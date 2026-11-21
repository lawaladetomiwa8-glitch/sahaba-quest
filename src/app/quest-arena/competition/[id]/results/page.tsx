"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AppNavbar } from "../../../../../components/ui";
import { supabase } from "../../../../../lib/supabase";

type Row = Record<string, any>;
type Competition = { id: string; title: string; status: string; starts_at: string; ends_at: string; creator_id: string; finalized_at?: string | null };
type Team = { id: string; team_name: string; team_slot: number };
type Player = { rank: number; displayName: string; username: string; teamId: string; teamName: string; xp: number; correct: number };

const get = (row: Row, keys: string[], fallback: any = undefined) => {
  for (const key of keys) if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  return fallback;
};
const num = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };


export default function QuestArenaCompetitionResultsPage() {
  const params = useParams<{ id: string }>();
  const competitionId = String(params?.id || "");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [finalizeNotice, setFinalizeNotice] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!competitionId) return;
    quiet ? setRefreshing(true) : setLoading(true);
    setError(""); setFinalizeNotice("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.replace(`/login?redirectTo=${encodeURIComponent(`/quest-arena/competition/${competitionId}/results`)}`); return; }

      const { data: compData, error: compError } = await supabase.from("quest_arena_competitions")
        .select("id,title,status,starts_at,ends_at,creator_id,finalized_at")
        .eq("id", competitionId).maybeSingle();
      if (compError) throw compError;
      if (!compData) throw new Error("Competition not found or access denied.");
      const comp = compData as Competition;

      // Results are restricted to the creator and registered participants.
      const isOwner = comp.creator_id === user.id;
      const { data: participant, error: participantError } = await supabase.from("quest_arena_participants")
        .select("id").eq("competition_id", competitionId).eq("user_id", user.id).maybeSingle();
      if (participantError) throw participantError;
      if (!isOwner && !participant) throw new Error("Only the organiser and registered participants can view this competition's results.");
      setIsCreator(isOwner);

      // Finalize when an organiser closed it or the scheduled end has passed.
      if (isOwner && (comp.status === "closed" || comp.status === "completed" || Date.now() >= new Date(comp.ends_at).getTime())) {
        if (comp.status !== "completed") {
          const { error: finalizeError } = await supabase.rpc("quest_arena_finalize_competition", { p_competition_id: competitionId });
          if (finalizeError) setFinalizeNotice(`The competition has ended, but finalization is pending: ${finalizeError.message}`);
        }
      }

      const { data: freshComp, error: freshCompError } = await supabase.from("quest_arena_competitions")
        .select("id,title,status,starts_at,ends_at,creator_id,finalized_at")
        .eq("id", competitionId).maybeSingle();
      if (freshCompError) throw freshCompError;
      if (freshComp) setCompetition(freshComp as Competition);

      const [{ data: teamData, error: teamError }, { data: leaderboardData, error: leaderboardError }] = await Promise.all([
        supabase.from("quest_arena_teams").select("id,team_name,team_slot").eq("competition_id", competitionId).order("team_slot", { ascending: true }),
        supabase.rpc("quest_arena_get_leaderboard", { p_competition_id: competitionId }),
      ]);
      if (teamError) throw teamError;
      if (leaderboardError) throw leaderboardError;
      const teamList = (teamData || []) as Team[];
      setTeams(teamList);
      const rows = Array.isArray(leaderboardData) ? leaderboardData : leaderboardData ? [leaderboardData] : [];
      setPlayers(rows.map((r: Row, i: number) => ({
        rank: num(get(r, ["out_rank", "rank", "position"], i + 1)),
        displayName: String(get(r, ["out_display_name", "display_name"], "Quest Arena player")),
        username: String(get(r, ["out_username", "username"], "")),
        teamId: String(get(r, ["out_team_id", "team_id"], "")),
        teamName: String(get(r, ["out_team_name", "team_name"], "Team")),
        xp: num(get(r, ["out_total_xp", "total_xp", "xp"], 0)),
        correct: num(get(r, ["out_correct_answers", "correct_answers"], 0)),
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load final competition results.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [competitionId, router]);

  useEffect(() => { void load(); }, [load]);


  const teamStats = useMemo(() => teams.map(team => {
    const completed = players.filter(p => p.teamId === team.id);
    const totalXp = completed.reduce((sum, p) => sum + p.xp, 0);
    return { ...team, count: completed.length, totalXp, averageXp: completed.length ? totalXp / completed.length : 0 };
  }), [teams, players]);


  const result = useMemo(() => {
    if (teamStats.length !== 2) return { type: "pending" as const, winner: null as Team | null };
    if (teamStats.some(t => t.count === 0)) return { type: "pending" as const, winner: null as Team | null };
    if (teamStats[0].averageXp === teamStats[1].averageXp) return { type: "draw" as const, winner: null as Team | null };
    const winner = teamStats[0].averageXp > teamStats[1].averageXp ? teamStats[0] : teamStats[1];
    return { type: "winner" as const, winner };
  }, [teamStats]);

  const finalized = competition?.status === "completed";
  const date = competition?.finalized_at ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" }).format(new Date(competition.finalized_at)) : "";

  if (loading) return <main className="sq-page min-h-screen"><div className="sq-container"><AppNavbar/><section className="sq-card mt-6 p-8 text-center"><div className="text-3xl">⏳</div><h2 className="mt-2 font-bold">Loading competition results...</h2></section></div></main>;

  return <main className="sq-page min-h-screen pb-12"><div className="sq-container" style={{ maxWidth: 1100 }}><AppNavbar/>
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><Link href={`/quest-arena/competition/${competitionId}`} className="sq-button-secondary">← Competition page</Link><button type="button" className="sq-button-secondary" disabled={refreshing} onClick={() => void load(true)}>{refreshing ? "Refreshing..." : "↻ Refresh results"}</button></div>
    {error ? <section className="sq-card mt-5 p-6"><h1 className="text-xl font-black">Results unavailable</h1><p className="mt-3 text-sm text-[var(--muted)]">{error}</p></section> : <>
    <section className="sq-card mt-5 overflow-hidden p-6 sm:p-9" style={{ background: "linear-gradient(135deg,#ffffff 0%,#f0fdfa 100%)" }}>
      <span className="sq-badge">QUEST ARENA · FINAL RESULTS</span>
      <h1 className="mt-3 text-3xl font-black sm:text-4xl">{competition?.title}</h1>
      {finalized ? <p className="mt-2 text-sm text-[var(--muted)]">Competition officially finalized{date ? ` · ${date}` : ""}</p> : <p className="mt-2 text-sm text-amber-800">Competition ended or closed. Finalization is still pending.</p>}
      {finalizeNotice && <div role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{finalizeNotice}</div>}
      <div className="mt-6 rounded-2xl p-6 text-center" style={{ background: finalized && result.type === "winner" ? "#ecfdf5" : "#f0fdfa", border: "1px solid #ccfbf1" }}>
        <div className="text-4xl">{finalized && result.type === "winner" ? "🏆" : finalized && result.type === "draw" ? "🤝" : "⚔️"}</div>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">{finalized ? result.type === "winner" ? `${result.winner?.team_name} WINS!` : result.type === "draw" ? "IT'S A DRAW!" : "RESULT PENDING" : "FINAL RESULT PENDING"}</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">{finalized ? result.type === "winner" ? `Victory by ${Math.round(Math.abs(teamStats[0].averageXp - teamStats[1].averageXp)).toLocaleString()} average XP.` : result.type === "draw" ? "Both teams finished with the same average XP." : "Both teams need completed attempts to determine the winner." : "The competition has not been officially finalized yet."}</p>
      </div>
    </section>
    <section className="mt-5 grid gap-4 sm:grid-cols-2">
      {teamStats.map(t => <div key={t.id} className="sq-card p-5 sm:p-6"><div className="text-xs font-bold text-[var(--muted)]">TEAM {t.team_slot}</div><h2 className="mt-2 text-xl font-black">{t.team_name}{finalized && result.winner?.id === t.id ? " 🏆" : ""}</h2><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="text-xl font-black text-[var(--primary)]">{t.averageXp.toLocaleString(undefined,{maximumFractionDigits:1})}</p><p className="text-xs text-[var(--muted)]">Average XP</p></div><div><p className="text-xl font-black">{t.totalXp.toLocaleString()}</p><p className="text-xs text-[var(--muted)]">Total XP</p></div><div><p className="text-xl font-black">{t.count}</p><p className="text-xs text-[var(--muted)]">Completed</p></div></div></div>)}
    </section>
    <section className="sq-card mt-5 p-5 sm:p-6"><div className="flex items-center justify-between gap-2"><h2 className="text-xl font-black">Completed players</h2><span className="sq-badge">{players.length} completed</span></div>{players.length === 0 ? <p className="mt-4 text-sm text-[var(--muted)]">No completed attempts were recorded.</p> : <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] border-collapse text-left"><thead><tr className="bg-slate-50 text-xs text-[var(--muted)]"><th className="p-3">Rank</th><th className="p-3">Player</th><th className="p-3">Team</th><th className="p-3">Correct</th><th className="p-3">XP</th></tr></thead><tbody>{players.map((p,i)=><tr key={`${p.rank}-${p.username}-${i}`} className="border-t border-[var(--border)]"><td className="p-3 font-bold">{p.rank}</td><td className="p-3 font-semibold">{p.displayName}{p.username ? <span className="block text-xs text-[var(--muted)]">@{p.username}</span> : null}</td><td className="p-3">{p.teamName}</td><td className="p-3">{p.correct}/10</td><td className="p-3 font-black text-[var(--primary)]">{p.xp.toLocaleString()} XP</td></tr>)}</tbody></table></div>}</section>
    </>}
    <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/quest-arena" className="sq-button-secondary">Quest Arena home</Link>{isCreator && <Link href={`/quest-arena/competition/${competitionId}`} className="sq-button-primary">Manage competition</Link>}</div>
  </div></main>;
}
