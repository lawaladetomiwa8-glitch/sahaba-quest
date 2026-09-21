import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const txRef = body.tx_ref;
    const transactionId = body.transaction_id;

    if (!txRef || !transactionId) {
      return NextResponse.json(
        {
          error:
            "Transaction reference and transaction ID are required.",
        },
        { status: 400 }
      );
    }

    const flutterwaveSecretKey =
      process.env.FLUTTERWAVE_SECRET_KEY;

    if (!flutterwaveSecretKey) {
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
     * ---------------------------------------------------------
     * 1. Find the payment transaction created during checkout
     * ---------------------------------------------------------
     */
    const {
      data: paymentTransaction,
      error: transactionLookupError,
    } = await supabaseServer
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
      .eq("transaction_reference", txRef)
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
     * ---------------------------------------------------------
     * 2. If this payment has already been processed,
     *    return the existing subscription.
     *
     * This is a quick response optimization.
     *
     * The database function remains the authoritative
     * idempotency protection.
     * ---------------------------------------------------------
     */
    if (
      paymentTransaction.status === "success" &&
      paymentTransaction.subscription_id
    ) {
      const {
        data: existingSubscription,
        error: existingSubscriptionError,
      } = await supabaseServer
        .from("subscriptions")
        .select(
          `
          id,
          current_period_end,
          subscription_plans (
            plan_type,
            billing_interval,
            currency
          )
          `
        )
        .eq(
          "id",
          paymentTransaction.subscription_id
        )
        .maybeSingle();

      if (
        existingSubscriptionError ||
        !existingSubscription
      ) {
        console.error(
          "Existing subscription lookup failed:",
          existingSubscriptionError
        );

        return NextResponse.json(
          {
            error:
              "Payment was already processed, but the subscription could not be loaded.",
          },
          { status: 500 }
        );
      }

      const planData =
        existingSubscription.subscription_plans;

      const plan = Array.isArray(planData)
        ? planData[0]
        : planData;

      return NextResponse.json({
        success: true,
        already_processed: true,
        subscription_id:
          existingSubscription.id,
        plan_type:
          plan?.plan_type || "",
        billing_interval:
          plan?.billing_interval || "",
        currency:
          plan?.currency ||
          paymentTransaction.currency,
        current_period_end:
          existingSubscription.current_period_end,
      });
    }

    /*
     * ---------------------------------------------------------
     * 3. Verify the transaction directly with Flutterwave
     * ---------------------------------------------------------
     */
    const flutterwaveResponse =
      await fetch(
        `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
        {
          method: "GET",
          headers: {
            Authorization:
              `Bearer ${flutterwaveSecretKey}`,
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
      flutterwaveData.status !== "success"
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
     * ---------------------------------------------------------
     * 4. Verify transaction reference
     * ---------------------------------------------------------
     */
    if (
      verified.tx_ref !==
      paymentTransaction.transaction_reference
    ) {
      console.error(
        "Transaction reference mismatch:",
        {
          expected:
            paymentTransaction.transaction_reference,
          received:
            verified.tx_ref,
        }
      );

      return NextResponse.json(
        {
          error:
            "Transaction reference does not match.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. Verify amount
     *
     * Database stores:
     *
     * NGN = naira
     * USD/GBP/EUR = cents/pence
     *
     * Flutterwave receives:
     *
     * NGN 1500
     * USD 2.99
     * GBP 2.49
     * EUR 2.99
     * ---------------------------------------------------------
     */
    let expectedAmount =
      Number(paymentTransaction.amount);

    if (
      paymentTransaction.currency !== "NGN"
    ) {
      expectedAmount =
        expectedAmount / 100;
    }

    const verifiedAmount =
      Number(verified.amount);

    const amountMatches =
      verifiedAmount >= expectedAmount;

    const currencyMatches =
      verified.currency ===
      paymentTransaction.currency;

    const paymentSuccessful =
      verified.status === "successful" &&
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
            "Payment verification failed. The payment details did not match the expected transaction.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Atomically process the verified payment
     *
     * The database function:
     *
     * - locks the payment row
     * - prevents duplicate processing
     * - creates one subscription when needed
     * - extends an existing active subscription
     * - starts from now when the old subscription expired
     * - links the payment to the subscription
     * ---------------------------------------------------------
     */
    const {
      data: processedPayment,
      error: processError,
    } = await supabaseServer.rpc(
      "process_verified_payment",
      {
        p_payment_transaction_id:
          paymentTransaction.id,

        p_provider_transaction_id:
          String(verified.id),

        p_paid_at:
          verified.created_at ||
          new Date().toISOString(),
      }
    );

    if (
      processError ||
      !processedPayment ||
      processedPayment.length === 0
    ) {
      console.error(
        "Verified payment processing failed:",
        processError
      );

      return NextResponse.json(
        {
          error:
            "Payment was verified, but we could not activate the subscription. Please contact support if you were charged.",
        },
        { status: 500 }
      );
    }

    const result =
      processedPayment[0];

    return NextResponse.json({
      success: true,

      already_processed:
        result.already_processed,

      subscription_id:
        result.subscription_id,

      plan_type:
        result.plan_type,

      billing_interval:
        result.billing_interval,

      currency:
        result.currency,

      current_period_end:
        result.current_period_end,
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