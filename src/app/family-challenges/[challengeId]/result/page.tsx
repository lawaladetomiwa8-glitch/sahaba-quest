"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { AppNavbar } from "../../../../components/ui";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  challenge_type: string | null;
  question_count: number;
  time_per_question: number;
};

type FamilyAttempt = {
  id: string;
  challenge_id: string;
  score: number;
  questions_answered: number;
  correct_answers: number;
  status: "in_progress" | "completed";
  passed: boolean | null;
  started_at: string;
  completed_at: string | null;
};

export default function FamilyChallengeResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const challengeId = params.challengeId as string;
  const attemptId = searchParams.get("attempt");

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempt, setAttempt] = useState<FamilyAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!challengeId || !attemptId) {
      setErrorMessage(
        "This result page is missing the challenge or attempt information."
      );
      setLoading(false);
      return;
    }

    void loadResults();
  }, [challengeId, attemptId]);

  async function loadResults() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.push("/login");
        return;
      }

      /*
       * ---------------------------------------------------------
       * FAMILY ACCOUNT CHECK
       * ---------------------------------------------------------
       */
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (!profile || profile.account_type !== "family") {
        router.replace("/dashboard");
        return;
      }

      /*
       * ---------------------------------------------------------
       * LOAD CHALLENGE
       * ---------------------------------------------------------
       */
      const {
        data: challengeData,
        error: challengeError,
      } = await supabase
        .from("challenges")
        .select(
          `
            id,
            title,
            description,
            icon,
            challenge_type,
            question_count,
            time_per_question
          `
        )
        .eq("id", challengeId)
        .eq("is_active", true)
        .maybeSingle();

      if (challengeError) {
        throw challengeError;
      }

      if (!challengeData) {
        throw new Error("Challenge not found.");
      }

      setChallenge(challengeData as Challenge);

      /*
       * ---------------------------------------------------------
       * LOAD FAMILY ATTEMPT
       * ---------------------------------------------------------
       *
       * The query is restricted to:
       * - this attempt ID
       * - this challenge ID
       * - the authenticated user's ID
       *
       * RLS also protects the table.
       */
      const {
        data: attemptData,
        error: attemptError,
      } = await supabase
        .from("family_challenge_attempts")
        .select(
          `
            id,
            challenge_id,
            score,
            questions_answered,
            correct_answers,
            status,
            passed,
            started_at,
            completed_at
          `
        )
        .eq("id", attemptId)
        .eq("user_id", user.id)
        .eq("challenge_id", challengeId)
        .maybeSingle();

      if (attemptError) {
        throw attemptError;
      }

      if (!attemptData) {
        throw new Error("Family challenge attempt not found.");
      }

      /*
       * If the attempt is not completed yet, return the user
       * to the Family Challenge gameplay page.
       */
      if (attemptData.status !== "completed") {
        router.replace(
          `/family-challenges/${challengeId}?attempt=${attemptId}`
        );
        return;
      }

      setAttempt(attemptData as FamilyAttempt);
    } catch (error: any) {
      console.error("Family result loading error:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error,
      });

      setErrorMessage(
        error?.message ||
          "We couldn't load your Family Challenge results."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */
  if (loading) {
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
            <div
              className="sq-card"
              style={{
                padding: "50px 20px",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Loading your Family Challenge results...
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * ERROR
   * ---------------------------------------------------------
   */
  if (errorMessage || !challenge || !attempt) {
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
            <div
              className="sq-card"
              style={{
                padding: "45px 30px",
                textAlign: "center",
                maxWidth: "700px",
                margin: "0 auto",
              }}
            >
              <div
                style={{
                  fontSize: "46px",
                  marginBottom: "16px",
                }}
              >
                ⚠️
              </div>

              <h1
                style={{
                  margin: "0 0 10px",
                  fontSize: "25px",
                  fontWeight: 900,
                }}
              >
                Results unavailable
              </h1>

              <p
                style={{
                  margin: "0 auto 24px",
                  color: "var(--muted)",
                  lineHeight: 1.7,
                  maxWidth: "520px",
                }}
              >
                {errorMessage ||
                  "We couldn't find the results for this Family Challenge."}
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="sq-button-primary"
                  onClick={() => router.push("/family-challenges")}
                >
                  Back to Family Challenges
                </button>

                <button
                  type="button"
                  onClick={() => router.push("/family-dashboard")}
                  style={{
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  Family Dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * RESULT CALCULATIONS
   * ---------------------------------------------------------
   */
  const percentage =
    challenge.question_count > 0
      ? Math.round(
          (attempt.correct_answers / challenge.question_count) * 100
        )
      : 0;

  const passingScore = Math.ceil(challenge.question_count / 2);

  const passed =
    typeof attempt.passed === "boolean"
      ? attempt.passed
      : attempt.correct_answers >= passingScore;

  const questionsAnswered = Math.min(
    attempt.questions_answered,
    challenge.question_count
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
      }}
    >
      <AppNavbar />

      <div className="sq-page">
        <div
          className="sq-container"
          style={{
            maxWidth: "850px",
          }}
        >
          {/* HEADER */}
          <section
            style={{
              textAlign: "center",
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                width: "76px",
                height: "76px",
                margin: "0 auto 16px",
                borderRadius: "24px",
                display: "grid",
                placeItems: "center",
                fontSize: "36px",
                background: passed
                  ? "var(--primary-light)"
                  : "var(--danger-light)",
              }}
            >
              {passed ? "🏆" : "📚"}
            </div>

            <span className="sq-badge">
              Family Challenge
            </span>

            <h1
              className="sq-title"
              style={{
                marginTop: "12px",
              }}
            >
              {challenge.icon || "🏆"} {challenge.title}
            </h1>

            <p
              style={{
                margin: "10px auto 0",
                maxWidth: "600px",
                color: "var(--muted)",
                lineHeight: 1.7,
              }}
            >
              Your Family Challenge is complete. Here is your final result.
            </p>
          </section>

          {/* RESULT BANNER */}
          <section
            className="sq-card"
            style={{
              padding: "28px",
              marginBottom: "18px",
              textAlign: "center",
              border: passed
                ? "1px solid var(--primary-light)"
                : "1px solid var(--danger-light)",
              background: passed
                ? "var(--primary-light)"
                : "var(--danger-light)",
            }}
          >
            <div
              style={{
                fontSize: "12px",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "var(--muted)",
                marginBottom: "8px",
              }}
            >
              Final Result
            </div>

            <div
              style={{
                fontSize: "30px",
                fontWeight: 950,
                color: passed
                  ? "var(--primary)"
                  : "var(--danger)",
              }}
            >
              {passed
                ? "Challenge Passed! 🎉"
                : "Challenge Not Passed"}
            </div>

            <p
              style={{
                margin: "9px auto 0",
                maxWidth: "560px",
                color: "var(--muted)",
                lineHeight: 1.6,
              }}
            >
              {passed
                ? "Excellent work. You reached the required 50% passing score."
                : "You did not reach the required 50% passing score. Keep learning and try again when another Family Challenge is available."}
            </p>
          </section>

          {/* MAIN STATS */}
          <section
            className="sq-card"
            style={{
              padding: "24px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "12px",
              }}
            >
              <div
                style={{
                  textAlign: "center",
                  padding: "18px 10px",
                  borderRadius: "16px",
                  background: "var(--background)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  FAMILY XP
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "30px",
                    fontWeight: 950,
                    color: "var(--primary)",
                  }}
                >
                  {attempt.score}
                </div>
              </div>

              <div
                style={{
                  textAlign: "center",
                  padding: "18px 10px",
                  borderRadius: "16px",
                  background: "var(--background)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  CORRECT
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "30px",
                    fontWeight: 950,
                  }}
                >
                  {attempt.correct_answers}
                  <span
                    style={{
                      fontSize: "15px",
                      color: "var(--muted)",
                    }}
                  >
                    /{challenge.question_count}
                  </span>
                </div>
              </div>

              <div
                style={{
                  textAlign: "center",
                  padding: "18px 10px",
                  borderRadius: "16px",
                  background: "var(--background)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 800,
                  }}
                >
                  ACCURACY
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "30px",
                    fontWeight: 950,
                  }}
                >
                  {percentage}%
                </div>
              </div>
            </div>
          </section>

          {/* BREAKDOWN */}
          <section
            className="sq-card"
            style={{
              padding: "24px",
              marginBottom: "18px",
            }}
          >
            <h2
              style={{
                margin: "0 0 18px",
                fontSize: "20px",
                fontWeight: 900,
              }}
            >
              Challenge Breakdown
            </h2>

            <div
              style={{
                display: "grid",
                gap: "0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "15px",
                  padding: "14px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>
                  Questions answered
                </span>

                <strong>
                  {questionsAnswered}/{challenge.question_count}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "15px",
                  padding: "14px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>
                  Correct answers
                </span>

                <strong>
                  {attempt.correct_answers}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "15px",
                  padding: "14px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span style={{ color: "var(--muted)" }}>
                  Passing score
                </span>

                <strong>
                  {passingScore}/{challenge.question_count}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "15px",
                  padding: "14px 0",
                }}
              >
                <span style={{ color: "var(--muted)" }}>
                  Result
                </span>

                <strong
                  style={{
                    color: passed
                      ? "var(--primary)"
                      : "var(--danger)",
                  }}
                >
                  {passed ? "Passed" : "Not Passed"}
                </strong>
              </div>
            </div>
          </section>

          {/* FAMILY NOTICE */}
          <section
            className="sq-card"
            style={{
              padding: "20px",
              marginBottom: "22px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "12px",
                  background: "var(--primary-light)",
                  fontSize: "20px",
                }}
              >
                👨‍👩‍👧‍👦
              </div>

              <div>
                <strong
                  style={{
                    display: "block",
                    marginBottom: "4px",
                  }}
                >
                  Family Progress
                </strong>

                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  This result belongs to your Family Challenge progress.
                  Your Family XP and Family leaderboard remain separate from
                  Individual progress.
                </span>
              </div>
            </div>
          </section>

          {/* ACTIONS */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "12px",
              marginBottom: "35px",
            }}
          >
            <button
              type="button"
              className="sq-button-primary"
              onClick={() => router.push("/family-challenges")}
              style={{
                width: "100%",
              }}
            >
              ← Family Challenges
            </button>

            <button
              type="button"
              onClick={() => router.push("/family-dashboard")}
              style={{
                width: "100%",
                padding: "13px 18px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Family Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* RESPONSIVE STYLES */}
      <style jsx>{`
        @media (max-width: 650px) {
          .sq-container {
            padding-left: 14px;
            padding-right: 14px;
          }

          .sq-title {
            font-size: 28px;
          }

          .result-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}
