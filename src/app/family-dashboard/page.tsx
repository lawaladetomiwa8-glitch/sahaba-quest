"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type Profile = {
  username: string | null;
  display_name: string | null;
  account_type: "free" | "individual" | "family";
};

type FamilyProgress = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

type FamilyQuestSession = {
  id: string;
  level: number;
  status: string;
  questions_answered: number;
  correct_answers: number;
  score: number;
  current_question_id: string | null;
  current_question_started_at: string | null;
  started_at: string;
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

export default function FamilyDashboardPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [progress, setProgress] =
    useState<FamilyProgress | null>(null);

  const [activeQuestSession, setActiveQuestSession] =
    useState<FamilyQuestSession | null>(null);

  const [subscription, setSubscription] =
    useState<Subscription | null>(null);

  const [message, setMessage] = useState(
    "Loading your Family Dashboard..."
  );

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      /*
       * AUTH USER
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      /*
       * PROFILE
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
          "Family profile lookup error:",
          profileError
        );

        setMessage(
          "We could not load your Family account."
        );

        return;
      }

      /*
       * FAMILY ACCOUNT GUARD
       *
       * Only Family accounts are allowed here.
       */
      if (
        profileData.account_type !== "family"
      ) {
        router.replace("/dashboard");
        return;
      }

      /*
       * FAMILY PROGRESS
       */
      const {
        data: progressData,
        error: progressError,
      } = await supabase
        .from("family_player_progress")
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
        .maybeSingle();

      if (progressError) {
        console.error(
          "Family progress lookup error:",
          progressError
        );

        setMessage(
          "We could not load your Family progress."
        );

        return;
      }

      /*
       * If progress does not exist yet,
       * create it through the existing RPC.
       */
      let familyProgress =
        progressData as FamilyProgress | null;

      if (!familyProgress) {
        const {
          data: createdProgress,
          error: createError,
        } = await supabase.rpc(
          "create_family_player_progress",
          {
            p_user_id: user.id,
          }
        );

        if (createError) {
          console.error(
            "Family progress creation error:",
            createError
          );

          setMessage(
            "We could not create your Family progress."
          );

          return;
        }

        familyProgress =
          createdProgress as FamilyProgress;
      }

      /*
       * ACTIVE FAMILY QUEST SESSION
       *
       * IMPORTANT: this is the Family Owner's quest only.
       * Family Member sessions always have family_member_id set,
       * so they are deliberately excluded here.
       */
      const {
        data: questSessionData,
        error: questSessionError,
      } = await supabase
        .from("game_sessions")
        .select(
          `
            id,
            level,
            status,
            questions_answered,
            correct_answers,
            score,
            current_question_id,
            current_question_started_at,
            started_at
          `
        )
        .eq("user_id", user.id)
        .eq("track", "family")
        .eq("status", "in_progress")
        .is("family_member_id", null)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (questSessionError) {
        console.error(
          "Family Quest session lookup error:",
          questSessionError
        );

        setActiveQuestSession(null);
      } else {
        setActiveQuestSession(
          questSessionData as FamilyQuestSession | null
        );
      }

      /*
       * ACTIVE FAMILY SUBSCRIPTION
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
          "Family subscription lookup error:",
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
            subscriptionResult
              .subscription_plans[0] ||
            null;
        } else {
          plan =
            subscriptionResult.subscription_plans ||
            null;
        }

        /*
         * Make sure this really is a Family plan.
         */
        if (
          plan?.plan_type === "family"
        ) {
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
      } else {
        setSubscription(null);
      }

      setProfile({
        username: profileData.username,
        display_name:
          profileData.display_name,
        account_type: "family",
      });

      setProgress(familyProgress);
      setMessage("");
    } catch (error) {
      console.error(
        "Family Dashboard loading error:",
        error
      );

      setMessage(
        "Something went wrong while loading your Family Dashboard."
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
                fontSize: "30px",
              }}
            >
              👨‍👩‍👧‍👦
            </div>

            <h1 className="sq-title">
              Family Dashboard
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

  const playerName =
    profile.display_name ||
    profile.username ||
    "Family";

  /*
   * CURRENT FAMILY QUEST PROGRESS
   *
   * Never derive the current level's 50-question progress
   * from lifetime family_player_progress totals.
   * The active game session is the source of truth for the
   * current level/attempt.
   */
  const currentQuestQuestions = Math.min(
    Number(activeQuestSession?.questions_answered ?? 0),
    50
  );

  const currentQuestCorrect = Math.min(
    Number(activeQuestSession?.correct_answers ?? 0),
    50
  );

  const accuracy =
    currentQuestQuestions > 0
      ? Math.round(
          (currentQuestCorrect / currentQuestQuestions) *
            100
        )
      : 0;

  const questionsInCurrentLevel =
    currentQuestQuestions;

  const correctInCurrentLevel =
    currentQuestCorrect;

  const levelQuestionProgress =
    Math.min(
      (questionsInCurrentLevel / 50) * 100,
      100
    );

  const levelCorrectProgress =
    Math.min(
      (correctInCurrentLevel / 25) * 100,
      100
    );

  const familyQuestActionLabel =
    activeQuestSession
      ? "Continue Family Quest"
      : "Start Family Quest";

  const displayLevel =
    activeQuestSession?.level ??
    progress.current_level;

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
                Level {displayLevel}
              </span>

              <span
                className="sq-badge"
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                }}
              >
                Family Account
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
              Welcome to your Family
              Sahaba Quest journey. Learn
              together, test your knowledge,
              and grow your family's
              understanding of the Sahabah.
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
                href="/family-quest"
                className="sq-button-primary"
              >
                👨‍👩‍👧‍👦 {familyQuestActionLabel}
              </a>

              <a
                href="/family-progress"
                className="sq-button-secondary"
              >
                View Progress
              </a>
            </div>
          </div>
        </section>

        {/* FAMILY ACCOUNT */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "22px 26px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #fffbeb 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
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
                Family Account
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Your Family Sahaba Quest
                experience with separate
                Family progress and Family XP.
              </p>
            </div>
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
              {displayLevel}
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
              Family XP
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
              Family experience earned
            </div>
          </div>

          <div className="sq-stat">
            <div className="sq-stat-label">
              Family Streak
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
              {correctInCurrentLevel} correct in this level
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
              justifyContent:
                "space-between",
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
                    "Sahaba Quest Family"}
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
                    ? "Your Family subscription is active."
                    : "Your Family account is ready for the Family experience."}
                </p>

                {subscription &&
                  subscriptionEndDate && (
                    <div
                      style={{
                        marginTop: "8px",
                        color:
                          "var(--success)",
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

          {/* FAMILY PROGRESS */}
          <div
            className="sq-card"
            style={{
              padding: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "flex-start",
                gap: "20px",
              }}
            >
              <div>
                <div className="sq-badge">
                  Family Journey
                </div>

                <h2
                  style={{
                    margin: "16px 0 6px",
                    fontSize: "24px",
                    fontWeight: 800,
                  }}
                >
                  Family Level{" "}
                  {displayLevel}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Keep learning together
                  and strengthen your
                  family's knowledge of
                  the Sahabah.
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
                  justifyContent:
                    "space-between",
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
                  Family Quest questions
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
                  justifyContent:
                    "space-between",
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
                  Questions Answered This Level
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {currentQuestQuestions}
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
                  {currentQuestCorrect}
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
              Family Actions
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
                href="/family-quest"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background:
                    "var(--primary)",
                  color: "white",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  👨‍👩‍👧‍👦 {familyQuestActionLabel}
                </span>

                <span>→</span>
              </a>

              <a
                href="/family-leaderboard"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background:
                    "var(--secondary-light)",
                  color: "#7c5d00",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  🏆 Family Leaderboard
                </span>

                <span>→</span>
              </a>

              <a
                href="/family-challenges"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "#f1f5f3",
                  color:
                    "var(--foreground)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  🎯 Family Challenges
                </span>

                <span>→</span>
              </a>

              <a
                href="/profile"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "#f1f5f3",
                  color:
                    "var(--foreground)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent:
                    "space-between",
                  textDecoration: "none",
                }}
              >
                <span>
                  👤 Family Profile
                </span>

                <span>→</span>
              </a>
            </div>
          </div>
        </section>

        {/* FAMILY LEARNING */}
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
              justifyContent:
                "space-between",
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
                  textTransform:
                    "uppercase",
                  opacity: 0.8,
                }}
              >
                Family Learning
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
                Make your Family Quest
                journey a shared learning
                experience. Discover the
                lives, sacrifices and
                lessons of the Sahabah
                together.
              </p>
            </div>

            <a
              href="/family-quest"
              style={{
                minHeight: "50px",
                padding: "0 22px",
                borderRadius: "14px",
                background: "white",
                color:
                  "var(--primary-dark)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent:
                  "center",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {activeQuestSession ? "Continue Family Learning →" : "Start Family Learning →"}
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
              episodes, Family updates,
              new challenges and other
              important announcements.
            </p>

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
                  color:
                    "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
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
                    justifyContent:
                      "center",
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
                  color:
                    "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
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
                    justifyContent:
                      "center",
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
                  }}
                >
                  Coming soon
                </div>
              </a>

              {/* BROTHERS */}
              <a
                href={
                  SOCIAL_LINKS.brothersWhatsApp
                }
                target="_blank"
                rel="noopener noreferrer"
                className="social-connect-item"
                style={{
                  textDecoration: "none",
                  color:
                    "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
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
                    justifyContent:
                      "center",
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
                  }}
                >
                  Join for weekly
                  episodes & updates →
                </div>
              </a>

              {/* SISTERS */}
              <a
                href={
                  SOCIAL_LINKS.sistersWhatsApp
                }
                target="_blank"
                rel="noopener noreferrer"
                className="social-connect-item"
                style={{
                  textDecoration: "none",
                  color:
                    "var(--foreground)",
                  padding: "20px",
                  borderRadius: "18px",
                  border:
                    "1px solid var(--border)",
                  background: "white",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "145px",
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
                    justifyContent:
                      "center",
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
                  }}
                >
                  Join for weekly
                  episodes & updates →
                </div>
              </a>
            </div>

            <div
              style={{
                marginTop: "18px",
                padding: "15px 18px",
                borderRadius: "15px",
                background:
                  "var(--primary-light)",
                color:
                  "var(--primary-dark)",
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
          Sahaba Quest • Family Learning.
          Remember. Learn. Grow Together.
        </footer>
      </div>

      <style jsx>{`
        .social-connect-item {
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

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
            grid-template-columns:
              1fr !important;
            gap: 16px !important;
            width: 100% !important;
          }

          .dashboard-main-grid > * {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 600px) {
          .dashboard-main-grid {
            gap: 16px !important;
          }

          .dashboard-main-grid .sq-card {
            padding: 22px !important;
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