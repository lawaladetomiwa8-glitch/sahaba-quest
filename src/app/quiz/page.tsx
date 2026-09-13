"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

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

export default function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [message, setMessage] = useState("Starting game...");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [timeUp, setTimeUp] = useState(false);
  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(
    null
  );

  useEffect(() => {
    startGame();
  }, []);

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

  async function startGame() {
    setMessage("Starting game...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in to play.");
      return;
    }

    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert({
        user_id: user.id,
        level: 1,
      })
      .select("id")
      .single();

    if (sessionError) {
      setMessage(sessionError.message);
      return;
    }

    setSessionId(session.id);

    await loadQuestion();
  }

  async function loadQuestion() {
    setMessage("Loading question...");

    const { data, error } = await supabase
      .from("questions")
      .select(
        "id, level, question, option_a, option_b, option_c, option_d, correct_answer, explanation"
      )
      .eq("is_published", true)
      .eq("level", 1)
      .limit(1)
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setQuestion(data);
    setSelectedAnswer(null);
    setTimeLeft(10);
    setTimeUp(false);
    setQuestionStartedAt(Date.now());
    setMessage("");
  }

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

    console.log("Quiz result:", data);

    setMessage("");
  }

  async function handleTimeout() {
    if (selectedAnswer || !question || !sessionId) {
      return;
    }

    setTimeUp(true);
    setMessage("Time's up!");

    const responseTime = questionStartedAt
      ? Date.now() - questionStartedAt
      : 10000;

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

    console.log("Timeout result:", data);
  }

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

            <h1 className="sq-title">Sahaba Quest</h1>

            <p className="sq-subtitle" style={{ marginTop: "12px" }}>
              {message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const answered = selectedAnswer !== null || timeUp;
  const isCorrect =
    selectedAnswer !== null &&
    selectedAnswer === question.correct_answer;

  const options = [
    {
      letter: "A",
      value: question.option_a,
    },
    {
      letter: "B",
      value: question.option_b,
    },
    {
      letter: "C",
      value: question.option_c,
    },
    {
      letter: "D",
      value: question.option_d,
    },
  ];

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
        {/* TOP NAVIGATION */}
        <nav className="sq-nav" style={{ borderRadius: "18px" }}>
          <div className="sq-logo">Sahaba Quest</div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <span className="sq-badge">
              Level {question.level}
            </span>

            <span
              style={{
                fontSize: "13px",
                color: "var(--muted)",
                fontWeight: 600,
              }}
            >
              Quiz Mode
            </span>
          </div>
        </nav>

        {/* GAME HEADER */}
        <div
          style={{
            maxWidth: "820px",
            margin: "32px auto 0",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "20px",
            alignItems: "center",
          }}
        >
          <div>
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

              <span style={{ color: "var(--muted-light)" }}>•</span>

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

            <h1 className="sq-title">Test your knowledge</h1>

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
          {/* PROGRESS */}
          <div style={{ marginBottom: "28px" }}>
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
                  color: "var(--muted)",
                }}
              >
                Question
              </span>

              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: "var(--primary)",
                }}
              >
                Level {question.level}
              </span>
            </div>

            <div className="sq-progress">
              <div
                className="sq-progress-bar"
                style={{
                  width: `${(timeLeft / 10) * 100}%`,
                  background:
                    timeLeft <= 3
                      ? "var(--danger)"
                      : "var(--primary)",
                }}
              />
            </div>
          </div>

          {/* QUESTION */}
          <div style={{ marginBottom: "30px" }}>
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
            {options.map((option) => {
              const isSelected = selectedAnswer === option.value;
              const isCorrectOption =
                option.value === question.correct_answer;

              let answerClass = "sq-answer";

              if (answered && isCorrectOption) {
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
                  key={option.letter}
                  className={answerClass}
                  onClick={() => handleAnswer(option.value)}
                  disabled={answered}
                >
                  <span className="sq-answer-letter">
                    {option.letter}
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

                  {answered && isCorrectOption && (
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
                  {isCorrect ? "✓" : timeUp ? "⏱" : "!"}
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

              <div
                style={{
                  padding: "16px",
                  borderRadius: "14px",
                  background: "rgba(255, 255, 255, 0.7)",
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

              <button
                className="sq-button-primary"
                onClick={loadQuestion}
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