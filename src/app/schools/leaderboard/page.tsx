
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type StudentRow = {
  rank: number;
  student_id: string;
  student_code: string | null;
  student_name: string;
  class_id: string | null;
  class_name: string;
  total_xp: number;
  monthly_xp: number;
  questions_answered: number;
  correct_answers: number;
};

type ClassLeaderboard = {
  class_id: string;
  class_name: string;
  academic_session: string | null;
  student_count: number;
  total_xp: number;
  leaderboard: StudentRow[];
};

type LeaderboardResponse = {
  success: boolean;
  message?: string;
  month: string;
  summary: {
    total_students: number;
    total_classes: number;
    total_xp: number;
    monthly_xp: number;
  };
  overall_leaderboard: StudentRow[];
  classes: ClassLeaderboard[];
};

const numberFormat = new Intl.NumberFormat("en-NG");

function formatNumber(value: number) {
  return numberFormat.format(value);
}

function monthLabel(value: string) {
  const [year, month] = value.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "en",
    { month: "long", year: "numeric", timeZone: "UTC" }
  );
}

export default function SchoolLeaderboardPage() {
  const router = useRouter();

  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [activeView, setActiveView] = useState<"school" | "classes">(
    "school"
  );
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        router.replace("/schools/login");
        return;
      }

      const response = await fetch(
        `/api/schools/leaderboard?month=${encodeURIComponent(selectedMonth)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        router.replace("/schools/login");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "Unable to load the school leaderboard."
        );
      }

      setData(result as LeaderboardResponse);

      setSelectedClassId((current) => {
        if (
          current &&
          result.classes?.some(
            (item: ClassLeaderboard) => item.class_id === current
          )
        ) {
          return current;
        }

        return result.classes?.[0]?.class_id ?? "";
      });
    } catch (err) {
      console.error("School leaderboard page error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the leaderboard."
      );
    } finally {
      setLoading(false);
    }
  }, [router, selectedMonth]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const selectedClass = useMemo(
    () =>
      data?.classes.find(
        (item) => item.class_id === selectedClassId
      ) ?? null,
    [data, selectedClassId]
  );

  if (loading && !data) {
    return (
      <main className="min-h-screen bg-[#f1f7f4] p-6">
        <div className="mx-auto max-w-7xl animate-pulse space-y-5">
          <div className="h-8 w-64 rounded bg-emerald-100" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="h-28 rounded-2xl bg-white shadow-sm"
              />
            ))}
          </div>
          <div className="h-80 rounded-2xl bg-white shadow-sm" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f1f7f4] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-7">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <Link
              href="/schools/dashboard"
              className="text-sm font-medium text-[#477166] hover:text-[#073d32]"
            >
              ← Back to school dashboard
            </Link>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#073d32]">
              School Leaderboard
            </h1>

            <p className="mt-2 text-sm text-[#45665d]">
              Track student progress across your school and individual classes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="leaderboard-month" className="text-sm font-medium text-[#244f43]">
              Monthly activity
            </label>
            <input
              id="leaderboard-month"
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm outline-none focus:border-[#08745b] focus:ring-2 focus:ring-emerald-100"
            />

            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="rounded-xl bg-[#073d32] px-4 py-2 text-sm font-semibold text-white hover:bg-[#062e27]"
            >
              Refresh
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              className="ml-2 font-semibold underline"
            >
              Try again
            </button>
          </div>
        )}

        {data && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                label="Active students"
                value={formatNumber(data.summary.total_students)}
                detail="Across the school"
              />
              <SummaryCard
                label="Classes"
                value={formatNumber(data.summary.total_classes)}
                detail="School classes"
              />
              <SummaryCard
                label="Total school XP"
                value={formatNumber(data.summary.total_xp)}
                detail="Cumulative student XP"
              />
              <SummaryCard
                label={`${monthLabel(data.month)} XP`}
                value={formatNumber(data.summary.monthly_xp)}
                detail="XP earned during the selected month"
              />
            </section>

            <section className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
              <div className="flex flex-col justify-between gap-4 border-b border-emerald-100 p-5 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-lg font-bold text-[#073d32]">
                    Rankings
                  </h2>
                  <p className="mt-1 text-sm text-[#557168]">
                    Overall rankings use cumulative XP. Monthly XP shows activity
                    for {monthLabel(data.month)}.
                  </p>
                </div>

                <div className="inline-flex w-fit rounded-xl bg-[#e3eee8] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveView("school")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      activeView === "school"
                        ? "bg-[#073d32] text-white shadow-sm"
                        : "text-[#557168] hover:text-[#073d32]"
                    }`}
                  >
                    Whole school
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveView("classes")}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                      activeView === "classes"
                        ? "bg-[#073d32] text-white shadow-sm"
                        : "text-[#557168] hover:text-[#073d32]"
                    }`}
                  >
                    By class
                  </button>
                </div>
              </div>

              {activeView === "school" ? (
                <StudentTable students={data.overall_leaderboard} />
              ) : (
                <div className="p-5">
                  {data.classes.length === 0 ? (
                    <EmptyState message="No classes have been added to this school yet." />
                  ) : (
                    <div className="space-y-6">
                      <div className="flex flex-wrap gap-2">
                        {data.classes.map((schoolClass) => (
                          <button
                            type="button"
                            key={schoolClass.class_id}
                            onClick={() =>
                              setSelectedClassId(schoolClass.class_id)
                            }
                            className={`rounded-xl border px-4 py-2 text-sm font-semibold ${
                              selectedClassId === schoolClass.class_id
                                ? "border-[#073d32] bg-[#073d32] text-white"
                                : "border-emerald-100 bg-white text-[#244f43] hover:bg-emerald-50"
                            }`}
                          >
                            {schoolClass.class_name}
                          </button>
                        ))}
                      </div>

                      {selectedClass && (
                        <div className="space-y-4">
                          <div className="grid gap-3 sm:grid-cols-3">
                            <MiniStat
                              label="Students"
                              value={formatNumber(selectedClass.student_count)}
                            />
                            <MiniStat
                              label="Class cumulative XP"
                              value={formatNumber(selectedClass.total_xp)}
                            />
                            <MiniStat
                              label="Academic session"
                              value={selectedClass.academic_session || "Not specified"}
                            />
                          </div>

                          <h3 className="text-base font-bold text-slate-900">
                            {selectedClass.class_name} leaderboard
                          </h3>

                          <StudentTable students={selectedClass.leaderboard} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </section>

            <p className="text-xs leading-5 text-slate-500">
              Rankings include active students. Cumulative XP comes from each
              student&apos;s existing progress record; monthly XP is calculated
              from question attempts in the selected month. Students without a
              progress record currently display zero cumulative XP.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-100 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-[#557168]">{label}</p>
      <p className="mt-3 break-words text-3xl font-bold tracking-tight text-[#073d32]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#557168]">{detail}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-[#f1f7f4] p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 break-words text-lg font-bold text-[#073d32]">
        {value}
      </p>
    </div>
  );
}

function StudentTable({ students }: { students: StudentRow[] }) {
  if (students.length === 0) {
    return <EmptyState message="There are no active students to display." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-[760px] w-full text-left text-sm">
        <thead className="bg-[#e7f1ec] text-xs uppercase tracking-wide text-[#42675b]">
          <tr>
            <th className="px-5 py-4 font-semibold">Rank</th>
            <th className="px-5 py-4 font-semibold">Student</th>
            <th className="px-5 py-4 font-semibold">Class</th>
            <th className="px-5 py-4 text-right font-semibold">Total XP</th>
            <th className="px-5 py-4 text-right font-semibold">Monthly XP</th>
            <th className="px-5 py-4 text-right font-semibold">Questions</th>
            <th className="px-5 py-4 text-right font-semibold">Correct</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-emerald-100">
          {students.map((student) => (
            <tr key={student.student_id} className="hover:bg-emerald-50">
              <td className="px-5 py-4">
                <RankBadge rank={student.rank} />
              </td>
              <td className="px-5 py-4">
                <p className="font-semibold text-slate-900">
                  {student.student_name || "Unnamed student"}
                </p>
                <p className="mt-1 text-xs text-[#557168]">
                  {student.student_code || "No student code"}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-600">
                {student.class_name}
              </td>
              <td className="px-5 py-4 text-right font-bold text-slate-900">
                {formatNumber(student.total_xp)}
              </td>
              <td className="px-5 py-4 text-right text-[#08745b]">
                {formatNumber(student.monthly_xp)}
              </td>
              <td className="px-5 py-4 text-right text-slate-600">
                {formatNumber(student.questions_answered)}
              </td>
              <td className="px-5 py-4 text-right text-slate-600">
                {formatNumber(student.correct_answers)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const style =
    rank === 1
      ? "bg-amber-100 text-amber-800"
      : rank === 2
        ? "bg-slate-200 text-slate-700"
        : rank === 3
          ? "bg-orange-100 text-orange-800"
          : "bg-slate-100 text-slate-600";

  return (
    <span
      className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 font-bold ${style}`}
    >
      {rank}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-emerald-200 px-5 py-12 text-center text-sm text-[#557168]">
      {message}
    </div>
  );
}
