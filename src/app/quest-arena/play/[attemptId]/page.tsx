"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppNavbar } from "../../../../components/ui";
import { supabase } from "../../../../lib/supabase";

type CurrentQuestionRow = {
  out_attempt_id: string;
  out_question_id: string | null;
  out_question_position: number | null;
  out_level: number | null;
  out_question: string | null;
  out_option_a: string | null;
  out_option_b: string | null;
  out_option_c: string | null;
  out_option_d: string | null;
  out_question_started_at: string | null;
  out_seconds_remaining: number | null;
  out_questions_answered: number;
  out_correct_answers: number;
  out_total_xp: number;
  out_completed: boolean;
};

type SubmitRow = {
  out_attempt_id: string;
  out_question_position: number;
  out_is_correct: boolean;
  out_timed_out: boolean;
  out_xp_earned: number;
  out_questions_answered: number;
  out_correct_answers: number;
  out_total_xp: number;
  out_completed: boolean;
};

type ReviewRow = {
  out_attempt_id: string;
  out_question_id: string;
  out_question_position: number;
  out_selected_answer: string | null;
  out_correct_answer: string;
  out_explanation: string | null;
  out_is_correct: boolean;
  out_timed_out: boolean;
  out_xp_earned: number;
};

type QuestionView = {
  attemptId: string;
  questionId: string;
  position: number;
  question: string;
  options: { key: "A" | "B" | "C" | "D"; text: string }[];
  secondsRemaining: number;
  questionsAnswered: number;
  correctAnswers: number;
  totalXp: number;
};

type Feedback = {
  kind: "correct" | "incorrect" | "timeout";
  xpEarned: number;
  selectedAnswer: "A" | "B" | "C" | "D" | null;
  correctAnswer: "A" | "B" | "C" | "D";
  explanation: string | null;
};

