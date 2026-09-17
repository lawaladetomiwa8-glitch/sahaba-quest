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

type ResumeSession = {
  id: string;
  level: number;
  current_question_id: string | null;
  current_question_started_at: string | null;
};

export default function QuizPage() {
  const [question, setQuestion] = useState<Question | null>(null);
  const [message, setMessage] = useState(
    "Checking for an unfinished game..."
  );

  const [sessionId, setSessionId] = useState<string | null>(null);

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

  const [timeLeft, setTimeLeft] = useState(15);
  const [timeUp, setTimeUp] = useState(false);

  const [questionStartedAt, setQuestionStartedAt] = useState<number | null>(
    null
  );

  const [options, setOptions] = useState<QuizOption[]>([]);

  const [attemptQuestions, setAttemptQuestions] = useState(0);
  const [attemptCorrect, setAttemptCorrect] = useState(0);

  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  const [resumeSession, setResumeSession] =
    useState<ResumeSession | null>(null);

  const [showResumeScreen, setShowResumeScreen] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const gameStarted = useRef(false);

  /*
   * ---------------------------------------------------------
   * INITIAL LOAD
   * ---------------------------------------------------------
   */

  useEffect(() => {
    if (gameStarted.current) {
      return;
    }

    gameStarted.current = true;
    checkForExistingGame();
  }, []);

  /*
   * ---------------------------------------------------------
   * QUESTION TIMER
   * ---------------------------------------------------------
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
   * ---------------------------------------------------------
   * CHECK FOR EXISTING GAME
   * ---------------------------------------------------------
   */

  async function checkForExistingGame() {
    setCheckingSession(true);
    setMessage("Checking for an unfinished game...");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCheckingSession(false);
      setMessage("You must be logged in to play.");
      return;
    }

    const { data: existingSession, error: sessionError } = await supabase
      .from("game_sessions")
      .select(
        "id, level, current_question_id, current_question_started_at"
      )
      .eq("user_id", user.id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      setCheckingSession(false);
      setMessage(sessionError.message);
      return;
    }

    /*
     * No unfinished game.
     * Start a fresh game.
     */
    if (!existingSession) {
      setCheckingSession(false);
      await startGame();
      return;
    }

    /*
     * Count questions already answered in this session.
     */
    const { count, error: countError } = await supabase
      .from("question_attempts")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("user_id", user.id)
      .eq("session_id", existingSession.id);

    if (countError) {
      setCheckingSession(false);
      setMessage(countError.message);
      return;
    }

    /*
     * Safety check.
     * A 50-question session should already be completed.
     */
    if ((count ?? 0) >= 50) {
      await supabase
        .from("game_sessions")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_question_id: null,
          current_question_started_at: null,
        })
        .eq("id", existingSession.id)
        .eq("user_id", user.id);

      setCheckingSession(false);
      await startGame();
      return;
    }

    /*
     * Genuine unfinished game.
     */
    setResumeSession(existingSession as ResumeSession);
    setShowResumeScreen(true);
    setCheckingSession(false);
    setMessage("");
  }

  /*
   * ---------------------------------------------------------
   * START NEW GAME
   * ---------------------------------------------------------
   */

  async function startGame() {
    setMessage("Starting a new game...");

    setAttemptQuestions(0);
    setAttemptCorrect(0);
    setQuizResult(null);
    setQuestion(null);
    setOptions([]);
    setSelectedAnswer(null);
    setTimeUp(false);
    setQuestionStartedAt(null);
    setResumeSession(null);
    setShowResumeScreen(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in to play.");
      return;
    }

    /*
     * Get the player's current level.
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
     * Create a new game session.
     */
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert({
        user_id: user.id,
        level: currentLevel,
        status: "in_progress",
      })
      .select("id, level")
      .single();

    if (sessionError) {
      setMessage(sessionError.message);
      return;
    }

    setSessionId(session.id);

    await loadQuestion(user.id, session.id);
  }

  /*
   * ---------------------------------------------------------
   * RESUME GAME
   * ---------------------------------------------------------
   */

  async function resumeGame() {
    if (!resumeSession) {
      return;
    }

    setShowResumeScreen(false);
    setMessage("Resuming your game...");
    setSessionId(resumeSession.id);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You must be logged in to play.");
      return;
    }

    /*
     * Get all attempts belonging to this session.
     */
    const { data: attempts, error: attemptsError } = await supabase
      .from("question_attempts")
      .select("question_id, is_correct")
      .eq("user_id", user.id)
      .eq("session_id", resumeSession.id);

    if (attemptsError) {
      setMessage(attemptsError.message);
      return;
    }

    const sessionQuestions = attempts?.length ?? 0;

    const sessionCorrect =
      attempts?.filter((attempt) => attempt.is_correct).length ?? 0;

    setAttemptQuestions(sessionQuestions);
    setAttemptCorrect(sessionCorrect);

    /*
     * No saved question means we simply load the next
     * unanswered question.
     */
    if (!resumeSession.current_question_id) {
      await loadQuestion(user.id, resumeSession.id);
      return;
    }

    /*
     * Load the exact question that was on screen.
     */
    const { data: savedQuestion, error: questionError } = await supabase
      .from("questions")
      .select(
        "id, level, question, option_a, option_b, option_c, option_d, correct_answer, explanation"
      )
      .eq("id", resumeSession.current_question_id)
      .eq("is_published", true)
      .single();

    if (questionError || !savedQuestion) {
      await loadQuestion(user.id, resumeSession.id);
      return;
    }

    /*
     * Make sure this question has not already been answered.
     */
    const alreadyAnswered = attempts?.some(
      (attempt) => attempt.question_id === savedQuestion.id
    );

    if (alreadyAnswered) {
      await loadQuestion(user.id, resumeSession.id);
      return;
    }

    /*
     * Create and shuffle the answer options.
     */
    const shuffledOptions: QuizOption[] = [
      { value: savedQuestion.option_a },
      { value: savedQuestion.option_b },
      { value: savedQuestion.option_c },
      { value: savedQuestion.option_d },
    ];

    shuffleOptions(shuffledOptions);

    /*
     * Restore the question.
     */
    setQuestion(savedQuestion as Question);
    setOptions(shuffledOptions);
    setSelectedAnswer(null);
    setTimeUp(false);

    /*
     * Restore the original start time.
     */
    const originalStartedAt = resumeSession.current_question_started_at
      ? new Date(resumeSession.current_question_started_at).getTime()
      : Date.now();

    setQuestionStartedAt(originalStartedAt);

    /*
     * Calculate remaining time.
     */
    const elapsedSeconds = Math.floor(
      (Date.now() - originalStartedAt) / 1000
    );

    const remainingSeconds = Math.max(0, 15 - elapsedSeconds);

    setTimeLeft(remainingSeconds);
    setMessage("");

    /*
     * If the 15 seconds already expired while the user
     * was away, let the timer immediately submit the timeout.
     */
  }

  /*
   * ---------------------------------------------------------
   * ABANDON CURRENT GAME AND START NEW GAME
   * ---------------------------------------------------------
   */

  async function abandonAndStartNewGame() {
    if (!resumeSession) {
      await startGame();
      return;
    }

    setMessage("Ending unfinished game...");

    const { data, error } = await supabase.rpc(
      "abandon_quiz_session",
      {
        p_session_id: resumeSession.id,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    console.log("Abandoned session:", data);

    /*
     * The unfinished session has now been abandoned and
     * its XP forfeited.
     *
     * Now create a completely fresh game.
     */
    await startGame();
  }

  /*
   * ---------------------------------------------------------
   * LOAD NEXT QUESTION
   * ---------------------------------------------------------
   */

  async function loadQuestion(
    userId?: string,
    activeSessionId?: string
  ) {
    setMessage("Loading question...");
    setQuestion(null);
    setOptions([]);
    setSelectedAnswer(null);
    setTimeUp(false);
    setQuestionStartedAt(null);

    let currentUserId = userId;

    /*
     * Get logged-in user if one wasn't supplied.
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
     * Use the supplied session ID or the current session.
     */
    const currentSessionId = activeSessionId ?? sessionId;

    if (!currentSessionId) {
      setMessage("No active game session found.");
      return;
    }

    /*
     * IMPORTANT:
     *
     * get_next_quiz_question now requires BOTH:
     * p_user_id
     * p_session_id
     *
     * This means questions are tracked separately
     * for every game session.
     */
    const { data, error } = await supabase.rpc(
      "get_next_quiz_question",
      {
        p_user_id: currentUserId,
        p_session_id: currentSessionId,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    if (!data || data.length === 0) {
      setMessage(
        "You have answered all available questions for this game."
      );
      return;
    }

    const nextQuestion = data[0] as Question;

    /*
     * Create the answer options.
     */
    const shuffledOptions: QuizOption[] = [
      { value: nextQuestion.option_a },
      { value: nextQuestion.option_b },
      { value: nextQuestion.option_c },
      { value: nextQuestion.option_d },
    ];

    shuffleOptions(shuffledOptions);

    /*
     * Save the question to the session before displaying it.
     */
    const startedAt = new Date();

    const { error: updateError } = await supabase
      .from("game_sessions")
      .update({
        current_question_id: nextQuestion.id,
        current_question_started_at: startedAt.toISOString(),
      })
      .eq("id", currentSessionId)
      .eq("user_id", currentUserId)
      .eq("status", "in_progress");

    if (updateError) {
      setMessage(updateError.message);
      return;
    }

    setQuestion(nextQuestion);
    setOptions(shuffledOptions);
    setSelectedAnswer(null);
    setTimeLeft(15);
    setTimeUp(false);
    setQuestionStartedAt(startedAt.getTime());
    setMessage("");
  }

  /*
   * ---------------------------------------------------------
   * SHUFFLE ANSWERS
   * ---------------------------------------------------------
   */

  function shuffleOptions(items: QuizOption[]) {
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));

      [items[i], items[j]] = [items[j], items[i]];
    }
  }

  /*
   * ---------------------------------------------------------
   * SUBMIT ANSWER
   * ---------------------------------------------------------
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
      : 15000;

    setMessage("Checking answer...");

    const { data, error } = await supabase.rpc(
      "submit_quiz_answer",
      {
        p_session_id: sessionId,
        p_question_id: question.id,
        p_selected_answer: answer,
        p_response_time_ms: responseTime,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    setSelectedAnswer(answer);

    const result = data as QuizResult;

    setAttemptQuestions(result.questions_answered_in_level);
    setAttemptCorrect(result.correct_answers_in_attempt);

    setQuizResult(result);
    setMessage("");
  }

  /*
   * ---------------------------------------------------------
   * TIMEOUT
   * ---------------------------------------------------------
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

    const { data, error } = await supabase.rpc(
      "submit_quiz_answer",
      {
        p_session_id: sessionId,
        p_question_id: question.id,
        p_selected_answer: null,
        p_response_time_ms: responseTime,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = data as QuizResult;

    setAttemptQuestions(result.questions_answered_in_level);
    setAttemptCorrect(result.correct_answers_in_attempt);

    setQuizResult(result);
    setMessage("");
  }

  /*
   * ---------------------------------------------------------
   * RESUME / CHECKING SCREEN
   * ---------------------------------------------------------
   */

  if (checkingSession || showResumeScreen) {
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
            <div
              style={{
                width: "76px",
                height: "76px",
                margin: "0 auto 24px",
                borderRadius: "24px",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                fontSize: "28px",
                fontWeight: 900,
              }}
            >
              SQ
            </div>

            {checkingSession ? (
              <>
                <h1
                  className="sq-title"
                  style={{ marginBottom: "12px" }}
                >
                  Checking your game...
                </h1>

                <p className="sq-subtitle">
                  We're checking whether you have an unfinished quiz.
                </p>
              </>
            ) : (
              <>
                <div
                  style={{
                    color: "var(--primary)",
                    fontSize: "13px",
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    marginBottom: "10px",
                  }}
                >
                  Unfinished Game
                </div>

                <h1
                  className="sq-title"
                  style={{ marginBottom: "12px" }}
                >
                  Continue your game?
                </h1>

                <p
                  className="sq-subtitle"
                  style={{
                    maxWidth: "520px",
                    margin: "0 auto",
                  }}
                >
                  You have an unfinished Level{" "}
                  {resumeSession?.level} game. You can continue where
                  you stopped or start a completely new game.
                </p>

                <div
                  style={{
                    marginTop: "28px",
                    padding: "22px",
                    borderRadius: "18px",
                    background: "var(--primary-light)",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.8px",
                      color: "var(--muted)",
                      marginBottom: "8px",
                    }}
                  >
                    Your unfinished game
                  </div>

                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 900,
                      color: "var(--primary-dark)",
                    }}
                  >
                    Level {resumeSession?.level}
                  </div>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "var(--muted)",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    Your previous answers and earned XP are still
                    attached to this game.
                  </p>
                </div>

                <button
                  className="sq-button-primary"
                  onClick={resumeGame}
                  style={{
                    width: "100%",
                    marginTop: "28px",
                  }}
                >
                  Resume Game →
                </button>

                <button
                  className="sq-button-secondary"
                  onClick={abandonAndStartNewGame}
                  style={{
                    width: "100%",
                    marginTop: "12px",
                  }}
                >
                  Start New Game
                </button>

                <div
                  style={{
                    marginTop: "18px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background: "var(--danger-light)",
                    color: "var(--danger)",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  <strong>Important:</strong> Starting a new game
                  abandons this unfinished game, so the XP earned
                  during it will be removed.
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * LEVEL RESULT SCREEN
   * ---------------------------------------------------------
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

            <h1
              className="sq-title"
              style={{ marginBottom: "14px" }}
            >
              {isFinalLevel
                ? "You mastered Level 10!"
                : passed
                ? `Level ${completedLevel} complete!`
                : `Keep going with Level ${completedLevel}`}
            </h1>

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
   * ---------------------------------------------------------
   * LOADING SCREEN
   * ---------------------------------------------------------
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
              style={{ marginTop: "12px" }}
            >
              {message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * QUIZ STATE
   * ---------------------------------------------------------
   */

  const answered =
    selectedAnswer !== null || timeUp;

  const isCorrect =
    selectedAnswer !== null &&
    selectedAnswer === question.correct_answer;

  const currentQuestionNumber =
    Math.min(attemptQuestions + 1, 50);

  /*
   * ---------------------------------------------------------
   * QUIZ UI
   * ---------------------------------------------------------
   */

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
          {/* PROGRESS */}
          <div style={{ marginBottom: "28px" }}>
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

            {/* QUESTION PROGRESS */}
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
                style={{ height: "4px" }}
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
            {options.map((option, index) => {
              const isSelected =
                selectedAnswer === option.value;

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
                  background: "rgba(255, 255, 255, 0.7)",
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
                    {attemptCorrect} / {attemptQuestions}
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
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
              {!quizResult?.level_completed && (
                <button
                  className="sq-button-primary"
                  onClick={() => loadQuestion()}
                  style={{
                    width: "100%",
                    marginTop: "22px",
                  }}
                >
                  Next Question →
                </button>
              )}
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