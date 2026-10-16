"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Activity = {
  id: string;
  title: string;
  instructions: string | null;
  activity_type: "classwork" | "test" | "assignment";
  due_at: string | null;
  time_limit_minutes?: number | null;
};
type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  points: number;
};
type Result = {
  id: string;
  score: number;
  max_score: number;
  correct_count: number;
  total_questions: number;
  submitted_at: string;
  timed_out?: boolean;
};
type ActivityPayload = {
  success?: boolean;
  message?: string;
  activity?: Activity;
  questions?: Question[];
  alreadySubmitted?: boolean;
  result?: Result;
  startedAt?: string | null;
  deadlineAt?: string | null;
  savedAnswers?: Record<string, string>;
};

const optionLabels = ["A", "B", "C", "D"] as const;

export default function StudentActivityAttemptPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const activityId = params?.id;
  const [activity, setActivity] = useState<Activity | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [starting, setStarting] = useState(false);
  const submissionInProgress = useRef(false);
  const answerStorageKey = activityId ? `school_activity_answers_${activityId}` : "";

  const loadActivity = useCallback(async () => {
    if (!activityId) return;
    const token = sessionStorage.getItem("school_student_session_token");
    if (!token) {
      router.replace("/schools/student-login");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/schools/student-activities/${activityId}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as ActivityPayload;
      if (response.status === 401) {
        sessionStorage.removeItem("school_student_session_token");
        sessionStorage.removeItem("school_student_expires_at");
        router.replace("/schools/student-login");
        return;
      }
      if (!response.ok) throw new Error(payload.message || "Unable to open this activity.");
      setActivity(payload.activity ?? null);
      setQuestions(Array.isArray(payload.questions) ? payload.questions : []);
      setStartedAt(payload.startedAt ?? null);
      setDeadlineAt(payload.deadlineAt ?? null);
      if (payload.alreadySubmitted && payload.result) {
        setResult(payload.result);
        if (answerStorageKey) sessionStorage.removeItem(answerStorageKey);
      } else {
        let browserAnswers: Record<string, string> = {};
        if (answerStorageKey) {
          try {
            const raw = sessionStorage.getItem(answerStorageKey);
            const parsed: unknown = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              browserAnswers = parsed as Record<string, string>;
            }
          } catch {
            sessionStorage.removeItem(answerStorageKey);
          }
        }
        const serverAnswers = payload.savedAnswers && typeof payload.savedAnswers === "object" ? payload.savedAnswers : {};
        setAnswers({ ...browserAnswers, ...serverAnswers });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open this activity.");
    } finally {
      setLoading(false);
    }
  }, [activityId, answerStorageKey, router]);

  useEffect(() => { void loadActivity(); }, [loadActivity]);

  const answeredCount = useMemo(() => Object.keys(answers).filter((id) => answers[id]).length, [answers]);

  const timedActivity = Number(activity?.time_limit_minutes ?? 0) > 0;
  const isStarted = !timedActivity || Boolean(startedAt);
  const remainingSeconds = deadlineAt
    ? Math.max(0, Math.ceil((new Date(deadlineAt).getTime() - nowMs) / 1000))
    : null;
  const timerDisplay = remainingSeconds === null
    ? ""
    : `${Math.floor(remainingSeconds / 60).toString().padStart(2, "0")}:${(remainingSeconds % 60).toString().padStart(2, "0")}`;

  useEffect(() => {
    if (!deadlineAt || result) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt, result]);

  useEffect(() => {
    if (!answerStorageKey || result) return;
    try {
      sessionStorage.setItem(answerStorageKey, JSON.stringify(answers));
    } catch (storageError) {
      console.warn("Could not preserve activity answers in this browser session:", storageError);
    }
  }, [answerStorageKey, answers, result]);

  // Persist answer drafts to the server while the activity is in progress.
  useEffect(() => {
    if (!activityId || !isStarted || result || submitting || !Object.keys(answers).length) return;
    const token = sessionStorage.getItem("school_student_session_token");
    if (!token) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/schools/student-activities/${activityId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_answers", answers }),
      }).then(async (response) => {
        if (response.status === 401) {
          sessionStorage.removeItem("school_student_session_token");
          sessionStorage.removeItem("school_student_expires_at");
          router.replace("/schools/student-login");
        }
      }).catch((saveError) => {
        console.error("Could not autosave student activity answers:", saveError);
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activityId, answers, isStarted, result, submitting, router]);

  async function startActivity() {
    const token = sessionStorage.getItem("school_student_session_token");
    if (!token || !activityId) {
      router.replace("/schools/student-login");
      return;
    }
    setStarting(true);
    setError("");
    try {
      const response = await fetch(`/api/schools/student-activities/${activityId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      const payload = (await response.json().catch(() => ({}))) as ActivityPayload;
      if (response.status === 401) {
        sessionStorage.removeItem("school_student_session_token");
        sessionStorage.removeItem("school_student_expires_at");
        router.replace("/schools/student-login");
        return;
      }
      if (!response.ok) throw new Error(payload.message || "Unable to start this activity.");
      setStartedAt(payload.startedAt ?? new Date().toISOString());
      setDeadlineAt(payload.deadlineAt ?? null);
      setNowMs(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start this activity.");
    } finally {
      setStarting(false);
    }
  }

  const submitAnswers = useCallback(async (automatic = false) => {
    if (submissionInProgress.current || result) return;
    const token = sessionStorage.getItem("school_student_session_token");
    if (!token || !activityId) {
      router.replace("/schools/student-login");
      return;
    }
    if (!automatic && answeredCount !== questions.length) {
      setError(`Please answer every question before submitting (${answeredCount} of ${questions.length} answered).`);
      return;
    }
    if (!automatic && !window.confirm("Submit your answers? You cannot change them after submission.")) return;
    submissionInProgress.current = true;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/schools/student-activities/${activityId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const payload = (await response.json().catch(() => ({}))) as ActivityPayload;
      if (response.status === 401) {
        sessionStorage.removeItem("school_student_session_token");
        sessionStorage.removeItem("school_student_expires_at");
        router.replace("/schools/student-login");
        return;
      }
      if (!response.ok) throw new Error(payload.message || "Your answers could not be submitted.");
      if (payload.result) {
        setResult(payload.result);
        if (answerStorageKey) sessionStorage.removeItem(answerStorageKey);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Your answers could not be submitted.");
      // Permit retry after a network or server error.
      submissionInProgress.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [activityId, answerStorageKey, answeredCount, questions.length, router, answers, result]);

  useEffect(() => {
    if (deadlineAt && remainingSeconds === 0 && !result && !submitting) {
      void submitAnswers(true);
    }
  }, [deadlineAt, remainingSeconds, result, submitting, submitAnswers]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <button type="button" onClick={() => router.push("/schools/student-dashboard")} className="mb-5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-100">
          ← Back to dashboard
        </button>
        {loading ? <div className="rounded-2xl border bg-white p-8 text-center">Loading your activity…</div> : error && !activity ? (
          <section className="rounded-2xl border border-red-200 bg-white p-6"><h1 className="text-xl font-bold">Unable to open activity</h1><p className="mt-2 text-red-700">{error}</p><button onClick={() => void loadActivity()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white">Try again</button></section>
        ) : result ? (
          <section className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Submission received</p>
            <h1 className="mt-2 text-2xl font-bold">{activity?.title ?? "Activity result"}</h1>
            <p className="mt-5 text-4xl font-extrabold">{result.score} / {result.max_score}</p>
            <p className="mt-2 text-slate-600">Correct answers: {result.correct_count} of {result.total_questions}</p>
            <p className="mt-1 text-sm text-slate-500">Submitted {new Date(result.submitted_at).toLocaleString()}</p>
            {result.timed_out && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm font-semibold text-amber-800">Time expired. Your available answers were submitted automatically.</p>}
            <button onClick={() => router.push("/schools/student-dashboard")} className="mt-6 rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white">Return to dashboard</button>
          </section>
        ) : activity ? (
          <>
            <header className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">{activity.activity_type}</p>
              <h1 className="mt-2 text-3xl font-extrabold">{activity.title}</h1>
              {activity.instructions && <p className="mt-3 whitespace-pre-wrap text-slate-600">{activity.instructions}</p>}
              <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500"><span>{questions.length} questions</span><span>{answeredCount} answered</span>{activity.time_limit_minutes ? <span>Time limit: {activity.time_limit_minutes} minutes</span> : <span>No time limit</span>}{activity.due_at && <span>Due {new Date(activity.due_at).toLocaleString()}</span>}</div>
              {deadlineAt && isStarted && <div className={`mt-5 rounded-xl border p-4 ${remainingSeconds !== null && remainingSeconds <= 60 ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`} aria-live="polite"><p className="text-xs font-bold uppercase tracking-wide">Time remaining</p><p className="mt-1 text-3xl font-extrabold tabular-nums">{timerDisplay}</p><p className="mt-1 text-sm">Your activity will be submitted automatically when the timer reaches zero.</p></div>}
            </header>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            {!isStarted ? (
              <section className="mt-5 rounded-2xl border border-emerald-200 bg-white p-6 sm:p-8">
                <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Ready when you are</p>
                <h2 className="mt-2 text-2xl font-extrabold">Start your activity</h2>
                <p className="mt-2 text-slate-600">Your {activity.time_limit_minutes}-minute timer will begin only after you select Start. Once started, the deadline remains the same if you refresh this page.</p>
                <button type="button" onClick={() => void startActivity()} disabled={starting} className="mt-5 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:opacity-60">{starting ? "Starting…" : "Start activity"}</button>
              </section>
            ) : <>
            <div className="mt-5 space-y-4">
              {questions.map((question, index) => {
                const options = [question.option_a, question.option_b, question.option_c, question.option_d];
                return <section key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Question {index + 1} · {question.points} {question.points === 1 ? "point" : "points"}</p>
                  <h2 className="mt-2 text-lg font-bold">{question.question_text}</h2>
                  <div className="mt-4 space-y-2">
                    {options.map((option, optionIndex) => {
                      const label = optionLabels[optionIndex];
                      const selected = answers[question.id] === label;
                      return <label key={label} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selected ? "border-emerald-600 bg-emerald-50" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="radio" name={`question-${question.id}`} value={label} checked={selected} onChange={() => setAnswers((current) => ({ ...current, [question.id]: label }))} className="mt-1 accent-emerald-700" />
                        <span className="font-semibold">{label}.</span><span>{option}</span>
                      </label>;
                    })}
                  </div>
                </section>;
              })}
            </div>
            <footer className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-600">You have answered {answeredCount} of {questions.length} questions. After submission, your answers cannot be changed.</p>
              <button type="button" onClick={() => void submitAnswers()} disabled={submitting || questions.length === 0 || (remainingSeconds !== null && remainingSeconds <= 0)} className="mt-4 w-full rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{submitting ? "Submitting…" : "Submit answers"}</button>
            </footer>
            </>}
          </>
        ) : <p className="rounded-xl border bg-white p-6">No activity data was returned.</p>}
      </div>
    </main>
  );
}