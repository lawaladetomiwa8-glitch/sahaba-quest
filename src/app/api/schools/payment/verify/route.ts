import { NextResponse } from "next/server";

import { supabaseServer } from "../../../../../lib/supabase-server";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const txRef = body?.tx_ref;
    const transactionId = body?.transaction_id;

    if (!txRef || !transactionId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction reference and transaction ID are required.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. Flutterwave secret key
    // ---------------------------------------------------------

    const flutterwaveSecretKey =
      process.env.FLUTTERWAVE_SECRET_KEY;

    if (!flutterwaveSecretKey) {
      console.error(
        "FLUTTERWAVE_SECRET_KEY is missing."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Payment configuration error.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 2. Find the SCHOOL payment transaction
    //
    // IMPORTANT:
    // We intentionally do NOT use payment_transactions.
    // ---------------------------------------------------------

    const {
      data: schoolPayment,
      error: paymentLookupError,
    } = await supabaseServer
      .from("school_payment_transactions")
      .select(
        `
          id,
          school_id,
          pricing_id,
          transaction_reference,
          currency,
          billing_interval,
          student_seat_limit,
          price_per_student,
          total_amount,
          status
        `
      )
      .eq("transaction_reference", txRef)
      .maybeSingle();

    if (paymentLookupError) {
      console.error(
        "School payment lookup failed:",
        paymentLookupError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Could not find school payment transaction.",
        },
        { status: 500 }
      );
    }

    if (!schoolPayment) {
      return NextResponse.json(
        {
          success: false,
          error:
            "School payment transaction could not be found.",
        },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 3. Verify directly with Flutterwave
    // ---------------------------------------------------------

    const flutterwaveResponse = await fetch(
      `https://api.flutterwave.com/v3/transactions/${encodeURIComponent(
        String(transactionId)
      )}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${flutterwaveSecretKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );

    const flutterwaveData =
      await flutterwaveResponse.json();

    if (
      !flutterwaveResponse.ok ||
      flutterwaveData?.status !== "success" ||
      !flutterwaveData?.data
    ) {
      console.error(
        "Flutterwave school payment verification failed:",
        flutterwaveData
      );

      if (schoolPayment.status !== "success") {
        await supabaseServer
          .from("school_payment_transactions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", schoolPayment.id);
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "Flutterwave could not verify this payment.",
        },
        { status: 400 }
      );
    }

    const verified = flutterwaveData.data;

    // ---------------------------------------------------------
    // 4. Verify transaction ID
    // ---------------------------------------------------------

    if (
      String(verified.id) !==
      String(transactionId)
    ) {
      console.error(
        "School payment transaction ID mismatch:",
        {
          expected: String(transactionId),
          received: String(verified.id),
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction ID does not match.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 5. Verify transaction reference
    // ---------------------------------------------------------

    if (
      verified.tx_ref !==
      schoolPayment.transaction_reference
    ) {
      console.error(
        "School payment transaction reference mismatch:",
        {
          expected:
            schoolPayment.transaction_reference,
          received: verified.tx_ref,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Transaction reference does not match.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 6. Verify payment status
    // ---------------------------------------------------------

    if (verified.status !== "successful") {
      console.error(
        "School Flutterwave payment is not successful:",
        {
          status: verified.status,
        }
      );

      if (schoolPayment.status !== "success") {
        await supabaseServer
          .from("school_payment_transactions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", schoolPayment.id);
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "The payment was not completed successfully.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 7. Verify currency
    // ---------------------------------------------------------

    const expectedCurrency =
      schoolPayment.currency;

    const verifiedCurrency =
      verified.currency;

    if (
      verifiedCurrency !== expectedCurrency
    ) {
      console.error(
        "School payment currency mismatch:",
        {
          expected: expectedCurrency,
          received: verifiedCurrency,
        }
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Payment currency does not match.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 8. Verify amount
    //
    // Database:
    // NGN = naira
    // USD/GBP/EUR = minor units
    //
    // Flutterwave:
    // actual major-unit checkout amount
    // ---------------------------------------------------------

    let expectedFlutterwaveAmount =
      Number(schoolPayment.total_amount);

    if (expectedCurrency !== "NGN") {
      expectedFlutterwaveAmount =
        expectedFlutterwaveAmount / 100;
    }

    const verifiedAmount =
      Number(verified.amount);

    if (
      !Number.isFinite(expectedFlutterwaveAmount) ||
      !Number.isFinite(verifiedAmount) ||
      verifiedAmount <
        expectedFlutterwaveAmount
    ) {
      console.error(
        "School payment amount mismatch:",
        {
          expectedAmount:
            expectedFlutterwaveAmount,
          verifiedAmount,
          currency:
            expectedCurrency,
        }
      );

      if (schoolPayment.status !== "success") {
        await supabaseServer
          .from("school_payment_transactions")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", schoolPayment.id);
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "Payment amount does not match the expected amount.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 9. Atomically process the verified SCHOOL payment
    //
    // This is completely separate from:
    // process_verified_payment()
    // ---------------------------------------------------------

    const {
      data: processedPayment,
      error: processError,
    } = await supabaseServer.rpc(
      "process_verified_school_payment",
      {
        p_school_payment_transaction_id:
          schoolPayment.id,

        p_provider_transaction_id:
          String(verified.id),

        p_paid_at:
          verified.created_at ||
          new Date().toISOString(),
      }
    );

    if (processError) {
      console.error(
        "School payment processing failed:",
        processError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Payment was verified but could not be processed.",
        },
        { status: 500 }
      );
    }

    if (
      !processedPayment ||
      processedPayment.length === 0
    ) {
      console.error(
        "School payment RPC returned no result."
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Payment processing returned no result.",
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

      school_id:
        result.school_id,

      school_subscription_id:
        result.school_subscription_id,

      school_status:
        result.school_status,

      billing_interval:
        result.billing_interval,

      currency:
        result.currency,

      student_seat_limit:
        result.student_seat_limit,

      total_amount:
        result.total_amount,

      current_period_end:
        result.current_period_end,
    });
  } catch (error) {
    console.error(
      "Unexpected school payment verification error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while verifying the payment.",
      },
      { status: 500 }
    );
  }
}