import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type FlutterwaveWebhook = {
  event?: string;
  type?: string;
  data?: {
    id?: number | string;
    tx_ref?: string;
    amount?: number | string;
    currency?: string;
    status?: string;
    created_at?: string;
  };
};

export async function POST(request: NextRequest) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Verify Flutterwave webhook signature
     * ---------------------------------------------------------
     */
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

    if (
      !receivedHash ||
      receivedHash !== webhookSecret
    ) {
      console.warn(
        "Rejected Flutterwave webhook: invalid signature."
      );

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 2. Read webhook payload
     * ---------------------------------------------------------
     */
    const payload =
      (await request.json()) as FlutterwaveWebhook;

    const event =
      payload.event ||
      payload.type ||
      "";

    const data = payload.data;

    console.log(
      "Flutterwave webhook received:",
      event
    );

    /*
     * ---------------------------------------------------------
     * 3. We currently process:
     *
     * charge.completed
     * subscription.cancelled
     *
     * Recurring renewal processing is intentionally not
     * handled here because our current checkout creates
     * one-time payments.
     * ---------------------------------------------------------
     */
    if (
      event !== "charge.completed" &&
      event !== "subscription.cancelled"
    ) {
      return NextResponse.json({
        received: true,
        ignored: true,
      });
    }

    /*
     * =========================================================
     * 4. HANDLE CHARGE COMPLETED
     * =========================================================
     */
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

      const transactionId =
        data.id;

      const flutterwaveSecretKey =
        process.env.FLUTTERWAVE_SECRET_KEY;

      if (!flutterwaveSecretKey) {
        console.error(
          "FLUTTERWAVE_SECRET_KEY is missing."
        );

        return NextResponse.json(
          {
            error:
              "Payment configuration error",
          },
          { status: 500 }
        );
      }

      /*
       * -------------------------------------------------------
       * 5. Verify the transaction directly with Flutterwave
       * -------------------------------------------------------
       */
      const verifyResponse =
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

      const verifyData =
        await verifyResponse.json();

      if (
        !verifyResponse.ok ||
        verifyData?.status !== "success" ||
        verifyData?.data?.status !==
          "successful"
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

      if (!txRef) {
        console.warn(
          "Verified Flutterwave transaction has no tx_ref."
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      /*
       * -------------------------------------------------------
       * 6. Find the payment transaction created by Sahaba Quest
       * -------------------------------------------------------
       */
      const {
        data: paymentTransaction,
        error: paymentLookupError,
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
        paymentLookupError
      ) {
        console.error(
          "Payment transaction lookup failed:",
          paymentLookupError
        );

        return NextResponse.json(
          {
            error:
              "Could not find payment transaction",
          },
          { status: 500 }
        );
      }

      /*
       * This is important.
       *
       * We only process payments that were initialized
       * by Sahaba Quest.
       */
      if (!paymentTransaction) {
        console.warn(
          "No Sahaba Quest payment transaction found for tx_ref:",
          txRef
        );

        return NextResponse.json({
          received: true,
          ignored: true,
        });
      }

      /*
       * -------------------------------------------------------
       * 7. Verify the transaction reference
       * -------------------------------------------------------
       */
      if (
        verifiedTransaction.tx_ref !==
        paymentTransaction.transaction_reference
      ) {
        console.error(
          "Webhook transaction reference mismatch."
        );

        return NextResponse.json({
          received: true,
          verified: false,
        });
      }

      /*
       * -------------------------------------------------------
       * 8. Verify amount and currency
       * -------------------------------------------------------
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
        Number(verifiedTransaction.amount);

      const amountMatches =
        verifiedAmount >=
        expectedAmount;

      const currencyMatches =
        verifiedTransaction.currency ===
        paymentTransaction.currency;

      if (
        !amountMatches ||
        !currencyMatches
      ) {
        console.error(
          "Webhook payment amount/currency mismatch:",
          {
            expectedAmount,
            expectedCurrency:
              paymentTransaction.currency,
            verifiedAmount,
            verifiedCurrency:
              verifiedTransaction.currency,
          }
        );

        return NextResponse.json({
          received: true,
          verified: false,
          reason:
            "amount_or_currency_mismatch",
        });
      }

      /*
       * -------------------------------------------------------
       * 9. Atomically process the payment
       * -------------------------------------------------------
       *
       * The same PostgreSQL function used by the callback
       * is used here.
       *
       * This protects us when:
       *
       * callback + webhook
       *
       * arrive at nearly the same time.
       */
      const {
        data: processedPayment,
        error: processError,
      } =
        await supabaseServer.rpc(
          "process_verified_payment",
          {
            p_payment_transaction_id:
              paymentTransaction.id,

            p_provider_transaction_id:
              String(
                verifiedTransaction.id
              ),

            p_paid_at:
              verifiedTransaction.created_at ||
              new Date().toISOString(),
          }
        );

      if (
        processError ||
        !processedPayment ||
        processedPayment.length === 0
      ) {
        console.error(
          "Verified webhook payment processing failed:",
          processError
        );

        return NextResponse.json(
          {
            error:
              "Payment was verified but could not be processed.",
          },
          { status: 500 }
        );
      }

      const result =
        processedPayment[0];

      console.log(
        "Flutterwave payment processed:",
        {
          txRef,
          transactionId:
            String(
              verifiedTransaction.id
            ),
          subscriptionId:
            result.subscription_id,
          alreadyProcessed:
            result.already_processed,
        }
      );

      return NextResponse.json({
        received: true,
        processed: true,
        already_processed:
          result.already_processed,
        subscription_id:
          result.subscription_id,
      });
    }

    /*
     * =========================================================
     * 10. HANDLE SUBSCRIPTION CANCELLED
     * =========================================================
     *
     * This is kept for compatibility with Flutterwave
     * subscription events.
     *
     * Our current checkout is one-time, so this event is
     * not responsible for normal monthly/annual expiry.
     */
    if (
      event === "subscription.cancelled"
    ) {
      const customerEmail =
        undefined;

      /*
       * We intentionally do not use the old email-based
       * cancellation logic here.
       *
       * One user may eventually have:
       *
       * Individual
       * Family
       * Organisation
       *
       * subscriptions simultaneously.
       *
       * Automatically cancelling all subscriptions belonging
       * to an email would therefore be unsafe.
       */
      console.log(
        "Flutterwave subscription.cancelled received. No automatic entitlement cancellation performed.",
        customerEmail
      );

      return NextResponse.json({
        received: true,
        processed: false,
        ignored: true,
      });
    }

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