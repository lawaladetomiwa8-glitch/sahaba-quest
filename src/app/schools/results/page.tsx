"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Activity = { id: string; title: string; activity_type: string; status: string; due_at: string | null; time_limit_minutes: number | null; class_ids: string[]; question_count: number; questions: ReviewQuestion[] };
type SchoolClass = { id: string; name: string; status: string };
type Student = { id: string; class_id: string | null; name: string; admission_number: string; status: string };
type Attempt = { id: string; activity_id: string; student_id: string; answers: Record<string, string>; score: number; max_score: number; correct_count: number; total_questions: number; submitted_at: string; timed_out: boolean; percentage: number };
type Start = { activity_id: string; student_id: string; started_at: string; deadline_at: string | null; answers: Record<string, string> };
type ReviewQuestion = { id: string; question_text: string; option_a: string; option_b: string; option_c: string; option_d: string; correct_option: string; explanation: string | null; points: number };
type Payload = { success?: boolean; message?: string; activities?: Activity[]; classes?: SchoolClass[]; students?: Student[]; attempts?: Attempt[]; starts?: Start[] };

const card = "rounded-2xl border border-slate-200 bg-white";
const fmt = (value?: string | null) => value ? new Date(value).toLocaleString() : "—";

export default function SchoolResultsPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [starts, setStarts] = useState<Start[]>([]);
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewStudentId, setReviewStudentId] = useState("");

  const loadResults = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Please sign in as a school administrator to view results.");
      const response = await fetch("/api/schools/admin-results", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as Payload;
      if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load activity results.");
      const nextActivities = payload.activities ?? [];
      setActivities(nextActivities); setClasses(payload.classes ?? []); setStudents(payload.students ?? []); setAttempts(payload.attempts ?? []); setStarts(payload.starts ?? []);
      setSelectedActivityId((current) => current && nextActivities.some((item) => item.id === current) ? current : nextActivities[0]?.id ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load activity results."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadResults(); }, [loadResults]);

  const activity = activities.find((item) => item.id === selectedActivityId) ?? null;
  const rows = useMemo(() => {
    if (!activity) return [];
    const assignedClassIds = new Set(activity.class_ids);
    const roster = students.filter((student) => student.class_id && assignedClassIds.has(student.class_id) && student.status === "active");
    return roster.map((student) => {
      const attempt = attempts.find((item) => item.activity_id === activity.id && item.student_id === student.id) ?? null;
      const start = starts.find((item) => item.activity_id === activity.id && item.student_id === student.id) ?? null;
      return { student, attempt, start };
    }).sort((a, b) => a.student.name.localeCompare(b.student.name));
  }, [activity, students, attempts, starts]);
  const submittedCount = rows.filter((row) => row.attempt).length;
  const average = rows.filter((row) => row.attempt).length ? Math.round(rows.reduce((sum, row) => sum + (row.attempt?.percentage ?? 0), 0) / submittedCount) : 0;
  const reviewRow = rows.find((row) => row.student.id === reviewStudentId && row.attempt);

  return <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6">
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-bold uppercase tracking-wider text-emerald-700">School administration</p><h1 className="mt-1 text-3xl font-extrabold">Activity results</h1><p className="mt-2 text-slate-600">Review submissions, scores, timeouts and students who have not submitted.</p></div>
        <div className="flex flex-wrap gap-2"><Link href="/schools/dashboard" className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-100">← Dashboard</Link><Link href="/schools/questions" className="rounded-xl border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-100">Manage activities</Link><button type="button" onClick={() => void loadResults()} className="rounded-xl bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">Refresh</button></div>
      </div>
      {error && <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{error}</div>}
      {loading ? <div className={`${card} p-8 text-center text-slate-600`}>Loading activity results…</div> : activities.length === 0 ? <div className={`${card} p-8 text-center`}><h2 className="text-xl font-bold">No activities yet</h2><p className="mt-2 text-slate-600">Create and publish an activity before results appear here.</p></div> : <>
        <section className={`${card} mb-5 p-4 sm:p-5`}><label htmlFor="activity" className="mb-2 block text-sm font-bold">Select activity</label><select id="activity" value={selectedActivityId} onChange={(event) => { setSelectedActivityId(event.target.value); setReviewStudentId(""); }} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 sm:max-w-2xl">{activities.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.activity_type} · {item.status}</option>)}</select>
          {activity && <div className="mt-4 flex flex-wrap gap-2 text-sm"><span className="rounded-full bg-slate-100 px-3 py-1">{activity.question_count} questions</span><span className="rounded-full bg-slate-100 px-3 py-1">{activity.time_limit_minutes ? `${activity.time_limit_minutes} minute limit` : "No time limit"}</span><span className="rounded-full bg-slate-100 px-3 py-1">Due: {fmt(activity.due_at)}</span><span className="rounded-full bg-slate-100 px-3 py-1">Classes: {activity.class_ids.map((id) => classes.find((item) => item.id === id)?.name ?? "Class").join(", ") || "None"}</span></div>}
        </section>
        {activity && <><div className="mb-5 grid gap-3 sm:grid-cols-3"><div className={`${card} p-4`}><p className="text-sm text-slate-500">Assigned students</p><p className="mt-1 text-2xl font-extrabold">{rows.length}</p></div><div className={`${card} p-4`}><p className="text-sm text-slate-500">Submitted</p><p className="mt-1 text-2xl font-extrabold">{submittedCount} / {rows.length}</p></div><div className={`${card} p-4`}><p className="text-sm text-slate-500">Average score</p><p className="mt-1 text-2xl font-extrabold">{average}%</p></div></div>
          <section className={`${card} overflow-hidden`}><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Score</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Submitted</th><th className="px-4 py-3">Review</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(({ student, attempt, start }) => <tr key={student.id} className="align-top"><td className="px-4 py-4"><div className="font-bold">{student.name}</div>{student.admission_number && <div className="mt-1 text-xs text-slate-500">{student.admission_number}</div>}</td><td className="px-4 py-4">{attempt ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${attempt.timed_out ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{attempt.timed_out ? "Timed out" : "Submitted"}</span> : start ? <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">In progress</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">Not started</span>}</td><td className="px-4 py-4">{attempt ? <><div className="font-bold">{attempt.score} / {attempt.max_score}</div><div className="text-slate-500">{attempt.percentage}% · {attempt.correct_count}/{attempt.total_questions} correct</div></> : "—"}</td><td className="px-4 py-4">{fmt(start?.started_at)}</td><td className="px-4 py-4">{fmt(attempt?.submitted_at)}</td><td className="px-4 py-4">{attempt && <button type="button" onClick={() => setReviewStudentId(reviewStudentId === student.id ? "" : student.id)} className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold hover:bg-slate-50">{reviewStudentId === student.id ? "Hide answers" : "Review answers"}</button>}</td></tr>)}</tbody></table></div>{rows.length === 0 && <p className="p-6 text-slate-600">No active students are currently assigned to this activity's classes.</p>}</section>
          {reviewRow?.attempt && <section className={`${card} mt-5 p-5 sm:p-6`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Answer review</p><h2 className="mt-1 text-xl font-extrabold">{reviewRow.student.name}</h2></div><p className="font-bold">{reviewRow.attempt.score} / {reviewRow.attempt.max_score} ({reviewRow.attempt.percentage}%)</p></div><div className="mt-5 space-y-4">{activity.questions.map((question, index) => { const selected = reviewRow.attempt?.answers?.[question.id]; const options = [{ key: "A", text: question.option_a }, { key: "B", text: question.option_b }, { key: "C", text: question.option_c }, { key: "D", text: question.option_d }]; return <article key={question.id} className="rounded-xl border border-slate-200 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Question {index + 1} · {question.points} {question.points === 1 ? "point" : "points"}</p><h3 className="mt-2 font-bold">{question.question_text}</h3><div className="mt-3 space-y-2">{options.map((option) => <div key={option.key} className={`rounded-lg border p-3 text-sm ${selected === option.key && selected === question.correct_option ? "border-emerald-400 bg-emerald-50" : selected === option.key ? "border-red-300 bg-red-50" : option.key === question.correct_option ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}><span className="mr-2 font-bold">{option.key}.</span>{option.text}{selected === option.key && <span className="ml-2 text-xs font-bold">Student answer</span>}{option.key === question.correct_option && <span className="ml-2 text-xs font-bold text-emerald-800">Correct answer</span>}</div>)}</div>{question.explanation && <p className="mt-3 text-sm text-slate-600">{question.explanation}</p>}</article>; })}</div></section>}
        </>}
      </>}
    </div>
  </main>;
}