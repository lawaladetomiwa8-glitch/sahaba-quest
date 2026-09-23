"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type AccountType = "free" | "individual" | "family";

type Profile = {
  username: string | null;
  display_name: string | null;
  account_type: AccountType;
};

type Progress = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

type SubscriptionPlan = {
  plan_type: "plus" | "family" | "school";
  display_name: string;
};

type Subscription = {
  status: string;
  current_period_end: string;
  plan: SubscriptionPlan | null;
};

type SubscriptionQueryResult = {
  status: string;
  current_period_end: string;
  subscription_plans:
    | SubscriptionPlan
    | SubscriptionPlan[]
    | null;
};

/*
 * SAHABA QUEST SOCIAL LINKS
 *
 * Facebook and Instagram are placeholders for now.
 * Replace "#" with the real links when they are available.
 */
const SOCIAL_LINKS = {
  instagram: "#",
  facebook: "#",

  brothersWhatsApp:
    "https://chat.whatsapp.com/HvS4ao1IsipHW44EbRZjjw?s=cl&p=a&mlu=4&ilr=4",

  sistersWhatsApp:
    "https://chat.whatsapp.com/GdfMHlXEeP16x95g454o0e?s=cl&p=a&mlu=4&ilr=4",
};

/*
 * SOCIAL MEDIA ICONS
 */

function InstagramIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="2"
      />

      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="2"
      />

      <circle
        cx="17.5"
        cy="6.5"
        r="1.2"
        fill="currentColor"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M14 8h3V4.5c-.5-.1-2-.2-3.7-.2-3.7 0-6.2 2.2-6.2 6.3V14H4v4h3.1v6h3.8v-6h3.2l.5-4h-3.7v-2.9c0-1.2.3-2.1 2.1-2.1Z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M20.5 3.5A11.8 11.8 0 0 0 12.1 0C5.5 0 .2 5.3.2 11.9c0 2.1.6 4.1 1.6 5.9L0 24l6.4-1.7a11.8 11.8 0 0 0 5.7 1.5h.1c6.6 0 11.8-5.3 11.8-11.9 0-3.2-1.2-6.2-3.5-8.4Zm-8.4 18.2h-.1c-1.8 0-3.6-.5-5.1-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.7 9.7 0 0 1-1.5-5.2c0-5.4 4.4-9.8 9.9-9.8 2.6 0 5.1 1 7 2.9 1.9 1.9 2.9 4.3 2.9 7 0 5.4-4.4 9.8-9.7 9.8Zm5.4-7.3c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-1.6-.8-2.7-1.5-3.8-3.3-.3-.5.3-.5.8-1.7.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.4s1 2.8 1.1 3c.1.2 2 3.1 4.8 4.3 1.8.8 2.5.9 3.4.8.5-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.6-.4Z" />
    </svg>
  );
}

