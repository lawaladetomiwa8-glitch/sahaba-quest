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
     * 1. Find the payment transaction created by Sahaba Quest
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
      .eq(
        "transaction_reference",
        txRef
      )
      .maybeSingle();

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
     * 2. Verify the transaction directly with Flutterwave
     * ---------------------------------------------------------
     *
     * We intentionally do this even if our database says
     * the payment was already processed.
     *
     * The database function handles idempotency safely.
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

      /*
       * Only mark a currently pending payment as failed.
       *
       * We do not overwrite an already successful payment
       * with failed status.
       */
      if (
        paymentTransaction.status !==
        "success"
      ) {
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
      }

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
     * 3. Verify transaction ID
     * ---------------------------------------------------------
     */

    if (
      String(verified.id) !==
      String(transactionId)
    ) {
      console.error(
        "Flutterwave transaction ID mismatch:",
        {
          expected:
            String(transactionId),

          received:
            String(verified.id),
        }
      );

      return NextResponse.json(
        {
          error:
            "Transaction ID does not match the verified payment.",
        },
        { status: 400 }
      );
    }

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
     * 5. Verify payment status
     * ---------------------------------------------------------
     */

    if (
      verified.status !==
      "successful"
    ) {
      console.error(
        "Flutterwave payment is not successful:",
        {
          status:
            verified.status,
        }
      );

      return NextResponse.json(
        {
          error:
            "The Flutterwave transaction has not been completed successfully.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. Verify amount
     *
     * Database stores:
     *
     * NGN = naira
     * USD/GBP/EUR = cents/pence
     *
     * Flutterwave receives the actual checkout amount.
     * ---------------------------------------------------------
     */

    let expectedAmount =
      Number(paymentTransaction.amount);

    if (
      paymentTransaction.currency !==
      "NGN"
    ) {
      expectedAmount =
        expectedAmount / 100;
    }

    const verifiedAmount =
      Number(verified.amount);

    const amountMatches =
      verifiedAmount >=
      expectedAmount;

    /*
     * ---------------------------------------------------------
     * 7. Verify currency
     * ---------------------------------------------------------
     */

    const currencyMatches =
      verified.currency ===
      paymentTransaction.currency;

    if (
      !amountMatches ||
      !currencyMatches
    ) {
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
        }
      );

      /*
       * Do not overwrite an already-successful payment.
       */
      if (
        paymentTransaction.status !==
        "success"
      ) {
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
      }

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
     * 8. Atomically process the verified payment
     * ---------------------------------------------------------
     *
     * process_verified_payment() handles:
     *
     * - payment locking
     * - duplicate protection
     * - payment success
     * - subscription creation
     * - subscription extension
     * - payment → subscription linking
     * - Individual account activation
     * - Family account activation
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

    /*
     * ---------------------------------------------------------
     * 9. Return successful result
     * ---------------------------------------------------------
     */

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