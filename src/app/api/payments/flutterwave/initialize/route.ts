import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // 1. Get the user's access token
    // ---------------------------------------------------------
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const accessToken = authorization.replace("Bearer ", "");

    // ---------------------------------------------------------
    // 2. Verify the logged-in user
    // ---------------------------------------------------------
    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired session" },
        { status: 401 }
      );
    }

    // ---------------------------------------------------------
    // 3. Read payment request
    // ---------------------------------------------------------
    const body = await request.json();

    const {
      plan_type,
      billing_interval,
      currency,
    } = body;

    // ---------------------------------------------------------
    // 4. Validate payment details
    // ---------------------------------------------------------
    const validPlanTypes = ["plus", "family", "school"];
    const validBillingIntervals = ["monthly", "annual"];
    const validCurrencies = ["NGN", "USD", "GBP", "EUR"];

    if (!validPlanTypes.includes(plan_type)) {
      return NextResponse.json(
        { error: "Invalid subscription plan" },
        { status: 400 }
      );
    }

    if (!validBillingIntervals.includes(billing_interval)) {
      return NextResponse.json(
        { error: "Invalid billing interval" },
        { status: 400 }
      );
    }

    if (!validCurrencies.includes(currency)) {
      return NextResponse.json(
        { error: "Invalid currency" },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 5. Get the matching subscription plan
    // ---------------------------------------------------------
    const { data: plan, error: planError } = await supabaseServer
      .from("subscription_plans")
      .select(
        "id, plan_type, billing_interval, currency, amount, display_name, flutterwave_plan_id"
      )
      .eq("plan_type", plan_type)
      .eq("billing_interval", billing_interval)
      .eq("currency", currency)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error("Subscription plan error:", planError);

      return NextResponse.json(
        { error: "Subscription plan not found" },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // 6. Make sure the plan is connected to Flutterwave
    // ---------------------------------------------------------
    if (!plan.flutterwave_plan_id) {
      return NextResponse.json(
        {
          error:
            "This subscription plan is not connected to Flutterwave yet.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 7. Make sure Flutterwave secret key exists
    // ---------------------------------------------------------
    const flutterwaveSecretKey =
      process.env.FLUTTERWAVE_SECRET_KEY;

    if (!flutterwaveSecretKey) {
      console.error(
        "FLUTTERWAVE_SECRET_KEY is missing from environment variables."
      );

      return NextResponse.json(
        { error: "Payment configuration error" },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 8. Generate unique transaction reference
    // ---------------------------------------------------------
    const txRef = `SQ-${Date.now()}-${crypto.randomUUID().slice(
      0,
      8
    )}`;

    // ---------------------------------------------------------
    // 9. Convert stored amount to Flutterwave amount
    //
    // NGN is stored directly in naira.
    // USD / GBP / EUR are stored in cents/pence.
    // ---------------------------------------------------------
    let flutterwaveAmount = Number(plan.amount);

    if (currency !== "NGN") {
      flutterwaveAmount = flutterwaveAmount / 100;
    }

    // ---------------------------------------------------------
    // 10. Create pending payment transaction
    // ---------------------------------------------------------
    const { data: paymentTransaction, error: transactionError } =
      await supabaseServer
        .from("payment_transactions")
        .insert({
          user_id: user.id,
          plan_id: plan.id,
          provider: "flutterwave",
          transaction_reference: txRef,
          amount: plan.amount,
          currency: currency,
          status: "pending",
          payment_type: "subscription",
          metadata: {
            plan_type,
            billing_interval,
            flutterwave_plan_id: plan.flutterwave_plan_id,
          },
        })
        .select("id")
        .single();

    if (transactionError || !paymentTransaction) {
      console.error(
        "Payment transaction creation error:",
        transactionError
      );

      return NextResponse.json(
        { error: "Could not create payment transaction" },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 11. Get application URL
    // ---------------------------------------------------------
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const redirectUrl =
      `${appUrl}/payment/flutterwave/callback`;

    // ---------------------------------------------------------
    // 12. Build Flutterwave recurring payment request
    // ---------------------------------------------------------
    const payload = {
      tx_ref: txRef,

      amount: flutterwaveAmount,

      currency: currency,

      redirect_url: redirectUrl,

      // This connects the first payment to the
      // recurring Flutterwave Payment Plan.
      payment_plan: Number(plan.flutterwave_plan_id),

      // Flutterwave Payment Plans currently use card payments.
      payment_options: "card",

      customer: {
        email: user.email,
      },

      customizations: {
        title: "Sahaba Quest",
        description: plan.display_name,
        logo: `${appUrl}/logo.png`,
      },

      meta: {
        user_id: user.id,
        plan_id: plan.id,
        plan_type: plan.plan_type,
        billing_interval: plan.billing_interval,
        flutterwave_plan_id: plan.flutterwave_plan_id,
        payment_transaction_id: paymentTransaction.id,
      },
    };

    // ---------------------------------------------------------
    // 13. Send payment request to Flutterwave
    // ---------------------------------------------------------
    const flutterwaveResponse = await fetch(
      "https://api.flutterwave.com/v3/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${flutterwaveSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    const flutterwaveData =
      await flutterwaveResponse.json();

    // ---------------------------------------------------------
    // 14. Handle Flutterwave error
    // ---------------------------------------------------------
    if (
      !flutterwaveResponse.ok ||
      flutterwaveData.status !== "success"
    ) {
      console.error(
        "Flutterwave initialization error:",
        flutterwaveData
      );

      // Mark our transaction as failed
      await supabaseServer
        .from("payment_transactions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentTransaction.id);

      return NextResponse.json(
        {
          error:
            flutterwaveData.message ||
            "Could not initialize Flutterwave payment",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 15. Return checkout URL to frontend
    // ---------------------------------------------------------
    const checkoutUrl =
      flutterwaveData?.data?.link;

    if (!checkoutUrl) {
      console.error(
        "Flutterwave did not return a checkout URL:",
        flutterwaveData
      );

      await supabaseServer
        .from("payment_transactions")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentTransaction.id);

      return NextResponse.json(
        { error: "Flutterwave did not return a checkout URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      checkout_url: checkoutUrl,
      transaction_reference: txRef,
    });
  } catch (error) {
    console.error(
      "Flutterwave initialization unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error: "An unexpected error occurred while initializing payment",
      },
      { status: 500 }
    );
  }
}