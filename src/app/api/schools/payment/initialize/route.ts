import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase-server";

type BillingInterval = "monthly" | "termly";
type Currency = "NGN" | "USD" | "GBP" | "EUR";

export async function POST(request: NextRequest) {
  try {
    // ---------------------------------------------------------
    // 1. Get the user's access token
    // ---------------------------------------------------------

    const authorization = request.headers.get("authorization");

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
        {
          error: "Invalid or expired session",
        },
        {
          status: 401,
        }
      );
    }

    // ---------------------------------------------------------
    // 3. Read request
    // ---------------------------------------------------------

    const body = await request.json();

    const {
      school_id,
      student_seat_limit,
      billing_interval,
      currency,
    } = body as {
      school_id?: string;
      student_seat_limit?: number;
      billing_interval?: string;
      currency?: string;
    };

    // ---------------------------------------------------------
    // 4. Validate school ID
    // ---------------------------------------------------------

    if (!school_id) {
      return NextResponse.json(
        {
          error: "School ID is required",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // 5. Validate seat count
    // ---------------------------------------------------------

    if (
      typeof student_seat_limit !== "number" ||
      !Number.isInteger(student_seat_limit) ||
      student_seat_limit <= 0
    ) {
      return NextResponse.json(
        {
          error: "Student seat limit must be a positive whole number",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Prevent unreasonable values from reaching the payment system.
     *
     * This is only a payment safety boundary.
     * The actual subscription seat limit is stored in the database.
     */

    if (student_seat_limit > 100000) {
      return NextResponse.json(
        {
          error: "Student seat limit is too large",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // 6. Validate billing interval
    // ---------------------------------------------------------

    const validBillingIntervals: BillingInterval[] = [
      "monthly",
      "termly",
    ];

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

    // ---------------------------------------------------------
    // 7. Validate currency
    // ---------------------------------------------------------

    const validCurrencies: Currency[] = [
      "NGN",
      "USD",
      "GBP",
      "EUR",
    ];

    if (
      !currency ||
      !validCurrencies.includes(currency as Currency)
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

    const requestedBillingInterval =
      billing_interval as BillingInterval;

    const requestedCurrency =
      currency as Currency;

    // ---------------------------------------------------------
    // 8. Verify that the user is an active school admin
    // ---------------------------------------------------------

    const {
      data: schoolAdmin,
      error: schoolAdminError,
    } = await supabaseServer
      .from("school_admins")
      .select(
        `
        id,
        school_id,
        role,
        status,
        schools (
          id,
          school_name,
          school_code,
          status
        )
        `
      )
      .eq("school_id", school_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (schoolAdminError) {
      console.error(
        "School admin lookup error:",
        schoolAdminError
      );

      return NextResponse.json(
        {
          error:
            "Could not verify your school administrator access",
        },
        {
          status: 500,
        }
      );
    }

    if (!schoolAdmin) {
      return NextResponse.json(
        {
          error:
            "You are not an active administrator of this school",
        },
        {
          status: 403,
        }
      );
    }

    // ---------------------------------------------------------
    // 9. Extract school information
    // ---------------------------------------------------------

    const school = Array.isArray(schoolAdmin.schools)
      ? schoolAdmin.schools[0]
      : schoolAdmin.schools;

    if (!school) {
      return NextResponse.json(
        {
          error: "School record could not be found",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // 10. Check school status
    // ---------------------------------------------------------

    const allowedSchoolStatuses = [
      "pending",
      "active",
    ];

    if (!allowedSchoolStatuses.includes(school.status)) {
      return NextResponse.json(
        {
          error:
            "This school is not currently eligible for subscription payment",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // 11. Get official school pricing
    // ---------------------------------------------------------

    const {
      data: pricing,
      error: pricingError,
    } = await supabaseServer
      .from("school_pricing")
      .select(
        `
        id,
        currency,
        billing_interval,
        price_per_student,
        display_name,
        is_active
        `
      )
      .eq("currency", requestedCurrency)
      .eq("billing_interval", requestedBillingInterval)
      .eq("is_active", true)
      .single();

    if (pricingError || !pricing) {
      console.error(
        "School pricing lookup error:",
        pricingError
      );

      return NextResponse.json(
        {
          error:
            "School pricing plan is not currently available",
        },
        {
          status: 404,
        }
      );
    }

    // ---------------------------------------------------------
    // 12. Calculate total amount
    // ---------------------------------------------------------

    /*
     * Prices are stored in minor units:
     *
     * NGN:
     *   800 = ₦800
     *
     * USD:
     *   100 = $1.00
     *
     * GBP:
     *   100 = £1.00
     *
     * EUR:
     *   100 = €1.00
     */

    const totalAmount =
      pricing.price_per_student *
      student_seat_limit;

    if (
      !Number.isSafeInteger(totalAmount) ||
      totalAmount <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "The calculated subscription amount is invalid",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // 13. Convert database amount to Flutterwave amount
    // ---------------------------------------------------------

    /*
     * Flutterwave expects major currency units.
     *
     * NGN:
     *   800 → 800
     *
     * USD:
     *   100 → 1
     *
     * GBP:
     *   100 → 1
     *
     * EUR:
     *   100 → 1
     */

    let flutterwaveAmount = totalAmount;

    if (requestedCurrency !== "NGN") {
      flutterwaveAmount =
        totalAmount / 100;
    }

    if (
      !Number.isFinite(flutterwaveAmount) ||
      flutterwaveAmount <= 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid payment amount",
        },
        {
          status: 400,
        }
      );
    }

    // ---------------------------------------------------------
    // 14. Make sure Flutterwave secret key exists
    // ---------------------------------------------------------

    const flutterwaveSecretKey =
      process.env.FLUTTERWAVE_SECRET_KEY;

    if (!flutterwaveSecretKey) {
      console.error(
        "FLUTTERWAVE_SECRET_KEY is missing from environment variables."
      );

      return NextResponse.json(
        {
          error: "Payment configuration error",
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 15. Generate unique transaction reference
    // ---------------------------------------------------------

    const txRef =
      `SQS-${Date.now()}-${crypto
        .randomUUID()
        .slice(0, 8)}`;

    // ---------------------------------------------------------
    // 16. Create pending school payment transaction
    // ---------------------------------------------------------

    const {
      data: paymentTransaction,
      error: transactionError,
    } = await supabaseServer
      .from("school_payment_transactions")
      .insert({
        school_id: school.id,
        pricing_id: pricing.id,
        provider: "flutterwave",
        transaction_reference: txRef,
        currency: requestedCurrency,
        billing_interval:
          requestedBillingInterval,
        student_seat_limit:
          student_seat_limit,
        price_per_student:
          pricing.price_per_student,
        total_amount:
          totalAmount,
        status: "pending",
        payment_type:
          "school_subscription",

        metadata: {
          school_name:
            school.school_name,

          school_code:
            school.school_code,

          admin_user_id:
            user.id,

          pricing_id:
            pricing.id,

          billing_interval:
            requestedBillingInterval,

          currency:
            requestedCurrency,

          student_seat_limit:
            student_seat_limit,

          payment_mode:
            "one_time",
        },
      })
      .select("id")
      .single();

    if (
      transactionError ||
      !paymentTransaction
    ) {
      console.error(
        "School payment transaction creation error:",
        transactionError
      );

      return NextResponse.json(
        {
          error:
            "Could not create school payment transaction",
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 17. Application URL
    // ---------------------------------------------------------

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";

    /*
     * School payments use their own callback.
     *
     * We will create this callback separately.
     */

    const redirectUrl =
      `${appUrl}/schools/payment/callback`;

    // ---------------------------------------------------------
    // 18. Build Flutterwave checkout payload
    // ---------------------------------------------------------

    const payload = {
      tx_ref: txRef,

      amount:
        flutterwaveAmount,

      currency:
        requestedCurrency,

      redirect_url:
        redirectUrl,

      customer: {
        email:
          user.email ||
          "school@sahabaquest.com",
      },

      customizations: {
        title:
          "Sahaba Quest — Schools & Madrasas",

        description:
          `${school.school_name} — ` +
          `${student_seat_limit} student seat` +
          `${student_seat_limit === 1 ? "" : "s"}` +
          ` (${requestedBillingInterval})`,

        logo:
          `${appUrl}/logo.png`,
      },

      meta: {
        payment_type:
          "school_subscription",

        school_id:
          school.id,

        school_code:
          school.school_code,

        admin_user_id:
          user.id,

        pricing_id:
          pricing.id,

        billing_interval:
          requestedBillingInterval,

        currency:
          requestedCurrency,

        student_seat_limit:
          student_seat_limit,

        total_amount:
          totalAmount,

        school_payment_transaction_id:
          paymentTransaction.id,

        payment_mode:
          "one_time",
      },

      payment_options:
        requestedCurrency === "NGN"
          ? "card,banktransfer,ussd,account"
          : "card",
    };

    // ---------------------------------------------------------
    // 19. Send payment request to Flutterwave
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

          body:
            JSON.stringify(payload),
        }
      );

    const flutterwaveData =
      await flutterwaveResponse.json();

    // ---------------------------------------------------------
    // 20. Handle Flutterwave error
    // ---------------------------------------------------------

    if (
      !flutterwaveResponse.ok ||
      flutterwaveData.status !==
        "success"
    ) {
      console.error(
        "School Flutterwave initialization error:",
        flutterwaveData
      );

      await supabaseServer
        .from(
          "school_payment_transactions"
        )
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
            "Could not initialize school payment",
        },
        {
          status: 500,
        }
      );
    }

    // ---------------------------------------------------------
    // 21. Get checkout URL
    // ---------------------------------------------------------

    const checkoutUrl =
      flutterwaveData?.data?.link;

    if (!checkoutUrl) {
      console.error(
        "Flutterwave did not return a school checkout URL:",
        flutterwaveData
      );

      await supabaseServer
        .from(
          "school_payment_transactions"
        )
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
    // 22. Return checkout URL
    // ---------------------------------------------------------

    return NextResponse.json({
      success: true,

      checkout_url:
        checkoutUrl,

      transaction_reference:
        txRef,

      payment_mode:
        "one_time",

      school_id:
        school.id,

      student_seat_limit:
        student_seat_limit,

      billing_interval:
        requestedBillingInterval,

      currency:
        requestedCurrency,

      total_amount:
        totalAmount,
    });

  } catch (error) {
    console.error(
      "School payment initialization unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "An unexpected error occurred while initializing school payment",
      },
      {
        status: 500,
      }
    );
  }
}