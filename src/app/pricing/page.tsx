"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Plan = {
  id: string;
  plan_type: "plus" | "family" | "school";
  billing_interval: "monthly" | "annual";
  currency: "NGN" | "USD" | "GBP" | "EUR";
  amount: number;
  display_name: string;
};

const currencyInfo = {
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

const planDescriptions = {
  plus: {
    title: "Sahaba Quest Plus",
    description:
      "For individual learners who want full access to the Sahaba Quest journey.",
    features: [
      "Access to all 10 levels",
      "Unlimited quiz attempts",
      "Advanced statistics",
      "Challenges and tournaments",
      "Badges and achievements",
    ],
  },

  family: {
    title: "Sahaba Quest Family",
    description:
      "Bring your family together and make learning about the Sahabah a shared journey.",
    features: [
      "Family leaderboard",
      "Multiple family members",
      "Individual member accounts",
      "Family progress tracking",
      "Family competitions",
    ],
  },

  school: {
    title: "Sahaba Quest School",
    description:
      "Give your school a structured and engaging way to build Islamic knowledge.",
    features: [
      "School dashboard",
      "Student accounts",
      "Class management",
      "Student performance tracking",
      "School leaderboard",
    ],
  },
};

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  const [billingInterval, setBillingInterval] = useState<
    "monthly" | "annual"
  >("monthly");

  const [currency, setCurrency] =
    useState<keyof typeof currencyInfo>("NGN");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const [paymentError, setPaymentError] =
    useState("");

  const [processingPlan, setProcessingPlan] =
    useState<string | null>(null);

  useEffect(() => {
    async function loadPlans() {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("subscription_plans")
        .select(
          "id, plan_type, billing_interval, currency, amount, display_name"
        )
        .eq("is_active", true)
        .eq("billing_interval", billingInterval)
        .eq("currency", currency)
        .order("amount", {
          ascending: true,
        });

      if (error) {
        console.error(
          "Error loading plans:",
          error
        );

        setError(
          "Unable to load subscription plans."
        );

        setPlans([]);
      } else {
        setPlans((data || []) as Plan[]);
      }

      setLoading(false);
    }

    loadPlans();
  }, [billingInterval, currency]);

  function formatPrice(amount: number) {
    const info = currencyInfo[currency];

    const actualAmount =
      amount / info.divisor;

    return `${info.symbol}${actualAmount.toLocaleString(
      "en-US",
      {
        minimumFractionDigits:
          currency === "NGN" ? 0 : 2,

        maximumFractionDigits:
          currency === "NGN" ? 0 : 2,
      }
    )}`;
  }

  async function handleSubscribe(
    plan: Plan
  ) {
    if (processingPlan) {
      return;
    }

    setProcessingPlan(plan.plan_type);
    setPaymentError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (
        sessionError ||
        !session ||
        !session.access_token
      ) {
        setPaymentError(
          "Please sign in to your Sahaba Quest account before subscribing."
        );

        setProcessingPlan(null);
        return;
      }

      const response = await fetch(
        "/api/payments/flutterwave/initialize",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            plan_type:
              plan.plan_type,

            billing_interval:
              plan.billing_interval,

            currency:
              plan.currency,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to start payment."
        );
      }

      if (!result.checkout_url) {
        throw new Error(
          "Flutterwave did not return a checkout link."
        );
      }

      window.location.href =
        result.checkout_url;
    } catch (error) {
      console.error(
        "Payment initialization error:",
        error
      );

      setPaymentError(
        error instanceof Error
          ? error.message
          : "Something went wrong while starting payment."
      );

      setProcessingPlan(null);
    }
  }

  const planOrder: Array<
    "plus" | "family" | "school"
  > = [
    "plus",
    "family",
    "school",
  ];

  return (
    <main
      style={{
        minHeight: "100vh",

        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)",

        color: "var(--text)",
      }}
    >
      <header className="sq-nav">
        <a
          href="/"
          className="sq-logo"
        >
          Sahaba Quest
        </a>

        <a
          href="/dashboard"
          className="sq-button-primary"
          style={{
            minHeight: "42px",
            padding: "0 16px",
            fontSize: "13px",
          }}
        >
          Dashboard →
        </a>
      </header>

      <div className="sq-page">
        <div
          className="sq-container"
          style={{
            maxWidth: "1180px",
          }}
        >
          <section
            style={{
              textAlign: "center",
              maxWidth: "760px",
              margin: "0 auto",
              paddingTop: "20px",
            }}
          >
            <span className="sq-badge">
              Choose your journey
            </span>

            <h1
              className="sq-title"
              style={{
                marginTop: "18px",
              }}
            >
              Unlock the full Sahaba Quest experience.
            </h1>

            <p
              className="sq-subtitle"
              style={{
                maxWidth: "650px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Learn about the Companions of the Prophet ﷺ,
              challenge yourself, track your progress, and grow
              together with your family or school.
            </p>
          </section>

          {/* BILLING */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "34px",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                padding: "5px",
                borderRadius: "14px",
                background:
                  "var(--primary-light)",
                border:
                  "1px solid var(--border)",
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
                    "11px 22px",

                  background:
                    billingInterval ===
                    "monthly"
                      ? "var(--primary)"
                      : "transparent",

                  color:
                    billingInterval ===
                    "monthly"
                      ? "white"
                      : "var(--primary-dark)",

                  fontWeight: 800,
                  fontSize: "13px",
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
                    "11px 22px",

                  background:
                    billingInterval ===
                    "annual"
                      ? "var(--primary)"
                      : "transparent",

                  color:
                    billingInterval ===
                    "annual"
                      ? "white"
                      : "var(--primary-dark)",

                  fontWeight: 800,
                  fontSize: "13px",
                }}
              >
                Annual
              </button>
            </div>
          </div>

          {/* CURRENCY */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "8px",
              marginTop: "18px",
            }}
          >
            {(
              Object.keys(
                currencyInfo
              ) as Array<
                keyof typeof currencyInfo
              >
            ).map(
              (currencyCode) => (
                <button
                  key={
                    currencyCode
                  }
                  type="button"
                  onClick={() =>
                    setCurrency(
                      currencyCode
                    )
                  }
                  style={{
                    border:
                      currency ===
                      currencyCode
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border)",

                    borderRadius:
                      "10px",

                    padding:
                      "8px 15px",

                    background:
                      currency ===
                      currencyCode
                        ? "var(--primary-light)"
                        : "var(--white)",

                    color:
                      currency ===
                      currencyCode
                        ? "var(--primary-dark)"
                        : "var(--muted)",

                    fontWeight: 800,
                    fontSize: "12px",
                  }}
                >
                  {currencyCode}
                </button>
              )
            )}
          </div>

          {/* PAYMENT ERROR */}
          {paymentError && (
            <div
              style={{
                maxWidth: "650px",
                margin:
                  "24px auto 0",

                padding:
                  "14px 16px",

                borderRadius:
                  "13px",

                background:
                  "var(--danger-light)",

                border:
                  "1px solid rgba(220, 38, 38, 0.15)",

                color:
                  "var(--danger)",

                fontSize: "13px",

                textAlign:
                  "center",
              }}
            >
              {paymentError}
            </div>
          )}

          {/* DATABASE ERROR */}
          {error && (
            <div
              style={{
                maxWidth: "600px",
                margin:
                  "28px auto 0",

                padding:
                  "14px 16px",

                borderRadius:
                  "13px",

                background:
                  "var(--danger-light)",

                border:
                  "1px solid rgba(220, 38, 38, 0.15)",

                color:
                  "var(--danger)",

                fontSize: "13px",

                textAlign:
                  "center",
              }}
            >
              {error}
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div
              style={{
                textAlign:
                  "center",

                padding:
                  "70px 0",

                color:
                  "var(--muted)",

                fontSize: "14px",
              }}
            >
              Loading plans...
            </div>
          )}

          {/* PLANS */}
          {!loading &&
            !error && (
              <div
                className="pricing-grid"
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",

                  gap: "20px",

                  marginTop:
                    "42px",
                }}
              >
                {planOrder.map(
                  (planType) => {
                    const plan =
                      plans.find(
                        (item) =>
                          item.plan_type ===
                          planType
                      );

                    const description =
                      planDescriptions[
                        planType
                      ];

                    const isFamily =
                      planType ===
                      "family";

                    const isProcessing =
                      processingPlan ===
                      planType;

                    return (
                      <div
                        key={
                          planType
                        }
                        className="sq-card"
                        style={{
                          padding:
                            "30px",

                          position:
                            "relative",

                          display:
                            "flex",

                          flexDirection:
                            "column",

                          border:
                            isFamily
                              ? "2px solid var(--primary)"
                              : "1px solid var(--border)",

                          boxShadow:
                            isFamily
                              ? "0 18px 45px rgba(15, 118, 110, 0.12)"
                              : "none",
                        }}
                      >
                        {isFamily && (
                          <div
                            style={{
                              position:
                                "absolute",

                              top:
                                "-13px",

                              left:
                                "50%",

                              transform:
                                "translateX(-50%)",

                              padding:
                                "6px 13px",

                              borderRadius:
                                "999px",

                              background:
                                "var(--primary)",

                              color:
                                "white",

                              fontSize:
                                "11px",

                              fontWeight:
                                800,

                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            FAMILY LEARNING
                          </div>
                        )}

                        <div>
                          <span
                            style={{
                              display:
                                "inline-block",

                              padding:
                                "7px 10px",

                              borderRadius:
                                "9px",

                              background:
                                "var(--primary-light)",

                              color:
                                "var(--primary-dark)",

                              fontSize:
                                "11px",

                              fontWeight:
                                800,

                              textTransform:
                                "uppercase",

                              letterSpacing:
                                "0.5px",
                            }}
                          >
                            {planType ===
                            "plus"
                              ? "Individual"
                              : planType ===
                                "family"
                              ? "Family"
                              : "School"}
                          </span>

                          <h2
                            style={{
                              margin:
                                "18px 0 8px",

                              fontSize:
                                "23px",

                              fontWeight:
                                900,

                              letterSpacing:
                                "-0.4px",
                            }}
                          >
                            {
                              description.title
                            }
                          </h2>

                          <p
                            style={{
                              margin: 0,

                              minHeight:
                                "72px",

                              color:
                                "var(--muted)",

                              fontSize:
                                "14px",

                              lineHeight:
                                1.65,
                            }}
                          >
                            {
                              description.description
                            }
                          </p>
                        </div>

                        {/* PRICE */}
                        <div
                          style={{
                            marginTop:
                              "24px",
                          }}
                        >
                          {plan ? (
                            <>
                              <div
                                style={{
                                  display:
                                    "flex",

                                  alignItems:
                                    "baseline",

                                  gap: "6px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize:
                                      "38px",

                                    lineHeight:
                                      1,

                                    fontWeight:
                                      900,

                                    color:
                                      "var(--primary-dark)",

                                    letterSpacing:
                                      "-1.5px",
                                  }}
                                >
                                  {formatPrice(
                                    plan.amount
                                  )}
                                </span>

                                <span
                                  style={{
                                    color:
                                      "var(--muted)",

                                    fontSize:
                                      "13px",

                                    fontWeight:
                                      600,
                                  }}
                                >
                                  /{" "}
                                  {billingInterval ===
                                  "monthly"
                                    ? "month"
                                    : "year"}
                                </span>
                              </div>

                              {billingInterval ===
                                "annual" && (
                                <div
                                  style={{
                                    marginTop:
                                      "9px",

                                    color:
                                      "var(--success)",

                                    fontSize:
                                      "12px",

                                    fontWeight:
                                      700,
                                  }}
                                >
                                  Billed annually
                                </div>
                              )}
                            </>
                          ) : (
                            <div
                              style={{
                                color:
                                  "var(--muted-light)",

                                fontSize:
                                  "14px",
                              }}
                            >
                              Plan unavailable
                            </div>
                          )}
                        </div>

                        {/* DIVIDER */}
                        <div
                          style={{
                            height:
                              "1px",

                            background:
                              "var(--border)",

                            margin:
                              "26px 0",
                          }}
                        />

                        {/* FEATURES */}
                        <ul
                          style={{
                            listStyle:
                              "none",

                            padding: 0,

                            margin: 0,

                            display:
                              "flex",

                            flexDirection:
                              "column",

                            gap: "13px",
                          }}
                        >
                          {description.features.map(
                            (
                              feature
                            ) => (
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
                                    "var(--muted)",

                                  fontSize:
                                    "13px",

                                  lineHeight:
                                    1.5,
                                }}
                              >
                                <span
                                  style={{
                                    width:
                                      "21px",

                                    height:
                                      "21px",

                                    flexShrink:
                                      0,

                                    display:
                                      "flex",

                                    alignItems:
                                      "center",

                                    justifyContent:
                                      "center",

                                    borderRadius:
                                      "50%",

                                    background:
                                      "var(--primary-light)",

                                    color:
                                      "var(--primary)",

                                    fontSize:
                                      "12px",

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

                        {/* BUTTON */}
                        <div
                          style={{
                            marginTop:
                              "auto",

                            paddingTop:
                              "28px",
                          }}
                        >
                          <button
                            type="button"

                            disabled={
                              !plan ||
                              !!processingPlan
                            }

                            onClick={() => {
                              if (
                                plan
                              ) {
                                handleSubscribe(
                                  plan
                                );
                              }
                            }}

                            className="sq-button-primary"

                            style={{
                              width:
                                "100%",

                              minHeight:
                                "50px",

                              fontSize:
                                "14px",

                              opacity:
                                processingPlan &&
                                !isProcessing
                                  ? 0.6
                                  : 1,
                            }}
                          >
                            {isProcessing
                              ? "Starting payment..."
                              : "Get Started →"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

          {/* BOTTOM NOTE */}
          <section
            className="sq-card"
            style={{
              marginTop:
                "30px",

              padding:
                "30px",

              textAlign:
                "center",

              background:
                "linear-gradient(135deg, var(--primary-light), var(--white))",
            }}
          >
            <h2
              style={{
                margin: 0,

                fontSize:
                  "22px",

                fontWeight:
                  900,
              }}
            >
              One journey. More ways to learn.
            </h2>

            <p
              style={{
                maxWidth:
                  "650px",

                margin:
                  "10px auto 0",

                color:
                  "var(--muted)",

                fontSize:
                  "14px",

                lineHeight:
                  1.7,
              }}
            >
              Whether you are learning independently,
              learning with your family, or building a
              learning community at school, Sahaba Quest
              gives you a place to grow your knowledge.
            </p>
          </section>

          <footer
            style={{
              padding:
                "34px 0 20px",

              textAlign:
                "center",

              color:
                "var(--muted-light)",

              fontSize:
                "12px",
            }}
          >
            Sahaba Quest — Learn • Remember • Compete
          </footer>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 950px) {
          .pricing-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 650px) {
          .pricing-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}