function firstRow<T>(data: T | T[] | null): T | null {
  if (!data) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

function mapQuestion(row: CurrentQuestionRow): QuestionView | null {
  if (!row.out_question_id || !row.out_question) return null;

  const options = [
    { key: "A" as const, text: row.out_option_a ?? "" },
    { key: "B" as const, text: row.out_option_b ?? "" },
    { key: "C" as const, text: row.out_option_c ?? "" },
    { key: "D" as const, text: row.out_option_d ?? "" },
  ];

  return {
    attemptId: row.out_attempt_id,
    questionId: row.out_question_id,
    position: Number(row.out_question_position ?? 1),
    question: row.out_question,
    options,
    secondsRemaining: Math.max(0, Number(row.out_seconds_remaining ?? 0)),
    questionsAnswered: Number(row.out_questions_answered ?? 0),
    correctAnswers: Number(row.out_correct_answers ?? 0),
    totalXp: Number(row.out_total_xp ?? 0),
  };
}

function ArenaPlayContent() {
  const params = useParams<{ attemptId: string }>();
  const router = useRouter();
  const attemptId = params.attemptId;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [question, setQuestion] = useState<QuestionView | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState("");
  const [completed, setCompleted] = useState(false);
  const [stats, setStats] = useState({ answered: 0, correct: 0, xp: 0 });
  const requestInFlight = useRef(false);
  const timerStartedAt = useRef<number | null>(null);
  const submitAnswerRef = useRef<(answer: "A" | "B" | "C" | "D" | null) => Promise<void>>(async () => {});

  const progress = useMemo(
    () => Math.min(100, Math.max(0, (stats.answered / 10) * 100)),
    [stats.answered]
  );

  const loadCurrentQuestion = useCallback(async () => {
    if (!attemptId || requestInFlight.current) return;
    requestInFlight.current = true;
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "quest_arena_get_current_question",
        { p_attempt_id: attemptId }
      );

      if (rpcError) throw rpcError;

      const row = firstRow(data as CurrentQuestionRow | CurrentQuestionRow[] | null);
      if (!row) throw new Error("The Arena could not load the next question. Please try again.");

      setStats({
        answered: Number(row.out_questions_answered ?? 0),
        correct: Number(row.out_correct_answers ?? 0),
        xp: Number(row.out_total_xp ?? 0),
      });

      const mapped = mapQuestion(row);

      if (!mapped) {
        if (row.out_completed) {
          setQuestion(null);
          setCompleted(true);
          router.replace(`/quest-arena/results/${attemptId}`);
          return;
        }
        throw new Error("The question returned by the server is incomplete.");
      }

      setQuestion(mapped);
      setSecondsLeft(mapped.secondsRemaining);
      timerStartedAt.current = Date.now();

      // A previously submitted answer remains available for review after refresh.
      const { data: reviewData, error: reviewError } = await supabase.rpc(
        "quest_arena_get_answer_review",
        { p_attempt_id: attemptId }
      );
      if (reviewError) throw reviewError;

      const review = firstRow(reviewData as ReviewRow | ReviewRow[] | null);
      if (review) {
        setFeedback({
          kind: review.out_timed_out
            ? "timeout"
            : review.out_is_correct
              ? "correct"
              : "incorrect",
          xpEarned: Number(review.out_xp_earned ?? 0),
          selectedAnswer: review.out_selected_answer as Feedback["selectedAnswer"],
          correctAnswer: review.out_correct_answer as Feedback["correctAnswer"],
          explanation: review.out_explanation ?? null,
        });
        setSecondsLeft(0);
      } else if (row.out_completed) {
        setQuestion(null);
        setCompleted(true);
        router.replace(`/quest-arena/results/${attemptId}`);
        return;
      } else {
        setFeedback(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the question.");
    } finally {
      requestInFlight.current = false;
      setLoading(false);
    }
  }, [attemptId, router]);

  useEffect(() => {
    let active = true;

    async function initialise() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (authError || !authData.user) {
        router.replace(`/login?redirectTo=${encodeURIComponent(`/quest-arena/play/${attemptId}`)}`);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", authData.user.id)
        .single();

      if (!active) return;
      if (profileError || !profile) {
        setError("We could not verify your account. Please sign in again.");
        setLoading(false);
        return;
      }

      if (profile.account_type === "family") {
        router.replace("/family-dashboard");
        return;
      }
      if (profile.account_type !== "free" && profile.account_type !== "individual") {
        router.replace("/dashboard");
        return;
      }

      await loadCurrentQuestion();
    }

    initialise();
    return () => {
      active = false;
      // No delayed auto-advance: participants control when to continue.
    };
  }, [attemptId, loadCurrentQuestion, router]);

  useEffect(() => {
    if (!question || submitting || feedback || completed) return;

    const tick = () => {
      if (timerStartedAt.current === null) return;
      const elapsed = Math.floor((Date.now() - timerStartedAt.current) / 1000);
      const next = Math.max(0, question.secondsRemaining - elapsed);
      setSecondsLeft(next);
      if (next <= 0 && !requestInFlight.current) {
        void submitAnswerRef.current(null);
      }
    };

    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [question, submitting, feedback, completed]);

  const handleAnswer = async (answer: "A" | "B" | "C" | "D" | null) => {
    if (!question || submitting || feedback || requestInFlight.current) return;

    setSubmitting(true);
    requestInFlight.current = true;
    setError("");

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "quest_arena_submit_answer",
        {
          p_attempt_id: attemptId,
          p_question_id: question.questionId,
          p_selected_answer: answer,
        }
      );

      if (rpcError) throw rpcError;

      const row = firstRow(data as SubmitRow | SubmitRow[] | null);
      if (!row) throw new Error("Your answer could not be confirmed. Please try again.");

      setStats({
        answered: Number(row.out_questions_answered ?? 0),
        correct: Number(row.out_correct_answers ?? 0),
        xp: Number(row.out_total_xp ?? 0),
      });

      const { data: reviewData, error: reviewError } = await supabase.rpc(
        "quest_arena_get_answer_review",
        { p_attempt_id: attemptId }
      );
      if (reviewError) throw reviewError;

      const review = firstRow(reviewData as ReviewRow | ReviewRow[] | null);
      if (!review) {
        throw new Error("Your answer was recorded, but its review could not be loaded. Please retry.");
      }

      setFeedback({
        kind: review.out_timed_out
          ? "timeout"
          : review.out_is_correct
            ? "correct"
            : "incorrect",
        xpEarned: Number(review.out_xp_earned ?? 0),
        selectedAnswer: review.out_selected_answer as Feedback["selectedAnswer"],
        correctAnswer: review.out_correct_answer as Feedback["correctAnswer"],
        explanation: review.out_explanation ?? null,
      });
      setSecondsLeft(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not submit your answer.");
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  };

  submitAnswerRef.current = handleAnswer;

  const handleNextQuestion = async () => {
    if (!feedback || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const { data, error: advanceError } = await supabase.rpc(
        "quest_arena_advance_question",
        { p_attempt_id: attemptId }
      );
      if (advanceError) throw advanceError;

      const result = firstRow(data as {
        out_attempt_id: string;
        out_reviewed_position: number;
        out_next_position: number | null;
        out_completed: boolean;
      } | Array<{
        out_attempt_id: string;
        out_reviewed_position: number;
        out_next_position: number | null;
        out_completed: boolean;
      }> | null);

      if (!result) throw new Error("We could not continue to the next question.");

      if (result.out_completed) {
        setCompleted(true);
        router.replace(`/quest-arena/results/${attemptId}`);
        return;
      }

      setFeedback(null);
      setLoading(true);
      await loadCurrentQuestion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the next question.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setError("");
    setLoading(true);
    void loadCurrentQuestion();
  };

  return (
    <main className="sq-page min-h-screen">
      <AppNavbar />
      <div className="sq-container mx-auto w-full max-w-4xl px-4 pb-12 pt-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/quest-arena" className="text-sm font-semibold text-[var(--primary)] hover:underline">
              ← Quest Arena
            </Link>
            <h1 className="mt-2 text-2xl font-extrabold text-[var(--foreground)] sm:text-3xl">
              Arena Challenge
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              10 questions · 30 seconds each · 100 Arena XP per correct answer
            </p>
          </div>
          <div className="sq-badge">⚔️ Individual attempt</div>
        </div>

        {error && (
          <div className="sq-card mb-5 border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
            <p>{error}</p>
            <button onClick={handleRetry} className="mt-3 font-bold underline">
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <section className="sq-card p-8 text-center">
            <div className="mx-auto mb-3 h-9 w-9 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
            <p className="font-semibold text-[var(--foreground)]">Loading your question...</p>
            <p className="mt-1 text-sm text-[var(--muted)]">The official timer is controlled by the server.</p>
          </section>
        ) : question ? (
          <>
            <section className="sq-card mb-5 p-5 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Question</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--foreground)]">
                    {question.position} <span className="font-medium text-[var(--muted)]">of 10</span>
                  </p>
                </div>
                <div
                  className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl border ${
                    secondsLeft <= 7
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-[var(--border)] bg-[var(--secondary-light)] text-[var(--primary)]"
                  }`}
                  aria-label={`${secondsLeft} seconds remaining`}
                >
                  <span className="text-2xl font-black tabular-nums">{secondsLeft}</span>
                  <span className="text-[10px] font-bold uppercase">Seconds</span>
                </div>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)] transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
                <span>{stats.answered} answered</span>
                <span>{stats.xp.toLocaleString()} / 1,000 Arena XP</span>
              </div>
            </section>

            <section className="sq-card p-5 sm:p-8">
              <div className="mb-4 flex items-center justify-end gap-3">
                <span className="text-xs font-semibold text-[var(--muted)]">Choose one answer</span>
              </div>
              <h2 className="mb-7 text-xl font-bold leading-relaxed text-[var(--foreground)] sm:text-2xl">
                {question.question}
              </h2>

              <div className="grid gap-3">
                {question.options.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    disabled={submitting || !!feedback || secondsLeft <= 0}
                    onClick={() => handleAnswer(option.key)}
                    className="flex w-full items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-left transition hover:border-[var(--primary)] hover:bg-[var(--secondary-light)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--secondary-light)] text-sm font-extrabold text-[var(--primary)]">
                      {option.key}
                    </span>
                    <span className="pt-1 font-medium leading-relaxed text-[var(--foreground)]">
                      {option.text}
                    </span>
                  </button>
                ))}
              </div>

              {submitting && (
                <p className="mt-5 text-center text-sm font-semibold text-[var(--muted)]">
                  Submitting your answer securely...
                </p>
              )}

              {feedback && (
                <div
                  className={`mt-6 rounded-2xl border p-5 text-left ${
                    feedback.kind === "correct"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                      : "border-amber-200 bg-amber-50 text-amber-950"
                  }`}
                  role="status"
                >
                  <p className="text-lg font-extrabold">
                    {feedback.kind === "correct"
                      ? "Correct answer!"
                      : feedback.kind === "timeout"
                        ? "Time is up!"
                        : "Your answer was incorrect."}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-black/5 bg-white/75 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Your answer</p>
                      <p className="mt-1 font-bold">
                        {feedback.selectedAnswer
                          ? `${feedback.selectedAnswer} — ${question.options.find((option) => option.key === feedback.selectedAnswer)?.text ?? ""}`
                          : "No answer submitted"}
                      </p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 bg-white/85 p-3">
                      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Correct answer</p>
                      <p className="mt-1 font-bold text-emerald-900">
                        {feedback.correctAnswer} — {question.options.find((option) => option.key === feedback.correctAnswer)?.text ?? ""}
                      </p>
                    </div>
                  </div>

                  {feedback.explanation && (
                    <div className="mt-4 rounded-xl bg-white/75 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Learn from this question</p>
                      <p className="mt-2 text-sm leading-relaxed">{feedback.explanation}</p>
                    </div>
                  )}

                  <p className="mt-4 text-sm font-semibold">
                    {feedback.xpEarned > 0
                      ? `You earned ${feedback.xpEarned} Arena XP.`
                      : "No Arena XP earned for this question."}
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleNextQuestion()}
                    disabled={submitting}
                    className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--primary)] px-5 py-3 font-extrabold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting
                      ? "Please wait..."
                      : question.position === 10
                        ? "Finish and view results →"
                        : "Next question →"}
                  </button>
                </div>
              )}
            </section>

            <p className="mt-4 text-center text-xs text-[var(--muted)]">
              Your answer is final once submitted. You cannot return to an earlier question.
            </p>
          </>
        ) : completed ? (
          <section className="sq-card p-8 text-center">
            <div className="mb-3 text-4xl">🏆</div>
            <h2 className="text-xl font-extrabold text-[var(--foreground)]">Attempt completed</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Taking you to your results...</p>
            <Link href={`/quest-arena/results/${attemptId}`} className="sq-button-primary mt-5 inline-flex">
              View results
            </Link>
          </section>
        ) : (
          <section className="sq-card p-8 text-center">
            <h2 className="text-lg font-extrabold text-[var(--foreground)]">No active question</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Refresh the question state to continue your attempt.
            </p>
            <button onClick={handleRetry} className="sq-button-primary mt-5">
              Continue attempt
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

export default function QuestArenaPlayPage() {
  return (
    <Suspense
      fallback={
        <main className="sq-page min-h-screen">
          <div className="sq-container mx-auto max-w-4xl px-4 py-12 text-center">
            Loading Arena...
          </div>
        </main>
      }
    >
      <ArenaPlayContent />
    </Suspense>
  );
}
