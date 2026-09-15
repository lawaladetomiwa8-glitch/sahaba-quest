import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type FlutterwaveWebhook = {
  event?: string;
  type?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    amount?: number | string;
    charged_amount?: number | string;
    currency?: string;
    status?: string;
    payment_type?: string;
    created_at?: string;
    customer?: {
      email?: string;
      name?: string;
    };
  };
};

function addBillingPeriod(
  date: Date,
  billingInterval: string
): Date {
  const result = new Date(date);

  if (billingInterval === "monthly") {
    result.setMonth(result.getMonth() + 1);
  } else {
    result.setFullYear(result.getFullYear() + 1);
  }

  return result;
}

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // 1. Verify Flutterwave webhook secret
    // ---------------------------------------------------------

    const webhookSecret =
      process.env.FLW_WEBHOOK_SECRET_HASH;

    const receivedHash =
      request.headers.get("verif-hash");

    if (!webhookSecret) {
      console.error(
        "FLW_WEBHOOK_SECRET_HASH is not configured."
      );

      return NextResponse.json(
        { error: "Webhook configuration error" },
        { status: 500 }
      );
    }

    if (!receivedHash || receivedHash !== webhookSecret) {
      console.warn(
        "Rejected Flutterwave webhook: invalid signature."
      );

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 2. Read webhook payload
    // ---------------------------------------------------------

    const payload =
      (await request.json()) as FlutterwaveWebhook;

    const event =
      payload.event || payload.type || "";

    const data = payload.data;

    console.log(
      "Flutterwave webhook received:",
      event
    );

    // ---------------------------------------------------------
    // 3. Ignore events we don't currently need
    // ---------------------------------------------------------

    if (
      event !== "charge.completed" &&
      event !== "subscription.cancelled"
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    // =========================================================
    // 4. HANDLE CHARGE COMPLETED
    // =========================================================

    if (event === "charge.completed") {
      if (!data?.id) {
        console.warn(
          "Flutterwave charge webhook has no transaction ID."
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      const transactionId = data.id;

      // -------------------------------------------------------
      // 5. Get Flutterwave secret key
      // -------------------------------------------------------

      const flutterwaveSecretKey =
        process.env.FLUTTERWAVE_SECRET_KEY;

      if (!flutterwaveSecretKey) {
        console.error(
          "FLUTTERWAVE_SECRET_KEY is missing."
        );

        return NextResponse.json(
          { error: "Payment configuration error" },
          { status: 500 }
        );
      }

      // -------------------------------------------------------
      // 6. Verify transaction directly with Flutterwave
      // -------------------------------------------------------

      const verifyResponse = await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${flutterwaveSecretKey}`,
            "Content-Type": "application/json",
          },
        }
      );

      const verifyData =
        await verifyResponse.json();

      if (
        !verifyResponse.ok ||
        verifyData?.status !== "success" ||
        verifyData?.data?.status !== "successful"
      ) {
        console.warn(
          "Flutterwave transaction verification failed:",
          verifyData
        );

        return NextResponse.json({
          received: true,
          verified: false,
        });
      }

      const verifiedTransaction =
        verifyData.data;

      const txRef =
        verifiedTransaction.tx_ref;

      const amount =
        Number(verifiedTransaction.amount);

      const currency =
        verifiedTransaction.currency;

      const customerEmail =
        verifiedTransaction?.customer?.email ||
        data?.customer?.email;

      // -------------------------------------------------------
      // 7. Make sure transaction has a reference
      // -------------------------------------------------------

      if (!txRef) {
        console.warn(
          "Verified Flutterwave transaction has no tx_ref."
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      // -------------------------------------------------------
      // 8. Check whether this transaction already exists
      // -------------------------------------------------------

      const { data: existingPayment } =
        await supabaseServer
          .from("payment_transactions")
          .select(
            "id, user_id, plan_id, subscription_id, status, amount, currency, payment_type"
          )
          .eq(
            "transaction_reference",
            txRef
          )
          .maybeSingle();

      // =======================================================
      // 9. HANDLE FIRST SUBSCRIPTION PAYMENT
      // =======================================================

      if (existingPayment) {
        // Prevent duplicate webhook processing.
        if (
          existingPayment.status === "success"
        ) {
          return NextResponse.json({
            received: true,
            already_processed: true,
          });
        }

        // -----------------------------------------------------
        // Mark original payment as successful
        // -----------------------------------------------------

        const {
          error: updatePaymentError,
        } = await supabaseServer
          .from("payment_transactions")
          .update({
            status: "success",
            provider_transaction_id:
              String(transactionId),
            paid_at:
              verifiedTransaction.created_at ||
              new Date().toISOString(),
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            existingPayment.id
          );

        if (updatePaymentError) {
          console.error(
            "Could not update payment transaction:",
            updatePaymentError
          );

          return NextResponse.json(
            {
              error:
                "Could not update payment transaction",
            },
            { status: 500 }
          );
        }

        // -----------------------------------------------------
        // Update subscription if already linked
        // -----------------------------------------------------

        if (existingPayment.subscription_id) {
          const {
            error: subscriptionError,
          } = await supabaseServer
            .from("subscriptions")
            .update({
              status: "active",
              updated_at:
                new Date().toISOString(),
            })
            .eq(
              "id",
              existingPayment.subscription_id
            );

          if (subscriptionError) {
            console.error(
              "Could not update subscription:",
              subscriptionError
            );
          }
        }

        return NextResponse.json({
          received: true,
          processed: true,
        });
      }

      // =======================================================
      // 10. HANDLE RECURRING RENEWAL
      // =======================================================

      if (!customerEmail) {
        console.warn(
          "Recurring payment has no customer email."
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      // -------------------------------------------------------
      // 11. Find Sahaba Quest user by email
      // -------------------------------------------------------

      const {
        data: usersData,
        error: usersError,
      } =
        await supabaseServer.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

      if (usersError) {
        console.error(
          "Could not retrieve users:",
          usersError
        );

        return NextResponse.json(
          {
            error:
              "Could not identify customer",
          },
          { status: 500 }
        );
      }

      const matchingUser =
        usersData.users.find(
          (authUser) =>
            authUser.email?.toLowerCase() ===
            customerEmail.toLowerCase()
        );

      if (!matchingUser) {
        console.warn(
          "No Sahaba Quest user found for Flutterwave customer:",
          customerEmail
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      // =======================================================
      // 12. Find the user's subscription
      // =======================================================

      const {
        data: subscription,
        error: subscriptionLookupError,
      } =
        await supabaseServer
          .from("subscriptions")
          .select(
            `
            id,
            user_id,
            plan_id,
            status,
            current_period_start,
            current_period_end,
            created_at,
            subscription_plans (
              id,
              plan_type,
              billing_interval,
              currency,
              amount,
              flutterwave_plan_id
            )
          `
          )
          .eq(
            "user_id",
            matchingUser.id
          )
          .in("status", [
            "active",
            "cancelled",
            "expired",
          ])
          .order(
            "created_at",
            { ascending: false }
          )
          .limit(1)
          .maybeSingle();

      if (subscriptionLookupError) {
        console.error(
          "Subscription lookup error:",
          subscriptionLookupError
        );

        return NextResponse.json(
          {
            error:
              "Could not find subscription",
          },
          { status: 500 }
        );
      }

      if (!subscription) {
        console.warn(
          "No subscription found for user:",
          matchingUser.id
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      // -------------------------------------------------------
      // IMPORTANT:
      // Supabase can return joined relationship data as
      // either an object or an array depending on the
      // generated TypeScript relationship type.
      // -------------------------------------------------------

      const planData =
        subscription.subscription_plans;

      const plan = Array.isArray(planData)
        ? planData[0]
        : planData;

      if (!plan) {
        console.warn(
          "Subscription has no associated plan."
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      // =======================================================
      // 13. Verify amount and currency
      // =======================================================

      let expectedAmount =
        Number(plan.amount);

      if (plan.currency !== "NGN") {
        expectedAmount =
          expectedAmount / 100;
      }

      if (
        currency !== plan.currency ||
        Number(amount) !==
          Number(expectedAmount)
      ) {
        console.error(
          "Recurring payment amount/currency mismatch.",
          {
            receivedAmount: amount,
            expectedAmount,
            receivedCurrency: currency,
            expectedCurrency:
              plan.currency,
          }
        );

        return NextResponse.json({
          received: true,
          verified: false,
          reason:
            "amount_or_currency_mismatch",
        });
      }

      // =======================================================
      // 14. Create renewal payment transaction
      // =======================================================

      const {
        error: renewalPaymentError,
      } = await supabaseServer
        .from("payment_transactions")
        .insert({
          user_id:
            matchingUser.id,
          plan_id:
            subscription.plan_id,
          subscription_id:
            subscription.id,
          provider:
            "flutterwave",
          transaction_reference:
            txRef,
          provider_transaction_id:
            String(transactionId),
          amount:
            plan.amount,
          currency:
            plan.currency,
          status:
            "success",
          payment_type:
            "renewal",
          paid_at:
            verifiedTransaction.created_at ||
            new Date().toISOString(),
          metadata: {
            recurring: true,
            flutterwave_plan_id:
              plan.flutterwave_plan_id,
            customer_email:
              customerEmail,
          },
        });

      if (renewalPaymentError) {
        console.error(
          "Could not create renewal transaction:",
          renewalPaymentError
        );

        return NextResponse.json(
          {
            error:
              "Could not record renewal payment",
          },
          { status: 500 }
        );
      }

      // =======================================================
      // 15. Calculate new subscription period
      // =======================================================

      const now = new Date();

      const existingEnd =
        subscription.current_period_end
          ? new Date(
              subscription.current_period_end
            )
          : null;

      const periodStart =
        existingEnd &&
        existingEnd.getTime() >
          now.getTime()
          ? existingEnd
          : now;

      const newPeriodEnd =
        addBillingPeriod(
          periodStart,
          plan.billing_interval
        );

      // =======================================================
      // 16. Extend subscription
      // =======================================================

      const {
        error: updateSubscriptionError,
      } = await supabaseServer
        .from("subscriptions")
        .update({
          status:
            "active",
          current_period_start:
            periodStart.toISOString(),
          current_period_end:
            newPeriodEnd.toISOString(),
          cancelled_at:
            null,
          updated_at:
            now.toISOString(),
        })
        .eq(
          "id",
          subscription.id
        );

      if (updateSubscriptionError) {
        console.error(
          "Could not extend subscription:",
          updateSubscriptionError
        );

        return NextResponse.json(
          {
            error:
              "Could not extend subscription",
          },
          { status: 500 }
        );
      }

      console.log(
        "Sahaba Quest subscription renewed successfully:",
        {
          userId:
            matchingUser.id,
          subscriptionId:
            subscription.id,
          transactionId,
          newPeriodEnd:
            newPeriodEnd.toISOString(),
        }
      );

      return NextResponse.json({
        received: true,
        processed: true,
        renewed: true,
      });
    }

    // =========================================================
    // 17. HANDLE SUBSCRIPTION CANCELLED
    // =========================================================

    if (
      event === "subscription.cancelled"
    ) {
      const customerEmail =
        data?.customer?.email;

      if (!customerEmail) {
        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      // -------------------------------------------------------
      // Find user
      // -------------------------------------------------------

      const {
        data: usersData,
        error: usersError,
      } =
        await supabaseServer.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });

      if (usersError) {
        console.error(
          "Could not retrieve users:",
          usersError
        );

        return NextResponse.json(
          {
            error:
              "Could not identify customer",
          },
          { status: 500 }
        );
      }

      const matchingUser =
        usersData.users.find(
          (authUser) =>
            authUser.email?.toLowerCase() ===
            customerEmail.toLowerCase()
        );

      if (!matchingUser) {
        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      // -------------------------------------------------------
      // Mark subscription as cancelled.
      //
      // We intentionally keep current_period_end.
      // This allows us to respect the customer's remaining
      // paid access until the actual expiry date.
      // -------------------------------------------------------

      const {
        error: cancellationError,
      } = await supabaseServer
        .from("subscriptions")
        .update({
          status:
            "cancelled",
          cancelled_at:
            new Date().toISOString(),
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "user_id",
          matchingUser.id
        )
        .in("status", [
          "active",
          "cancelled",
        ]);

      if (cancellationError) {
        console.error(
          "Could not mark subscription as cancelled:",
          cancellationError
        );

        return NextResponse.json(
          {
            error:
              "Could not update subscription",
          },
          { status: 500 }
        );
      }

      console.log(
        "Sahaba Quest subscription cancelled:",
        matchingUser.id
      );

      return NextResponse.json({
        received: true,
        processed: true,
        cancelled: true,
      });
    }

    // ---------------------------------------------------------
    // 18. Default response
    // ---------------------------------------------------------

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error(
      "Flutterwave webhook error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Webhook processing error",
      },
      { status: 500 }
    );
  }
}