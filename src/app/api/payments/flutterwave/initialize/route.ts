import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase-server";

type PlanType = "plus" | "family";
type BillingInterval = "monthly" | "annual";
type Currency = "NGN" | "USD" | "GBP" | "EUR";
type AccountType = "free" | "individual" | "family";

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // 1. Get the user's access token
    // ---------------------------------------------------------

    const authorization = request.headers.get(
      "authorization"
    );

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const accessToken = authorization.replace(
      "Bearer ",
      ""
    );

    // ---------------------------------------------------------
    // 2. Verify the logged-in user
    // ---------------------------------------------------------

    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser(
      accessToken
    );

    if (userError || !user) {
      return NextResponse.json(
        {
          error: "Invalid or expired session",
        },
        {
          status: 401,
        }
      );
    }

    // ---------------------------------------------------------
    // 3. Get the user's actual account type
    // ---------------------------------------------------------

    const {
      data: profile,
      error: profileError,
    } = await supabaseServer
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "Could not retrieve user account type:",
        profileError
      );

      return NextResponse.json(
        {
          error:
            "Could not verify your account type. Please try again.",
        },
        {
          status: 500,
        }
      );
    }

    const accountType: AccountType =
      profile?.account_type === "individual" ||
      profile?.account_type === "family"
        ? profile.account_type
        : "free";

    // ---------------------------------------------------------
    // 4. Read payment request
    // ---------------------------------------------------------

    const body = await request.json();

    const {
      plan_type,
      billing_interval,
      currency,
    } = body as {
      plan_type?: string;
      billing_interval?: string;
      currency?: string;
    };

    // ---------------------------------------------------------
    // 5. Validate requested plan
    //
    // IMPORTANT:
    // "plus" = Individual
    // "family" = Family
    //
    // "school" / Organisation is intentionally NOT accepted.
    // ---------------------------------------------------------

    const validPlanTypes: PlanType[] = [
      "plus",
      "family",
    ];

    const validBillingIntervals: BillingInterval[] = [
      "monthly",
      "annual",
    ];

    const validCurrencies: Currency[] = [
      "NGN",
      "USD",
      "GBP",
      "EUR",
    ];

    if (
      !plan_type ||
      !validPlanTypes.includes(
        plan_type as PlanType
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid subscription plan. Organisation subscriptions are not currently available.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !billing_interval ||
      !validBillingIntervals.includes(
        billing_interval as BillingInterval
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid billing interval",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !currency ||
      !validCurrencies.includes(
        currency as Currency
      )
    ) {
      return NextResponse.json(
        {
          error: "Invalid currency",
        },
        {
          status: 400,
        }
      );
    }

    const requestedPlan =
      plan_type as PlanType;

    const requestedBillingInterval =
      billing_interval as BillingInterval;

    const requestedCurrency =
      currency as Currency;

    // ---------------------------------------------------------
    // 6. Enforce account upgrade rules
    //
    // plus   = Individual
    // family = Family
    // ---------------------------------------------------------

    if (
      accountType === "individual" &&
      requestedPlan === "plus"
    ) {
      return NextResponse.json(
        {
          error:
            "You already have an Individual Account.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      accountType === "family" &&
      requestedPlan === "family"
    ) {
      return NextResponse.json(
        {
          error:
            "You already have a Family Account.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      accountType === "family" &&
      requestedPlan === "plus"
    ) {
      return NextResponse.json(
        {
          error:
            "A Family Account cannot purchase an Individual subscription.",
        },
        {
          status: 400,
        }
      );
    }

    // Free users can purchase either plan.
    //
    // Individual users can upgrade to Family.
    //
    // Family users cannot downgrade to Individual.

    // ---------------------------------------------------------
    // 7. Get the matching subscription plan
    // ---------------------------------------------------------

    const {
      data: plan,
      error: planError,
    } = await supabaseServer
      .from("subscription_plans")
      .select(
        `
        id,
        plan_type,
        billing_interval,
        currency,
        amount,
        display_name,
        flutterwave_plan_id
        `
      )
      .eq(
        "plan_type",
        requestedPlan
      )
      .eq(
        "billing_interval",
        requestedBillingInterval
      )
      .eq(
        "currency",
        requestedCurrency
      )
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      console.error(
        "Subscription plan error:",
        planError
      );

      return NextResponse.json(
        {
          error:
            "Subscription plan not found",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // 8. Make sure Flutterwave secret key exists
    // ---------------------------------------------------------

    const flutterwaveSecretKey =
      process.env.FLUTTERWAVE_SECRET_KEY;

    if (!flutterwaveSecretKey) {
      console.error(
        "FLUTTERWAVE_SECRET_KEY is missing from environment variables."
      );

      return NextResponse.json(
        {
          error:
            "Payment configuration error",
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 9. Generate unique transaction reference
    // ---------------------------------------------------------

    const txRef = `SQ-${Date.now()}-${crypto
      .randomUUID()
      .slice(0, 8)}`;

    // ---------------------------------------------------------
    // 10. Convert stored amount to Flutterwave amount
    //
    // NGN = naira
    // USD / GBP / EUR = cents/pence
    // ---------------------------------------------------------

    let flutterwaveAmount = Number(
      plan.amount
    );

    if (requestedCurrency !== "NGN") {
      flutterwaveAmount =
        flutterwaveAmount / 100;
    }

    if (
      !Number.isFinite(flutterwaveAmount) ||
      flutterwaveAmount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid subscription amount",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // 11. Create pending payment transaction
    // ---------------------------------------------------------

    const {
      data: paymentTransaction,
      error: transactionError,
    } = await supabaseServer
      .from("payment_transactions")
      .insert({
        user_id: user.id,

        plan_id: plan.id,

        provider: "flutterwave",

        transaction_reference: txRef,

        amount: plan.amount,

        currency: requestedCurrency,

        status: "pending",

        payment_type: "subscription",

        metadata: {
          plan_type: requestedPlan,
          billing_interval:
            requestedBillingInterval,

          payment_mode: "one_time",

          flutterwave_plan_id:
            plan.flutterwave_plan_id,

          account_type_before_payment:
            accountType,
        },
      })
      .select("id")
      .single();

    if (
      transactionError ||
      !paymentTransaction
    ) {
      console.error(
        "Payment transaction creation error:",
        transactionError
      );

      return NextResponse.json(
        {
          error:
            "Could not create payment transaction",
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 12. Application URL
    // ---------------------------------------------------------

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    const redirectUrl =
      `${appUrl}/payment/flutterwave/callback`;

    // ---------------------------------------------------------
    // 13. Build Flutterwave checkout payload
    // ---------------------------------------------------------

    const payload = {
      tx_ref: txRef,

      amount: flutterwaveAmount,

      currency: requestedCurrency,

      redirect_url: redirectUrl,

      customer: {
        email:
          user.email ||
          "customer@sahabaquest.com",
      },

      customizations: {
        title: "Sahaba Quest",

        description:
          plan.display_name,

        logo: `${appUrl}/logo.png`,
      },

      meta: {
        user_id: user.id,

        plan_id: plan.id,

        plan_type:
          plan.plan_type,

        billing_interval:
          plan.billing_interval,

        payment_mode: "one_time",

        flutterwave_plan_id:
          plan.flutterwave_plan_id,

        payment_transaction_id:
          paymentTransaction.id,

        account_type_before_payment:
          accountType,
      },

      // -------------------------------------------------------
      // One-time checkout payment methods
      // -------------------------------------------------------

      payment_options:
        requestedCurrency === "NGN"
          ? "card,banktransfer,ussd,account"
          : "card",
    };

    // ---------------------------------------------------------
    // 14. Send payment request to Flutterwave
    // ---------------------------------------------------------

    const flutterwaveResponse =
      await fetch(
        "https://api.flutterwave.com/v3/payments",
        {
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${flutterwaveSecretKey}`,

            "Content-Type":
              "application/json",
          },

          body: JSON.stringify(
            payload
          ),
        }
      );

    const flutterwaveData =
      await flutterwaveResponse.json();

    // ---------------------------------------------------------
    // 15. Handle Flutterwave error
    // ---------------------------------------------------------

    if (
      !flutterwaveResponse.ok ||
      flutterwaveData.status !==
        "success"
    ) {
      console.error(
        "Flutterwave initialization error:",
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
            flutterwaveData.message ||
            "Could not initialize Flutterwave payment",
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 16. Get checkout URL
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
            "Flutterwave did not return a checkout URL",
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 17. Return checkout URL
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,

      checkout_url:
        checkoutUrl,

      transaction_reference:
        txRef,

      payment_mode:
        "one_time",
    });
  } catch (error) {
    console.error(
      "Flutterwave initialization unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while initializing payment",
      },
      {
        status: 500,
      }
    );
  }
}