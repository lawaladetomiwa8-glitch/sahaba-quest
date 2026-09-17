"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";
import { AppNavbar } from "../../../../components/ui";

type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  challenge_type: string;
  question_count: number;
  time_per_question: number;
};

type Attempt = {
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

export default function ChallengeResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const challengeId = params.challengeId as string;
  const attemptId = searchParams.get("attempt");

  const [challenge, setChallenge] =
    useState<Challenge | null>(null);

  const [attempt, setAttempt] =
    useState<Attempt | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    if (!challengeId || !attemptId) {
      setErrorMessage(
        "This result page is missing the challenge or attempt information."
      );

      setLoading(false);
      return;
    }

    loadResults();
  }, [challengeId, attemptId]);

  async function loadResults() {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      /*
       * Load challenge information
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
        throw new Error(
          "Challenge not found."
        );
      }

      setChallenge(
        challengeData as Challenge
      );

      /*
       * Load the user's attempt
       */
      const {
        data: attemptData,
        error: attemptError,
      } = await supabase
        .from("challenge_attempts")
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
        throw new Error(
          "Challenge attempt not found."
        );
      }

      /*
       * If the attempt somehow isn't completed yet,
       * send the user back to the challenge.
       */
      if (
        attemptData.status !== "completed"
      ) {
        router.replace(
          `/challenges/${challengeId}?attempt=${attemptId}`
        );

        return;
      }

      setAttempt(
        attemptData as Attempt
      );
    } catch (error) {
      console.error(
        "Result loading error:",
        error
      );

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't load your challenge results."
      );
    } finally {
      setLoading(false);
    }
  }

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
                padding: "50px",
                textAlign: "center",
                color: "var(--muted)",
              }}
            >
              Loading your results...
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
    errorMessage ||
    !challenge ||
    !attempt
  ) {
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
                  "We couldn't find the results for this challenge."}
              </p>

              <button
                type="button"
                className="sq-button-primary"
                onClick={() =>
                  router.push("/challenges")
                }
              >
                Back to Challenges
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const percentage =
    challenge.question_count > 0
      ? Math.round(
          (attempt.correct_answers /
            challenge.question_count) *
            100
        )
      : 0;

  const xpEarned = attempt.score;

  const passed =
    attempt.passed === true;

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
          {/* Header */}
          <section
            style={{
              textAlign: "center",
              marginBottom: "26px",
            }}
          >
            <div
              style={{
                fontSize: "58px",
                marginBottom: "12px",
              }}
            >
              {passed ? "🏆" : "📚"}
            </div>

            <span className="sq-badge">
              {challenge.challenge_type}
            </span>

            <h1
              className="sq-title"
              style={{
                marginTop: "14px",
              }}
            >
              {challenge.icon}{" "}
              {challenge.title}
            </h1>

            <p
              className="sq-subtitle"
              style={{
                maxWidth: "620px",
                margin: "8px auto 0",
              }}
            >
              Challenge completed. Here is your
              final result.
            </p>
          </section>

          {/* Result banner */}
          <section
            className="sq-card"
            style={{
              padding: "32px",
              marginBottom: "18px",
              textAlign: "center",
              border:
                passed
                  ? "1px solid var(--primary)"
                  : "1px solid var(--border)",
              background:
                passed
                  ? "var(--primary-light)"
                  : "var(--background)",
            }}
          >
            <div
              style={{
                fontSize: "13px",
                fontWeight: 900,
                textTransform: "uppercase",
                letterSpacing: "0.7px",
                color: "var(--muted)",
                marginBottom: "8px",
              }}
            >
              Final Result
            </div>

            <div
              style={{
                fontSize: "34px",
                fontWeight: 950,
                color: passed
                  ? "var(--primary-dark)"
                  : "var(--foreground)",
              }}
            >
              {passed
                ? "Challenge Passed! 🎉"
                : "Challenge Completed"}
            </div>

            <p
              style={{
                margin: "10px auto 0",
                color: "var(--muted)",
                fontSize: "14px",
                lineHeight: 1.6,
                maxWidth: "550px",
              }}
            >
              {passed
                ? "Excellent work. You reached the required passing score."
                : "You completed the challenge. Keep learning and continue building your Sahaba knowledge."}
            </p>
          </section>

          {/* Main score */}
          <section
            className="sq-card"
            style={{
              padding: "30px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, 1fr)",
                gap: "14px",
              }}
            >
              <div
                style={{
                  padding: "20px 14px",
                  borderRadius: "14px",
                  background:
                    "var(--muted-light)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Score
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "28px",
                    fontWeight: 900,
                    color: "var(--primary)",
                  }}
                >
                  {attempt.score}
                </div>

                <div
                  style={{
                    marginTop: "3px",
                    fontSize: "11px",
                    color: "var(--muted)",
                  }}
                >
                  XP
                </div>
              </div>

              <div
                style={{
                  padding: "20px 14px",
                  borderRadius: "14px",
                  background:
                    "var(--muted-light)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Correct
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "28px",
                    fontWeight: 900,
                  }}
                >
                  {attempt.correct_answers}
                  <span
                    style={{
                      fontSize: "16px",
                      color: "var(--muted)",
                    }}
                  >
                    /{challenge.question_count}
                  </span>
                </div>

                <div
                  style={{
                    marginTop: "3px",
                    fontSize: "11px",
                    color: "var(--muted)",
                  }}
                >
                  Answers
                </div>
              </div>

              <div
                style={{
                  padding: "20px 14px",
                  borderRadius: "14px",
                  background:
                    "var(--muted-light)",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--muted)",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  Accuracy
                </div>

                <div
                  style={{
                    marginTop: "6px",
                    fontSize: "28px",
                    fontWeight: 900,
                  }}
                >
                  {percentage}%
                </div>

                <div
                  style={{
                    marginTop: "3px",
                    fontSize: "11px",
                    color: "var(--muted)",
                  }}
                >
                  Overall
                </div>
              </div>
            </div>
          </section>

          {/* Detailed breakdown */}
          <section
            className="sq-card"
            style={{
              padding: "26px",
              marginBottom: "18px",
            }}
          >
            <h2
              style={{
                margin: "0 0 18px",
                fontSize: "19px",
                fontWeight: 850,
              }}
            >
              Challenge Breakdown
            </h2>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "15px",
                  paddingBottom: "12px",
                  borderBottom:
                    "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  Questions
                </span>

                <strong>
                  {challenge.question_count}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "15px",
                  paddingBottom: "12px",
                  borderBottom:
                    "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  Correct answers
                </span>

                <strong>
                  {attempt.correct_answers}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "15px",
                  paddingBottom: "12px",
                  borderBottom:
                    "1px solid var(--border)",
                }}
              >
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  Passing score
                </span>

                <strong>
                  {Math.ceil(
                    challenge.question_count / 2
                  )}
                  /{challenge.question_count}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: "15px",
                }}
              >
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  XP earned
                </span>

                <strong
                  style={{
                    color: "var(--primary)",
                  }}
                >
                  +{xpEarned} XP
                </strong>
              </div>
            </div>
          </section>

          {/* Important one-attempt notice */}
          <section
            className="sq-card"
            style={{
              padding: "20px",
              marginBottom: "22px",
              background:
                "var(--muted-light)",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  fontSize: "22px",
                }}
              >
                💡
              </div>

              <div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 850,
                    marginBottom: "4px",
                  }}
                >
                  Challenge completed
                </div>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "12px",
                    lineHeight: 1.6,
                  }}
                >
                  This challenge uses a one-attempt
                  system. Your result has been saved
                  and you can review it from the
                  Challenges page.
                </p>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="sq-button-primary"
              onClick={() =>
                router.push("/challenges")
              }
            >
              Back to Challenges →
            </button>

            <button
              type="button"
              className="sq-button-secondary"
              onClick={() =>
                router.push("/dashboard")
              }
            >
              Go to Dashboard
            </button>
          </section>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 650px) {
          .sq-container {
            padding-left: 14px;
            padding-right: 14px;
          }
        }
      `}</style>
    </main>
  );
}