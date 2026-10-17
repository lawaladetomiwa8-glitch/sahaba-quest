"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Activity = { id: string; title: string; activity_type: string; status: string; due_at: string | null; time_limit_minutes: number | null; class_ids: string[]; question_count: number };
type SchoolClass = { id: string; name: string; status: string };
type Student = { id: string; class_id: string | null; name: string; admission_number: string; status: string };
type Attempt = { id: string; activity_id: string; student_id: string; score: number; max_score: number; correct_count: number; total_questions: number; submitted_at: string; timed_out: boolean; percentage: number };
type Start = { activity_id: string; student_id: string; started_at: string; deadline_at: string | null };
type QuizSession = { id: string; student_id: string; level: number; score: number | null; questions_answered: number | null; correct_answers: number | null; started_at: string | null; status: string | null; completed_at: string | null; track: string | null; created_at: string; student_name?: string; admission_number?: string; class_id?: string | null; accuracy_percentage?: number | null };
type QuizQuestionAttempt = { id: string; student_id: string; session_id: string; question_id: string; is_correct: boolean; xp_earned: number | null; selected_answer: string | null; response_time_ms: number | null; answered_at: string; student_name?: string; admission_number?: string; class_id?: string | null };
type Payload = { success?: boolean; message?: string; activities?: Activity[]; classes?: SchoolClass[]; students?: Student[]; attempts?: Attempt[]; starts?: Start[]; builtInQuizSessions?: QuizSession[]; builtInQuizQuestionAttempts?: QuizQuestionAttempt[] };
type Range = "7" | "30" | "all";
type EventRow = { id: string; student_id: string; date: string; source: "School activity" | "Built-in quiz"; title: string; percentage: number | null };

