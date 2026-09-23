"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type ProgressData = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

const TOTAL_QUESTIONS_PER_LEVEL = 50;
const PASS_MARK = 25;

export default function FamilyProgressPage() {
  const router = useRouter();

  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [displayName, setDisplayName] = useState("Family");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadProgress();
  }, []);

  async function loadProgress() {
    setLoading(true);
    setMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setMessage("You are not logged in.");
        return;
      }

      /*
       * FAMILY ACCOUNT CHECK
       */
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, account_type")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      if (profile.account_type !== "family") {
        router.replace("/dashboard");
        return;
      }

      /*
       * FAMILY PROGRESS
       *
       * IMPORTANT:
       * current_level is determined by Family Quest pass/fail.
       * total_xp is a separate reward system and must NOT determine level.
       */
      let { data: familyProgress, error: progressError } = await supabase
        .from("family_player_progress")
        .select(
          "current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak"
        )
        .eq("user_id", user.id)
        .maybeSingle();

      if (progressError) throw progressError;

      if (!familyProgress) {
        const { error: createError } = await supabase.rpc(
          "create_family_player_progress",
          {
            p_user_id: user.id,
          }
        );

        if (createError) throw createError;

        const { data: createdProgress, error: reloadError } =
          await supabase
            .from("family_player_progress")
            .select(
              "current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak"
            )
            .eq("user_id", user.id)
            .single();

        if (reloadError) throw reloadError;

        familyProgress = createdProgress;
      }

      setDisplayName(profile.display_name || "Family");
      setProgress(familyProgress as ProgressData);
    } catch (error: any) {
      console.error("Family progress loading error:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error,
      });

      setMessage(
        error?.message ||
          "We couldn't load your Family progress."
      );
    } finally {
      setLoading(false);
    }
  }

  const accuracy =
    progress && progress.questions_answered > 0
      ? Math.round(
          (progress.correct_answers /
            progress.questions_answered) *
            100
        )
      : 0;

  /*
   * LEVEL PROGRESSION
   *
   * XP does NOT determine this.
   * The current_level value comes from the Family Quest pass result.
   *
   * A Family Quest contains 50 questions.
   * A score of 25/50 or more passes the level.
   * Passing advances the player to the next level.
   * Failing keeps the player on the same level while XP is retained.
   */
  const currentLevel = progress?.current_level ?? 1;
  const nextLevel = currentLevel + 1;

  if (loading) {
    return (
      <main className="sq-page">
        <div
          className="sq-container"
          style={{
            minHeight: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="sq-timer"
              style={{
                margin: "0 auto 20px",
                width: "64px",
                height: "64px",
                fontSize: "18px",
              }}
            >
              👨‍👩‍👧‍👦
            </div>

            <h2 style={{ margin: 0 }}>
              Loading Family progress...
            </h2>

            <p className="sq-subtitle">
              We're getting your latest Family learning statistics.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (message || !progress) {
    return (
      <main className="sq-page">
        <AppNavbar />

        <div
          className="sq-container"
          style={{
            minHeight: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="sq-card"
            style={{
              maxWidth: "560px",
              width: "100%",
              padding: "36px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "44px", marginBottom: "12px" }}>
              👨‍👩‍👧‍👦
            </div>

            <h2 style={{ marginTop: 0 }}>
              Unable to load Family progress
            </h2>

            <p className="sq-subtitle">
              {message || "Family progress is currently unavailable."}
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: "20px",
              }}
            >
              <Link
                href="/family-dashboard"
                className="sq-button-primary"
              >
                Family Dashboard
              </Link>

              <Link
                href="/family-challenges"
                className="sq-button-secondary"
              >
                Family Challenges
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
      }}
    >
      <AppNavbar />

      <div className="sq-page">
        <div className="sq-container">

          {/* HEADER */}
          <section style={{ marginBottom: "32px" }}>
            <span className="sq-badge">
              Family learning journey
            </span>

            <h1
              className="sq-title"
              style={{ marginTop: "16px" }}
            >
              Family Progress, {displayName} 📈
            </h1>

            <p className="sq-subtitle">
              Track your Family XP, Quest performance, streaks, and level
              achievements.
            </p>
          </section>

          {/* STAT CARDS */}
          <section
            className="family-progress-stats"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "18px",
              marginBottom: "24px",
            }}
          >
            <div className="sq-stat">
              <div className="sq-stat-label">
                Family XP
              </div>

              <div className="sq-stat-value">
                {progress.total_xp.toLocaleString()}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Earned from correct answers
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">
                Family Level
              </div>

              <div className="sq-stat-value">
                {currentLevel}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--muted)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Based on Quest pass marks
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">
                Family Accuracy
              </div>

              <div className="sq-stat-value">
                {accuracy}%
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--success)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Overall answer accuracy
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">
                Family Streak
              </div>

              <div className="sq-stat-value">
                {progress.current_streak} 🔥
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--secondary)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Best: {progress.best_streak}
              </div>
            </div>
          </section>

          {/* LEVEL / PASS PROGRESSION */}
          <section
            className="sq-card"
            style={{
              padding: "28px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "24px",
                marginBottom: "24px",
              }}
            >
              <div>
                <span className="sq-badge">
                  Family Level {currentLevel}
                </span>

                <h2
                  style={{
                    margin: "14px 0 6px",
                    fontSize: "24px",
                    fontWeight: 800,
                  }}
                >
                  Family Quest progression
                </h2>

                <p className="sq-subtitle">
                  Your level is determined by successfully passing the Family
                  Quest, not by your XP.
                </p>
              </div>

              <div
                style={{
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    color: "var(--primary)",
                  }}
                >
                  {TOTAL_QUESTIONS_PER_LEVEL} Questions
                </div>

                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    marginTop: "4px",
                  }}
                >
                  per Family Quest level
                </div>
              </div>
            </div>

            {/* PASS MARK */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "14px",
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  padding: "18px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Current Level
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "28px",
                    fontWeight: 900,
                  }}
                >
                  Level {currentLevel}
                </div>
              </div>

              <div
                style={{
                  padding: "18px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Pass Mark
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "28px",
                    fontWeight: 900,
                  }}
                >
                  {PASS_MARK} / {TOTAL_QUESTIONS_PER_LEVEL}
                </div>
              </div>

              <div
                style={{
                  padding: "18px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 600,
                  }}
                >
                  Next Level
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "28px",
                    fontWeight: 900,
                  }}
                >
                  Level {nextLevel}
                </div>
              </div>
            </div>

            {/* PROGRESSION EXPLANATION */}
            <div
              style={{
                padding: "20px",
                borderRadius: "18px",
                background: "var(--primary-light)",
                border: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontWeight: 800,
                  fontSize: "16px",
                }}
              >
                <span style={{ fontSize: "22px" }}>🎯</span>
                How Family levels work
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginTop: "16px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: "6px",
                    }}
                  >
                    Pass the Quest
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      fontSize: "14px",
                    }}
                  >
                    Answer at least {PASS_MARK} of the{" "}
                    {TOTAL_QUESTIONS_PER_LEVEL} questions correctly to pass
                    the current level and unlock Level {nextLevel}.
                  </p>
                </div>

                <div>
                  <div
                    style={{
                      fontWeight: 800,
                      marginBottom: "6px",
                    }}
                  >
                    XP is retained
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      lineHeight: 1.6,
                      fontSize: "14px",
                    }}
                  >
                    XP is earned from correct answers and remains yours even
                    when you fail a level and need to retake it.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* PERFORMANCE */}
          <section
            className="family-progress-performance"
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: "24px",
            }}
          >
            {/* QUESTIONS */}
            <div
              className="sq-card"
              style={{
                padding: "28px",
              }}
            >
              <div className="sq-badge">
                Family Performance
              </div>

              <h2
                style={{
                  margin: "16px 0 22px",
                  fontSize: "24px",
                  fontWeight: 800,
                }}
              >
                Family question statistics
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: "#f8faf9",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Questions Answered
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress.questions_answered}
                  </div>
                </div>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: "#f8faf9",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Correct Answers
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress.correct_answers}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "22px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Overall Accuracy
                  </span>

                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "var(--primary)",
                    }}
                  >
                    {accuracy}%
                  </span>
                </div>

                <div className="sq-progress">
                  <div
                    className="sq-progress-bar"
                    style={{
                      width: `${accuracy}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* STREAK */}
            <div
              className="sq-card"
              style={{
                padding: "28px",
                background:
                  "linear-gradient(145deg, var(--primary-dark), var(--primary))",
                color: "white",
                border: "none",
              }}
            >
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  borderRadius: "18px",
                  background: "rgba(255,255,255,0.13)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                🔥
              </div>

              <h2
                style={{
                  margin: "20px 0 8px",
                  fontSize: "25px",
                  fontWeight: 800,
                }}
              >
                Keep the Family streak alive
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.6,
                  fontSize: "14px",
                }}
              >
                Answer questions correctly to keep building your Family
                streak and earn bonus Family XP.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "28px",
                  marginTop: "28px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress.current_streak}
                  </div>

                  <div
                    style={{
                      color: "rgba(255,255,255,0.65)",
                      fontSize: "12px",
                    }}
                  >
                    Current
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress.best_streak}
                  </div>

                  <div
                    style={{
                      color: "rgba(255,255,255,0.65)",
                      fontSize: "12px",
                    }}
                  >
                    Best
                  </div>
                </div>
              </div>

              <Link
                href="/family-quest"
                className="sq-button-secondary"
                style={{
                  marginTop: "28px",
                  width: "100%",
                  border: "none",
                }}
              >
                Continue Family Quest
              </Link>
            </div>
          </section>

          {/* FAMILY NAVIGATION */}
          <section
            className="sq-card"
            style={{
              padding: "24px",
              marginTop: "24px",
            }}
          >
            <h2
              style={{
                margin: "0 0 16px",
                fontSize: "20px",
                fontWeight: 800,
              }}
            >
              Continue your Family journey
            </h2>

            <div
              className="family-progress-navigation"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
              }}
            >
              <Link
                href="/family-dashboard"
                className="sq-button-secondary"
                style={{ textAlign: "center" }}
              >
                Family Dashboard
              </Link>

              <Link
                href="/family-challenges"
                className="sq-button-secondary"
                style={{ textAlign: "center" }}
              >
                Family Challenges
              </Link>

              <Link
                href="/family-leaderboard"
                className="sq-button-secondary"
                style={{ textAlign: "center" }}
              >
                Family Leaderboard
              </Link>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .family-progress-stats {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .family-progress-performance {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 700px) {
          .family-progress-stats {
            grid-template-columns: 1fr !important;
          }

          .family-progress-performance {
            grid-template-columns: 1fr !important;
          }

          .family-progress-performance > div:first-child > div:nth-child(3) {
            grid-template-columns: 1fr !important;
          }

          .family-progress-navigation {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 650px) {
          .family-progress-performance > div:first-child > div:nth-child(3) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
