"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type PlanType = "plus" | "family" | "school";
type BillingInterval = "monthly" | "annual";
type Currency = "NGN" | "USD" | "GBP" | "EUR";

type Plan = {
  id: string;
  plan_type: PlanType;
  billing_interval: BillingInterval;
  currency: Currency;
  amount: number;
  display_name: string;
};

const PLAN_INFO: Record<
  PlanType,
  {
    name: string;
    description: string;
    features: string[];
  }
> = {
  plus: {
    name: "Sahaba Quest Plus",
    description:
      "For individual learners who want to go deeper into their Sahaba journey.",
    features: [
      "Access to premium quiz levels",
      "Detailed progress tracking",
      "Personal performance statistics",
      "Compete on the leaderboard",
    ],
  },

  family: {
    name: "Family",
    description:
      "Make learning about the Sahabah a shared family experience.",
    features: [
      "Everything in Plus",
      "Family leaderboard",
      "Multiple family members",
      "Family progress tracking",
    ],
  },

  school: {
    name: "School",
    description:
      "Structured Islamic learning and competition for schools.",
    features: [
      "Everything in Plus",
      "Student accounts",
      "School leaderboard",
      "School performance dashboard",
      "Inter-school competition support",
    ],
  },
};

const CURRENCY_INFO: Record<
  Currency,
  {
    symbol: string;
    divisor: number;
  }
> = {
  NGN: {
    symbol: "₦",
    divisor: 1,
  },
  USD: {
    symbol: "$",
    divisor: 100,
  },
  GBP: {
    symbol: "£",
    divisor: 100,
  },
  EUR: {
    symbol: "€",
    divisor: 100,
  },
};

function formatAmount(
  amount: number,
  currency: Currency
): string {
  const currencyInfo = CURRENCY_INFO[currency];

  const actualAmount =
    Number(amount) / currencyInfo.divisor;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits:
      currency === "NGN" ? 0 : 2,
    maximumFractionDigits:
      currency === "NGN" ? 0 : 2,
  }).format(actualAmount);
}

