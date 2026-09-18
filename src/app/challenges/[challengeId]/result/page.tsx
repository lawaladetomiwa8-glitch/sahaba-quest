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

  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
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
        throw new Error("Challenge not found.");
      }

      setChallenge(challengeData as Challenge);

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
        throw new Error("Challenge attempt not found.");
      }

      /*
       * If the attempt somehow isn't completed yet,
       * send the user back to the challenge.
       */
      if (attemptData.status !== "completed") {
        router.replace(
          `/challenges/${challengeId}?attempt=${attemptId}`
        );

        return;
      }

      setAttempt(attemptData as Attempt);
    } catch (error) {
      console.error("Result loading error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We couldn't load your challenge results."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * Loading state
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
              Loading your results...
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Error state
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
                  "We couldn't find the results for this challenge."}
              </p>

              <button
                type="button"
                className="sq-button-primary"
                onClick={() => router.push("/challenges")}
              >
                Back to Challenges
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  /*
   * Calculate result
   */
  const percentage =
    challenge.question_count > 0
      ? Math.round(
          (attempt.correct_answers / challenge.question_count) * 100
        )
      : 0;

  const xpEarned = attempt.score;

  /*
   * Use the stored passed value when available.
   * If an older record has passed = null,
   * calculate it using the 50% passing rule.
   */
  const passed =
    typeof attempt.passed === "boolean"
      ? attempt.passed
      : challenge.question_count > 0
        ? attempt.correct_answers >=
          Math.ceil(challenge.question_count / 2)
        : false;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
      }}
    >
      <AppNavbar />

      <div className="sq-page">
        <div className="sq-container result-container">
          {/* Header */}
          <section className="result-header">
            <div className="result-header-icon">
              {passed ? "🏆" : "📚"}
            </div>

            <span className="sq-badge">
              {challenge.challenge_type}
            </span>

            <h1 className="sq-title result-title">
              {challenge.icon} {challenge.title}
            </h1>

            <p className="sq-subtitle result-subtitle">
              Challenge completed. Here is your final result.
            </p>
          </section>

          {/* Result banner */}
          <section
            className={`sq-card result-banner ${
              passed ? "result-passed" : "result-failed"
            }`}
          >
            <div className="result-label">
              Final Result
            </div>

            <div
              className={`result-main-status ${
                passed ? "status-passed" : "status-failed"
              }`}
            >
              {passed
                ? "Challenge Passed! 🎉"
                : "Challenge Failed"}
            </div>

            <p className="result-description">
              {passed
                ? "Excellent work. You reached the required passing score."
                : "You did not reach the required 50% passing score. Keep learning and come back stronger."}
            </p>
          </section>

          {/* Main score */}
          <section className="sq-card result-score-card">
            <div className="result-score-grid">
              {/* Score */}
              <div className="result-score-item">
                <div className="result-score-label">
                  Score
                </div>

                <div className="result-score-number primary-score">
                  {attempt.score}
                </div>

                <div className="result-score-small">
                  XP
                </div>
              </div>

              {/* Correct */}
              <div className="result-score-item">
                <div className="result-score-label">
                  Correct
                </div>

                <div className="result-score-number">
                  {attempt.correct_answers}
                  <span className="result-score-total">
                    /{challenge.question_count}
                  </span>
                </div>

                <div className="result-score-small">
                  Answers
                </div>
              </div>

              {/* Accuracy */}
              <div className="result-score-item">
                <div className="result-score-label">
                  Accuracy
                </div>

                <div className="result-score-number">
                  {percentage}%
                </div>

                <div className="result-score-small">
                  Overall
                </div>
              </div>
            </div>
          </section>

          {/* Detailed breakdown */}
          <section className="sq-card breakdown-card">
            <h2 className="breakdown-title">
              Challenge Breakdown
            </h2>

            <div className="breakdown-list">
              {/* Questions */}
              <div className="breakdown-row">
                <span>Questions</span>

                <strong>
                  {challenge.question_count}
                </strong>
              </div>

              {/* Correct answers */}
              <div className="breakdown-row">
                <span>Correct answers</span>

                <strong>
                  {attempt.correct_answers}
                </strong>
              </div>

              {/* Passing score */}
              <div className="breakdown-row">
                <span>Passing score</span>

                <strong>
                  {Math.ceil(
                    challenge.question_count / 2
                  )}
                  /{challenge.question_count}
                </strong>
              </div>

              {/* XP */}
              <div className="breakdown-row breakdown-row-last">
                <span>XP earned</span>

                <strong className="xp-value">
                  +{xpEarned} XP
                </strong>
              </div>
            </div>
          </section>

          {/* Important one-attempt notice */}
          <section className="sq-card attempt-notice-card">
            <div className="attempt-notice">
              <div className="attempt-notice-icon">
                💡
              </div>

              <div className="attempt-notice-content">
                <div className="attempt-notice-title">
                  Challenge completed
                </div>

                <p className="attempt-notice-text">
                  This challenge uses a one-attempt
                  system. Your result has been saved
                  and you can review it from the
                  Challenges page.
                </p>
              </div>
            </div>
          </section>

          {/* Actions */}
          <section className="result-actions">
            <button
              type="button"
              className="sq-button-primary result-action-button"
              onClick={() => router.push("/challenges")}
            >
              Back to Challenges →
            </button>

            <button
              type="button"
              className="sq-button-secondary result-action-button"
              onClick={() => router.push("/dashboard")}
            >
              Go to Dashboard
            </button>
          </section>
        </div>
      </div>

      <style jsx>{`
        .result-container {
          max-width: 850px;
          width: 100%;
          box-sizing: border-box;
        }

        /* Header */

        .result-header {
          text-align: center;
          margin-bottom: 26px;
          width: 100%;
        }

        .result-header-icon {
          font-size: 58px;
          line-height: 1;
          margin-bottom: 12px;
        }

        .result-title {
          margin-top: 14px;
          overflow-wrap: anywhere;
          word-break: break-word;
        }

        .result-subtitle {
          max-width: 620px;
          margin: 8px auto 0;
        }

        /* Result banner */

        .result-banner {
          width: 100%;
          box-sizing: border-box;
          padding: 32px;
          margin-bottom: 18px;
          text-align: center;
        }

        .result-passed {
          border: 1px solid var(--primary);
          background: var(--primary-light);
        }

        .result-failed {
          border: 1px solid var(--border);
          background: var(--background);
        }

        .result-label {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.7px;
          color: var(--muted);
          margin-bottom: 8px;
        }

        .result-main-status {
          font-size: 34px;
          font-weight: 950;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .status-passed {
          color: var(--primary-dark);
        }

        .status-failed {
          color: var(--foreground);
        }

        .result-description {
          margin: 10px auto 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.6;
          max-width: 550px;
        }

        /* Score */

        .result-score-card {
          padding: 30px;
          margin-bottom: 18px;
          box-sizing: border-box;
        }

        .result-score-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .result-score-item {
          min-width: 0;
          padding: 20px 14px;
          border-radius: 14px;
          background: var(--muted-light);
          text-align: center;
          box-sizing: border-box;
        }

        .result-score-label {
          font-size: 12px;
          color: var(--muted);
          font-weight: 800;
          text-transform: uppercase;
        }

        .result-score-number {
          margin-top: 6px;
          font-size: 28px;
          font-weight: 900;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .primary-score {
          color: var(--primary);
        }

        .result-score-total {
          font-size: 16px;
          color: var(--muted);
        }

        .result-score-small {
          margin-top: 3px;
          font-size: 11px;
          color: var(--muted);
        }

        /* Breakdown */

        .breakdown-card {
          padding: 26px;
          margin-bottom: 18px;
          box-sizing: border-box;
        }

        .breakdown-title {
          margin: 0 0 18px;
          font-size: 19px;
          font-weight: 850;
        }

        .breakdown-list {
          display: grid;
          gap: 12px;
          width: 100%;
        }

        .breakdown-row {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
          box-sizing: border-box;
        }

        .breakdown-row span {
          color: var(--muted);
          font-size: 13px;
          min-width: 0;
        }

        .breakdown-row strong {
          flex-shrink: 0;
          text-align: right;
        }

        .breakdown-row-last {
          padding-bottom: 0;
          border-bottom: none;
        }

        .xp-value {
          color: var(--primary);
        }

        /* One-attempt notice */

        .attempt-notice-card {
          padding: 20px;
          margin-bottom: 22px;
          background: var(--muted-light);
          box-sizing: border-box;
        }

        .attempt-notice {
          display: flex;
          gap: 12px;
          align-items: flex-start;
          width: 100%;
        }

        .attempt-notice-icon {
          font-size: 22px;
          line-height: 1.3;
          flex-shrink: 0;
        }

        .attempt-notice-content {
          min-width: 0;
          flex: 1;
        }

        .attempt-notice-title {
          font-size: 14px;
          font-weight: 850;
          margin-bottom: 4px;
        }

        .attempt-notice-text {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        /* Actions */

        .result-actions {
          width: 100%;
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
          box-sizing: border-box;
        }

        .result-action-button {
          min-height: 46px;
        }

        /* Mobile */

        @media (max-width: 650px) {
          .result-container {
            width: 100%;
            padding-left: 14px;
            padding-right: 14px;
          }

          .result-header {
            margin-bottom: 20px;
          }

          .result-header-icon {
            font-size: 48px;
            margin-bottom: 10px;
          }

          .result-title {
            font-size: 27px;
            line-height: 1.2;
            padding: 0 4px;
          }

          .result-subtitle {
            font-size: 13px;
            line-height: 1.6;
            padding: 0 8px;
          }

          .result-banner {
            padding: 24px 16px !important;
            margin-bottom: 12px;
          }

          .result-label {
            font-size: 11px;
          }

          .result-main-status {
            font-size: 26px;
            line-height: 1.25;
          }

          .result-description {
            font-size: 13px;
            line-height: 1.55;
          }

          .result-score-card {
            padding: 14px;
            margin-bottom: 12px;
          }

          .result-score-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .result-score-item {
            width: 100%;
            padding: 17px 14px;
          }

          .result-score-number {
            font-size: 27px;
          }

          .breakdown-card {
            padding: 20px 16px;
            margin-bottom: 12px;
          }

          .breakdown-title {
            font-size: 18px;
            margin-bottom: 16px;
          }

          .breakdown-list {
            gap: 10px;
          }

          .breakdown-row {
            gap: 10px;
            padding-bottom: 11px;
          }

          .breakdown-row span {
            font-size: 12px;
            line-height: 1.4;
          }

          .breakdown-row strong {
            font-size: 13px;
          }

          .attempt-notice-card {
            padding: 16px;
            margin-bottom: 18px;
          }

          .attempt-notice {
            gap: 9px;
          }

          .attempt-notice-icon {
            font-size: 20px;
          }

          .attempt-notice-title {
            font-size: 13px;
          }

          .attempt-notice-text {
            font-size: 11px;
            line-height: 1.55;
          }

          .result-actions {
            flex-direction: column;
            width: 100%;
            gap: 9px;
          }

          .result-action-button {
            width: 100%;
            min-height: 48px;
            box-sizing: border-box;
          }
        }

        @media (max-width: 380px) {
          .result-container {
            padding-left: 10px;
            padding-right: 10px;
          }

          .result-banner {
            padding: 22px 13px !important;
          }

          .result-main-status {
            font-size: 23px;
          }

          .result-score-card {
            padding: 10px;
          }

          .breakdown-card {
            padding: 18px 13px;
          }

          .attempt-notice-card {
            padding: 14px;
          }
        }
      `}</style>
    </main>
  );
}