"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

const SESSION_KEY = "sahabaquest_family_member_session";
const QUESTION_TIME_SECONDS = 15;
const QUESTION_TIME_MS = QUESTION_TIME_SECONDS * 1000;
const OPTIONS = ["option_a", "option_b", "option_c", "option_d"] as const;
type OptionKey = (typeof OPTIONS)[number];

type MemberProgress = {
  member_id: string;
  display_name: string;
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

type GameSession = {
  session_id: string;
  member_id: string;
  family_id: string;
  display_name: string;
  level: number;
  track: string;
  started_at: string;
  questions_answered: number;
  correct_answers: number;
  resumed: boolean;
};

type QuizQuestion = {
  id: string;
  level: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  question_started_at: string;
};

type AnswerResult = {
  member_id: string;
  display_name: string;
  family_id: string;
  is_correct: boolean;
  timed_out: boolean;
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

type SessionRow = {
  member_id: string;
  display_name: string;
  family_id: string;
  expires_at: string;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    if (typeof e.message === "string" && e.message) return e.message;
    if (typeof e.details === "string" && e.details) return e.details;
    if (typeof e.hint === "string" && e.hint) return e.hint;
  }
  return fallback;
}

/*
 * Family Member progress can contain NULL values for a newly created
 * member. The quiz itself requires a real level from 1 to 10.
 *
 * Treat a missing/invalid level as Level 1 rather than sending NULL
 * (or 0) to start_family_member_quiz.
 */
function normalizeFamilyMemberLevel(value: unknown): number {
  const level = Number(value);

  if (!Number.isFinite(level) || level < 1) {
    return 1;
  }

  return Math.min(Math.floor(level), 10);
}

function normalizeMemberProgress(
  value: Partial<MemberProgress>
): MemberProgress {
  return {
    member_id: String(value.member_id ?? ""),
    display_name: String(value.display_name ?? "Family Member"),
    current_level: normalizeFamilyMemberLevel(value.current_level),
    total_xp: Number(value.total_xp ?? 0),
    questions_answered: Number(value.questions_answered ?? 0),
    correct_answers: Number(value.correct_answers ?? 0),
    current_streak: Number(value.current_streak ?? 0),
    best_streak: Number(value.best_streak ?? 0),
  };
}

export default function FamilyMemberQuizPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingQuestion, setLoadingQuestion] = useState(false);

  const [error, setError] = useState("");
  const [progress, setProgress] = useState<MemberProgress | null>(null);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [levelFinished, setLevelFinished] = useState(false);
  const [resumedSession, setResumedSession] = useState(false);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME_SECONDS);

  const timerRef = useRef<number | null>(null);
  const timeoutSubmittedRef = useRef(false);
  const questionLoadIdRef = useRef(0);

  const getToken = useCallback(async () => {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem(SESSION_KEY);
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    initialise();
    return () => clearTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initialise() {
    setLoading(true);
    setError("");

    try {
      const token = await getToken();

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      const { data: sessionData, error: sessionError } = await supabase.rpc(
        "get_family_member_session",
        { p_session_token: token }
      );

      if (sessionError || !Array.isArray(sessionData) || !sessionData.length) {
        sessionStorage.removeItem(SESSION_KEY);
        router.replace("/family-member-login");
        return;
      }

      const session = sessionData[0] as SessionRow;

      const { data: progressData, error: progressError } = await supabase.rpc(
        "get_family_member_progress",
        { p_session_token: token }
      );

      if (progressError) throw new Error(progressError.message);

      if (!Array.isArray(progressData) || !progressData.length) {
        throw new Error("No Family Member progress was found.");
      }

      /*
       * Normalize the RPC response before using current_level.
       *
       * This is the exact point that matters for the Lawal account:
       * if current_level comes back NULL from Supabase, we start at
       * Level 1 instead of sending NULL to the RPC.
       */
      const memberProgress = normalizeMemberProgress(
        progressData[0] as Partial<MemberProgress>
      );

      setProgress(memberProgress);

      await startQuiz(
        token,
        normalizeFamilyMemberLevel(memberProgress.current_level),
        session.display_name
      );
    } catch (err) {
      console.error("Family Member quiz initialisation error:", err);
      setError(getErrorMessage(err, "We could not start your Family Quest."));
    } finally {
      setLoading(false);
    }
  }

  async function startQuiz(token: string, level: number, displayName?: string) {
    const safeLevel = normalizeFamilyMemberLevel(level);

    setStarting(true);
    setError("");
    setAnswerResult(null);
    setSelectedAnswer("");
    setLevelFinished(false);
    setResumedSession(false);
    clearTimer();

    try {
      const { data, error: startError } = await supabase.rpc(
        "start_family_member_quiz",
        {
          p_session_token: token,
          p_level: safeLevel,
          p_track: "individual",
        }
      );

      if (startError) throw new Error(startError.message);
      if (!Array.isArray(data) || !data.length) {
        throw new Error("No Family Member quiz session was created.");
      }

      const session = data[0] as GameSession;
      setGameSession(session);
      setResumedSession(Boolean(session.resumed));
      setQuestionNumber(Number(session.questions_answered ?? 0) + 1);

      await loadQuestion(token, session.session_id);
    } catch (err) {
      console.error("Family Member quiz start error:", err);
      setError(getErrorMessage(err, "We could not start this quiz."));
    } finally {
      setStarting(false);
    }
  }

  /*
   * IMPORTANT:
   * The timer is started from a useEffect after `question` has actually
   * been committed to React state. Starting it immediately after
   * setQuestion(...) can call submitAnswer() while `question` is still the
   * previous value, which makes the timeout submission silently return.
   */
  useEffect(() => {
    clearTimer();
    timeoutSubmittedRef.current = false;

    if (!question || !gameSession || answerResult) {
      return;
    }

    const started = new Date(question.question_started_at).getTime();

    const updateRemaining = () => {
      const elapsed = Date.now() - started;
      const remaining = Math.max(
        0,
        Math.ceil((QUESTION_TIME_MS - elapsed) / 1000)
      );

      setTimeLeft(remaining);
      return remaining;
    };

    const remaining = updateRemaining();

    if (remaining <= 0) {
      if (!timeoutSubmittedRef.current) {
        timeoutSubmittedRef.current = true;
        void submitAnswer("", true);
      }
      return;
    }

    timerRef.current = window.setInterval(() => {
      const nextRemaining = updateRemaining();

      if (nextRemaining <= 0) {
        clearTimer();

        if (!timeoutSubmittedRef.current) {
          timeoutSubmittedRef.current = true;
          void submitAnswer("", true);
        }
      }
    }, 250);

    return () => {
      clearTimer();
    };
    // The effect intentionally tracks the active question/session/result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, gameSession, answerResult]);

  async function loadQuestion(token: string, sessionId: string) {
    const loadId = ++questionLoadIdRef.current;

    setLoadingQuestion(true);
    setError("");
    setSelectedAnswer("");
    setAnswerResult(null);
    setQuestion(null);
    clearTimer();
    setTimeLeft(QUESTION_TIME_SECONDS);

    try {
      const { data, error: questionError } = await supabase.rpc(
        "get_next_family_member_quiz_question",
        {
          p_session_token: token,
          p_session_id: sessionId,
        }
      );

      if (questionError) throw new Error(questionError.message);
      if (loadId !== questionLoadIdRef.current) return;

      if (!Array.isArray(data) || !data.length) {
        setQuestion(null);
        setLevelFinished(true);
        return;
      }

      const nextQuestion = data[0] as QuizQuestion;
      setQuestion(nextQuestion);
    } catch (err) {
      console.error("Family Member question error:", err);
      setError(getErrorMessage(err, "We could not load the next question."));
    } finally {
      setLoadingQuestion(false);
    }
  }

  async function submitAnswer(answer: string, fromTimeout = false) {
    if (!question || !gameSession || submitting || answerResult) return;

    const token = await getToken();
    if (!token) {
      sessionStorage.removeItem(SESSION_KEY);
      router.replace("/family-member-login");
      return;
    }

    clearTimer();
    setSubmitting(true);
    setSelectedAnswer(answer);
    setError("");

    try {
      const { data, error: submitError } = await supabase.rpc(
        "submit_family_member_quiz_answer",
        {
          p_session_token: token,
          p_session_id: gameSession.session_id,
          p_question_id: question.id,
          p_selected_answer: fromTimeout ? "" : answer,
          p_response_time_ms: fromTimeout ? QUESTION_TIME_MS : null,
        }
      );

      if (submitError) throw new Error(submitError.message);
      if (!Array.isArray(data) || !data.length) {
        throw new Error("The answer submission returned no result.");
      }

      const result = data[0] as AnswerResult;
      setAnswerResult(result);

      setProgress((current) =>
        current
          ? {
              ...current,
              total_xp: current.total_xp + result.xp_earned,
              questions_answered: current.questions_answered + 1,
              correct_answers:
                current.correct_answers + (result.is_correct ? 1 : 0),
              current_streak: result.current_streak,
              best_streak: Math.max(current.best_streak, result.best_streak),
              current_level: result.current_level,
            }
          : current
      );

      setGameSession((current) =>
        current
          ? {
              ...current,
              questions_answered: current.questions_answered + 1,
              correct_answers:
                current.correct_answers + (result.is_correct ? 1 : 0),
            }
          : current
      );

      if (result.level_completed) {
        setLevelFinished(true);
      }
    } catch (err) {
      console.error("Family Member answer submission error:", err);
      setError(getErrorMessage(err, "We could not submit your answer."));
      setSelectedAnswer("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleNextQuestion() {
    if (!gameSession || !answerResult || levelFinished) return;

    const token = await getToken();
    if (!token) {
      sessionStorage.removeItem(SESSION_KEY);
      router.replace("/family-member-login");
      return;
    }

    setQuestionNumber((current) => current + 1);
    await loadQuestion(token, gameSession.session_id);
  }

  async function continueAfterLevel() {
    const token = await getToken();
    if (!token) {
      router.replace("/family-member-login");
      return;
    }

    const nextLevel = normalizeFamilyMemberLevel(
      progress?.current_level ?? gameSession?.level ?? 1
    );

    if (nextLevel >= 10) {
      router.push("/family-member-dashboard");
      return;
    }

    setQuestion(null);
    setAnswerResult(null);
    setLevelFinished(false);
    await startQuiz(token, nextLevel);
  }

  function switchMember() {
    clearTimer();
    sessionStorage.removeItem(SESSION_KEY);
    router.push("/family-member-login");
  }

  if (loading) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div className="sq-card" style={{ maxWidth: 620, margin: "80px auto", padding: 48, textAlign: "center" }}>
            <div className="sq-badge">Family Quest</div>
            <h1 className="sq-title" style={{ marginTop: 16 }}>Preparing your quest…</h1>
            <p className="sq-subtitle" style={{ marginTop: 10 }}>
              Checking your Family Member session and loading your progress.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error && !question && !levelFinished) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div className="sq-card" style={{ maxWidth: 680, margin: "70px auto", padding: 36, textAlign: "center" }}>
            <div className="sq-badge">Family Quest</div>
            <h1 className="sq-title" style={{ marginTop: 16 }}>Something went wrong</h1>
            <p className="sq-subtitle" style={{ marginTop: 12 }}>{error}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
              <button className="sq-button-primary" type="button" onClick={initialise} style={{ border: "none", cursor: "pointer" }}>
                Try Again
              </button>
              <button className="sq-button-secondary" type="button" onClick={() => router.push("/family-member-dashboard")} style={{ border: "none", cursor: "pointer" }}>
                Dashboard
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const currentLevel = progress?.current_level ?? gameSession?.level ?? 1;
  const answeredInLevel =
    answerResult?.questions_answered_in_level ?? gameSession?.questions_answered ?? 0;
  const questionsRequired = answerResult?.questions_required ?? 50;
  const correctInLevel =
    answerResult?.correct_answers_in_attempt ?? gameSession?.correct_answers ?? 0;
  const correctRequired = answerResult?.correct_required_to_pass ?? 25;
  const questionProgress = Math.min((answeredInLevel / questionsRequired) * 100, 100);
  const correctProgress = Math.min((correctInLevel / correctRequired) * 100, 100);

  if (levelFinished) {
    const passed = answerResult?.level_passed ?? false;
    const completedLevel = gameSession?.level ?? currentLevel;

    return (
      <main className="sq-page" style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)" }}>
        <div className="sq-container">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
            <div className="sq-badge">Family Quest</div>
            <button type="button" onClick={switchMember} className="sq-button-secondary" style={{ border: "none", cursor: "pointer" }}>
              Switch Member
            </button>
          </div>

          <section className="sq-card" style={{ maxWidth: 760, margin: "40px auto", padding: "44px 32px", textAlign: "center", background: "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)" }}>
            <div style={{ fontSize: 54 }}>{passed ? "🎉" : "📚"}</div>
            <h1 style={{ margin: "18px 0 8px", fontSize: "clamp(30px, 5vw, 44px)", fontWeight: 900 }}>
              {passed ? `Level ${completedLevel} Complete!` : `Level ${completedLevel} Finished`}
            </h1>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.7 }}>
              {passed
                ? "MashaAllah! You reached the required score for this level. Keep going and continue your Sahaba Quest."
                : "You completed this set of questions. Keep practising and you can attempt the level again."}
            </p>

            {answerResult && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 28 }}>
                <div className="sq-stat"><div className="sq-stat-label">Questions</div><div className="sq-stat-value">{answerResult.questions_answered_in_level}/{answerResult.questions_required}</div></div>
                <div className="sq-stat"><div className="sq-stat-label">Correct</div><div className="sq-stat-value">{answerResult.correct_answers_in_attempt}/{answerResult.questions_required}</div></div>
                <div className="sq-stat"><div className="sq-stat-label">XP Earned</div><div className="sq-stat-value">+{answerResult.xp_earned}</div></div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
              {passed && (gameSession?.level ?? currentLevel) < 10 ? (
                <button type="button" className="sq-button-primary" onClick={continueAfterLevel} disabled={starting} style={{ border: "none", cursor: "pointer" }}>
                  {starting ? "Starting…" : `Continue to Level ${(gameSession?.level ?? currentLevel) + 1} →`}
                </button>
              ) : (
                <button type="button" className="sq-button-primary" onClick={() => router.push("/family-member-dashboard")} style={{ border: "none", cursor: "pointer" }}>
                  Back to Dashboard
                </button>
              )}
              <button type="button" className="sq-button-secondary" onClick={switchMember} style={{ border: "none", cursor: "pointer" }}>
                Switch Member
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const optionLabels: Record<OptionKey, string> = {
    option_a: "A",
    option_b: "B",
    option_c: "C",
    option_d: "D",
  };

  const answered = Boolean(answerResult);
  const timerUrgent = timeLeft <= 5 && !answered;

  return (
    <main className="sq-page" style={{ minHeight: "100vh", background: "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)" }}>
      <div className="sq-container">
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
          <div>
            <div className="sq-badge">Family Quest</div>
            <h1 style={{ margin: "10px 0 0", fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 900 }}>
              {progress?.display_name || gameSession?.display_name || "Family Member"}
            </h1>
            <p style={{ margin: "5px 0 0", color: "var(--muted)", fontSize: 14 }}>
              Level {currentLevel} • Question {questionNumber}
            </p>
          </div>

          <button type="button" onClick={switchMember} className="sq-button-secondary" style={{ border: "none", cursor: "pointer" }}>
            Switch Member
          </button>
        </header>

        <section className="sq-card" style={{ padding: "26px 28px", marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <div className="sq-badge">Level {currentLevel}</div>
                {resumedSession && <div className="sq-badge" style={{ background: "#ecfdf5", color: "#047857" }}>Resumed Quest</div>}
              </div>
              <h2 style={{ margin: "12px 0 4px", fontSize: 22, fontWeight: 900 }}>Your Quest</h2>
              <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>
                Answer 50 questions and get at least 25 correct to pass the level.
                {resumedSession ? " Your unfinished quest has been resumed." : ""}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: "var(--primary)" }}>{Number(progress?.total_xp ?? 0).toLocaleString()} XP</div>
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Total XP</div>
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12, fontWeight: 800 }}>
              <span>Questions</span><span>{answeredInLevel}/{questionsRequired}</span>
            </div>
            <div className="sq-progress"><div className="sq-progress-bar" style={{ width: `${questionProgress}%` }} /></div>
          </div>

          <div style={{ marginTop: 15 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7, fontSize: 12, fontWeight: 800 }}>
              <span>Correct answers</span><span>{correctInLevel}/{correctRequired}</span>
            </div>
            <div className="sq-progress"><div className="sq-progress-bar" style={{ width: `${correctProgress}%` }} /></div>
          </div>
        </section>

        {error && (
          <div className="sq-card" style={{ marginBottom: 18, padding: 16, border: "1px solid #fecaca", background: "#fff7f7", color: "#991b1b" }}>
            {error}
          </div>
        )}

        <section className="sq-card" style={{ padding: "32px", maxWidth: 900, margin: "0 auto" }}>
          {loadingQuestion || starting ? (
            <div style={{ textAlign: "center", padding: "55px 20px" }}>
              <div className="sq-badge">Loading</div>
              <h2 style={{ marginTop: 16, fontSize: 26, fontWeight: 900 }}>Preparing your question…</h2>
              <p style={{ color: "var(--muted)", marginTop: 8 }}>Your next Sahaba Quest question is on its way.</p>
            </div>
          ) : question ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, marginBottom: 18, flexWrap: "wrap" }}>
                <div style={{ color: "var(--muted)", fontSize: 13, fontWeight: 800 }}>
                  Question {questionNumber}
                </div>
                <div
                  aria-label={`Time remaining: ${timeLeft} seconds`}
                  style={{
                    minWidth: 94,
                    padding: "10px 16px",
                    borderRadius: 14,
                    textAlign: "center",
                    fontSize: 22,
                    fontWeight: 900,
                    background: timerUrgent ? "#fef2f2" : "#ecfdf5",
                    color: timerUrgent ? "#b91c1c" : "#047857",
                    border: timerUrgent ? "1px solid #fecaca" : "1px solid #a7f3d0",
                  }}
                >
                  {answered ? "—" : `${timeLeft}s`}
                </div>
              </div>

              <h2 style={{ margin: 0, fontSize: "clamp(23px, 4vw, 32px)", lineHeight: 1.35, fontWeight: 900 }}>
                {question.question}
              </h2>

              <div style={{ display: "grid", gap: 12, marginTop: 28 }}>
                {OPTIONS.map((key) => {
                  const isSelected = selectedAnswer === question[key];
                  const isCorrectOption = answerResult && question[key] === answerResult.correct_answer;
                  const isWrongSelected = answerResult && isSelected && !answerResult.is_correct;

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={submitting || answered}
                      onClick={() => submitAnswer(question[key])}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "18px 20px",
                        borderRadius: 16,
                        border: isCorrectOption
                          ? "2px solid #16a34a"
                          : isWrongSelected
                          ? "2px solid #dc2626"
                          : "1px solid var(--border)",
                        background: isCorrectOption
                          ? "#f0fdf4"
                          : isWrongSelected
                          ? "#fef2f2"
                          : isSelected
                          ? "var(--primary-light)"
                          : "#f8faf9",
                        color: "var(--foreground)",
                        cursor: submitting || answered ? "default" : "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 14,
                        fontSize: 15,
                        lineHeight: 1.5,
                      }}
                    >
                      <span style={{ width: 34, height: 34, flex: "0 0 34px", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", background: "white", border: "1px solid var(--border)", fontWeight: 900 }}>
                        {optionLabels[key]}
                      </span>
                      <span style={{ paddingTop: 5, fontWeight: 700 }}>{question[key]}</span>
                    </button>
                  );
                })}
              </div>

              {answerResult && (
                <div style={{ marginTop: 22, padding: 20, borderRadius: 16, background: answerResult.timed_out ? "#fff7ed" : answerResult.is_correct ? "#f0fdf4" : "#fff7ed", border: answerResult.is_correct ? "1px solid #bbf7d0" : "1px solid #fed7aa" }}>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
                    {answerResult.timed_out
                      ? "Time's Up! ⏰"
                      : answerResult.is_correct
                      ? "Correct! 🎉"
                      : "Incorrect Answer"}
                  </h3>

                  {answerResult.timed_out && (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
                      You did not answer within 15 seconds, so no XP was awarded.
                    </p>
                  )}

                  {!answerResult.timed_out && answerResult.is_correct && (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
                      You earned {answerResult.xp_earned} XP. Your current streak is {answerResult.current_streak}.
                    </p>
                  )}

                  {!answerResult.is_correct && !answerResult.timed_out && (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", lineHeight: 1.6 }}>
                      The correct answer is: <strong>{answerResult.correct_answer}</strong>
                    </p>
                  )}

                  <div style={{ marginTop: 16, padding: 15, borderRadius: 12, background: "rgba(255,255,255,0.75)", border: "1px solid rgba(148,163,184,0.25)" }}>
                    <strong>Explanation</strong>
                    <p style={{ margin: "7px 0 0", color: "var(--muted)", lineHeight: 1.65 }}>
                      {answerResult.explanation || "No explanation was provided for this question."}
                    </p>
                  </div>

                  {!answerResult.level_completed && (
                    <button
                      type="button"
                      onClick={handleNextQuestion}
                      disabled={submitting}
                      className="sq-button-primary"
                      style={{ marginTop: 18, border: "none", cursor: "pointer" }}
                    >
                      Next Question →
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "45px 20px" }}>
              <h2 style={{ fontSize: 26, fontWeight: 900 }}>No more questions right now</h2>
              <p style={{ color: "var(--muted)", marginTop: 8 }}>Return to your dashboard and try again.</p>
              <button type="button" className="sq-button-primary" onClick={() => router.push("/family-member-dashboard")} style={{ border: "none", cursor: "pointer", marginTop: 20 }}>
                Back to Dashboard
              </button>
            </div>
          )}
        </section>

        <footer style={{ padding: "28px 0 10px", textAlign: "center", color: "var(--muted-light)", fontSize: 12 }}>
          Sahaba Quest • Learn. Remember. Compete.
        </footer>
      </div>
    </main>
  );
}
