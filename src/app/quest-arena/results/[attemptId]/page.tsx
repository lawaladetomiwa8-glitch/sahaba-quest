"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppNavbar } from "../../../../components/ui";
import { supabase } from "../../../../lib/supabase";

type Attempt = {
  id: string;
  competition_id: string;
  participant_id: string;
  user_id: string;
  team_id: string;
  status: string;
  questions_answered: number;
  correct_answers: number;
  total_xp: number;
  started_at: string;
  completed_at: string | null;
};

type Competition = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  creator_id: string;
};

type Team = {
  id: string;
  team_name: string;
  team_slot: number;
};

type LeaderboardEntry = {
  rank: number;
  userId: string;
  participantId: string;
  displayName: string;
  username: string;
  teamId: string;
  teamName: string;
  totalXp: number;
  correctAnswers: number;
  completedAt: string | null;
};

function firstRow<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

function valueOf(row: Record<string, unknown>, keys: string[], fallback: unknown = "") {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return fallback;
}

function mapLeaderboardRow(row: Record<string, unknown>, index: number): LeaderboardEntry {
  return {
    rank: Number(valueOf(row, ["out_rank", "rank", "position"], index + 1)),
    userId: String(valueOf(row, ["out_user_id", "user_id"], "")),
    participantId: String(valueOf(row, ["out_participant_id", "participant_id"], "")),
    displayName: String(valueOf(row, ["out_display_name", "display_name"], "Quest Arena player")),
    username: String(valueOf(row, ["out_username", "username"], "")),
    teamId: String(valueOf(row, ["out_team_id", "team_id"], "")),
    teamName: String(valueOf(row, ["out_team_name", "team_name"], "Team")),
    totalXp: Number(valueOf(row, ["out_total_xp", "total_xp", "xp"], 0)),
    correctAnswers: Number(valueOf(row, ["out_correct_answers", "correct_answers"], 0)),
    completedAt: valueOf(row, ["out_completed_at", "completed_at"], null) as string | null,
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Lagos",
  }).format(date);

  return formatted.replace(/\\b(am|pm)\\b/i, (period) =>
    period.toUpperCase()
  );
}

