"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type Question = {
  id: string;
  level: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  explanation: string;
};

type QuizOption = {
  value: string;
};

type QuizResult = {
  is_correct: boolean;
  correct_answer: string;
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

export default function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [message, setMessage] = useState("Starting game...");
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  // 15 seconds per question
  const [timeLeft, setTimeLeft] = useState(15);

  const [timeUp, setTimeUp] = useState(false);

  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(
    null
  );

  const [options, setOptions] = useState<QuizOption[]>([]);

  /*
   * Current 50-question attempt progress.
   *
   * These reset whenever a new game session starts.
   */
  const [attemptQuestions, setAttemptQuestions] = useState(0);
  const [attemptCorrect, setAttemptCorrect] = useState(0);

  /*
   * Stores the result returned by submit_quiz_answer().
   */
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  /*
   * Prevent React development mode from starting
   * two game sessions.
   */
  const gameStarted = useRef(false);

  /*
   * Start the game once when the page loads.
   */
  useEffect(() => {
    if (gameStarted.current) {
      return;
    }

    gameStarted.current = true;
    startGame();
  }, []);

  /*
   * 15-second question timer.
   */
  useEffect(() => {
    if (!question || selectedAnswer || timeUp) {
      return;
    }

    if (timeLeft <= 0) {
      handleTimeout();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft((previousTime) => previousTime - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [question, selectedAnswer, timeLeft, timeUp]);

  /*
   * Start a completely new 50-question attempt.
   *
   * This works for every level.
   */
  async function startGame() {
    setMessage("Starting game...");

    // Reset current attempt progress
    setAttemptQuestions(0);
    setAttemptCorrect(0);
    setQuizResult(null);
    setQuestion(null);
    setOptions([]);
    setSelectedAnswer(null);
    setTimeUp(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in to play.");
      return;
    }

    /*
     * Get the player's actual current level.
     */
    const { data: progress, error: progressError } = await supabase
      .from("player_progress")
      .select("current_level")
      .eq("user_id", user.id)
      .single();

    if (progressError) {
      setMessage(progressError.message);
      return;
    }

    const currentLevel = progress.current_level;

    /*
     * Create a new game session for this attempt.
     */
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert({
        user_id: user.id,
        level: currentLevel,
      })
      .select("id")
      .single();

    if (sessionError) {
      setMessage(sessionError.message);
      return;
    }

    setSessionId(session.id);

    await loadQuestion(user.id);
  }

  /*
   * Load the next unanswered question.
   */
  async function loadQuestion(userId?: string) {
    setMessage("Loading question...");
    setQuestion(null);
    setOptions([]);
    setSelectedAnswer(null);
    setTimeUp(false);

    let currentUserId = userId;

    /*
     * Get the logged-in user if an ID wasn't supplied.
     */
    if (!currentUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("You must be logged in to play.");
        return;
      }

      currentUserId = user.id;
    }

    /*
     * Get the next unanswered question
     * from the player's current level.
     */
    const { data, error } = await supabase.rpc(
      "get_next_quiz_question",
      {
        p_user_id: currentUserId,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setMessage(
        "You have answered all available questions for your current level."
      );
      return;
    }

    const nextQuestion = data[0] as Question;

    /*
     * Create the four answer options.
     */
    const shuffledOptions: QuizOption[] = [
      {
        value: nextQuestion.option_a,
      },
      {
        value: nextQuestion.option_b,
      },
      {
        value: nextQuestion.option_c,
      },
      {
        value: nextQuestion.option_d,
      },
    ];

    /*
     * Fisher-Yates shuffle.
     */
    for (let i = shuffledOptions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [shuffledOptions[i], shuffledOptions[j]] = [
        shuffledOptions[j],
        shuffledOptions[i],
      ];
    }

    setQuestion(nextQuestion);
    setOptions(shuffledOptions);
    setSelectedAnswer(null);

    // Reset timer to 15 seconds
    setTimeLeft(15);

    setTimeUp(false);
    setQuestionStartedAt(Date.now());
    setMessage("");
  }

  /*
   * Submit a normal answer.
   */
  async function handleAnswer(answer: string) {
    if (selectedAnswer || timeUp || !question || !sessionId) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in to answer.");
      return;
    }

    const responseTime = questionStartedAt
      ? Date.now() - questionStartedAt
      : null;

    setMessage("Checking answer...");

    const { data, error } = await supabase.rpc("submit_quiz_answer", {
      p_session_id: sessionId,
      p_question_id: question.id,
      p_selected_answer: answer,
      p_response_time_ms: responseTime,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedAnswer(answer);

    /*
     * Update live attempt progress.
     */
    const result = data as QuizResult;

    setAttemptQuestions(result.questions_answered_in_level);
    setAttemptCorrect(result.correct_answers_in_attempt);

    /*
     * Store complete result.
     */
    setQuizResult(result);

    console.log("Quiz result:", result);

    setMessage("");
  }

  /*
   * Handle timeout.
   *
   * Timeout is recorded as an incorrect answer.
   */
  async function handleTimeout() {
    if (selectedAnswer || timeUp || !question || !sessionId) {
      return;
    }

    setTimeUp(true);
    setMessage("Time's up!");

    const responseTime = questionStartedAt
      ? Date.now() - questionStartedAt
      : 15000;

    const { data, error } = await supabase.rpc("submit_quiz_answer", {
      p_session_id: sessionId,
      p_question_id: question.id,
      p_selected_answer: null,
      p_response_time_ms: responseTime,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    /*
     * Update live attempt progress after timeout.
     */
    const result = data as QuizResult;

    setAttemptQuestions(result.questions_answered_in_level);
    setAttemptCorrect(result.correct_answers_in_attempt);

    setQuizResult(result);

    console.log("Timeout result:", result);
  }

  /*
   * ---------------------------------------------------------
   * LEVEL RESULT SCREEN
   * ---------------------------------------------------------
   *
   * Appears after question 50.
   *
   * 25–50 correct = PASS
   * 0–24 correct = FAIL
   */
  if (quizResult?.level_completed) {
    const passed = quizResult.level_passed;

    const completedLevel =
      question?.level ?? quizResult.current_level;

    const isFinalLevel =
      passed &&
      completedLevel === 10 &&
      quizResult.current_level === 10;

    return (
      <main
        className="sq-page"
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
        }}
      >
        <div className="sq-container">
          <div style={{ marginBottom: "28px" }}>
            <AppNavbar />
          </div>

          <div
            className="sq-card"
            style={{
              maxWidth: "700px",
              margin: "80px auto",
              padding: "48px",
              textAlign: "center",
            }}
          >
            {/* RESULT ICON */}
            <div
              style={{
                width: "76px",
                height: "76px",
                margin: "0 auto 24px",
                borderRadius: "24px",
                background: passed
                  ? "var(--primary-light)"
                  : "var(--danger-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: passed
                  ? "var(--primary)"
                  : "var(--danger)",
                fontSize: "32px",
                fontWeight: 800,
              }}
            >
              {passed ? "✓" : "↻"}
            </div>

            {/* RESULT LABEL */}
            <div
              style={{
                color: passed
                  ? "var(--primary)"
                  : "var(--danger)",
                fontSize: "13px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "1px",
                marginBottom: "10px",
              }}
            >
              {isFinalLevel
                ? "Sahaba Quest Complete"
                : passed
                ? "Level Passed"
                : "Level Not Passed"}
            </div>

            {/* TITLE */}
            <h1
              className="sq-title"
              style={{
                marginBottom: "14px",
              }}
            >
              {isFinalLevel
                ? "You mastered Level 10!"
                : passed
                ? `Level ${completedLevel} complete!`
                : `Keep going with Level ${completedLevel}`}
            </h1>

            {/* DESCRIPTION */}
            <p
              className="sq-subtitle"
              style={{
                maxWidth: "520px",
                margin: "0 auto",
              }}
            >
              {passed
                ? isFinalLevel
                  ? "You have successfully completed the highest level of Sahaba Quest."
                  : `You passed Level ${completedLevel} and unlocked Level ${quizResult.current_level}.`
                : `You scored ${quizResult.correct_answers_in_attempt} out of 50. You need at least 25 correct answers to pass.`}
            </p>

            {/* FINAL SCORE */}
            <div
              style={{
                marginTop: "28px",
                padding: "24px",
                borderRadius: "18px",
                background: passed
                  ? "var(--primary-light)"
                  : "var(--danger-light)",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--muted)",
                  marginBottom: "6px",
                }}
              >
                Final Score
              </div>

              <div
                style={{
                  fontSize: "42px",
                  fontWeight: 900,
                  color: passed
                    ? "var(--primary-dark)"
                    : "var(--danger)",
                }}
              >
                {quizResult.correct_answers_in_attempt} / 50
              </div>

              <div
                style={{
                  marginTop: "6px",
                  fontSize: "13px",
                  color: "var(--muted)",
                }}
              >
                {passed
                  ? "You reached the 25/50 passing mark."
                  : "25/50 is required to pass."}
              </div>
            </div>

            {/* ACTION */}
            {!isFinalLevel && (
              <button
                className="sq-button-primary"
                onClick={() => {
                  setQuizResult(null);
                  startGame();
                }}
                style={{
                  width: "100%",
                  marginTop: "28px",
                }}
              >
                {passed
                  ? `Continue to Level ${quizResult.current_level} →`
                  : `Retry Level ${completedLevel} →`}
              </button>
            )}

            {/* LEVEL 10 */}
            {isFinalLevel && (
              <button
                className="sq-button-primary"
                onClick={() => {
                  setQuizResult(null);
                  startGame();
                }}
                style={{
                  width: "100%",
                  marginTop: "28px",
                }}
              >
                Play Level 10 Again →
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  /*
   * Loading / initial screen.
   */
  if (!question) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div
            className="sq-card"
            style={{
              maxWidth: "700px",
              margin: "80px auto",
              padding: "48px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "20px",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                fontSize: "28px",
                fontWeight: 800,
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
   * Whether the current question has already been answered.
   */
  const answered =
    selectedAnswer !== null || timeUp;

  /*
   * Check whether the selected answer is correct.
   */
  const isCorrect =
    selectedAnswer !== null &&
    selectedAnswer === question.correct_answer;

  /*
   * Current question number.
   *
   * attemptQuestions represents questions already submitted,
   * so the question currently on screen is +1.
   */
  const currentQuestionNumber =
    Math.min(attemptQuestions + 1, 50);

  return (
    <main
      className="sq-page"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
      }}
    >
      <div className="sq-container">

        {/* SHARED NAVIGATION */}
        <div style={{ marginBottom: "28px" }}>
          <AppNavbar />
        </div>

        {/* GAME HEADER */}
        <div
          style={{
            maxWidth: "820px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <div>

            {/* LEVEL LABEL */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                Sahaba Quest
              </span>

              <span
                style={{
                  color: "var(--muted-light)",
                }}
              >
                •
              </span>

              <span
                style={{
                  color: "var(--muted)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Level {question.level}
              </span>
            </div>

            <h1 className="sq-title">
              Test your knowledge
            </h1>

            <p className="sq-subtitle">
              Choose the best answer before the timer runs out.
            </p>
          </div>

          {/* TIMER */}
          {!answered && (
            <div
              className="sq-timer"
              style={{
                width: "78px",
                height: "78px",
                background:
                  timeLeft <= 3
                    ? "var(--danger-light)"
                    : "var(--primary-light)",
                color:
                  timeLeft <= 3
                    ? "var(--danger)"
                    : "var(--primary-dark)",
                borderColor:
                  timeLeft <= 3
                    ? "var(--danger)"
                    : "var(--primary)",
              }}
            >
              {timeLeft}
            </div>
          )}
        </div>

        {/* QUESTION CARD */}
        <section
          className="sq-card"
          style={{
            maxWidth: "820px",
            margin: "28px auto 0",
            padding: "32px",
          }}
        >

          {/* PROGRESS + LIVE SCORE */}
          <div
            style={{
              marginBottom: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "var(--muted)",
                }}
              >
                Question {currentQuestionNumber} / 50
              </span>

              <span
                style={{
                  color: "var(--muted-light)",
                }}
              >
                •
              </span>

              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  color: "var(--primary)",
                }}
              >
                Score {attemptCorrect} / {attemptQuestions}
              </span>

              <span
                style={{
                  color: "var(--muted-light)",
                }}
              >
                •
              </span>

              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--muted)",
                }}
              >
                Level {question.level}
              </span>
            </div>

            {/* QUESTION NUMBER PROGRESS */}
            <div
              style={{
                width: "100%",
                height: "7px",
                background: "var(--border)",
                borderRadius: "999px",
                overflow: "hidden",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: `${(attemptQuestions / 50) * 100}%`,
                  height: "100%",
                  background: "var(--primary)",
                  borderRadius: "999px",
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            {/* TIMER PROGRESS */}
            {!answered && (
              <div
                className="sq-progress"
                style={{
                  height: "4px",
                }}
              >
                <div
                  className="sq-progress-bar"
                  style={{
                    width: `${(timeLeft / 15) * 100}%`,
                    background:
                      timeLeft <= 3
                        ? "var(--danger)"
                        : "var(--primary)",
                    transition: "width 1s linear",
                  }}
                />
              </div>
            )}
          </div>

          {/* QUESTION */}
          <div
            style={{
              marginBottom: "30px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(22px, 4vw, 32px)",
                lineHeight: 1.35,
                letterSpacing: "-0.4px",
              }}
            >
              {question.question}
            </h2>
          </div>

          {/* ANSWERS */}
          <div
            style={{
              display: "grid",
              gap: "14px",
            }}
          >
            {options.map((option, index) => {
              const isSelected =
                selectedAnswer === option.value;

              const isCorrectOption =
                option.value === question.correct_answer;

              let answerClass = "sq-answer";

              if (
                answered &&
                isCorrectOption
              ) {
                answerClass += " sq-correct";
              }

              if (
                answered &&
                isSelected &&
                !isCorrectOption
              ) {
                answerClass += " sq-wrong";
              }

              return (
                <button
                  key={`${question.id}-${option.value}`}
                  className={answerClass}
                  onClick={() =>
                    handleAnswer(option.value)
                  }
                  disabled={answered}
                >
                  <span className="sq-answer-letter">
                    {String.fromCharCode(65 + index)}
                  </span>

                  <span
                    style={{
                      flex: 1,
                      fontSize: "16px",
                      lineHeight: 1.5,
                      fontWeight: 600,
                    }}
                  >
                    {option.value}
                  </span>

                  {answered &&
                    isCorrectOption && (
                      <span
                        style={{
                          fontSize: "20px",
                          color: "var(--success)",
                        }}
                      >
                        ✓
                      </span>
                    )}

                  {answered &&
                    isSelected &&
                    !isCorrectOption && (
                      <span
                        style={{
                          fontSize: "20px",
                          color: "var(--danger)",
                        }}
                      >
                        ×
                      </span>
                    )}
                </button>
              );
            })}
          </div>

          {/* FEEDBACK */}
          {answered && (
            <div
              style={{
                marginTop: "28px",
                padding: "24px",
                borderRadius: "20px",
                background: isCorrect
                  ? "var(--success-light)"
                  : timeUp
                  ? "var(--secondary-light)"
                  : "var(--danger-light)",
                border: `1px solid ${
                  isCorrect
                    ? "rgba(22, 163, 74, 0.2)"
                    : timeUp
                    ? "rgba(212, 167, 44, 0.25)"
                    : "rgba(220, 38, 38, 0.2)"
                }`,
              }}
            >

              {/* FEEDBACK HEADER */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "13px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "var(--white)",
                    fontSize: "20px",
                  }}
                >
                  {isCorrect
                    ? "✓"
                    : timeUp
                    ? "⏱"
                    : "!"}
                </div>

                <div>
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "20px",
                      fontWeight: 800,
                    }}
                  >
                    {isCorrect
                      ? "Excellent!"
                      : timeUp
                      ? "Time's Up!"
                      : "Not quite!"}
                  </h3>

                  <p
                    style={{
                      margin: "4px 0 0",
                      color: "var(--muted)",
                      fontSize: "14px",
                    }}
                  >
                    {isCorrect
                      ? "You got this question right."
                      : "Here's what you should know."}
                  </p>
                </div>
              </div>

              {/* CURRENT SCORE */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background:
                    "rgba(255, 255, 255, 0.7)",
                  marginBottom: "16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      fontWeight: 800,
                      color: "var(--muted)",
                      marginBottom: "6px",
                    }}
                  >
                    Current Score
                  </div>

                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 900,
                    }}
                  >
                    {attemptCorrect} /{" "}
                    {attemptQuestions}
                  </div>
                </div>

                <div
                  style={{
                    textAlign: "right",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--muted)",
                    }}
                  >
                    Need to pass
                  </div>

                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 800,
                      color: "var(--primary)",
                    }}
                  >
                    25 / 50
                  </div>
                </div>
              </div>

              {/* CORRECT ANSWER */}
              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background:
                    "rgba(255, 255, 255, 0.7)",
                  marginBottom: "16px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    fontWeight: 800,
                    color: "var(--muted)",
                    marginBottom: "6px",
                  }}
                >
                  Correct answer
                </div>

                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 800,
                  }}
                >
                  {question.correct_answer}
                </div>
              </div>

              {/* EXPLANATION */}
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    fontWeight: 800,
                    color: "var(--muted)",
                    marginBottom: "6px",
                  }}
                >
                  Why?
                </div>

                <p
                  style={{
                    margin: 0,
                    lineHeight: 1.7,
                    color: "var(--foreground)",
                  }}
                >
                  {question.explanation}
                </p>
              </div>

              {/* NEXT QUESTION */}
              <button
                className="sq-button-primary"
                onClick={() =>
                  loadQuestion()
                }
                style={{
                  width: "100%",
                  marginTop: "22px",
                }}
              >
                Next Question →
              </button>
            </div>
          )}
        </section>

        {/* BOTTOM GAME INFO */}
        <div
          style={{
            maxWidth: "820px",
            margin: "18px auto 0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          {/* STREAK */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: "var(--muted)",
              fontSize: "13px",
            }}
          >
            <span>🔥</span>
            <span>Keep your streak alive</span>
          </div>

          {/* SESSION */}
          <div
            style={{
              color: "var(--muted-light)",
              fontSize: "11px",
              maxWidth: "500px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Session: {sessionId}
          </div>
        </div>
      </div>
    </main>
  );
}