export default function DashboardPage() {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [progress, setProgress] =
    useState<Progress | null>(null);

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [message, setMessage] = useState(
    "Loading your dashboard..."
  );

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.error(
          "User lookup error:",
          userError
        );

        setMessage(
          "We could not load your account."
        );

        return;
      }

      if (!user) {
        setMessage("You are not logged in.");
        return;
      }

      /*
       * PROFILE
       *
       * account_type is now the source of truth
       * for the user's account experience.
       */
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "username, display_name, account_type"
        )
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error(
          "Profile lookup error:",
          profileError
        );

        setMessage(
          "We could not load your profile."
        );

        return;
      }

      const accountType =
        profileData.account_type;

      /*
       * Only the three active account types
       * are allowed in V1.
       */
      if (
        accountType !== "free" &&
        accountType !== "individual" &&
        accountType !== "family"
      ) {
        console.error(
          "Invalid account type:",
          accountType
        );

        setMessage(
          "Your account type could not be verified."
        );

        return;
      }

      /*
       * PLAYER PROGRESS
       */
      const {
        data: progressData,
        error: progressError,
      } = await supabase
        .from("player_progress")
        .select(
          `
            current_level,
            total_xp,
            questions_answered,
            correct_answers,
            current_streak,
            best_streak
          `
        )
        .eq("user_id", user.id)
        .single();

      if (progressError) {
        console.error(
          "Progress lookup error:",
          progressError
        );

        setMessage(
          "We could not load your game progress."
        );

        return;
      }

      /*
       * ACTIVE SUBSCRIPTION
       *
       * We only retrieve active subscriptions.
       * The newest ending subscription is selected.
       */
      const {
        data: subscriptionData,
        error: subscriptionError,
      } = await supabase
        .from("subscriptions")
        .select(
          `
            status,
            current_period_end,
            subscription_plans (
              plan_type,
              display_name
            )
          `
        )
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("current_period_end", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

      if (subscriptionError) {
        console.error(
          "Subscription lookup error:",
          subscriptionError
        );

        setSubscription(null);
      } else if (subscriptionData) {
        const subscriptionResult =
          subscriptionData as unknown as SubscriptionQueryResult;

        let plan: SubscriptionPlan | null =
          null;

        if (
          Array.isArray(
            subscriptionResult.subscription_plans
          )
        ) {
          plan =
            subscriptionResult.subscription_plans[0] ||
            null;
        } else {
          plan =
            subscriptionResult.subscription_plans ||
            null;
        }

        setSubscription({
          status:
            subscriptionResult.status,

          current_period_end:
            subscriptionResult.current_period_end,

          plan,
        });
      } else {
        setSubscription(null);
      }

      setProfile({
        username: profileData.username,
        display_name: profileData.display_name,
        account_type: accountType,
      });

      setProgress(progressData);
      setMessage("");
    } catch (error) {
      console.error(
        "Dashboard loading error:",
        error
      );

      setMessage(
        "Something went wrong while loading your dashboard."
      );
    }
  }

  /*
   * LOADING / ERROR STATE
   */
  if (!profile || !progress) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div
            className="sq-card"
            style={{
              maxWidth: "620px",
              margin: "80px auto",
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "20px",
                background:
                  "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                fontSize: "24px",
                fontWeight: 900,
              }}
            >
              SQ
            </div>

            <h1 className="sq-title">
              Sahaba Quest
            </h1>

            <p
              className="sq-subtitle"
              style={{
                marginTop: "12px",
              }}
            >
              {message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * PLAYER NAME
   */
  const playerName =
    profile.display_name ||
    profile.username ||
    "Player";

  /*
   * ACCOUNT DISPLAY
   */
  const accountLabels: Record<
    AccountType,
    string
  > = {
    free: "Free Account",
    individual: "Individual Account",
    family: "Family Account",
  };

  const accountDescriptions: Record<
    AccountType,
    string
  > = {
    free:
      "You're currently using the free Sahaba Quest experience.",
    individual:
      "You're using the Individual Sahaba Quest experience.",
    family:
      "You're using the Family Sahaba Quest experience.",
  };

  const accountLabel =
    accountLabels[profile.account_type];

  const accountDescription =
    accountDescriptions[profile.account_type];

  /*
   * ACCURACY
   */
  const accuracy =
    progress.questions_answered > 0
      ? Math.round(
          (progress.correct_answers /
            progress.questions_answered) *
            100
        )
      : 0;

  /*
   * CURRENT LEVEL QUESTION PROGRESS
   */
  const questionsInCurrentLevel =
    progress.questions_answered % 50;

  const correctInCurrentLevel =
    progress.correct_answers % 50;

  /*
   * If the player has completed exactly 50 questions,
   * show 100% rather than 0%.
   */
  const levelQuestionProgress =
    questionsInCurrentLevel === 0 &&
    progress.questions_answered > 0
      ? 100
      : Math.min(
          (questionsInCurrentLevel / 50) * 100,
          100
        );

  /*
   * REQUIRED CORRECT ANSWERS TO PASS
   */
  const levelCorrectProgress = Math.min(
    (correctInCurrentLevel / 25) * 100,
    100
  );

  /*
   * DISPLAY DATE
   */
  const subscriptionEndDate =
    subscription?.current_period_end
      ? new Date(
          subscription.current_period_end
        ).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  return (
    <main
      className="sq-page"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)",
      }}
    >
      <div className="sq-container">

        {/* NAVIGATION */}
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <AppNavbar />
        </div>

        {/* WELCOME HERO */}
        <section
          className="sq-card"
          style={{
            padding: "36px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-60px",
              top: "-80px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background:
                "var(--primary-light)",
              opacity: 0.6,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "720px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span className="sq-badge">
                Level {progress.current_level}
              </span>

              <span
                className="sq-badge"
                style={{
                  background:
                    profile.account_type ===
                    "family"
                      ? "#fef3c7"
                      : profile.account_type ===
                        "individual"
                      ? "#dbeafe"
                      : "var(--primary-light)",
                  color:
                    profile.account_type ===
                    "family"
                      ? "#92400e"
                      : profile.account_type ===
                        "individual"
                      ? "#1d4ed8"
                      : "var(--primary-dark)",
                }}
              >
                {accountLabel}
              </span>
            </div>

            <h1
              style={{
                margin: "18px 0 8px",
                fontSize:
                  "clamp(30px, 5vw, 48px)",
                lineHeight: 1.1,
                letterSpacing: "-1.2px",
                fontWeight: 900,
              }}
            >
              Assalamu alaikum,{" "}
              <span
                style={{
                  color: "var(--primary)",
                }}
              >
                {playerName}
              </span>{" "}
              👋
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: "620px",
                color: "var(--muted)",
                fontSize: "17px",
                lineHeight: 1.7,
              }}
            >
              Ready to continue your Sahaba
              journey? Test your knowledge,
              build your streak, and learn
              something valuable today.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "26px",
              }}
            >
              <a
                href="/quiz"
                className="sq-button-primary"
              >
                🎮 Continue Quest
              </a>

              <a
                href="/progress"
                className="sq-button-secondary"
              >
                View Progress
              </a>
            </div>
          </div>
        </section>

        {/* ACCOUNT TYPE */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "22px 26px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f8faf9 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="sq-badge">
                Account Type
              </div>

              <h2
                style={{
                  margin: "9px 0 4px",
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                {accountLabel}
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                {accountDescription}
              </p>
            </div>

            {profile.account_type ===
              "free" && (
              <a
                href="/pricing"
                className="sq-button-primary"
                style={{
                  minHeight: "44px",
                  padding: "0 18px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                Explore Plans →
              </a>
            )}
          </div>
        </section>

        {/* STATS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginTop: "20px",
          }}
        >
          <div className="sq-stat">
            <div className="sq-stat-label">
              Current Level
            </div>

            <div className="sq-stat-value">
              {progress.current_level}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--primary)",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Keep progressing
            </div>
          </div>

          <div className="sq-stat">
            <div className="sq-stat-label">
              Total XP
            </div>

            <div className="sq-stat-value">
              {progress.total_xp.toLocaleString()}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              Experience earned
            </div>
          </div>

          <div className="sq-stat">
            <div className="sq-stat-label">
              Current Streak
            </div>

            <div
              className="sq-stat-value"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              🔥 {progress.current_streak}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              Best: {progress.best_streak}
            </div>
          </div>

          <div className="sq-stat">
            <div className="sq-stat-label">
              Accuracy
            </div>

            <div className="sq-stat-value">
              {accuracy}%
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              {progress.correct_answers} correct
            </div>
          </div>
        </section>

        {/* SUBSCRIPTION */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "26px 28px",
            background: subscription
              ? "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)"
              : "linear-gradient(135deg, #ffffff 0%, #f8faf9 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "16px",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  flexShrink: 0,
                  borderRadius: "14px",
                  background:
                    "var(--primary-light)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "21px",
                  fontWeight: 900,
                }}
              >
                {subscription ? "✓" : "✦"}
              </div>

              <div>
                <div className="sq-badge">
                  Your Subscription
                </div>

                <h2
                  style={{
                    margin: "10px 0 5px",
                    fontSize: "22px",
                    fontWeight: 900,
                  }}
                >
                  {subscription?.plan
                    ?.display_name ||
                    "Sahaba Quest Free"}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {subscription
                    ? "Your subscription is active and your premium access is available."
                    : "You are currently on the free plan. Continue your journey or unlock more levels."}
                </p>

                {subscription &&
                  subscriptionEndDate && (
                    <div
                      style={{
                        marginTop: "8px",
                        color: "var(--success)",
                        fontSize: "12px",
                        fontWeight: 800,
                      }}
                    >
                      Active until{" "}
                      {subscriptionEndDate}
                    </div>
                  )}
              </div>
            </div>

            {!subscription && (
              <a
                href="/pricing"
                className="sq-button-primary"
                style={{
                  minHeight: "46px",
                  padding: "0 20px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                View Plans →
              </a>
            )}
          </div>
        </section>

        {/* MAIN CONTENT GRID */}
        <section
          className="dashboard-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.5fr) minmax(280px, 1fr)",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {/* PROGRESS CARD */}
          <div
            className="sq-card"
            style={{
              padding: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
              }}
            >
              <div>
                <div className="sq-badge">
                  Your Journey
                </div>

                <h2
                  style={{
                    margin: "16px 0 6px",
                    fontSize: "24px",
                    fontWeight: 800,
                  }}
                >
                  Level{" "}
                  {progress.current_level}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Keep answering
                  questions to
                  strengthen your
                  knowledge.
                </p>
              </div>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 900,
                  color: "var(--primary)",
                }}
              >
                {progress.total_xp}
              </div>
            </div>

            {/* QUESTIONS PROGRESS */}
            <div
              style={{
                marginTop: "28px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "9px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--muted)",
                  }}
                >
                  Level questions
                </span>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--primary)",
                  }}
                >
                  {questionsInCurrentLevel}
                  /50
                </span>
              </div>

              <div className="sq-progress">
                <div
                  className="sq-progress-bar"
                  style={{
                    width: `${levelQuestionProgress}%`,
                  }}
                />
              </div>
            </div>

            {/* PASS PROGRESS */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "9px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--muted)",
                  }}
                >
                  Correct answers needed
                </span>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--primary)",
                  }}
                >
                  {correctInCurrentLevel}
                  /25
                </span>
              </div>

              <div className="sq-progress">
                <div
                  className="sq-progress-bar"
                  style={{
                    width: `${levelCorrectProgress}%`,
                  }}
                />
              </div>
            </div>

            {/* SMALL PROGRESS STATS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, 1fr)",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border:
                    "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Questions Answered
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {progress.questions_answered}
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border:
                    "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Correct Answers
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {progress.correct_answers}
                </div>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div
            className="sq-card"
            style={{
              padding: "28px",
            }}
          >
            <div className="sq-badge">
              Quick Actions
            </div>

            <h2
              style={{
                margin: "16px 0 18px",
                fontSize: "24px",
                fontWeight: 800,
              }}
            >
              What do you want to
              do?
            </h2>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              <a
                href="/quiz"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background:
                    "var(--primary)",
                  color: "white",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  🎮 Play Quiz
                </span>

                <span>→</span>
              </a>

              <a
                href="/leaderboard"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background:
                    "var(--secondary-light)",
                  color: "#7c5d00",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  🏆 Leaderboard
                </span>

                <span>→</span>
              </a>

              <a
                href="/challenges"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "#f1f5f3",
                  color: "var(--foreground)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  🎯 Challenges
                </span>

                <span>→</span>
              </a>

              <a
                href="/profile"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "#f1f5f3",
                  color: "var(--foreground)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  👤 My Profile
                </span>

                <span>→</span>
              </a>
            </div>
          </div>
        </section>

        {/* LEARNING MOTIVATION */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "28px",
            background:
              "linear-gradient(135deg, #115e59, #0f766e)",
            color: "white",
            border: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                maxWidth: "700px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  opacity: 0.8,
                }}
              >
                Daily reminder
              </div>

              <h2
                style={{
                  margin: "10px 0 8px",
                  fontSize: "26px",
                  fontWeight: 900,
                }}
              >
                Learn about those
                who walked with the
                Prophet ﷺ.
              </h2>

              <p
                style={{
                  margin: 0,
                  lineHeight: 1.7,
                  opacity: 0.85,
                }}
              >
                Every question is an
                opportunity to increase
                your knowledge and
                strengthen your
                connection with the
                lives of the Sahabah.
              </p>
            </div>

            <a
              href="/quiz"
              style={{
                minHeight: "50px",
                padding: "0 22px",
                borderRadius: "14px",
                background: "white",
                color: "var(--primary-dark)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Start Learning →
            </a>
          </div>
        </section>

        {/* STAY CONNECTED */}
        <section
          className="sq-card social-connect-card"
          style={{
            marginTop: "20px",
            padding: "32px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {/* DECORATIVE CIRCLE */}
          <div
            style={{
              position: "absolute",
              right: "-70px",
              top: "-80px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background:
                "var(--primary-light)",
              opacity: 0.45,
              pointerEvents: "none",
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
            }}
          >
            <div className="sq-badge">
              Stay Connected
            </div>

            <h2
              style={{
                margin: "14px 0 8px",
                fontSize:
                  "clamp(24px, 4vw, 30px)",
                fontWeight: 900,
              }}
            >
              Don't miss the next
              Sahaba episode.
            </h2>

            <p
              style={{
                margin: 0,
                maxWidth: "720px",
                color: "var(--muted)",
                lineHeight: 1.7,
                fontSize: "15px",
              }}
            >
              Follow Sahaba Quest and join
              our WhatsApp communities to
              receive weekly{" "}
              <strong>
                Walking with the Sahaba
              </strong>{" "}
              episodes, platform updates,
              new challenges and other
              important announcements.
            </p>

            {/* SOCIAL LINKS */}
            <div
              className="social-connect-grid"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(4, minmax(0, 1fr))",
                gap: "14px",
                marginTop: "24px",
              }}
            >
              {/* INSTAGRAM */}
              <a
                href={SOCIAL_LINKS.instagram}
                onClick={(event) => {
                  if (
                    SOCIAL_LINKS.instagram ===
                    "#"
                  ) {
                    event.preventDefault();
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="social-connect-item"
                style={{
                  textDecoration: "none",
                  color: "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
                  transition:
                    "transform 0.2s ease, box-shadow 0.2s ease",
                  cursor:
                    SOCIAL_LINKS.instagram ===
                    "#"
                      ? "default"
                      : "pointer",
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "14px",
                    background:
                      "var(--primary-light)",
                    color: "#E1306C",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <InstagramIcon />
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "16px",
                  }}
                >
                  Instagram
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "var(--muted)",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  Coming soon
                </div>
              </a>

              {/* FACEBOOK */}
              <a
                href={SOCIAL_LINKS.facebook}
                onClick={(event) => {
                  if (
                    SOCIAL_LINKS.facebook ===
                    "#"
                  ) {
                    event.preventDefault();
                  }
                }}
                target="_blank"
                rel="noopener noreferrer"
                className="social-connect-item"
                style={{
                  textDecoration: "none",
                  color: "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
                  transition:
                    "transform 0.2s ease, box-shadow 0.2s ease",
                  cursor:
                    SOCIAL_LINKS.facebook ===
                    "#"
                      ? "default"
                      : "pointer",
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "14px",
                    background:
                      "var(--primary-light)",
                    color: "#1877F2",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <FacebookIcon />
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "16px",
                  }}
                >
                  Facebook
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "var(--muted)",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  Coming soon
                </div>
              </a>

              {/* BROTHERS WHATSAPP */}
              <a
                href={
                  SOCIAL_LINKS.brothersWhatsApp
                }
                target="_blank"
                rel="noopener noreferrer"
                className="social-connect-item"
                style={{
                  textDecoration: "none",
                  color: "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
                  transition:
                    "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "14px",
                    background:
                      "var(--primary-light)",
                    color: "#25D366",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <WhatsAppIcon />
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "16px",
                  }}
                >
                  Brothers' Group
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "var(--muted)",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  Join for weekly
                  episodes & updates →
                </div>
              </a>

              {/* SISTERS WHATSAPP */}
              <a
                href={
                  SOCIAL_LINKS.sistersWhatsApp
                }
                target="_blank"
                rel="noopener noreferrer"
                className="social-connect-item"
                style={{
                  textDecoration: "none",
                  color: "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
                  transition:
                    "transform 0.2s ease, box-shadow 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: "46px",
                    height: "46px",
                    borderRadius: "14px",
                    background:
                      "var(--primary-light)",
                    color: "#25D366",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: "14px",
                  }}
                >
                  <WhatsAppIcon />
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: "16px",
                  }}
                >
                  Sisters' Group
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    color: "var(--muted)",
                    fontSize: "12px",
                    lineHeight: 1.5,
                  }}
                >
                  Join for weekly
                  episodes & updates →
                </div>
              </a>
            </div>

            {/* WEEKLY EPISODE MESSAGE */}
            <div
              style={{
                marginTop: "18px",
                padding: "15px 18px",
                borderRadius: "15px",
                background:
                  "var(--primary-light)",
                color: "var(--primary-dark)",
                fontSize: "13px",
                lineHeight: 1.6,
                fontWeight: 700,
              }}
            >
              📖 New Sahaba episode every
              week — stay connected so you
              don't miss it.
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            padding: "28px 0 8px",
            textAlign: "center",
            color: "var(--muted-light)",
            fontSize: "12px",
          }}
        >
          Sahaba Quest • Learn.
          Remember. Compete.
        </footer>
      </div>

      {/* RESPONSIVE DASHBOARD FIX */}
      <style jsx>{`
        .social-connect-item:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 25px
            rgba(15, 118, 110, 0.08);
        }

        @media (max-width: 1000px) {
          .social-connect-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 800px) {
          .dashboard-main-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            width: 100% !important;
          }

          .dashboard-main-grid > * {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 600px) {
          nav {
            margin-bottom: 18px !important;
          }

          .dashboard-main-grid {
            gap: 16px !important;
          }

          .dashboard-main-grid .sq-card {
            padding: 22px !important;
          }

          .dashboard-main-grid
            .sq-card
            > div:first-child {
            min-width: 0;
          }

          .dashboard-main-grid
            .sq-card
            h2 {
            line-height: 1.25 !important;
          }

          .dashboard-main-grid
            .sq-card
            p {
            max-width: 100% !important;
          }

          .social-connect-card {
            padding: 22px !important;
          }

          .social-connect-grid {
            grid-template-columns:
              1fr !important;
          }

          .social-connect-item {
            min-height: 120px !important;
          }
        }
      `}</style>
    </main>
  );
}