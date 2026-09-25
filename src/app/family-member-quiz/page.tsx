"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type Progress = {
  member_id: string;
  display_name: string;
  family_id: string;
  total_xp: number;
  current_level: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
  accuracy: number;
  family_total_xp: number;
  family_member_count: number;
};

type GameSession = {
  session_id: string;
  member_id: string;
  family_id: string;
  display_name: string;
  level: number;
  track: string;
  started_at: string;
};

type QuizQuestion = {
  id: string;
  level: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type AnswerResult = {
  member_id: string;
  display_name: string;
  family_id: string;
  is_correct: boolean;
  correct_answer: string;
  explanation: string | null;
  xp_earned: number;
  current_streak: number;
  best_streak: number;
  level_completed: boolean;
  level_passed: boolean;
  current_level: number;
  questions_answered_in_level: number;
  correct_answers_in_attempt: number;
  questions_required: number;
  correct_required_to_pass: number;
};

const SESSION_KEY =
  "sahabaquest_family_member_session";

const QUESTION_TIME_SECONDS = 30;

const OPTIONS = [
  { key: "A", field: "option_a" as const },
  { key: "B", field: "option_b" as const },
  { key: "C", field: "option_c" as const },
  { key: "D", field: "option_d" as const },
];

export default function FamilyMemberQuizPage() {
  const router = useRouter();

  // React Strict Mode intentionally runs effects twice in development.
  // This guard prevents two quiz sessions from being created at once.
  const quizStartedRef = useRef(false);

  const [progress, setProgress] =
    useState<Progress | null>(null);

  const [gameSession, setGameSession] =
    useState<GameSession | null>(null);

  const [question, setQuestion] =
    useState<QuizQuestion | null>(null);

  const [selectedAnswer, setSelectedAnswer] =
    useState("");

  const [answerResult, setAnswerResult] =
    useState<AnswerResult | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [loadingNext, setLoadingNext] =
    useState(false);

  const [error, setError] = useState("");

  const [questionNumber, setQuestionNumber] =
    useState(1);

  const [timeLeft, setTimeLeft] =
    useState(QUESTION_TIME_SECONDS);

  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem(SESSION_KEY)
      : null;

  useEffect(() => {
    if (quizStartedRef.current) {
      return;
    }

    quizStartedRef.current = true;

    startMemberQuiz();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startMemberQuiz() {
    try {
      setLoading(true);
      setError("");
      setAnswerResult(null);
      setSelectedAnswer("");

      if (typeof window === "undefined") {
        return;
      }

      const sessionToken =
        sessionStorage.getItem(SESSION_KEY);

      if (!sessionToken) {
        router.replace("/family-member-test");
        return;
      }

      // ----------------------------------------------------------
      // Get the member's current progress.
      // ----------------------------------------------------------
      const {
        data: progressData,
        error: progressError,
      } = await supabase.rpc(
        "get_family_member_progress",
        {
          p_session_token: sessionToken,
        }
      );

      if (progressError) {
        throw new Error(
          `Could not load your progress: ${progressError.message}`
        );
      }

      if (
        !progressData ||
        !Array.isArray(progressData) ||
        progressData.length === 0
      ) {
        throw new Error(
          "Your Family Member progress could not be found."
        );
      }

      const memberProgress =
        progressData[0] as Progress;

      setProgress(memberProgress);

      // ----------------------------------------------------------
      // Start a session at the member's current level.
      // ----------------------------------------------------------
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.rpc(
        "start_family_member_quiz",
        {
          p_session_token: sessionToken,
          p_level: memberProgress.current_level,
          p_track: "individual",
        }
      );

      if (sessionError) {
        throw new Error(
          `Could not start your quiz: ${sessionError.message}`
        );
      }

      if (
        !sessionData ||
        !Array.isArray(sessionData) ||
        sessionData.length === 0
      ) {
        throw new Error(
          "No Family Member quiz session was created."
        );
      }

      const newSession =
        sessionData[0] as GameSession;

      setGameSession(newSession);

      // ----------------------------------------------------------
      // Get the first secure question.
      // ----------------------------------------------------------
      await loadNextQuestion(
        sessionToken,
        newSession.session_id,
        1
      );
    } catch (err) {
      console.error(
        "Family Member quiz start error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "We could not start the Family Member quiz."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadNextQuestion(
    sessionToken: string,
    sessionId: string,
    nextNumber: number
  ) {
    try {
      setLoadingNext(true);
      setError("");

      const {
        data: questionData,
        error: questionError,
      } = await supabase.rpc(
        "get_next_family_member_quiz_question_secure",
        {
          p_session_token: sessionToken,
          p_session_id: sessionId,
        }
      );

      if (questionError) {
        throw new Error(
          `Could not load the next question: ${questionError.message}`
        );
      }

      if (
        !questionData ||
        !Array.isArray(questionData) ||
        questionData.length === 0
      ) {
        throw new Error(
          "No more questions are available for this level right now."
        );
      }

      setQuestion(
        questionData[0] as QuizQuestion
      );

      setQuestionNumber(nextNumber);
      setTimeLeft(QUESTION_TIME_SECONDS);
      setSelectedAnswer("");
      setAnswerResult(null);
    } catch (err) {
      console.error(
        "Family Member question error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "We could not load the next question."
      );
    } finally {
      setLoadingNext(false);
    }
  }

  // ----------------------------------------------------------
  // 30-second question timer.
  // When time reaches zero, the question is submitted as
  // unanswered. The server then records it as incorrect.
  // ----------------------------------------------------------
  useEffect(() => {
    if (!question || answerResult || submitting) {
      return;
    }

    setTimeLeft(QUESTION_TIME_SECONDS);

    const timer = window.setInterval(() => {
      setTimeLeft((previous) => {
        if (previous <= 1) {
          window.clearInterval(timer);

          // Submit an empty answer after time expires.
          void submitAnswer("");

          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };

    // The timer should restart only when the question changes
    // or when a result is displayed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.id, answerResult]);

  async function submitAnswer(
    answer: string
  ) {
    if (
      !question ||
      !gameSession ||
      submitting
    ) {
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSelectedAnswer(answer);

      const sessionToken =
        typeof window !== "undefined"
          ? sessionStorage.getItem(
              SESSION_KEY
            )
          : null;

      if (!sessionToken) {
        throw new Error(
          "Your Family Member session has expired. Please sign in again."
        );
      }

      const {
        data: resultData,
        error: resultError,
      } = await supabase.rpc(
        "submit_family_member_quiz_answer_secure",
        {
          p_session_token: sessionToken,
          p_session_id:
            gameSession.session_id,
          p_question_id: question.id,
          p_selected_answer: answer,
          p_response_time_ms:
            Math.max(
              0,
              (QUESTION_TIME_SECONDS - timeLeft) * 1000
            ),
        }
      );

      if (resultError) {
        throw new Error(
          `Could not submit your answer: ${resultError.message}`
        );
      }

      if (
        !resultData ||
        !Array.isArray(resultData) ||
        resultData.length === 0
      ) {
        throw new Error(
          "The answer submission returned no result."
        );
      }

      const result =
        resultData[0] as AnswerResult;

      setAnswerResult(result);

      // Refresh progress so the dashboard values are
      // immediately reflected if the member returns there.
      const {
        data: refreshedProgress,
      } = await supabase.rpc(
        "get_family_member_progress",
        {
          p_session_token: sessionToken,
        }
      );

      if (
        refreshedProgress &&
        Array.isArray(refreshedProgress) &&
        refreshedProgress.length > 0
      ) {
        setProgress(
          refreshedProgress[0] as Progress
        );
      }
    } catch (err) {
      console.error(
        "Family Member answer submission error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "We could not submit your answer."
      );

      setSelectedAnswer("");
    } finally {
      setSubmitting(false);
    }
  }

  async function continueAfterAnswer() {
    if (!answerResult) {
      return;
    }

    const sessionToken =
      typeof window !== "undefined"
        ? sessionStorage.getItem(SESSION_KEY)
        : null;

    if (!sessionToken) {
      router.replace("/family-member-test");
      return;
    }

    setError("");
    setLoadingNext(true);

    try {
      // ----------------------------------------------------------
      // If the level was completed, start a fresh game session
      // at the newly available/current level.
      // ----------------------------------------------------------
      if (answerResult.level_completed) {
        const {
          data: progressData,
          error: progressError,
        } = await supabase.rpc(
          "get_family_member_progress",
          {
            p_session_token: sessionToken,
          }
        );

        if (progressError) {
          throw new Error(
            `Could not refresh your progress: ${progressError.message}`
          );
        }

        if (
          !progressData ||
          !Array.isArray(progressData) ||
          progressData.length === 0
        ) {
          throw new Error(
            "Your updated progress could not be found."
          );
        }

        const updatedProgress =
          progressData[0] as Progress;

        setProgress(updatedProgress);

        const {
          data: sessionData,
          error: sessionError,
        } = await supabase.rpc(
          "start_family_member_quiz",
          {
            p_session_token:
              sessionToken,
            p_level:
              updatedProgress.current_level,
            p_track: "individual",
          }
        );

        if (sessionError) {
          throw new Error(
            `Could not start the next level: ${sessionError.message}`
          );
        }

        if (
          !sessionData ||
          !Array.isArray(sessionData) ||
          sessionData.length === 0
        ) {
          throw new Error(
            "The next Family Member quiz session could not be created."
          );
        }

        const newSession =
          sessionData[0] as GameSession;

        setGameSession(newSession);

        await loadNextQuestion(
          sessionToken,
          newSession.session_id,
          1
        );

        return;
      }

      // ----------------------------------------------------------
      // Normal question: keep using the current session.
      // ----------------------------------------------------------
      if (!gameSession) {
        throw new Error(
          "The current quiz session is no longer available."
        );
      }

      await loadNextQuestion(
        sessionToken,
        gameSession.session_id,
        questionNumber + 1
      );
    } catch (err) {
      console.error(
        "Continue Family Member quiz error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "We could not continue the quiz."
      );
    } finally {
      setLoadingNext(false);
    }
  }

  function goToDashboard() {
    router.push(
      "/family-member-dashboard"
    );
  }

  function switchMember() {
    sessionStorage.removeItem(
      SESSION_KEY
    );

    router.push("/family-member-test");
  }

  const levelQuestionProgress =
    progress
      ? Math.min(
          ((progress.questions_answered % 50) /
            50) *
            100,
          100
        )
      : 0;

  const answerOptions = useMemo(() => {
    if (!question) {
      return [];
    }

    return OPTIONS.map((option) => ({
      ...option,
      text: question[option.field],
    }));
  }, [question]);

  if (loading) {
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
              Preparing Your Quest
            </h1>

            <p
              className="sq-subtitle"
              style={{
                marginTop: "12px",
                lineHeight: 1.7,
              }}
            >
              Loading your Family Member
              progress and preparing your next
              question...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !question) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div
            className="sq-card"
            style={{
              maxWidth: "620px",
              margin: "80px auto",
              padding: "42px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "20px",
                background: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "28px",
              }}
            >
              ⚠️
            </div>

            <h1 className="sq-title">
              We couldn't start your quest
            </h1>

            <p
              className="sq-subtitle"
              style={{
                marginTop: "12px",
                lineHeight: 1.7,
              }}
            >
              {error}
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "center",
                flexWrap: "wrap",
                marginTop: "24px",
              }}
            >
              <button
                type="button"
                onClick={() => {
                  quizStartedRef.current = true;
                  startMemberQuiz();
                }}
                className="sq-button-primary"
                style={{
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>

              <button
                type="button"
                onClick={goToDashboard}
                className="sq-button-secondary"
                style={{
                  border:
                    "1px solid var(--border)",
                  cursor: "pointer",
                }}
              >
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

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
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <AppNavbar />
        </div>

        {/* TOP BAR */}
        <section
          className="sq-card"
          style={{
            padding: "20px 24px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "16px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="sq-badge">
                Family Quest
              </div>

              <h1
                style={{
                  margin:
                    "10px 0 3px",
                  fontSize: "24px",
                  fontWeight: 900,
                }}
              >
                {progress?.display_name ||
                  "Family Member"}
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "13px",
                }}
              >
                Level{" "}
                {gameSession?.level ||
                  progress?.current_level ||
                  1}
                {" • "}
                Question {questionNumber}
              </p>
            </div>

            <button
              type="button"
              onClick={switchMember}
              className="sq-button-secondary"
              style={{
                border:
                  "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              👤 Switch Member
            </button>
          </div>
        </section>

        {/* PROGRESS */}
        <section
          className="sq-card"
          style={{
            padding: "18px 22px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              marginBottom: "9px",
            }}
          >
            <span
              style={{
                color: "var(--muted)",
                fontSize: "12px",
                fontWeight: 700,
              }}
            >
              Level {gameSession?.level || 1}
            </span>

            <span
              style={{
                color: "var(--primary)",
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              {progress
                ? `${progress.questions_answered % 50}/50 questions`
                : "Loading..." }
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
        </section>

        {/* QUESTION */}
        {question && !answerResult && (
          <section
            className="sq-card"
            style={{
              padding: "32px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: "16px",
                marginBottom: "24px",
              }}
            >
              <span className="sq-badge">
                Question {questionNumber}
              </span>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    color: "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 700,
                  }}
                >
                  Choose one answer
                </span>

                <span
                  style={{
                    minWidth: "72px",
                    padding: "8px 12px",
                    borderRadius: "999px",
                    background:
                      timeLeft <= 10
                        ? "#fef2f2"
                        : "var(--primary-light)",
                    color:
                      timeLeft <= 10
                        ? "#b91c1c"
                        : "var(--primary-dark)",
                    fontSize: "13px",
                    fontWeight: 900,
                    textAlign: "center",
                    border:
                      timeLeft <= 10
                        ? "1px solid #fecaca"
                        : "1px solid rgba(13, 148, 136, 0.15)",
                  }}
                >
                  ⏱ {timeLeft}s
                </span>
              </div>
            </div>

            <h2
              style={{
                margin: 0,
                fontSize:
                  "clamp(22px, 4vw, 32px)",
                lineHeight: 1.4,
                fontWeight: 850,
                letterSpacing: "-0.4px",
              }}
            >
              {question.question}
            </h2>

            <div
              style={{
                display: "grid",
                gap: "12px",
                marginTop: "30px",
              }}
            >
              {answerOptions.map(
                (option) => {
                  const selected =
                    selectedAnswer ===
                    option.text;

                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={
                        submitting ||
                        loadingNext
                      }
                      onClick={() =>
                        submitAnswer(
                          option.text
                        )
                      }
                      style={{
                        width: "100%",
                        textAlign:
                          "left",
                        padding:
                          "18px 20px",
                        border: selected
                          ? "2px solid var(--primary)"
                          : "1px solid var(--border)",
                        borderRadius:
                          "16px",
                        background:
                          selected
                            ? "var(--primary-light)"
                            : "white",
                        color:
                          "var(--foreground)",
                        cursor:
                          submitting ||
                          loadingNext
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          submitting ||
                          loadingNext
                            ? 0.75
                            : 1,
                        display:
                          "flex",
                        alignItems:
                          "flex-start",
                        gap: "14px",
                        fontSize:
                          "15px",
                        lineHeight: 1.55,
                        transition:
                          "all 0.15s ease",
                      }}
                    >
                      <span
                        style={{
                          flex:
                            "0 0 36px",
                          width: "36px",
                          height: "36px",
                          borderRadius:
                            "12px",
                          background:
                            selected
                              ? "var(--primary)"
                              : "#f1f5f3",
                          color:
                            selected
                              ? "white"
                              : "var(--foreground)",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          fontWeight: 900,
                        }}
                      >
                        {option.key}
                      </span>

                      <span
                        style={{
                          paddingTop:
                            "6px",
                          fontWeight:
                            selected
                              ? 750
                              : 550,
                        }}
                      >
                        {option.text}
                      </span>
                    </button>
                  );
                }
              )}
            </div>

            {timeLeft === 0 && !answerResult && (
              <div
                style={{
                  marginTop: "22px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#fffbeb",
                  color: "#92400e",
                  fontSize: "13px",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                Time is up. Your answer is being checked...
              </div>
            )}

            {submitting && (
              <div
                style={{
                  marginTop: "22px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background:
                    "var(--primary-light)",
                  color:
                    "var(--primary-dark)",
                  fontSize: "13px",
                  fontWeight: 700,
                  textAlign: "center",
                }}
              >
                Checking your answer...
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#fef2f2",
                  color: "#991b1b",
                  border:
                    "1px solid #fecaca",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                {error}
              </div>
            )}
          </section>
        )}

        {/* RESULT */}
        {answerResult && (
          <section
            className="sq-card"
            style={{
              padding: "32px",
            }}
          >
            <div
              style={{
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "76px",
                  height: "76px",
                  margin:
                    "0 auto 18px",
                  borderRadius: "24px",
                  background:
                    answerResult.is_correct
                      ? "var(--primary-light)"
                      : "#fef2f2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "34px",
                }}
              >
                {answerResult.is_correct
                  ? "✓"
                  : "✕"}
              </div>

              <span className="sq-badge">
                {answerResult.is_correct
                  ? "Correct Answer"
                  : "Keep Learning"}
              </span>

              <h2
                style={{
                  margin:
                    "14px 0 8px",
                  fontSize: "30px",
                  fontWeight: 900,
                }}
              >
                {answerResult.is_correct
                  ? "Excellent work!"
                  : "Not quite this time"}
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  lineHeight: 1.7,
                }}
              >
                {answerResult.is_correct
                  ? "Your answer was correct. Keep your streak going!"
                  : "Review the explanation below and use it to strengthen your knowledge."}
              </p>
            </div>

            {/* RESULT STATS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "12px",
                marginTop: "28px",
              }}
            >
              <div className="sq-stat">
                <div className="sq-stat-label">
                  XP Earned
                </div>

                <div
                  className="sq-stat-value"
                  style={{
                    color:
                      answerResult.xp_earned >
                      0
                        ? "var(--primary)"
                        : undefined,
                  }}
                >
                  +{answerResult.xp_earned}
                </div>
              </div>

              <div className="sq-stat">
                <div className="sq-stat-label">
                  Current Streak
                </div>

                <div className="sq-stat-value">
                  🔥{" "}
                  {
                    answerResult.current_streak
                  }
                </div>
              </div>

              <div className="sq-stat">
                <div className="sq-stat-label">
                  Best Streak
                </div>

                <div className="sq-stat-value">
                  {
                    answerResult.best_streak
                  }
                </div>
              </div>
            </div>

            {/* ANSWER */}
            <div
              style={{
                marginTop: "24px",
                padding: "18px",
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
                  fontWeight: 800,
                  textTransform:
                    "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Correct Answer
              </div>

              <div
                style={{
                  marginTop: "7px",
                  fontSize: "16px",
                  fontWeight: 800,
                  lineHeight: 1.6,
                }}
              >
                {answerResult.correct_answer}
              </div>
            </div>

            {/* EXPLANATION — ONLY AFTER ANSWER */}
            {answerResult.explanation && (
              <div
                style={{
                  marginTop: "16px",
                  padding: "20px",
                  borderRadius: "16px",
                  background:
                    "var(--primary-light)",
                  border:
                    "1px solid rgba(13, 148, 136, 0.15)",
                }}
              >
                <div
                  style={{
                    color:
                      "var(--primary-dark)",
                    fontSize: "13px",
                    fontWeight: 900,
                    marginBottom:
                      "8px",
                  }}
                >
                  Explanation
                </div>

                <p
                  style={{
                    margin: 0,
                    color:
                      "var(--foreground)",
                    lineHeight: 1.75,
                    fontSize: "14px",
                  }}
                >
                  {answerResult.explanation}
                </p>
              </div>
            )}

            {/* LEVEL COMPLETION */}
            {answerResult.level_completed && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "18px",
                  borderRadius: "16px",
                  background:
                    answerResult.level_passed
                      ? "#ecfdf5"
                      : "#fffbeb",
                  border:
                    answerResult.level_passed
                      ? "1px solid #a7f3d0"
                      : "1px solid #fde68a",
                }}
              >
                <strong
                  style={{
                    display: "block",
                    fontSize: "15px",
                  }}
                >
                  {answerResult.level_passed
                    ? `🎉 Level ${answerResult.current_level - 1} completed!`
                    : `Level ${answerResult.current_level} completed.`}
                </strong>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color:
                      "var(--muted)",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {answerResult.level_passed
                    ? `You reached the required score and can continue to Level ${answerResult.current_level}.`
                    : `You can keep building your knowledge and continue your Family Quest.`}
                </p>
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "14px 16px",
                  borderRadius: "14px",
                  background: "#fef2f2",
                  color: "#991b1b",
                  border:
                    "1px solid #fecaca",
                  fontSize: "13px",
                }}
              >
                {error}
              </div>
            )}

            {/* ACTIONS */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "26px",
              }}
            >
              <button
                type="button"
                onClick={
                  continueAfterAnswer
                }
                disabled={loadingNext}
                className="sq-button-primary"
                style={{
                  border: "none",
                  cursor: loadingNext
                    ? "not-allowed"
                    : "pointer",
                  minHeight: "48px",
                  padding: "0 22px",
                }}
              >
                {loadingNext
                  ? "Loading..."
                  : answerResult.level_completed
                  ? answerResult.level_passed
                    ? `Continue to Level ${answerResult.current_level} →`
                    : "Continue Quest →"
                  : "Next Question →"}
              </button>

              <button
                type="button"
                onClick={goToDashboard}
                className="sq-button-secondary"
                style={{
                  border:
                    "1px solid var(--border)",
                  cursor: "pointer",
                  minHeight: "48px",
                  padding: "0 22px",
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </section>
        )}

        <footer
          style={{
            padding: "28px 0 8px",
            textAlign: "center",
            color: "var(--muted-light)",
            fontSize: "12px",
          }}
        >
          Sahaba Quest • Learn. Remember. Compete.
        </footer>
      </div>
    </main>
  );
}
