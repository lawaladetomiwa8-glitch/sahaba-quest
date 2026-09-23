"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type AccountType = "free" | "individual" | "family";

type PlanType = "plus" | "family";

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

type Profile = {
  account_type: AccountType;
};

const PLAN_INFO: Record<
  PlanType,
  {
    name: string;
    badge: string;
    description: string;
    features: string[];
  }
> = {
  plus: {
    name: "Individual",
    badge: "INDIVIDUAL",
    description:
      "The full personal Sahaba Quest experience for learners who want deeper access, more challenges and exclusive competitions.",
    features: [
      "Access to all Levels 1–10",
      "Full Individual Quest journey",
      "All Individual challenges and quizzes",
      "Individual XP, streak and progress tracking",
      "Individual leaderboard",
      "Detailed performance statistics",
      "Access to exclusive Individual competitions",
      "Eligibility for sponsored monthly/weekly competitions when active",
      "Eligibility to compete for 1st, 2nd and 3rd place prizes",
      "Access to competition results and winner announcements",
      "Early access to selected Individual activities and events",
    ],
  },

  family: {
    name: "Family",
    badge: "FAMILY",
    description:
      "A dedicated Family Quest experience focused on the Sahabah, family life, parenting, character and learning together.",
    features: [
      "Access to all Levels 1–10",
      "Full Family Quest journey",
      "Family-focused Sahaba content",
      "Family challenges and quizzes",
      "Family XP and progress tracking",
      "Separate Family leaderboard",
      "Family-focused learning categories",
      "Lessons from the families and households of the Sahabah",
      "Marriage, parenting and family-life lessons",
      "Family sacrifice, patience, mercy and character",
      "Qur'an and Sunnah family guidance",
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

  const [accountType, setAccountType] =
    useState<AccountType>("free");

  const [loadingAccount, setLoadingAccount] =
    useState(true);

  const [loadingPlans, setLoadingPlans] =
    useState(true);

  const [processingPlan, setProcessingPlan] =
    useState<PlanType | null>(null);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  /*
   * ---------------------------------------------------------
   * LOAD CURRENT ACCOUNT
   * ---------------------------------------------------------
   */
  useEffect(() => {
    async function loadAccount() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setAccountType("free");
          return;
        }

        const {
          data: profile,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) {
          console.error(
            "Could not load account type:",
            profileError
          );

          setAccountType("free");
          return;
        }

        const detectedAccountType =
          profile?.account_type;

        if (
          detectedAccountType === "individual" ||
          detectedAccountType === "family"
        ) {
          setAccountType(
            detectedAccountType
          );
        } else {
          setAccountType("free");
        }
      } catch (accountError) {
        console.error(
          "Account loading error:",
          accountError
        );

        setAccountType("free");
      } finally {
        setLoadingAccount(false);
      }
    }

    loadAccount();
  }, []);

  /*
   * ---------------------------------------------------------
   * LOAD PAID PLANS
   *
   * We intentionally load only Individual (plus) and Family.
   * Organisation/school remains in the database for V2 but
   * is not exposed for payment in V1.
   * ---------------------------------------------------------
   */
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
        .in("plan_type", [
          "plus",
          "family",
        ])
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
    };

    for (const plan of plans) {
      if (plan.plan_type in result) {
        result[plan.plan_type] = plan;
      }
    }

    return result;
  }, [plans]);

  /*
   * ---------------------------------------------------------
   * SUBSCRIBE
   * ---------------------------------------------------------
   */
  async function handleSubscribe(
    planType: PlanType
  ) {
    setError("");
    setSuccessMessage("");

    /*
     * A Family account is already the Family experience.
     * We do not offer a casual switch back to Individual.
     */
    if (
      accountType === "family" &&
      planType === "plus"
    ) {
      setError(
        "Your Family Account is already active. Individual access is not available from this account."
      );
      return;
    }

    setProcessingPlan(planType);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "Please create a free account or log in before upgrading."
        );

        setTimeout(() => {
          window.location.href =
            "/login?redirect=/pricing";
        }, 1000);

        return;
      }

      const plan =
        plansByType[planType];

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
    const plan =
      plansByType[planType];

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

  function getPaidButtonLabel(
    planType: PlanType
  ): string {
    if (loadingAccount) {
      return "Loading...";
    }

    if (
      accountType === "individual" &&
      planType === "plus"
    ) {
      return "Current Plan";
    }

    if (
      accountType === "family" &&
      planType === "family"
    ) {
      return "Current Plan";
    }

    if (
      accountType === "individual" &&
      planType === "family"
    ) {
      return "Upgrade to Family";
    }

    return planType === "family"
      ? "Upgrade to Family"
      : "Get Individual";
  }

  function isPaidPlanDisabled(
    planType: PlanType
  ): boolean {
    if (loadingAccount) {
      return true;
    }

    if (
      accountType === "individual" &&
      planType === "plus"
    ) {
      return true;
    }

    if (
      accountType === "family" &&
      planType === "family"
    ) {
      return true;
    }

    if (
      accountType === "family" &&
      planType === "plus"
    ) {
      return true;
    }

    return (
      !plansByType[planType] ||
      processingPlan !== null
    );
  }

  return (
    <main className="sq-page">
      <div className="sq-container">

        {/* =================================================
            NAVIGATION
        ================================================== */}
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <AppNavbar />
        </div>

        {/* =================================================
            HERO
        ================================================== */}
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
              SAHABA QUEST PLANS
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
                color:
                  "var(--muted)",
                fontSize: "17px",
                lineHeight: 1.7,
                maxWidth: "650px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Start free, explore Levels
              1–4, and upgrade when you
              are ready to continue your
              journey.
            </p>

            {!loadingAccount && (
              <div
                style={{
                  display: "inline-flex",
                  marginTop: "20px",
                  padding:
                    "8px 14px",
                  borderRadius:
                    "999px",
                  background:
                    "rgba(255,255,255,0.85)",
                  border:
                    "1px solid var(--border)",
                  color:
                    "var(--primary-dark)",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                {accountType ===
                  "free" &&
                  "You are currently on the Free Account"}
                {accountType ===
                  "individual" &&
                  "You are currently on the Individual Account"}
                {accountType ===
                  "family" &&
                  "You are currently on the Family Account"}
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            CONTROLS
        ================================================== */}
        <section
          style={{
            display: "flex",
            justifyContent:
              "center",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            marginTop: "20px",
          }}
        >
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
              background:
                "#ffffff",
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

        {/* =================================================
            MESSAGES
        ================================================== */}
        {error && (
          <div
            role="alert"
            style={{
              marginTop: "20px",
              padding:
                "14px 18px",
              borderRadius: "14px",
              background:
                "#fef2f2",
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

        {/* =================================================
            PLANS
        ================================================== */}
        {loadingPlans ||
        loadingAccount ? (
          <div
            className="sq-card"
            style={{
              marginTop: "20px",
              padding:
                "60px 30px",
              textAlign:
                "center",
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
                alignItems:
                  "center",
                justifyContent:
                  "center",
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

            {/* =================================================
                FREE
            ================================================== */}
            <article
              className="sq-card"
              style={{
                position:
                  "relative",
                display: "flex",
                flexDirection:
                  "column",
                padding: "28px",
                border:
                  accountType ===
                  "free"
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                background:
                  accountType ===
                  "free"
                    ? "linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)"
                    : "#ffffff",
              }}
            >
              {accountType ===
                "free" && (
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
                    fontWeight:
                      900,
                    letterSpacing:
                      "0.5px",
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  CURRENT PLAN
                </div>
              )}

              <span className="sq-badge">
                FREE
              </span>

              <h2
                style={{
                  margin:
                    "16px 0 7px",
                  fontSize: "24px",
                  lineHeight: 1.2,
                  fontWeight: 900,
                }}
              >
                Free Account
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  minHeight: "45px",
                }}
              >
                Start your Sahaba
                Quest journey at no
                cost.
              </p>

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
                    }}
                  >
                    ₦0
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
                  forever
                </div>
              </div>

              <div
                style={{
                  height: "1px",
                  background:
                    "var(--border)",
                  margin:
                    "24px 0",
                }}
              />

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
                {[
                  "Access to Levels 1–4",
                  "Selected free challenges and quizzes",
                  "Basic Sahaba learning content",
                  "Personal XP and streak",
                  "Basic progress tracking",
                  "Access to the Free leaderboard experience",
                  "A chance to explore the Sahaba Quest platform before upgrading",
                  "Free access forever",
                ].map(
                  (feature) => (
                    <li
                      key={feature}
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "flex-start",
                        gap: "10px",
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
                        {feature}
                      </span>
                    </li>
                  )
                )}
              </ul>

              <div
                style={{
                  marginTop:
                    "auto",
                }}
              >
                {accountType ===
                "free" ? (
                  <button
                    type="button"
                    disabled
                    style={{
                      width:
                        "100%",
                      minHeight:
                        "48px",
                      borderRadius:
                        "14px",
                      border:
                        "1px solid var(--border)",
                      background:
                        "#f1f5f3",
                      color:
                        "var(--muted)",
                      cursor:
                        "not-allowed",
                      fontWeight:
                        800,
                      padding:
                        "0 18px",
                    }}
                  >
                    Current Plan
                  </button>
                ) : (
                  <div
                    style={{
                      width:
                        "100%",
                      minHeight:
                        "48px",
                      borderRadius:
                        "14px",
                      background:
                        "#f8faf9",
                      color:
                        "var(--muted)",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      fontSize:
                        "13px",
                      fontWeight:
                        700,
                      textAlign:
                        "center",
                      padding:
                        "8px 18px",
                    }}
                  >
                    Free access remains
                    available as the starting
                    plan
                  </div>
                )}
              </div>
            </article>

            {/* =================================================
                PAID PLANS
            ================================================== */}
            {(
              [
                "plus",
                "family",
              ] as PlanType[]
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

              const disabled =
                isPaidPlanDisabled(
                  planType
                );

              return (
                <article
                  key={planType}
                  className="sq-card"
                  style={{
                    position:
                      "relative",
                    display:
                      "flex",
                    flexDirection:
                      "column",
                    padding:
                      "28px",
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
                        fontWeight:
                          900,
                        letterSpacing:
                          "0.5px",
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      FAMILY
                    </div>
                  )}

                  <div>
                    <span className="sq-badge">
                      {info.badge}
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

                  <div
                    style={{
                      height: "1px",
                      background:
                        "var(--border)",
                      margin:
                        "24px 0",
                    }}
                  />

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
                          key={feature}
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "flex-start",
                            gap: "10px",
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
                            {feature}
                          </span>
                        </li>
                      )
                    )}
                  </ul>

                  <div
                    style={{
                      marginTop:
                        "auto",
                    }}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        handleSubscribe(
                          planType
                        )
                      }
                      className={
                        !disabled
                          ? "sq-button-primary"
                          : ""
                      }
                      style={{
                        width:
                          "100%",
                        minHeight:
                          "48px",
                        borderRadius:
                          "14px",
                        border:
                          !disabled
                            ? "none"
                            : "1px solid var(--border)",
                        background:
                          !disabled
                            ? undefined
                            : "#f1f5f3",
                        color:
                          !disabled
                            ? undefined
                            : "var(--muted)",
                        cursor:
                          !disabled
                            ? "pointer"
                            : "not-allowed",
                        fontWeight:
                          800,
                        padding:
                          "0 18px",
                      }}
                    >
                      {isProcessing
                        ? "Preparing payment..."
                        : plan
                          ? getPaidButtonLabel(
                              planType
                            )
                          : "Currently unavailable"}
                    </button>
                  </div>
                </article>
              );
            })}

            {/* =================================================
                ORGANISATION — V2
            ================================================== */}
            <article
              className="sq-card"
              style={{
                position:
                  "relative",
                display: "flex",
                flexDirection:
                  "column",
                padding: "28px",
                border:
                  "1px solid var(--border)",
                background:
                  "#f8faf9",
                opacity: 0.96,
              }}
            >
              <div
                style={{
                  position:
                    "absolute",
                  top: "18px",
                  right: "18px",
                  padding:
                    "6px 10px",
                  borderRadius:
                    "999px",
                  background:
                    "#fff8df",
                  color:
                    "#8a6800",
                  fontSize:
                    "10px",
                  fontWeight:
                    900,
                  letterSpacing:
                    "0.5px",
                }}
              >
                COMING SOON
              </div>

              <span className="sq-badge">
                ORGANISATION
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
                  paddingRight:
                    "90px",
                }}
              >
                Organisation
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
                Built for schools,
                madrasas, mosques and
                Islamic organisations.
              </p>

              <div
                style={{
                  marginTop:
                    "24px",
                }}
              >
                <span
                  style={{
                    fontSize:
                      "25px",
                    fontWeight:
                      900,
                  }}
                >
                  Launching soon
                </span>

                <div
                  style={{
                    marginTop:
                      "6px",
                    color:
                      "var(--muted)",
                    fontSize:
                      "13px",
                  }}
                >
                  Expected in a future
                  Sahaba Quest release
                </div>
              </div>

              <div
                style={{
                  height: "1px",
                  background:
                    "var(--border)",
                  margin:
                    "24px 0",
                }}
              />

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
                {[
                  "Organisation learning spaces",
                  "Student accounts",
                  "Classes and groups",
                  "Organisation competitions",
                  "Organisation leaderboard",
                ].map(
                  (feature) => (
                    <li
                      key={feature}
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "flex-start",
                        gap: "10px",
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
                            "#e8eeeb",
                          color:
                            "var(--muted)",
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
                        •
                      </span>

                      <span>
                        {feature}
                      </span>
                    </li>
                  )
                )}
              </ul>

              <div
                style={{
                  marginTop:
                    "auto",
                  width: "100%",
                  minHeight:
                    "48px",
                  borderRadius:
                    "14px",
                  border:
                    "1px solid var(--border)",
                  background:
                    "#ffffff",
                  color:
                    "var(--muted)",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize:
                    "13px",
                  fontWeight:
                    800,
                  padding:
                    "0 18px",
                }}
              >
                Organisation is not
                available yet
              </div>
            </article>
          </section>
        )}

        {/* =================================================
            INDIVIDUAL COMPETITION NOTICE
        ================================================== */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "28px",
            border:
              "1px solid var(--border)",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "22px",
              alignItems: "center",
            }}
          >
            <div>
              <span className="sq-badge">
                INDIVIDUAL EXCLUSIVE
              </span>

              <h2
                style={{
                  margin:
                    "13px 0 8px",
                  fontSize: "23px",
                  lineHeight: 1.25,
                  fontWeight: 900,
                }}
              >
                Sponsored Sahaba Quest Competitions
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                When a sponsored competition is active,
                Individual subscribers can take part in
                special weekly or monthly challenges,
                compete for the top positions and become
                eligible for the announced prizes.
              </p>
            </div>

            <div
              style={{
                padding: "20px",
                borderRadius: "16px",
                background: "#ffffff",
                border:
                  "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 900,
                  marginBottom: "12px",
                }}
              >
                Competition access
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "9px",
                  color: "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                <div>✓ Individual subscribers only</div>
                <div>✓ Sponsored challenge or quiz</div>
                <div>✓ 1st, 2nd and 3rd place prizes</div>
                <div>✓ Winners announced after the competition</div>
                <div>✓ Free users cannot enter exclusive competitions</div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            WHY UPGRADE
        ================================================== */}
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
              textAlign:
                "center",
              maxWidth:
                "700px",
              margin:
                "0 auto 24px",
            }}
          >
            <span className="sq-badge">
              YOUR JOURNEY
            </span>

            <h2
              style={{
                margin:
                  "14px 0 7px",
                fontSize:
                  "24px",
                fontWeight:
                  900,
              }}
            >
              Learn. Remember. Compete.
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
              }}
            >
              Every plan is designed to
              help you build knowledge
              about the Sahabah and turn
              learning into consistent
              progress.
            </p>
          </div>

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
                  borderRadius:
                    "14px",
                  background:
                    "var(--primary-light)",
                  color:
                    "var(--primary)",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize:
                    "20px",
                  fontWeight:
                    900,
                }}
              >
                📚
              </div>

              <h3
                style={{
                  margin:
                    "13px 0 6px",
                  fontSize:
                    "18px",
                  fontWeight:
                    900,
                }}
              >
                Learn
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    "var(--muted)",
                  fontSize:
                    "13px",
                  lineHeight:
                    1.6,
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
                  borderRadius:
                    "14px",
                  background:
                    "#fff8df",
                  color:
                    "#8a6800",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize:
                    "20px",
                  fontWeight:
                    900,
                }}
              >
                🏆
              </div>

              <h3
                style={{
                  margin:
                    "13px 0 6px",
                  fontSize:
                    "18px",
                  fontWeight:
                    900,
                }}
              >
                Compete
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    "var(--muted)",
                  fontSize:
                    "13px",
                  lineHeight:
                    1.6,
                }}
              >
                Challenge yourself and
                see your progress on
                the right leaderboard.
              </p>
            </div>

            <div>
              <div
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius:
                    "14px",
                  background:
                    "#f1f5f3",
                  color:
                    "var(--foreground)",
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "center",
                  fontSize:
                    "20px",
                  fontWeight:
                    900,
                }}
              >
                🌱
              </div>

              <h3
                style={{
                  margin:
                    "13px 0 6px",
                  fontSize:
                    "18px",
                  fontWeight:
                    900,
                }}
              >
                Grow
              </h3>

              <p
                style={{
                  margin: 0,
                  color:
                    "var(--muted)",
                  fontSize:
                    "13px",
                  lineHeight:
                    1.6,
                }}
              >
                Build your knowledge
                consistently, one
                question at a time.
              </p>
            </div>
          </div>
        </section>

        {/* =================================================
            PAYMENT NOTICE
        ================================================== */}
        <section
          style={{
            marginTop: "20px",
            padding:
              "20px 24px",
            borderRadius:
              "18px",
            background:
              "#f8faf9",
            border:
              "1px solid var(--border)",
            textAlign:
              "center",
          }}
        >
          <div
            style={{
              fontSize:
                "13px",
              fontWeight:
                800,
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
              fontSize:
                "12px",
              lineHeight:
                1.6,
            }}
          >
            Paid plans are securely
            processed through
            Flutterwave. Sahaba Quest
            does not store your card
            details.
          </p>
        </section>

        {/* =================================================
            FOOTER
        ================================================== */}
        <footer
          style={{
            padding:
              "28px 0 8px",
            textAlign:
              "center",
            color:
              "var(--muted-light)",
            fontSize:
              "12px",
          }}
        >
          Sahaba Quest • Learn.
          Remember. Compete.
        </footer>
      </div>

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