const card = "rounded-2xl border border-emerald-100/80 bg-white shadow-sm";
const fmtDate = (value?: string | null) => value ? new Date(value).toLocaleDateString() : "—";
const inRange = (value: string | null | undefined, range: Range) => {
  if (!value || range === "all") return true;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= Date.now() - Number(range) * 24 * 60 * 60 * 1000;
};
const percent = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
};
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function SchoolReportsPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [starts, setStarts] = useState<Start[]>([]);
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([]);
  const [quizQuestionAttempts, setQuizQuestionAttempts] = useState<QuizQuestionAttempt[]>([]);
  const [range, setRange] = useState<Range>("30");
  const [classId, setClassId] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) throw new Error("Please sign in as a school administrator to view reports.");
      const response = await fetch("/api/schools/admin-reports", { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" });
      const payload = await response.json().catch(() => ({})) as Payload;
      if (response.status === 401) throw new Error("Your session has expired. Please sign in again.");
      if (!response.ok || !payload.success) throw new Error(payload.message || "Unable to load school reports.");
      setActivities(payload.activities ?? []);
      setClasses(payload.classes ?? []);
      setStudents(payload.students ?? []);
      setAttempts(payload.attempts ?? []);
      setStarts(payload.starts ?? []);
      setQuizSessions(payload.builtInQuizSessions ?? []);
      setQuizQuestionAttempts(payload.builtInQuizQuestionAttempts ?? []);
      setLoadedAt(new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load school reports.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadReports(); }, [loadReports]);

  const visibleStudents = useMemo(() => students.filter((s) => s.status === "active" && (classId === "all" || s.class_id === classId) && (studentId === "all" || s.id === studentId)), [students, classId, studentId]);
  const visibleStudentIds = useMemo(() => new Set(visibleStudents.map((s) => s.id)), [visibleStudents]);
  const showSchoolActivities = sourceFilter === "all" || sourceFilter === "school";
  const showBuiltInQuizzes = sourceFilter === "all" || sourceFilter === "quiz";
  const visibleAttempts = useMemo(() => showSchoolActivities ? attempts.filter((a) => visibleStudentIds.has(a.student_id) && inRange(a.submitted_at, range)) : [], [attempts, visibleStudentIds, range, showSchoolActivities]);
  const visibleStarts = useMemo(() => showSchoolActivities ? starts.filter((s) => visibleStudentIds.has(s.student_id) && inRange(s.started_at, range)) : [], [starts, visibleStudentIds, range, showSchoolActivities]);
  const visibleQuizSessions = useMemo(() => showBuiltInQuizzes ? quizSessions.filter((s) => visibleStudentIds.has(s.student_id) && inRange(s.completed_at ?? s.started_at ?? s.created_at, range)) : [], [quizSessions, visibleStudentIds, range, showBuiltInQuizzes]);
  const visibleQuizQuestionAttempts = useMemo(() => showBuiltInQuizzes ? quizQuestionAttempts.filter((a) => visibleStudentIds.has(a.student_id) && inRange(a.answered_at, range)) : [], [quizQuestionAttempts, visibleStudentIds, range, showBuiltInQuizzes]);

  const events = useMemo<EventRow[]>(() => {
    const activityEvents: EventRow[] = visibleAttempts.map((a) => ({ id: `activity-${a.id}`, student_id: a.student_id, date: a.submitted_at, source: "School activity", title: activities.find((x) => x.id === a.activity_id)?.title ?? "School activity", percentage: percent(a.percentage) }));
    const quizEvents: EventRow[] = visibleQuizSessions.map((s) => ({ id: `quiz-${s.id}`, student_id: s.student_id, date: s.completed_at ?? s.started_at ?? s.created_at, source: "Built-in quiz", title: `Sahaba Quest quiz · Level ${s.level}${s.track ? ` · ${s.track}` : ""}`, percentage: percent(s.accuracy_percentage) ?? (Number(s.questions_answered) > 0 ? percent((Number(s.correct_answers ?? 0) / Number(s.questions_answered)) * 100) : null) }));
    return [...activityEvents, ...quizEvents];
  }, [visibleAttempts, visibleQuizSessions, activities]);

  const scoredEvents = events.filter((e) => e.percentage !== null);
  const average = scoredEvents.length ? Math.round(scoredEvents.reduce((sum, e) => sum + (e.percentage ?? 0), 0) / scoredEvents.length) : 0;
  const activeStudentCount = new Set([...visibleAttempts.map((a) => a.student_id), ...visibleStarts.map((s) => s.student_id), ...visibleQuizSessions.map((s) => s.student_id), ...visibleQuizQuestionAttempts.map((a) => a.student_id)]).size;
  const participation = visibleStudents.length ? Math.min(100, Math.round(activeStudentCount / visibleStudents.length * 100)) : 0;
  const assessedStudents = new Set(events.map((e) => e.student_id)).size;

  const performanceRows = useMemo(() => {
    const rows: { id: string; title: string; source: string; attempts: number; average: number }[] = [];
    if (showSchoolActivities) {
      for (const activity of activities) {
        const items = visibleAttempts.filter((a) => a.activity_id === activity.id);
        if (!items.length) continue;
        const scores = items.map((a) => percent(a.percentage)).filter((x): x is number => x !== null);
        rows.push({ id: `activity-${activity.id}`, title: activity.title, source: "School activity", attempts: items.length, average: scores.length ? Math.round(scores.reduce((sum, x) => sum + x, 0) / scores.length) : 0 });
      }
    }
    if (showBuiltInQuizzes) {
      const groups = new Map<string, { title: string; attempts: number; scores: number[] }>();
      for (const session of visibleQuizSessions) {
        const key = `${session.level}:${session.track ?? "general"}`;
        const group = groups.get(key) ?? { title: `Sahaba Quest quiz · Level ${session.level}${session.track ? ` · ${session.track}` : ""}`, attempts: 0, scores: [] };
        group.attempts++;
        const score = percent(session.accuracy_percentage) ?? (Number(session.questions_answered) > 0 ? percent((Number(session.correct_answers ?? 0) / Number(session.questions_answered)) * 100) : null);
        if (score !== null) group.scores.push(score);
        groups.set(key, group);
      }
      for (const [key, group] of groups) rows.push({ id: `quiz-${key}`, title: group.title, source: "Built-in quiz", attempts: group.attempts, average: group.scores.length ? Math.round(group.scores.reduce((sum, x) => sum + x, 0) / group.scores.length) : 0 });
    }
    return rows.sort((a, b) => b.attempts - a.attempts).slice(0, 8);
  }, [activities, visibleAttempts, visibleQuizSessions, showSchoolActivities, showBuiltInQuizzes]);

  const studentRows = useMemo(() => visibleStudents.map((student) => {
    const items = events.filter((e) => e.student_id === student.id);
    const scores = items.map((e) => e.percentage).filter((x): x is number => x !== null);
    return { ...student, attempts: items.length, activityAttempts: items.filter((e) => e.source === "School activity").length, quizAttempts: items.filter((e) => e.source === "Built-in quiz").length, averageScore: scores.length ? Math.round(scores.reduce((sum, x) => sum + x, 0) / scores.length) : null, lastActivity: items.map((e) => e.date).sort().at(-1) ?? null };
  }).sort((a, b) => (b.averageScore ?? -1) - (a.averageScore ?? -1)), [visibleStudents, events]);

  function exportCsv() {
    const header = ["Student", "Admission number", "Class", "School activity submissions", "Built-in quiz sessions", "Total attempts", "Average score (%)", "Last activity"];
    const rows = studentRows.map((r) => [r.name, r.admission_number, classes.find((c) => c.id === r.class_id)?.name ?? "Unassigned", r.activityAttempts, r.quizAttempts, r.attempts, r.averageScore ?? "No scored attempts", r.lastActivity ?? ""]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = "sahaba-quest-school-report.csv"; link.click(); URL.revokeObjectURL(url);
  }

  const statCards = [
    { label: "Active students", value: visibleStudents.length.toLocaleString(), hint: "In the selected student group", icon: "♙" },
    { label: "Students participating", value: assessedStudents.toLocaleString(), hint: "With a quiz session or submitted activity", icon: "◎" },
    { label: "Completed attempts", value: events.length.toLocaleString(), hint: "School submissions plus built-in quiz sessions", icon: "✓" },
    { label: "Average score", value: `${average}%`, hint: scoredEvents.length ? "Across scored attempts" : "No scored attempts yet", icon: "↗" },
  ];

  return <main className="min-h-screen bg-[#f4f8f6] px-4 py-6 text-slate-900 sm:px-6 lg:px-8"><div className="mx-auto max-w-7xl">
    <nav className="mb-5 flex flex-wrap items-center justify-between gap-3"><Link href="/schools/dashboard" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-emerald-800">← School dashboard</Link><div className="flex flex-wrap gap-2"><Link href="/schools/results" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">Activity results</Link><button onClick={() => void loadReports()} disabled={loading} className="rounded-xl bg-emerald-800 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-900 disabled:opacity-60">{loading ? "Refreshing…" : "↻ Refresh"}</button></div></nav>
    <section className="relative isolate overflow-hidden rounded-[28px] bg-gradient-to-br from-[#073d32] via-[#08745b] to-[#0d9488] p-6 text-white shadow-lg sm:p-8"><div className="pointer-events-none absolute -right-12 -top-20 h-64 w-64 rounded-full border border-white/10"/><div className="pointer-events-none absolute -right-2 -top-10 h-44 w-44 rounded-full border border-white/10"/><div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end"><div className="max-w-2xl"><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-100">Sahaba Quest · Schools & Madrasas</p><p className="mt-5 text-sm font-medium text-emerald-50">Assalamu Alaikum wa Rahmatullahi wa Barakatuh</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">School performance reports</h1><p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50 sm:text-base">Review student participation and performance across built-in Sahaba Quest quizzes and activities assigned by your school.</p></div><div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm md:min-w-52"><p className="text-xs font-semibold uppercase tracking-wider text-emerald-100">Report period</p><p className="mt-1 text-lg font-extrabold">{range === "7" ? "Last 7 days" : range === "30" ? "Last 30 days" : "All available records"}</p><p className="mt-1 text-xs text-emerald-100">{loadedAt ? `Updated ${new Date(loadedAt).toLocaleTimeString()}` : "School records"}</p></div></div></section>
    {error && <div role="alert" className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}<button onClick={() => void loadReports()} className="ml-3 underline">Try again</button></div>}
    <section className={`${card} mt-5 p-4 sm:p-5`}><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-extrabold">Report filters</h2><p className="mt-1 text-sm text-slate-500">Filters apply to the overview, performance breakdown and student table.</p></div><button type="button" onClick={() => { setRange("30"); setClassId("all"); setStudentId("all"); setSourceFilter("all"); }} className="text-sm font-bold text-emerald-800 hover:underline">Reset filters</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-semibold text-slate-700">Date range<select value={range} onChange={(e) => setRange(e.target.value as Range)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All available records</option></select></label>
      <label className="text-sm font-semibold text-slate-700">Class<select value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId("all"); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"><option value="all">All classes</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Student<select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"><option value="all">All students</option>{students.filter((s) => s.status === "active" && (classId === "all" || s.class_id === classId)).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">Report source<select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-medium outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"><option value="all">All learning activities</option><option value="quiz">Built-in Sahaba Quest quizzes</option><option value="school">School-created activities</option></select></label>
    </div></section>
    {loading ? <div className={`${card} mt-5 p-12 text-center text-slate-500`}><div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700"/>Loading school reports…</div> : <>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statCards.map((item) => <article key={item.label} className={`${card} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{item.value}</p></div><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-xl font-black text-emerald-800">{item.icon}</span></div><p className="mt-3 text-xs text-slate-500">{item.hint}</p></article>)}</section>
      <section className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><article className={`${card} p-5 sm:p-6`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold">Learning performance</h2><p className="mt-1 text-sm text-slate-500">School-created activities and built-in quiz levels</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">Top 8 by attempts</span></div>{performanceRows.length ? <div className="mt-6 space-y-5">{performanceRows.map((item) => <div key={item.id}><div className="mb-2 flex items-start justify-between gap-3"><div className="max-w-[70%]"><p className="truncate text-sm font-bold text-slate-700" title={item.title}>{item.title}</p><p className="mt-0.5 text-[11px] font-semibold text-slate-400">{item.source}</p></div><p className="shrink-0 text-xs font-bold text-slate-500">{item.attempts} attempts · {item.average}% avg.</p></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-emerald-700 to-teal-500" style={{ width: `${Math.max(0, Math.min(100, item.average))}%` }}/></div></div>)}</div> : <div className="mt-6 rounded-xl bg-slate-50 p-8 text-center"><p className="font-bold text-slate-700">No learning data for these filters</p><p className="mt-1 text-sm text-slate-500">Quiz sessions and submitted school activities will appear here when available.</p></div>}</article>
      <article className={`${card} p-5 sm:p-6`}><h2 className="text-lg font-extrabold">Participation snapshot</h2><p className="mt-1 text-sm text-slate-500">Students with a quiz session, activity start or submission in this period</p><div className="mt-6 flex items-center gap-5"><div className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#087f5b ${participation}%, #e7efeb ${participation}% 100%)` }}><div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-white"><span className="text-2xl font-black">{participation}%</span><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">participation</span></div></div><div className="min-w-0"><p className="text-2xl font-black">{activeStudentCount} <span className="text-sm font-semibold text-slate-500">of {visibleStudents.length}</span></p><p className="mt-1 text-sm text-slate-500">Students active in the selected period</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{visibleStarts.length} activity starts</span><span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">{visibleAttempts.length} activity submissions</span><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-800">{visibleQuizSessions.length} quiz sessions</span></div></div></div><div className="mt-6 rounded-xl border border-emerald-100 bg-emerald-50/70 p-4"><p className="text-sm font-bold text-emerald-950">A helpful next step</p><p className="mt-1 text-sm leading-5 text-emerald-900">Review students with no recorded learning attempts in this period and encourage them to participate in the next quiz or assigned activity.</p></div></article></section>
      <section className={`${card} mt-5 overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6"><div><h2 className="text-lg font-extrabold">Student performance</h2><p className="mt-1 text-sm text-slate-500">Combined summary of built-in quiz sessions and submitted school activities.</p></div><button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100">↓ Export CSV</button></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3.5 font-bold">Student</th><th className="px-5 py-3.5 font-bold">Class</th><th className="px-5 py-3.5 font-bold">School activities</th><th className="px-5 py-3.5 font-bold">Built-in quizzes</th><th className="px-5 py-3.5 font-bold">Average score</th><th className="px-5 py-3.5 font-bold">Last activity</th><th className="px-5 py-3.5 font-bold">Learning status</th></tr></thead><tbody className="divide-y divide-slate-100">{studentRows.map((row) => <tr key={row.id} className="transition hover:bg-emerald-50/30"><td className="px-5 py-4"><p className="font-bold text-slate-800">{row.name}</p><p className="mt-1 text-xs text-slate-500">{row.admission_number || "No admission number"}</p></td><td className="px-5 py-4 text-slate-600">{classes.find((c) => c.id === row.class_id)?.name ?? "Unassigned"}</td><td className="px-5 py-4 font-semibold">{row.activityAttempts}</td><td className="px-5 py-4 font-semibold">{row.quizAttempts}</td><td className="px-5 py-4">{row.averageScore === null ? <span className="text-slate-400">No score yet</span> : <div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${row.averageScore >= 70 ? "bg-emerald-600" : row.averageScore >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${row.averageScore}%` }}/></div><span className="font-bold">{row.averageScore}%</span></div>}</td><td className="px-5 py-4 text-slate-600">{fmtDate(row.lastActivity)}</td><td className="px-5 py-4">{row.attempts === 0 ? <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">No activity yet</span> : row.averageScore !== null && row.averageScore >= 70 ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">On track</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">May need support</span>}</td></tr>)}</tbody></table></div>{studentRows.length === 0 && <div className="p-10 text-center"><p className="font-bold text-slate-700">No students match these filters</p><p className="mt-1 text-sm text-slate-500">Try changing the class or student filter.</p></div>}<div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">Scores combine available percentage scores from completed built-in quiz sessions and submitted school activities. These indicators are not formal academic grades.</div></section>
      <footer className="py-6 text-center text-xs text-slate-500">Sahaba Quest · School learning reports · Only school-scoped student records returned by the reports API are displayed.</footer>
    </>}
  </div></main>;
}
