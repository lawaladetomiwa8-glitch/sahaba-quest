import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase-server";

function getPeriodEnd(
  interval: "monthly" | "annual"
) {
  const date = new Date();

  if (interval === "monthly") {
    date.setMonth(date.getMonth() + 1);
  } else {
    date.setFullYear(
      date.getFullYear() + 1
    );
  }

  return date.toISOString();
}

export async function POST(
  request: Request
) {
  try {
    const body = await request.json();

    const txRef = body.tx_ref;
    const transactionId =
      body.transaction_id;

    if (!txRef || !transactionId) {
      return NextResponse.json(
        {
          error:
            "Transaction reference and transaction ID are required.",
        },
        { status: 400 }
      );
    }

    if (
      !process.env.FLUTTERWAVE_SECRET_KEY
    ) {
      console.error(
        "FLUTTERWAVE_SECRET_KEY is missing."
      );

      return NextResponse.json(
        {
          error:
            "Flutterwave server configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    /*
     * Find the transaction we created
     * before sending the user to Flutterwave.
     */
    const {
      data: paymentTransaction,
      error: transactionLookupError,
    } =
      await supabaseServer
        .from("payment_transactions")
        .select(
          `
          id,
          user_id,
          plan_id,
          subscription_id,
          transaction_reference,
          amount,
          currency,
          status
        `
        )
        .eq(
          "transaction_reference",
          txRef
        )
        .single();

    if (
      transactionLookupError ||
      !paymentTransaction
    ) {
      console.error(
        "Payment transaction not found:",
        transactionLookupError
      );

      return NextResponse.json(
        {
          error:
            "Payment transaction could not be found.",
        },
        { status: 404 }
      );
    }

    /*
     * Verify the transaction directly
     * with Flutterwave.
     */
    const flutterwaveResponse =
      await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,

            "Content-Type":
              "application/json",
          },

          cache: "no-store",
        }
      );

    const flutterwaveData =
      await flutterwaveResponse.json();

    if (
      !flutterwaveResponse.ok ||
      flutterwaveData.status !==
        "success"
    ) {
      console.error(
        "Flutterwave verification failed:",
        flutterwaveData
      );

      await supabaseServer
        .from("payment_transactions")
        .update({
          status: "failed",
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          paymentTransaction.id
        );

      return NextResponse.json(
        {
          error:
            "Flutterwave could not verify this payment.",
        },
        { status: 400 }
      );
    }

    const verified =
      flutterwaveData.data;

    /*
     * Make sure the payment belongs
     * to the transaction we created.
     */
    if (
      verified.tx_ref !==
      paymentTransaction.transaction_reference
    ) {
      return NextResponse.json(
        {
          error:
            "Transaction reference does not match.",
        },
        { status: 400 }
      );
    }

    /*
     * The stored database amount uses:
     *
     * NGN 1500
     * USD 299 cents
     * GBP 249 pence
     * EUR 299 cents
     *
     * Flutterwave receives:
     *
     * NGN 1500
     * USD 2.99
     * GBP 2.49
     * EUR 2.99
     */
    let expectedAmount =
      paymentTransaction.amount;

    if (
      paymentTransaction.currency !==
      "NGN"
    ) {
      expectedAmount =
        paymentTransaction.amount / 100;
    }

    const amountMatches =
      Number(verified.amount) >=
      Number(expectedAmount);

    const currencyMatches =
      verified.currency ===
      paymentTransaction.currency;

    const paymentSuccessful =
      verified.status ===
        "successful" &&
      amountMatches &&
      currencyMatches;

    if (!paymentSuccessful) {
      console.error(
        "Payment verification mismatch:",
        {
          expectedAmount,
          expectedCurrency:
            paymentTransaction.currency,
          verifiedAmount:
            verified.amount,
          verifiedCurrency:
            verified.currency,
          verifiedStatus:
            verified.status,
        }
      );

      await supabaseServer
        .from("payment_transactions")
        .update({
          status:
            verified.status ===
            "successful"
              ? "failed"
              : "failed",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          paymentTransaction.id
        );

      return NextResponse.json(
        {
          error:
            "Payment verification failed. The payment details did not match the expected transaction.",
        },
        { status: 400 }
      );
    }

    /*
     * Mark the payment as successful.
     */
    const {
      error: paymentUpdateError,
    } =
      await supabaseServer
        .from("payment_transactions")
        .update({
          status: "success",

          provider_transaction_id:
            String(verified.id),

          paid_at:
            new Date().toISOString(),

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          paymentTransaction.id
        );

    if (paymentUpdateError) {
      console.error(
        "Could not update payment transaction:",
        paymentUpdateError
      );

      return NextResponse.json(
        {
          error:
            "Payment was verified but could not be recorded.",
        },
        { status: 500 }
      );
    }

    /*
     * Get the selected subscription plan.
     */
    const {
      data: plan,
      error: planError,
    } =
      await supabaseServer
        .from("subscription_plans")
        .select(
          `
          id,
          plan_type,
          billing_interval,
          currency,
          amount,
          display_name
        `
        )
        .eq(
          "id",
          paymentTransaction.plan_id
        )
        .single();

    if (
      planError ||
      !plan
    ) {
      console.error(
        "Subscription plan not found:",
        planError
      );

      return NextResponse.json(
        {
          error:
            "Payment succeeded, but the subscription plan could not be found.",
        },
        { status: 500 }
      );
    }

    /*
     * Check whether an active subscription
     * already exists for this payment.
     *
     * This prevents duplicate subscriptions
     * if the callback is refreshed.
     */
    if (
      paymentTransaction.subscription_id
    ) {
      return NextResponse.json({
        success: true,

        already_processed: true,

        subscription_id:
          paymentTransaction.subscription_id,
      });
    }

    /*
     * Create the user's active entitlement.
     */
    const now =
      new Date();

    const periodEnd =
      getPeriodEnd(
        plan.billing_interval
      );

    const {
      data: subscription,
      error: subscriptionError,
    } =
      await supabaseServer
        .from("subscriptions")
        .insert({
          user_id:
            paymentTransaction.user_id,

          plan_id:
            plan.id,

          status:
            "active",

          provider:
            "flutterwave",

          provider_customer_code:
            null,

          provider_subscription_code:
            txRef,

          start_date:
            now.toISOString(),

          current_period_start:
            now.toISOString(),

          current_period_end:
            periodEnd,

          created_at:
            now.toISOString(),

          updated_at:
            now.toISOString(),
        })
        .select("id")
        .single();

    if (
      subscriptionError ||
      !subscription
    ) {
      console.error(
        "Subscription creation error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          error:
            "Payment succeeded, but the subscription could not be activated.",
        },
        { status: 500 }
      );
    }

    /*
     * Link the successful payment
     * to the new subscription.
     */
    const {
      error:
        subscriptionLinkError,
    } =
      await supabaseServer
        .from("payment_transactions")
        .update({
          subscription_id:
            subscription.id,

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          paymentTransaction.id
        );

    if (
      subscriptionLinkError
    ) {
      console.error(
        "Could not link subscription to payment:",
        subscriptionLinkError
      );
    }

    return NextResponse.json({
      success: true,

      already_processed: false,

      subscription_id:
        subscription.id,

      plan_type:
        plan.plan_type,

      billing_interval:
        plan.billing_interval,

      currency:
        plan.currency,

      current_period_end:
        periodEnd,
    });
  } catch (error) {
    console.error(
      "Payment verification error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Something went wrong while verifying the payment.",
      },
      { status: 500 }
    );
  }
}