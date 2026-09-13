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
    if (timeUp || selectedAnswer || !question || !sessionId) {
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in to continue.");
      return;
    }

    const responseTime = questionStartedAt
      ? Date.now() - questionStartedAt
      : 10000;

    const { error } = await supabase
      .from("question_attempts")
      .insert({
        user_id: user.id,
        session_id: sessionId,
        question_id: question.id,
        selected_answer: null,
        is_correct: false,
        response_time_ms: responseTime,
        xp_earned: 0,
      });

    if (error) {
      setMessage(error.message);
      return;
    }

    setTimeUp(true);
  }

  if (!question) {
    return (
      <main style={{ padding: "40px" }}>
        <h1>Sahaba Quest</h1>
        <p>{message}</p>
      </main>
    );
  }

  const answered = selectedAnswer !== null || timeUp;
  const isCorrect = selectedAnswer === question.correct_answer;

  return (
    <main style={{ padding: "40px", maxWidth: "700px" }}>
      <h1>Sahaba Quest</h1>

      <p>
        Session: {sessionId}
      </p>

      <h2>Level {question.level}</h2>

      <h3>{question.question}</h3>

      {!answered && (
        <h2>
          Time: {timeLeft}s
        </h2>
      )}

      <div>
        <button
          onClick={() => handleAnswer(question.option_a)}
          disabled={answered}
        >
          A. {question.option_a}
        </button>

        <br />
        <br />

        <button
          onClick={() => handleAnswer(question.option_b)}
          disabled={answered}
        >
          B. {question.option_b}
        </button>

        <br />
        <br />

        <button
          onClick={() => handleAnswer(question.option_c)}
          disabled={answered}
        >
          C. {question.option_c}
        </button>

        <br />
        <br />

        <button
          onClick={() => handleAnswer(question.option_d)}
          disabled={answered}
        >
          D. {question.option_d}
        </button>
      </div>

      {timeUp && (
        <div style={{ marginTop: "30px" }}>
          <h2>Time's Up! ?</h2>

          <p>
            <strong>Correct answer:</strong>{" "}
            {question.correct_answer}
          </p>

          <p>
            <strong>Explanation:</strong>{" "}
            {question.explanation}
          </p>

          <button onClick={loadQuestion}>
            Next Question ?
          </button>
        </div>
      )}

      {selectedAnswer && (
        <div style={{ marginTop: "30px" }}>
          <h2>{isCorrect ? "Correct! ??" : "Incorrect ?"}</h2>

          <p>
            <strong>Correct answer:</strong>{" "}
            {question.correct_answer}
          </p>

          <p>
            <strong>Explanation:</strong>{" "}
            {question.explanation}
          </p>

          <button onClick={loadQuestion}>
            Next Question ?
          </button>
        </div>
      )}

      {message && <p>{message}</p>}
    </main>
  );
}
