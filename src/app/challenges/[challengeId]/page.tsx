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
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type ChallengeAttempt = {
  success: boolean;
  action: "new" | "resume" | "completed";

  attempt_id: string;
  challenge_id: string;
  title: string;
  description: string;
  icon: string;
  challenge_type: string;
  question_count: number;
  time_per_question: number;
  questions_answered: number;
  correct_answers: number;
  score: number;
  passing_score: number;
  passed: boolean | null;
  status: "in_progress" | "completed";
};

type AnswerResult = {
  is_correct: boolean;
  correct_answer: string;
  xp_earned: number;
  questions_answered: number;
  correct_answers: number;
  score: number;
  questions_required: number;
  passing_score: number;
  completed: boolean;
  passed: boolean | null;
};

const OPTIONS = ["A", "B", "C", "D"] as const;

/*
  Normalize answer text before comparing it.

  This protects against small differences such as:
  - extra spaces
  - different capitalization
  - accidental leading/trailing spaces
*/
function normalizeAnswer(value: string | null | undefined) {
  return (value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export default function ChallengeGamePage() {
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
    selectedAnswer stores the ACTUAL ANSWER TEXT.
  */
  const [selectedAnswer, setSelectedAnswer] =
    useState("");

  const [answerResult, setAnswerResult] =
    useState<AnswerResult | null>(null);

  const [timeLeft, setTimeLeft] =
    useState(0);

  /*
    XP earned during this challenge.
  */
  const [totalXp, setTotalXp] =
    useState(0);

  /*
    Challenge progress.
  */
  const [questionsAnswered, setQuestionsAnswered] =
    useState(0);

  const [correctAnswers, setCorrectAnswers] =
    useState(0);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [startedAt, setStartedAt] =
    useState<number | null>(null);

  // ==========================================
  // LOAD CHALLENGE + START / RESUME ATTEMPT
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

      // ----------------------------------------
      // CHECK USER
      // ----------------------------------------

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // ----------------------------------------
      // LOAD CHALLENGE
      // ----------------------------------------

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

      // ----------------------------------------
      // START OR RESUME CHALLENGE
      // ----------------------------------------

      const {
        data: attemptData,
        error: attemptError,
      } = await supabase.rpc(
        "start_challenge",
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

      const attempt =
        attemptData as ChallengeAttempt;

      // ----------------------------------------
      // COMPLETED CHALLENGE
      // ----------------------------------------

      if (
        attempt.action === "completed" ||
        attempt.status === "completed"
      ) {
        router.replace(
          `/challenges/${challengeId}/result?attempt=${attempt.attempt_id}`
        );

        return;
      }

      // ----------------------------------------
      // NEW OR RESUMED ATTEMPT
      // ----------------------------------------

      setAttemptId(
        attempt.attempt_id
      );

      setQuestionsAnswered(
        attempt.questions_answered || 0
      );

      setCorrectAnswers(
        attempt.correct_answers || 0
      );

      setTotalXp(
        attempt.score || 0
      );

      /*
        SAFETY CHECK

        If the attempt already has the configured
        number of questions answered, do not ask
        Supabase for another question.
      */
      if (
        attempt.questions_answered >=
        loadedChallenge.question_count
      ) {
        router.replace(
          `/challenges/${challengeId}/result?attempt=${attempt.attempt_id}`
        );

        return;
      }

      // ----------------------------------------
      // LOAD NEXT UNANSWERED QUESTION
      // ----------------------------------------

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

      /*
        HARD STOP

        Never load question 31 for a
        30-question challenge.

        Never load question 21 for a
        20-question challenge.

        Never load question 26 for a
        25-question challenge, etc.
      */
      if (
        answeredCount >=
        activeChallenge.question_count
      ) {
        router.replace(
          `/challenges/${activeChallenge.id}/result?attempt=${activeAttemptId}`
        );

        return;
      }

      try {
        setQuestionLoading(true);
        setErrorMessage("");

        setSelectedAnswer("");
        setAnswerResult(null);

        const {
          data,
          error,
        } = await supabase.rpc(
          "get_next_challenge_question",
          {
            p_attempt_id:
              activeAttemptId,
          }
        );

        if (error) {
          throw error;
        }

        /*
          NO MORE QUESTIONS

          If Supabase returns no question,
          immediately show the result.
        */
        if (
          !data ||
          data.length === 0
        ) {
          router.replace(
            `/challenges/${activeChallenge.id}/result?attempt=${activeAttemptId}`
          );

          return;
        }

        const nextQuestion =
          data[0] as ChallengeQuestion;

        setQuestion(
          nextQuestion
        );

        /*
          IMPORTANT:

          The timer comes directly from the
          challenge configuration.

          Example:
          Sahaba Master = 15
          Speed Round = 10
          Abu Bakr = 15
        */
        setTimeLeft(
          activeChallenge.time_per_question
        );

        setStartedAt(
          Date.now()
        );
      } catch (error) {
        console.error(
          "Question loading error:",
          error
        );

        setErrorMessage(
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

      /*
        Extra safety check.

        If the configured number of questions
        has already been answered, do not submit
        another answer.
      */
      if (
        challenge &&
        questionsAnswered >=
          challenge.question_count
      ) {
        router.replace(
          `/challenges/${challenge.id}/result?attempt=${attemptId}`
        );

        return;
      }

      /*
        Store the ACTUAL ANSWER TEXT.
      */
      setSelectedAnswer(
        answerText
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
          "submit_challenge_answer",
          {
            p_attempt_id:
              attemptId,

            p_question_id:
              question.id,

            /*
              Send actual answer text.
            */
            p_selected_answer:
              answerText,

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

        /*
          Update progress immediately.
        */
        setQuestionsAnswered(
          result.questions_answered
        );

        setCorrectAnswers(
          result.correct_answers
        );

        setTotalXp(
          result.score
        );

        /*
          IMPORTANT:

          If this was the final question,
          do NOT wait for another question.

          The result page will be shown immediately
          after the player sees the final answer.
        */
      } catch (error) {
        console.error(
          "Answer submission error:",
          error
        );

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
        Timeout = incorrect answer.
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

    /*
      FINAL QUESTION

      We check the actual number of questions
      answered, rather than relying only on
      answerResult.completed.

      This gives us a second layer of protection
      against ever showing an extra question.
    */
    if (
      answerResult.completed ||
      answerResult.questions_answered >=
        challenge.question_count
    ) {
      router.replace(
        `/challenges/${challengeId}/result?attempt=${attemptId}`
      );

      return;
    }

    /*
      There are still questions remaining.
      Load exactly one more question.
    */
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
                textAlign:
                  "center",
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
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize: "42px",
                  marginBottom:
                    "16px",
                }}
              >
                ⚠️
              </div>

              <h2
                style={{
                  margin:
                    "0 0 10px",
                  fontSize:
                    "24px",
                  fontWeight: 800,
                }}
              >
                Challenge unavailable
              </h2>

              <p
                style={{
                  margin:
                    "0 auto 24px",
                  maxWidth:
                    "520px",
                  color:
                    "var(--muted)",
                  lineHeight:
                    1.6,
                }}
              >
                {errorMessage}
              </p>

              <button
                onClick={() =>
                  router.push(
                    "/challenges"
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
            maxWidth:
              "850px",
          }}
        >
          {/* CHALLENGE HEADER */}

          <section
            style={{
              marginBottom:
                "24px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: "15px",
                flexWrap:
                  "wrap",
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
                    marginTop:
                      "12px",
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
                  textAlign:
                    "right",
                }}
              >
                <div
                  style={{
                    fontSize:
                      "12px",
                    color:
                      "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  XP EARNED
                </div>

                <div
                  style={{
                    fontSize:
                      "22px",
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
              padding:
                "18px 20px",
              marginBottom:
                "18px",
            }}
          >
            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                gap: "12px",
                marginBottom:
                  "9px",
                fontSize:
                  "13px",
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
              display:
                "flex",
              justifyContent:
                "center",
              marginBottom:
                "18px",
            }}
          >
            <div
              className="sq-timer"
              style={{
                minWidth:
                  "100px",
                textAlign:
                  "center",
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
                padding:
                  "30px",
              }}
            >
              <div
                style={{
                  color:
                    "var(--muted)",
                  fontSize:
                    "12px",
                  fontWeight: 800,
                  textTransform:
                    "uppercase",
                  letterSpacing:
                    "0.6px",
                  marginBottom:
                    "12px",
                }}
              >
                Your challenge question
              </div>

              <h2
                style={{
                  margin: 0,
                  fontSize:
                    "23px",
                  lineHeight:
                    1.5,
                  fontWeight: 800,
                }}
              >
                {
                  question.question
                }
              </h2>

              {/* ANSWERS */}

              <div
                style={{
                  display:
                    "grid",
                  gap: "12px",
                  marginTop:
                    "28px",
                }}
              >
                {OPTIONS.map(
                  (letter) => {
                    const option =
                      question[
                        `option_${letter.toLowerCase()}` as keyof ChallengeQuestion
                      ] as string;

                    /*
                      Normalize both values before
                      comparing them.

                      This prevents a correct answer
                      from being displayed as wrong
                      because of capitalization or
                      extra spaces.
                    */
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

                    /*
                      Correct answer is always
                      highlighted as correct.
                    */
                    if (
                      answerResult &&
                      isCorrect
                    ) {
                      className +=
                        " sq-correct";
                    }
                    /*
                      If the player selected a
                      wrong answer, highlight only
                      their selected answer as wrong.
                    */
                    else if (
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

              {/* FEEDBACK */}

              {answerResult && (
                <div
                  style={{
                    marginTop:
                      "22px",
                    padding:
                      "18px",
                    borderRadius:
                      "14px",
                    background:
                      answerResult.is_correct
                        ? "var(--primary-light)"
                        : "var(--danger-light)",
                  }}
                >
                  <div
                    style={{
                      fontSize:
                        "17px",
                      fontWeight:
                        900,
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
                        fontSize:
                          "13px",
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
                        fontSize:
                          "13px",
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

              {/* CONTINUE */}

              {answerResult && (
                <button
                  type="button"
                  className="sq-button-primary"
                  onClick={
                    handleContinue
                  }
                  style={{
                    width:
                      "100%",
                    marginTop:
                      "18px",
                  }}
                >
                  {answerResult.completed ||
                  answerResult.questions_answered >=
                    (challenge?.question_count ||
                      0)
                    ? "View Results →"
                    : "Next Question →"}
                </button>
              )}
            </section>
          )}

          {/* ERROR */}

          {errorMessage &&
            question && (
              <div
                style={{
                  marginTop:
                    "18px",
                  padding:
                    "14px",
                  borderRadius:
                    "12px",
                  background:
                    "var(--danger-light)",
                  color:
                    "var(--danger)",
                  fontSize:
                    "13px",
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