export default function PricingPage() {
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");

  const [currency, setCurrency] =
    useState<Currency>("NGN");

  const [plans, setPlans] = useState<Plan[]>([]);

  const [loadingPlans, setLoadingPlans] =
    useState(true);

  const [processingPlan, setProcessingPlan] =
    useState<PlanType | null>(null);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  useEffect(() => {
    async function loadPlans() {
      setLoadingPlans(true);
      setError("");

      const {
        data,
        error: plansError,
      } = await supabase
        .from("subscription_plans")
        .select(
          "id, plan_type, billing_interval, currency, amount, display_name"
        )
        .eq(
          "billing_interval",
          billingInterval
        )
        .eq("currency", currency)
        .eq("is_active", true)
        .order("amount", {
          ascending: true,
        });

      if (plansError) {
        console.error(
          "Could not load subscription plans:",
          plansError
        );

        setError(
          "We could not load the subscription plans. Please refresh the page."
        );

        setPlans([]);
        setLoadingPlans(false);

        return;
      }

      setPlans((data ?? []) as Plan[]);
      setLoadingPlans(false);
    }

    loadPlans();
  }, [billingInterval, currency]);

  const plansByType = useMemo(() => {
    const result: Record<
      PlanType,
      Plan | null
    > = {
      plus: null,
      family: null,
      school: null,
    };

    for (const plan of plans) {
      if (plan.plan_type in result) {
        result[plan.plan_type] = plan;
      }
    }

    return result;
  }, [plans]);

  async function handleSubscribe(
    planType: PlanType
  ) {
    setError("");
    setSuccessMessage("");
    setProcessingPlan(planType);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Please log in before subscribing."
        );

        setTimeout(() => {
          window.location.href =
            "/login?redirect=/pricing";
        }, 1000);

        return;
      }

      const plan = plansByType[planType];

      if (!plan) {
        setError(
          "This plan is currently unavailable for the selected currency and billing interval."
        );

        return;
      }

      const response = await fetch(
        "/api/payments/flutterwave/initialize",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            plan_type: plan.plan_type,
            billing_interval:
              plan.billing_interval,
            currency: plan.currency,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to initialize payment."
        );
      }

      if (!result?.checkout_url) {
        throw new Error(
          "Flutterwave did not return a checkout URL."
        );
      }

      setSuccessMessage(
        "Redirecting you to secure payment..."
      );

      window.location.href =
        result.checkout_url;
    } catch (err: unknown) {
      console.error(
        "Subscription error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(
          "Something went wrong while starting the payment."
        );
      }
    } finally {
      setProcessingPlan(null);
    }
  }

  function getPlanPrice(
    planType: PlanType
  ): string {
    const plan = plansByType[planType];

    if (!plan) {
      return "Unavailable";
    }

    return `${
      CURRENCY_INFO[currency].symbol
    }${formatAmount(
      plan.amount,
      currency
    )}`;
  }

  return (
    <main className="sq-page">
      <div className="sq-container">

        {/* NAVIGATION */}
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <AppNavbar />
        </div>

        {/* HERO */}
        <section
          className="sq-card"
          style={{
            padding: "40px 32px",
            position: "relative",
            overflow: "hidden",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
          }}
        >
          {/* Decorative circle */}
          <div
            style={{
              position: "absolute",
              right: "-80px",
              top: "-100px",
              width: "260px",
              height: "260px",
              borderRadius: "50%",
              background:
                "var(--primary-light)",
              opacity: 0.65,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "760px",
              margin: "0 auto",
              textAlign: "center",
            }}
          >
            <span className="sq-badge">
              Sahaba Quest Plans
            </span>

            <h1
              style={{
                margin:
                  "18px 0 10px",
                fontSize:
                  "clamp(30px, 5vw, 48px)",
                lineHeight: 1.1,
                fontWeight: 900,
                letterSpacing:
                  "-1.2px",
              }}
            >
              Continue your{" "}
              <span
                style={{
                  color:
                    "var(--primary)",
                }}
              >
                Sahaba journey
              </span>
            </h1>

            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: "17px",
                lineHeight: 1.7,
                maxWidth: "650px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Choose the plan that fits
              your learning journey and
              unlock more ways to learn,
              remember, and compete.
            </p>
          </div>
        </section>

        {/* CONTROLS */}
        <section
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "20px",
          }}
        >
          {/* Billing */}
          <div
            style={{
              display: "flex",
              padding: "4px",
              borderRadius: "14px",
              background: "#ffffff",
              border:
                "1px solid var(--border)",
              boxShadow:
                "0 4px 15px rgba(15, 23, 42, 0.04)",
            }}
          >
            <button
              type="button"
              onClick={() =>
                setBillingInterval(
                  "monthly"
                )
              }
              style={{
                border: "none",
                borderRadius: "10px",
                padding:
                  "10px 18px",
                background:
                  billingInterval ===
                  "monthly"
                    ? "var(--primary)"
                    : "transparent",
                color:
                  billingInterval ===
                  "monthly"
                    ? "#ffffff"
                    : "var(--muted)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() =>
                setBillingInterval(
                  "annual"
                )
              }
              style={{
                border: "none",
                borderRadius: "10px",
                padding:
                  "10px 18px",
                background:
                  billingInterval ===
                  "annual"
                    ? "var(--primary)"
                    : "transparent",
                color:
                  billingInterval ===
                  "annual"
                    ? "#ffffff"
                    : "var(--muted)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Annual
            </button>
          </div>

          {/* Currency */}
          <select
            value={currency}
            onChange={(event) =>
              setCurrency(
                event.target
                  .value as Currency
              )
            }
            style={{
              minHeight: "46px",
              borderRadius: "14px",
              border:
                "1px solid var(--border)",
              background: "#ffffff",
              color:
                "var(--foreground)",
              padding:
                "0 14px",
              fontSize: "14px",
              fontWeight: 700,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="NGN">
              🇳🇬 Nigerian Naira
            </option>

            <option value="USD">
              🇺🇸 US Dollar
            </option>

            <option value="GBP">
              🇬🇧 British Pound
            </option>

            <option value="EUR">
              🇪🇺 Euro
            </option>
          </select>
        </section>

        {/* MESSAGES */}
        {error && (
          <div
            role="alert"
            style={{
              marginTop: "20px",
              padding:
                "14px 18px",
              borderRadius: "14px",
              background: "#fef2f2",
              border:
                "1px solid #fecaca",
              color: "#b91c1c",
              textAlign: "center",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            style={{
              marginTop: "20px",
              padding:
                "14px 18px",
              borderRadius: "14px",
              background:
                "var(--primary-light)",
              border:
                "1px solid var(--border)",
              color:
                "var(--primary-dark)",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 700,
            }}
          >
            {successMessage}
          </div>
        )}

        {/* PLANS */}
        {loadingPlans ? (
          <div
            className="sq-card"
            style={{
              marginTop: "20px",
              padding: "60px 30px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "52px",
                height: "52px",
                margin:
                  "0 auto 18px",
                borderRadius: "16px",
                background:
                  "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color:
                  "var(--primary)",
                fontWeight: 900,
              }}
            >
              SQ
            </div>

            <p
              style={{
                margin: 0,
                color:
                  "var(--muted)",
              }}
            >
              Loading plans...
            </p>
          </div>
        ) : (
          <section
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "20px",
              marginTop: "20px",
              alignItems:
                "stretch",
            }}
          >
            {(
              Object.keys(
                PLAN_INFO
              ) as PlanType[]
            ).map((planType) => {
              const info =
                PLAN_INFO[planType];

              const plan =
                plansByType[
                  planType
                ];

              const isProcessing =
                processingPlan ===
                planType;

              const isFamily =
                planType ===
                "family";

              return (
                <article
                  key={planType}
                  className="sq-card"
                  style={{
                    position:
                      "relative",
                    display: "flex",
                    flexDirection:
                      "column",
                    padding: "28px",
                    border:
                      isFamily
                        ? "2px solid var(--primary)"
                        : "1px solid var(--border)",
                    background:
                      isFamily
                        ? "linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)"
                        : "#ffffff",
                  }}
                >
                  {/* Popular badge */}
                  {isFamily && (
                    <div
                      style={{
                        position:
                          "absolute",
                        top: "-13px",
                        left: "50%",
                        transform:
                          "translateX(-50%)",
                        padding:
                          "6px 15px",
                        borderRadius:
                          "999px",
                        background:
                          "var(--primary)",
                        color:
                          "#ffffff",
                        fontSize:
                          "11px",
                        fontWeight: 900,
                        letterSpacing:
                          "0.5px",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      POPULAR
                    </div>
                  )}

                  {/* Plan heading */}
                  <div>
                    <span className="sq-badge">
                      {planType ===
                      "plus"
                        ? "Individual"
                        : planType ===
                            "family"
                          ? "Family"
                          : "Schools"}
                    </span>

                    <h2
                      style={{
                        margin:
                          "16px 0 7px",
                        fontSize:
                          "24px",
                        lineHeight:
                          1.2,
                        fontWeight:
                          900,
                      }}
                    >
                      {info.name}
                    </h2>

                    <p
                      style={{
                        margin: 0,
                        color:
                          "var(--muted)",
                        fontSize:
                          "14px",
                        lineHeight:
                          1.6,
                        minHeight:
                          "45px",
                      }}
                    >
                      {
                        info.description
                      }
                    </p>
                  </div>

                  {/* Price */}
                  <div
                    style={{
                      marginTop:
                        "24px",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "baseline",
                        gap: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            "34px",
                          fontWeight:
                            900,
                          letterSpacing:
                            "-1px",
                          color:
                            "var(--foreground)",
                        }}
                      >
                        {getPlanPrice(
                          planType
                        )}
                      </span>
                    </div>

                    <div
                      style={{
                        marginTop:
                          "4px",
                        color:
                          "var(--muted)",
                        fontSize:
                          "13px",
                      }}
                    >
                      {billingInterval ===
                      "monthly"
                        ? "per month"
                        : "per year"}
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    style={{
                      height: "1px",
                      background:
                        "var(--border)",
                      margin:
                        "24px 0",
                    }}
                  />

                  {/* Features */}
                  <ul
                    style={{
                      listStyle:
                        "none",
                      padding: 0,
                      margin:
                        "0 0 28px",
                      display:
                        "flex",
                      flexDirection:
                        "column",
                      gap: "13px",
                    }}
                  >
                    {info.features.map(
                      (feature) => (
                        <li
                          key={
                            feature
                          }
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "flex-start",
                            gap: "10px",
                            color:
                              "var(--foreground)",
                            fontSize:
                              "14px",
                            lineHeight:
                              1.5,
                          }}
                        >
                          <span
                            style={{
                              flexShrink:
                                0,
                              width:
                                "21px",
                              height:
                                "21px",
                              borderRadius:
                                "50%",
                              background:
                                "var(--primary-light)",
                              color:
                                "var(--primary)",
                              display:
                                "inline-flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              fontSize:
                                "11px",
                              fontWeight:
                                900,
                            }}
                          >
                            ✓
                          </span>

                          <span>
                            {
                              feature
                            }
                          </span>
                        </li>
                      )
                    )}
                  </ul>

                  {/* Button */}
                  <div
                    style={{
                      marginTop:
                        "auto",
                    }}
                  >
                    <button
                      type="button"
                      disabled={
                        !plan ||
                        processingPlan !==
                          null
                      }
                      onClick={() =>
                        handleSubscribe(
                          planType
                        )
                      }
                      className={
                        plan &&
                        processingPlan ===
                          null
                          ? "sq-button-primary"
                          : ""
                      }
                      style={{
                        width: "100%",
                        minHeight:
                          "48px",
                        borderRadius:
                          "14px",
                        border:
                          plan &&
                          processingPlan ===
                            null
                            ? "none"
                            : "1px solid var(--border)",
                        background:
                          plan &&
                          processingPlan ===
                            null
                            ? undefined
                            : "#f1f5f3",
                        color:
                          plan &&
                          processingPlan ===
                            null
                            ? undefined
                            : "var(--muted)",
                        cursor:
                          plan &&
                          processingPlan ===
                            null
                            ? "pointer"
                            : "not-allowed",
                        fontWeight: 800,
                        padding:
                          "0 18px",
                      }}
                    >
                      {isProcessing
                        ? "Preparing payment..."
                        : plan
                          ? `Get ${info.name}`
                          : "Currently unavailable"}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {/* WHY UPGRADE */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "28px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "20px",
            }}
          >
            <div>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "14px",
                  background:
                    "var(--primary-light)",
                  color:
                    "var(--primary)",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                📚
              </div>

              <h3
                style={{
                  margin:
                    "13px 0 6px",
                  fontSize: "18px",
                  fontWeight: 900,
                }}
              >
                Learn
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Discover meaningful
                lessons from the lives
                of the Sahabah.
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "14px",
                  background:
                    "#fff8df",
                  color:
                    "#8a6800",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                🏆
              </div>

              <h3
                style={{
                  margin:
                    "13px 0 6px",
                  fontSize: "18px",
                  fontWeight: 900,
                }}
              >
                Compete
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Challenge yourself and
                see your progress on
                the leaderboard.
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "14px",
                  background:
                    "#f1f5f3",
                  color:
                    "var(--foreground)",
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                🌱
              </div>

              <h3
                style={{
                  margin:
                    "13px 0 6px",
                  fontSize: "18px",
                  fontWeight: 900,
                }}
              >
                Grow
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Build your knowledge
                consistently, one
                question at a time.
              </p>
            </div>
          </div>
        </section>

        {/* PAYMENT NOTICE */}
        <section
          style={{
            marginTop: "20px",
            padding:
              "20px 24px",
            borderRadius: "18px",
            background:
              "#f8faf9",
            border:
              "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "13px",
              fontWeight: 800,
              color:
                "var(--foreground)",
              marginBottom:
                "5px",
            }}
          >
            🔒 Secure payment
          </div>

          <p
            style={{
              margin: 0,
              color:
                "var(--muted)",
              fontSize: "12px",
              lineHeight: 1.6,
            }}
          >
            Payments are securely
            processed through
            Flutterwave. Sahaba Quest
            does not store your card
            details.
          </p>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            padding:
              "28px 0 8px",
            textAlign: "center",
            color:
              "var(--muted-light)",
            fontSize: "12px",
          }}
        >
          Sahaba Quest • Learn.
          Remember. Compete.
        </footer>
      </div>

      {/* MOBILE */}
      <style jsx>{`
        @media (max-width: 700px) {
          .sq-container {
            width: 100%;
          }
        }

        @media (max-width: 600px) {
          .sq-card {
            border-radius: 18px;
          }
        }
      `}</style>
    </main>
  );
}