export default function QuestArenaResultsPage() {
  const params = useParams<{ attemptId: string }>();
  const attemptId = params?.attemptId;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isCreator, setIsCreator] = useState(false);

  const loadResults = useCallback(async () => {
    if (!attemptId) return;
    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace(
          `/login?redirectTo=${encodeURIComponent(`/quest-arena/results/${attemptId}`)}`
        );
        return;
      }

      setCurrentUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.account_type === "family") {
        router.replace("/family-dashboard");
        return;
      }

      if (profile?.account_type !== "free" && profile?.account_type !== "individual") {
        router.replace("/dashboard");
        return;
      }

      const { data: attemptData, error: attemptError } = await supabase
        .from("quest_arena_attempts")
        .select(
          "id, competition_id, participant_id, user_id, team_id, status, questions_answered, correct_answers, total_xp, started_at, completed_at"
        )
        .eq("id", attemptId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (attemptError) throw attemptError;
      if (!attemptData) throw new Error("This attempt could not be found.");

      const currentAttempt = attemptData as Attempt;
      setAttempt(currentAttempt);

      const [
        { data: competitionData, error: competitionError },
        { data: teamData, error: teamError },
        { data: teamsData, error: teamsError },
        { data: leaderboardData, error: leaderboardError },
      ] = await Promise.all([
        supabase
          .from("quest_arena_competitions")
          .select("id, title, status, starts_at, ends_at, creator_id")
          .eq("id", currentAttempt.competition_id)
          .maybeSingle(),
        supabase
          .from("quest_arena_teams")
          .select("id, team_name, team_slot")
          .eq("id", currentAttempt.team_id)
          .maybeSingle(),
        supabase
          .from("quest_arena_teams")
          .select("id, team_name, team_slot")
          .eq("competition_id", currentAttempt.competition_id)
          .order("team_slot", { ascending: true }),
        supabase.rpc("quest_arena_get_leaderboard", {
          p_competition_id: currentAttempt.competition_id,
        }),
      ]);

      if (competitionError) throw competitionError;
      if (teamError) throw teamError;
      if (teamsError) throw teamsError;
      if (leaderboardError) throw leaderboardError;
      if (!competitionData) throw new Error("Competition details could not be found.");

      const currentCompetition = competitionData as Competition;
      setCompetition(currentCompetition);
      setIsCreator(currentCompetition.creator_id === user.id);
      setTeam((teamData as Team | null) ?? null);
      setTeams((teamsData as Team[]) ?? []);

      const rows = Array.isArray(leaderboardData)
        ? leaderboardData
        : leaderboardData
        ? [leaderboardData]
        : [];

      setLeaderboard(
        rows.map((row, index) =>
          mapLeaderboardRow(row as Record<string, unknown>, index)
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We could not load your results."
      );
    } finally {
      setLoading(false);
    }
  }, [attemptId, router]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  const myRank = useMemo(
    () => leaderboard.find((entry) => entry.userId === currentUserId),
    [leaderboard, currentUserId]
  );

  const teamStats = useMemo(() => {
    return teams.map((item) => {
      const entries = leaderboard.filter((entry) => entry.teamId === item.id);
      const totalXp = entries.reduce((sum, entry) => sum + entry.totalXp, 0);
      return {
        ...item,
        completedCount: entries.length,
        totalXp,
        averageXp: entries.length ? totalXp / entries.length : 0,
      };
    });
  }, [teams, leaderboard]);

  const teamWinner = useMemo(() => {
    if (teamStats.length !== 2) return "pending";
    if (teamStats.some((item) => item.completedCount === 0)) return "pending";
    if (teamStats[0].averageXp === teamStats[1].averageXp) return "draw";
    return teamStats[0].averageXp > teamStats[1].averageXp
      ? teamStats[0].id
      : teamStats[1].id;
  }, [teamStats]);

  if (loading) {
    return (
      <main className="sq-page min-h-screen">
        <AppNavbar />
        <div className="mx-auto max-w-3xl px-4 py-16 text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[var(--border)] border-t-[var(--primary)]" />
          <p className="font-semibold text-[var(--foreground)]">Loading your results...</p>
        </div>
      </main>
    );
  }

  if (error || !attempt || !competition) {
    return (
      <main className="sq-page min-h-screen">
        <AppNavbar />
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <section className="sq-card p-8">
            <h1 className="text-xl font-extrabold text-[var(--foreground)]">
              Results unavailable
            </h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {error || "We could not find this attempt."}
            </p>
            <button onClick={() => void loadResults()} className="sq-button-primary mt-5">
              Try again
            </button>
            <div>
              <Link href="/quest-arena" className="mt-4 inline-block text-sm font-bold text-[var(--primary)]">
                Return to Quest Arena
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const completed = attempt.status === "completed";
  const accuracy = attempt.questions_answered
    ? Math.round((attempt.correct_answers / attempt.questions_answered) * 100)
    : 0;

  return (
    <main className="sq-page min-h-screen">
      <AppNavbar />
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-7 sm:px-6">
        <section className="sq-card relative overflow-hidden p-6 sm:p-9">
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full opacity-60"
            style={{ background: "var(--primary-light)" }}
          />
          <div className="relative">
            <span className="sq-badge">QUEST ARENA RESULTS</span>
            <h1 className="mt-4 text-3xl font-black text-[var(--foreground)] sm:text-4xl">
              {completed ? "Your attempt is complete!" : "Your attempt is in progress"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
              {competition.title}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <p className="text-xs font-semibold text-[var(--muted)]">Arena XP</p>
                <p className="mt-1 text-3xl font-black text-[var(--primary)]">
                  {attempt.total_xp.toLocaleString()}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Out of 1,000</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <p className="text-xs font-semibold text-[var(--muted)]">Correct answers</p>
                <p className="mt-1 text-3xl font-black text-[var(--foreground)]">
                  {attempt.correct_answers}/10
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{accuracy}% accuracy</p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <p className="text-xs font-semibold text-[var(--muted)]">Questions answered</p>
                <p className="mt-1 text-3xl font-black text-[var(--foreground)]">
                  {attempt.questions_answered}/10
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {Math.max(0, 10 - attempt.questions_answered)} remaining
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <p className="text-xs font-semibold text-[var(--muted)]">Individual rank</p>
                <p className="mt-1 text-3xl font-black text-[var(--foreground)]">
                  {myRank ? `#${myRank.rank}` : "—"}
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">Among completed attempts</p>
              </div>
            </div>

            {!completed && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This attempt is not complete yet. Resume it to answer the remaining questions. Incomplete attempts do not count towards the team average or final winner.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/quest-arena/play/${attempt.id}`)}
                    className="sq-button-primary"
                  >
                    Resume my attempt
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="sq-card p-5 sm:p-6">
            <h2 className="text-lg font-extrabold text-[var(--foreground)]">Your team</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              You represented <strong className="text-[var(--foreground)]">{team?.team_name ?? "your team"}</strong>.
            </p>
            <div className="mt-5 space-y-3">
              {teamStats.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-[var(--foreground)]">{item.team_name}</span>
                    {teamWinner === item.id && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        Leading by average
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-extrabold text-[var(--primary)]">{item.totalXp.toLocaleString()}</p>
                      <p className="text-[10px] text-[var(--muted)]">Total XP</p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-[var(--foreground)]">{item.completedCount}</p>
                      <p className="text-[10px] text-[var(--muted)]">Completed</p>
                    </div>
                    <div>
                      <p className="text-lg font-extrabold text-[var(--foreground)]">{Math.round(item.averageXp)}</p>
                      <p className="text-[10px] text-[var(--muted)]">Average XP</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
              The winning team is decided by average XP per completed participant, not total XP. Incomplete attempts are excluded.
            </p>
            {teamWinner === "draw" && (
              <p className="mt-3 rounded-xl bg-[var(--secondary-light)] p-3 text-sm font-bold text-[var(--primary)]">
                The teams are currently tied.
              </p>
            )}
            {teamWinner === "pending" && (
              <p className="mt-3 rounded-xl bg-[var(--secondary-light)] p-3 text-sm text-[var(--primary)]">
                The team result is pending until both teams have at least one completed attempt.
              </p>
            )}
          </div>

          <div className="sq-card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[var(--foreground)]">Individual leaderboard</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">Completed attempts only</p>
              </div>
              <span className="sq-badge">{leaderboard.length} players</span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="mt-5 rounded-xl bg-[var(--secondary-light)] p-5 text-center text-sm text-[var(--muted)]">
                No completed attempts have been recorded yet.
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {leaderboard.slice(0, 10).map((entry) => (
                  <div
                    key={entry.participantId || entry.userId || `${entry.rank}-${entry.displayName}`}
                    className={`flex items-center gap-3 rounded-xl border p-3 ${
                      entry.userId === currentUserId
                        ? "border-[var(--primary)] bg-[var(--secondary-light)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--secondary-light)] text-xs font-black text-[var(--primary)]">
                      {entry.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-[var(--foreground)]">
                        {entry.displayName}
                        {entry.userId === currentUserId ? " (You)" : ""}
                      </p>
                      <p className="truncate text-xs text-[var(--muted)]">
                        {entry.teamName}{entry.username ? ` · @${entry.username}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-extrabold text-[var(--primary)]">
                      {entry.totalXp.toLocaleString()} XP
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 sq-card p-5 sm:p-6">
          <h2 className="text-lg font-extrabold text-[var(--foreground)]">Attempt details</h2>
          <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="text-xs text-[var(--muted)]">Started</p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">{formatDate(attempt.started_at)}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--muted)]">Completed</p>
              <p className="mt-1 font-semibold text-[var(--foreground)]">{formatDate(attempt.completed_at)}</p>
            </div>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {isCreator && (
            <Link href={`/quest-arena/competition/${competition.id}`} className="sq-button-primary">
              Manage competition
            </Link>
          )}
          <Link href={`/quest-arena/competition/${competition.id}`} className="sq-button-secondary">
            Competition page
          </Link>
          <Link href="/quest-arena" className="sq-button-secondary">
            Back to Quest Arena
          </Link>
          <button type="button" onClick={() => void loadResults()} className="sq-button-secondary">
            Refresh results
          </button>
        </div>
      </div>
    </main>
  );
}
