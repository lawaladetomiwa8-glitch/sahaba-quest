"use client";

import { useEffect, useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { AppNavbar } from "../../../components/ui";

type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  challenge_type: string;
  question_count: number;
  time_per_question: number;
};

type ChallengeQuestion = {
  id: string;
  level: number;
  question: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
};

type ChallengeAttempt = {
  attempt_id: string;
  challenge_id: string;
  title: string;
  description: string;
  icon: string;
  challenge_type: string;
  question_count: number;
  time_per_question: number;
  score: number;
  questions_answered: number;
  correct_answers: number;
  status: "in_progress" | "completed";
  passed: boolean;
  started_at: string;
  completed_at: string | null;
};

type AnswerResult = {
  is_correct: boolean;
  correct_answer: string;
  xp_earned: number;
  questions_answered: number;
  correct_answers: number;
  score: number;
  total_questions: number;
  questions_remaining: number;
  pass_mark: number;
  session_complete: boolean;
  passed: boolean;
  explanation?: string | null;
};

const OPTIONS = ["A", "B", "C", "D"] as const;

function normalizeAnswer(value: string | null | undefined) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export default function FamilyChallengeGamePage() {
  const params = useParams();
  const router = useRouter();

  const challengeId = params.challengeId as string;

  const [challenge, setChallenge] =
    useState<Challenge | null>(null);

  const [attemptId, setAttemptId] =
    useState<string | null>(null);

  const [question, setQuestion] =
    useState<ChallengeQuestion | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [questionLoading, setQuestionLoading] =
    useState(false);

  /*
    selectedAnswer = answer that has actually
    been submitted.

    puzzleAnswer = what the user is currently
    typing into the puzzle input.
  */
  const [selectedAnswer, setSelectedAnswer] =
    useState("");

  const [puzzleAnswer, setPuzzleAnswer] =
    useState("");

  const [answerResult, setAnswerResult] =
    useState<AnswerResult | null>(null);

  const [timeLeft, setTimeLeft] =
    useState(0);

  const [totalXp, setTotalXp] =
    useState(0);

  const [questionsAnswered, setQuestionsAnswered] =
    useState(0);

  const [correctAnswers, setCorrectAnswers] =
    useState(0);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [startedAt, setStartedAt] =
    useState<number | null>(null);

  // ==========================================
  // LOAD CHALLENGE
  // ==========================================

  useEffect(() => {
    if (!challengeId) {
      setErrorMessage(
        "This challenge is invalid."
      );

      setLoading(false);
      return;
    }

    loadChallenge();
  }, [challengeId]);

  async function loadChallenge() {
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

      const loadedChallenge =
        challengeData as Challenge;

      setChallenge(loadedChallenge);

      const {
        data: attemptData,
        error: attemptError,
      } = await supabase.rpc(
        "start_family_challenge",
        {
          p_challenge_id: challengeId,
        }
      );

      if (attemptError) {
        throw attemptError;
      }

      if (!attemptData) {
        throw new Error(
          "Unable to start this challenge."
        );
      }

      const startedAttempt = attemptData as {
        attempt_id: string;
      };

      if (!startedAttempt.attempt_id) {
        throw new Error(
          "Unable to determine the Family challenge attempt."
        );
      }

      /*
        Load the complete saved attempt.
        This is important when the user is resuming an
        unfinished Family challenge.
      */
      const {
        data: attemptDetails,
        error: attemptDetailsError,
      } = await supabase.rpc(
        "get_family_challenge_attempt",
        {
          p_attempt_id: startedAttempt.attempt_id,
        }
      );

      if (attemptDetailsError) {
        throw attemptDetailsError;
      }

      if (!attemptDetails) {
        throw new Error(
          "Unable to load the Family challenge attempt."
        );
      }

      const attempt =
        attemptDetails as ChallengeAttempt;

      /*
        If the challenge was already completed,
        go straight to the Family result page.
      */
      if (attempt.status === "completed") {
        router.replace(
          `/family-challenges/${challengeId}/result?attempt=${attempt.attempt_id}`
        );

        return;
      }

      setAttemptId(attempt.attempt_id);
      setQuestionsAnswered(attempt.questions_answered || 0);
      setCorrectAnswers(attempt.correct_answers || 0);
      setTotalXp(attempt.score || 0);

      if (
        attempt.questions_answered >=
        loadedChallenge.question_count
      ) {
        router.replace(
          `/family-challenges/${challengeId}/result?attempt=${attempt.attempt_id}`
        );

        return;
      }

      await loadNextQuestion(
        loadedChallenge,
        attempt.attempt_id,
        attempt.questions_answered
      );
    } catch (error) {
      console.error(
        "Challenge loading error:",
        error
      );

      const message =
        error instanceof Error
          ? error.message
          : "We couldn't load this challenge.";

      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }

  // ==========================================
  // LOAD NEXT QUESTION
  // ==========================================

  const loadNextQuestion = useCallback(
    async (
      currentChallenge?: Challenge,
      currentAttemptId?: string,
      currentQuestionsAnswered?: number
    ) => {
      const activeChallenge =
        currentChallenge || challenge;

      const activeAttemptId =
        currentAttemptId || attemptId;

      const answeredCount =
        currentQuestionsAnswered ??
        questionsAnswered;

      if (
        !activeChallenge ||
        !activeAttemptId
      ) {
        return;
      }

      if (
        answeredCount >=
        activeChallenge.question_count
      ) {
        router.replace(
          `/family-challenges/${activeChallenge.id}/result?attempt=${activeAttemptId}`
        );

        return;
      }

      try {
        setQuestionLoading(true);
        setErrorMessage("");

        /*
          Reset the answer state for the new question.
        */
        setSelectedAnswer("");
        setPuzzleAnswer("");
        setAnswerResult(null);

        const {
          data,
          error,
        } = await supabase.rpc(
          "get_next_family_challenge_question",
          {
            p_attempt_id:
              activeAttemptId,
          }
        );

        if (error) {
          throw error;
        }

        if (
          !data ||
          data.length === 0
        ) {
          router.replace(
            `/family-challenges/${activeChallenge.id}/result?attempt=${activeAttemptId}`
          );

          return;
        }

        const nextQuestion =
          data[0] as ChallengeQuestion;

        setQuestion(
          nextQuestion
        );

        setTimeLeft(
          activeChallenge.time_per_question
        );

        setStartedAt(
          Date.now()
        );
      } catch (error: any) {
        console.error("Question loading error:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
          error,
        });

        setErrorMessage(
          error?.message ||
            "We couldn't load the next question. Please try again."
        );
      } finally {
        setQuestionLoading(false);
      }
    },
    [
      challenge,
      attemptId,
      questionsAnswered,
      router,
    ]
  );

  // ==========================================
  // SUBMIT ANSWER
  // ==========================================

  const submitAnswer = useCallback(
    async (answerText: string) => {
      /*
        Prevent duplicate submissions.
      */
      if (
        !question ||
        !attemptId ||
        selectedAnswer ||
        answerResult
      ) {
        return;
      }

      if (
        challenge &&
        questionsAnswered >=
          challenge.question_count
      ) {
        router.replace(
          `/family-challenges/${challenge.id}/result?attempt=${attemptId}`
        );

        return;
      }

      /*
        For a Puzzle challenge, don't manually
        submit an empty answer while time remains.

        Empty answers are allowed when the timer
        reaches zero.
      */
      if (
        challenge?.challenge_type ===
          "Puzzle" &&
        !answerText.trim() &&
        timeLeft > 0
      ) {
        return;
      }

      const cleanAnswer =
        answerText.trim();

      /*
        IMPORTANT:

        Mark the answer as submitted BEFORE
        calling Supabase.

        This prevents double-clicks and timer
        races.
      */
      setSelectedAnswer(
        cleanAnswer
      );

      const responseTime =
        startedAt
          ? Date.now() - startedAt
          : null;

      try {
        const {
          data,
          error,
        } = await supabase.rpc(
          "submit_family_challenge_answer",
          {
            p_attempt_id:
              attemptId,

            p_question_id:
              question.id,

            p_selected_answer:
              cleanAnswer,

            p_response_time_ms:
              responseTime,
          }
        );

        if (error) {
          throw error;
        }

        const result =
          data as AnswerResult;

        setAnswerResult(
          result
        );

        setQuestionsAnswered(
          result.questions_answered
        );

        setCorrectAnswers(
          result.correct_answers
        );

        setTotalXp(
          result.score
        );
      } catch (error) {
        console.error(
          "Answer submission error:",
          error
        );

        /*
          Allow the user to try again if the
          database submission itself failed.
        */
        setSelectedAnswer("");

        setErrorMessage(
          "We couldn't submit your answer. Please try again."
        );
      }
    },
    [
      question,
      attemptId,
      selectedAnswer,
      answerResult,
      startedAt,
      challenge,
      questionsAnswered,
      router,
      timeLeft,
    ]
  );

  // ==========================================
  // TIMER
  // ==========================================

  useEffect(() => {
    if (
      !question ||
      !challenge ||
      selectedAnswer ||
      answerResult ||
      questionLoading
    ) {
      return;
    }

    if (timeLeft <= 0) {
      /*
        Time ran out.

        For Puzzle:
        submit an empty answer.

        For multiple choice:
        also submit an empty answer.
      */
      submitAnswer("");
      return;
    }

    const timer =
      setInterval(() => {
        setTimeLeft(
          (previous) =>
            previous - 1
        );
      }, 1000);

    return () =>
      clearInterval(timer);
  }, [
    timeLeft,
    question,
    challenge,
    selectedAnswer,
    answerResult,
    questionLoading,
    submitAnswer,
  ]);

  // ==========================================
  // ABANDON CHALLENGE
  // ==========================================

  async function handleAbandonChallenge() {
    if (!attemptId) return;

    const confirmed = window.confirm(
      "Are you sure you want to leave this challenge? Your unfinished attempt will be discarded."
    );

    if (!confirmed) return;

    try {
      setErrorMessage("");

      const { error } = await supabase.rpc(
        "abandon_family_challenge",
        {
          p_attempt_id: attemptId,
        }
      );

      if (error) throw error;

      router.replace("/family-challenges");
    } catch (error) {
      console.error("Abandon challenge error:", error);
      setErrorMessage(
        "We couldn't exit the challenge. Please try again."
      );
    }
  }

  // ==========================================
  // CONTINUE
  // ==========================================

  async function handleContinue() {
    if (
      !answerResult ||
      !attemptId ||
      !challenge
    ) {
      return;
    }

    if (
      answerResult.session_complete ||
      answerResult.questions_answered >=
        challenge.question_count
    ) {
      router.replace(
        `/family-challenges/${challengeId}/result?attempt=${attemptId}`
      );

      return;
    }

    await loadNextQuestion(
      challenge,
      attemptId,
      answerResult.questions_answered
    );
  }

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "var(--background)",
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
                color:
                  "var(--muted)",
              }}
            >
              Loading challenge...
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // ERROR SCREEN
  // ==========================================

  if (
    errorMessage &&
    !question
  ) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "var(--background)",
        }}
      >
        <AppNavbar />

        <div className="sq-page">
          <div className="sq-container">
            <div
              className="sq-card"
              style={{
                padding: "40px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "42px",
                  marginBottom: "16px",
                }}
              >
                ⚠️
              </div>

              <h2
                style={{
                  margin:
                    "0 0 10px",
                  fontSize: "24px",
                  fontWeight: 800,
                }}
              >
                Challenge unavailable
              </h2>

              <p
                style={{
                  margin:
                    "0 auto 24px",
                  maxWidth: "520px",
                  color:
                    "var(--muted)",
                  lineHeight: 1.6,
                }}
              >
                {errorMessage}
              </p>

              <button
                onClick={() =>
                  router.push(
                    "/family-challenges"
                  )
                }
                className="sq-button-primary"
              >
                Back to Challenges
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==========================================
  // MAIN GAME
  // ==========================================

  const isPuzzle =
    challenge?.challenge_type ===
    "Puzzle";

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "var(--background)",
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
          {/* CHALLENGE HEADER */}

          <section
            style={{
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: "15px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <span className="sq-badge">
                  {
                    challenge?.challenge_type
                  }
                </span>

                <h1
                  className="sq-title"
                  style={{
                    marginTop: "12px",
                  }}
                >
                  {
                    challenge?.icon
                  }{" "}
                  {
                    challenge?.title
                  }
                </h1>
              </div>

              <div
                style={{
                  textAlign: "right",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    color:
                      "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  XP EARNED
                </div>

                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    color:
                      "var(--primary)",
                  }}
                >
                  +{totalXp}
                </div>
              </div>
            </div>
          </section>

          {/* PROGRESS */}

          <section
            className="sq-card"
            style={{
              padding: "18px 20px",
              marginBottom: "18px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                gap: "12px",
                marginBottom: "9px",
                fontSize: "13px",
                fontWeight: 800,
              }}
            >
              <span>
                Question{" "}
                {Math.min(
                  questionsAnswered + 1,
                  challenge?.question_count ||
                    1
                )}{" "}
                of{" "}
                {
                  challenge?.question_count
                }
              </span>

              <span
                style={{
                  color:
                    "var(--primary)",
                }}
              >
                {
                  correctAnswers
                }{" "}
                correct
              </span>
            </div>

            <div className="sq-progress">
              <div
                className="sq-progress-bar"
                style={{
                  width: `${
                    Math.min(
                      (questionsAnswered /
                        (challenge?.question_count ||
                          1)) *
                        100,
                      100
                    )
                  }%`,
                }}
              />
            </div>
          </section>

          {/* TIMER */}

          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
              marginBottom: "18px",
            }}
          >
            <div
              className="sq-timer"
              style={{
                minWidth: "100px",
                textAlign: "center",
                fontWeight: 900,
              }}
            >
              ⏱ {timeLeft}s
            </div>
          </div>

          {/* QUESTION */}

          {question && (
            <section
              className="sq-card"
              style={{
                padding: "30px",
              }}
            >
              <div
                style={{
                  color:
                    "var(--muted)",
                  fontSize: "12px",
                  fontWeight: 800,
                  textTransform:
                    "uppercase",
                  letterSpacing:
                    "0.6px",
                  marginBottom: "12px",
                }}
              >
                {isPuzzle
                  ? "Complete the name"
                  : "Your challenge question"}
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize: "23px",
                  lineHeight: 1.5,
                  fontWeight: 800,
                }}
              >
                {
                  question.question
                }
              </h2>

              {/* ==================================
                  PUZZLE
              ================================== */}

              {isPuzzle ? (
                <div
                  style={{
                    marginTop: "28px",
                  }}
                >
                  <input
                    type="text"
                    value={
                      puzzleAnswer
                    }
                    onChange={(event) =>
                      setPuzzleAnswer(
                        event.target.value
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();

                        if (
                          puzzleAnswer.trim()
                        ) {
                          submitAnswer(
                            puzzleAnswer.trim()
                          );
                        }
                      }
                    }}
                    disabled={
                      !!selectedAnswer ||
                      !!answerResult
                    }
                    autoComplete="off"
                    autoCapitalize="words"
                    spellCheck={false}
                    placeholder="Type the missing name..."
                    style={{
                      width: "100%",
                      boxSizing:
                        "border-box",
                      padding:
                        "16px 18px",
                      borderRadius:
                        "14px",
                      border:
                        "2px solid var(--border)",
                      background:
                        "var(--background)",
                      color:
                        "var(--foreground)",
                      fontSize:
                        "18px",
                      fontWeight: 700,
                      outline: "none",
                    }}
                  />

                  {!answerResult && (
                    <button
                      type="button"
                      className="sq-button-primary"
                      disabled={
                        !puzzleAnswer.trim() ||
                        !!selectedAnswer
                      }
                      onClick={() =>
                        submitAnswer(
                          puzzleAnswer.trim()
                        )
                      }
                      style={{
                        width: "100%",
                        marginTop: "14px",
                      }}
                    >
                      Submit Answer →
                    </button>
                  )}
                </div>
              ) : (
                /* ==================================
                   MULTIPLE CHOICE
                ================================== */

                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                    marginTop: "28px",
                  }}
                >
                  {OPTIONS.map(
                    (letter) => {
                      const option =
                        question[
                          `option_${letter.toLowerCase()}` as keyof ChallengeQuestion
                        ] as string | null;

                      if (!option) {
                        return null;
                      }

                      const normalizedOption =
                        normalizeAnswer(
                          option
                        );

                      const normalizedSelected =
                        normalizeAnswer(
                          selectedAnswer
                        );

                      const normalizedCorrect =
                        normalizeAnswer(
                          answerResult?.correct_answer
                        );

                      const isSelected =
                        normalizedSelected !==
                          "" &&
                        normalizedSelected ===
                          normalizedOption;

                      const isCorrect =
                        !!answerResult &&
                        normalizedCorrect !==
                          "" &&
                        normalizedOption ===
                          normalizedCorrect;

                      let className =
                        "sq-answer";

                      if (
                        answerResult &&
                        isCorrect
                      ) {
                        className +=
                          " sq-correct";
                      } else if (
                        isSelected &&
                        answerResult &&
                        !answerResult.is_correct
                      ) {
                        className +=
                          " sq-wrong";
                      }

                      return (
                        <button
                          key={
                            letter
                          }
                          type="button"
                          className={
                            className
                          }
                          disabled={
                            !!selectedAnswer ||
                            !!answerResult
                          }
                          onClick={() =>
                            submitAnswer(
                              option
                            )
                          }
                          style={{
                            textAlign:
                              "left",
                            width:
                              "100%",
                            cursor:
                              selectedAnswer
                                ? "default"
                                : "pointer",
                          }}
                        >
                          <span className="sq-answer-letter">
                            {
                              letter
                            }
                          </span>

                          <span
                            style={{
                              flex: 1,
                            }}
                          >
                            {
                              option
                            }
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              )}

              {/* FEEDBACK */}

              {answerResult && (
                <div
                  style={{
                    marginTop: "22px",
                    padding: "18px",
                    borderRadius: "14px",
                    background:
                      answerResult.is_correct
                        ? "var(--primary-light)"
                        : "var(--danger-light)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "17px",
                      fontWeight: 900,
                    }}
                  >
                    {answerResult.is_correct
                      ? "Correct! 🎉"
                      : "Not quite."}
                  </div>

                  {!answerResult.is_correct && (
                    <p
                      style={{
                        margin:
                          "7px 0 0",
                        color:
                          "var(--muted)",
                        fontSize: "13px",
                      }}
                    >
                      Correct answer:{" "}
                      <strong>
                        {
                          answerResult.correct_answer
                        }
                      </strong>
                    </p>
                  )}

                  {answerResult.is_correct && (
                    <p
                      style={{
                        margin:
                          "7px 0 0",
                        color:
                          "var(--muted)",
                        fontSize: "13px",
                      }}
                    >
                      +{
                        answerResult.xp_earned
                      }{" "}
                      XP
                    </p>
                  )}
                </div>
              )}

              {answerResult?.explanation && (
                <div
                  style={{
                    marginTop: "14px",
                    padding: "14px",
                    borderRadius: "12px",
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Explanation
                  </div>
                  <p style={{ margin: 0, lineHeight: 1.6 }}>
                    {answerResult.explanation}
                  </p>
                </div>
              )}

              {/* CONTINUE */}

              {answerResult && (
                <button
                  type="button"
                  className="sq-button-primary"
                  onClick={
                    handleContinue
                  }
                  style={{
                    width: "100%",
                    marginTop: "18px",
                  }}
                >
                  {answerResult.session_complete ||
                  answerResult.questions_answered >=
                    (challenge?.question_count ||
                      0)
                    ? "View Results →"
                    : "Next Question →"}
                </button>
              )}
            </section>
          )}

          {/* EXIT CHALLENGE */}

          {attemptId && (
            <button
              type="button"
              onClick={handleAbandonChallenge}
              disabled={!!answerResult}
              style={{
                width: "100%",
                marginTop: "14px",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "1px solid var(--border)",
                background: "transparent",
                color: "var(--muted)",
                fontWeight: 800,
                cursor: answerResult ? "default" : "pointer",
              }}
            >
              Exit Challenge
            </button>
          )}

          {/* ERROR */}

          {errorMessage &&
            question && (
              <div
                style={{
                  marginTop: "18px",
                  padding: "14px",
                  borderRadius: "12px",
                  background:
                    "var(--danger-light)",
                  color:
                    "var(--danger)",
                  fontSize: "13px",
                }}
              >
                {errorMessage}
              </div>
            )}
        </div>
      </div>
    </main>
  );
}