"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppNavbar } from "../../../../components/ui";
import { supabase } from "../../../../lib/supabase";

type Row = Record<string, any>;

type Competition = {
  id: string;
  creator_id: string;
  title: string;
  invite_code: string;
  status: string;
  starts_at: string;
  ends_at: string;
  registration_closes_at: string;
  creator_participates: boolean;
  closed_at: string | null;
  finalized_at: string | null;
};

type Team = {
  id: string;
  team_slot: number;
  team_name: string;
};

type Participant = {
  id: string;
  user_id: string;
  team_id: string;
  is_creator: boolean;
  joined_at: string;
  display_name?: string;
  username?: string;
  team_name?: string;
  attempt_status?: string | null;
  questions_answered?: number;
  correct_answers?: number;
  total_xp?: number;
  completed_at?: string | null;
};

type LeaderboardEntry = {
  rank: number;
  display_name: string;
  username: string;
  team_name: string;
  total_xp: number;
  correct_answers: number;
};

function first(row: Row, keys: string[], fallback: any = undefined): any {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null) return row[key];
  }
  return fallback;
}

function asNumber(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}

function formatDate(value?: string | null): string {
  if (!value) return "Not set";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";

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

function friendlyError(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}

function mapParticipant(row: Row): Participant {
  return {
    id: String(first(row, ["out_participant_id", "participant_id", "id"], "")),
    user_id: String(first(row, ["out_user_id", "user_id"], "")),
    team_id: String(first(row, ["out_team_id", "team_id"], "")),
    is_creator: asBoolean(first(row, ["out_is_creator", "is_creator"], false)),
    joined_at: String(first(row, ["out_joined_at", "joined_at"], "")),
    display_name: first(row, ["out_display_name", "display_name"], undefined),
    username: first(row, ["out_username", "username"], undefined),
    team_name: first(row, ["out_team_name", "team_name"], undefined),
    attempt_status: first(row, ["out_attempt_status", "attempt_status", "status"], null),
    questions_answered: asNumber(first(row, ["out_questions_answered", "questions_answered"], 0)),
    correct_answers: asNumber(first(row, ["out_correct_answers", "correct_answers"], 0)),
    total_xp: asNumber(first(row, ["out_total_xp", "total_xp"], 0)),
    completed_at: first(row, ["out_completed_at", "completed_at"], null),
  };
}

function mapLeaderboard(row: Row, index: number): LeaderboardEntry {
  return {
    rank: asNumber(first(row, ["out_rank", "rank", "position"], index + 1)),
    display_name: String(first(row, ["out_display_name", "display_name"], "")),
    username: String(first(row, ["out_username", "username"], "")),
    team_name: String(first(row, ["out_team_name", "team_name"], "")),
    total_xp: asNumber(first(row, ["out_total_xp", "total_xp", "xp"], 0)),
    correct_answers: asNumber(first(row, ["out_correct_answers", "correct_answers"], 0)),
  };
}

export default function QuestArenaCompetitionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const competitionId = useMemo(() => String(params?.id || ""), [params]);

  const [userId, setUserId] = useState("");
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isCreator, setIsCreator] = useState(false);
  const [myParticipant, setMyParticipant] = useState<Participant | null>(null);
  const [myAttempt, setMyAttempt] = useState<Row | null>(null);
  const [overview, setOverview] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadCompetition = useCallback(async (quiet = false) => {
    if (!competitionId) return;
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.replace(`/login?redirectTo=${encodeURIComponent(`/quest-arena/competition/${competitionId}`)}`);
        return;
      }
      setUserId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      if (!profile || !["free", "individual"].includes(profile.account_type)) {
        router.replace(profile?.account_type === "family" ? "/family-dashboard" : "/dashboard");
        return;
      }

      const { data: compData, error: compError } = await supabase
        .from("quest_arena_competitions")
        .select("*")
        .eq("id", competitionId)
        .maybeSingle();
      if (compError) throw compError;
      if (!compData) throw new Error("This competition could not be found, or you do not have permission to view it.");

      const comp = compData as Competition;
      setCompetition(comp);
      const creator = comp.creator_id === user.id;
      setIsCreator(creator);

      const [
        teamsResult,
        participantsResult,
        myAttemptResult,
        leaderboardResult,
      ] = await Promise.all([
        supabase
          .from("quest_arena_teams")
          .select("id, team_slot, team_name")
          .eq("competition_id", competitionId)
          .order("team_slot", { ascending: true }),
        supabase
          .from("quest_arena_participants")
          .select("id, user_id, team_id, is_creator, joined_at")
          .eq("competition_id", competitionId)
          .order("joined_at", { ascending: true }),
        supabase
          .from("quest_arena_attempts")
          .select("id, status, questions_answered, correct_answers, total_xp, started_at, completed_at")
          .eq("competition_id", competitionId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.rpc("quest_arena_get_leaderboard", {
          p_competition_id: competitionId,
        }),
      ]);

      if (teamsResult.error) throw teamsResult.error;
      if (participantsResult.error) throw participantsResult.error;
      if (myAttemptResult.error) throw myAttemptResult.error;
      if (leaderboardResult.error) throw leaderboardResult.error;

      const teamRows = (teamsResult.data || []) as Team[];
      const participantRows = (participantsResult.data || []) as Participant[];
      setTeams(teamRows);
      setMyAttempt(myAttemptResult.data as Row | null);

      const myRow = participantRows.find((p) => p.user_id === user.id) || null;
      setMyParticipant(myRow);

      if (creator) {
        const [overviewResult, creatorParticipantsResult] = await Promise.all([
          supabase.rpc("quest_arena_get_creator_overview", {
            p_competition_id: competitionId,
          }),
          supabase.rpc("quest_arena_get_creator_participants", {
            p_competition_id: competitionId,
          }),
        ]);

        if (overviewResult.error) throw overviewResult.error;
        if (creatorParticipantsResult.error) throw creatorParticipantsResult.error;

        const overviewRow = Array.isArray(overviewResult.data)
          ? overviewResult.data[0]
          : overviewResult.data;
        setOverview((overviewRow || null) as Row | null);

        const creatorRows = Array.isArray(creatorParticipantsResult.data)
          ? creatorParticipantsResult.data
          : [];
        setParticipants(creatorRows.map((row: Row) => mapParticipant(row)));
      } else {
        setOverview(null);
        // Non-creators can see registration totals without exposing private attempt details.
        setParticipants(participantRows.map((row) => ({
          ...row,
          team_name: teamRows.find((team) => team.id === row.team_id)?.team_name || "Team",
        })));
      }

      const boardRows = Array.isArray(leaderboardResult.data)
        ? leaderboardResult.data
        : [];
      setLeaderboard(boardRows.map((row: Row, index: number) => mapLeaderboard(row, index)));
    } catch (loadError) {
      setError(friendlyError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [competitionId, router]);

  useEffect(() => {
    void loadCompetition();
  }, [loadCompetition]);

  const teamCounts = useMemo(() => {
    return teams.map((team) => ({
      ...team,
      count: participants.filter((participant) => participant.team_id === team.id).length,
    }));
  }, [teams, participants]);

  const inviteUrl = typeof window !== "undefined" && competition
    ? `${window.location.origin}/quest-arena/join?code=${encodeURIComponent(competition.invite_code)}`
    : "";

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Your browser could not copy the invitation link. You can copy it from the field below.");
    }
  }

  async function startOrResume() {
    if (!competition) return;
    setStarting(true);
    setError("");
    try {
      const { data, error: startError } = await supabase.rpc(
        "quest_arena_start_attempt",
        { p_competition_id: competition.id }
      );
      if (startError) throw startError;
      const row = Array.isArray(data) ? data[0] : data;
      const attemptId = row?.out_attempt_id || row?.attempt_id;
      if (!attemptId) {
        throw new Error("The attempt was started, but the server did not return an attempt ID. Please refresh and try again.");
      }
      router.push(`/quest-arena/play/${attemptId}`);
    } catch (startError) {
      setError(friendlyError(startError));
    } finally {
      setStarting(false);
    }
  }

  const now = Date.now();
  const notStarted = competition ? now < new Date(competition.starts_at).getTime() : false;
  const endedByTime = competition ? now >= new Date(competition.ends_at).getTime() : false;
  const closed = competition?.status !== "open" || endedByTime;
  const canPlay = Boolean(myParticipant && !closed && !notStarted);
  const attemptCompleted = myAttempt?.status === "completed";
  const attemptInProgress = myAttempt?.status === "in_progress";

  const overviewValue = (keys: string[], fallback: any = undefined) =>
    overview ? first(overview, keys, fallback) : fallback;

  const competitionResult = String(overviewValue(
    ["out_competition_result", "competition_result", "result"], "pending"
  ));
  const completedCount = asNumber(overviewValue(
    ["out_completed_attempts", "completed_attempts", "completed_count"], 0
  ));
  const participantCount = participants.length;

  if (loading) {
    return (
      <main className="sq-page" style={{ minHeight: "100vh" }}>
        <div className="sq-container" style={{ maxWidth: 1120 }}>
          <AppNavbar />
          <section className="sq-card" style={{ marginTop: 28, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 30 }}>⏳</div>
            <h2>Loading competition...</h2>
            <p style={{ color: "var(--muted)" }}>Please wait while we retrieve the competition details.</p>
          </section>
        </div>
      </main>
    );
  }

  if (!competition) {
    return (
      <main className="sq-page" style={{ minHeight: "100vh" }}>
        <div className="sq-container" style={{ maxWidth: 900 }}>
          <AppNavbar />
          <section className="sq-card" style={{ marginTop: 28, padding: 28 }}>
            <div role="alert" style={errorStyle}>{error || "Competition not found."}</div>
            <Link href="/quest-arena" className="sq-button-primary" style={{ display: "inline-flex", marginTop: 18 }}>
              Return to Quest Arena
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="sq-page" style={{ minHeight: "100vh", paddingBottom: 48 }}>
      <div className="sq-container" style={{ maxWidth: 1120 }}>
        <AppNavbar />

        <div style={{ margin: "24px 0 18px", display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <Link href="/quest-arena" style={{ color: "var(--primary)", fontWeight: 800, textDecoration: "none" }}>
            ← Back to Quest Arena
          </Link>
          <button type="button" className="sq-button-secondary" onClick={() => void loadCompetition(true)} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "↻ Refresh"}
          </button>
        </div>

        <section className="sq-card" style={{ padding: "clamp(24px, 4vw, 40px)", background: "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)", position: "relative", overflow: "hidden" }}>
          <div aria-hidden="true" style={{ position: "absolute", right: -60, top: -80, width: 220, height: 220, borderRadius: "50%", background: "var(--primary-light)", opacity: .6 }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span className="sq-badge">⚔️ QUEST ARENA</span>
              <span className="sq-badge" style={{ background: closed ? "#fff7ed" : "#ecfdf5", color: closed ? "#9a3412" : "#047857" }}>
                {competition.status === "closed" ? "Closed by organiser" : endedByTime ? "Competition ended" : notStarted ? "Upcoming" : "Open"}
              </span>
              {isCreator && <span className="sq-badge">Organiser view</span>}
            </div>
            <h1 style={{ margin: "16px 0 8px", fontSize: "clamp(28px, 5vw, 42px)", lineHeight: 1.12, fontWeight: 900, overflowWrap: "anywhere" }}>
              {competition.title}
            </h1>
            <p style={{ margin: 0, maxWidth: 720, color: "var(--muted)", lineHeight: 1.7 }}>
              Two teams. Ten questions per participant. Thirty seconds for each question. Every correct answer earns 100 Arena XP.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
              {canPlay && !attemptCompleted && (
                <button type="button" className="sq-button-primary" onClick={() => void startOrResume()} disabled={starting}>
                  {starting ? "Preparing attempt..." : attemptInProgress ? "Resume my attempt →" : "Start my attempt →"}
                </button>
              )}
              {attemptCompleted && (
                <span className="sq-badge" style={{ padding: "10px 14px", background: "#ecfdf5", color: "#047857" }}>
                  ✓ Your attempt is completed
                </span>
              )}
              {notStarted && myParticipant && (
                <span className="sq-badge" style={{ padding: "10px 14px" }}>Your attempt opens when the competition starts</span>
              )}
              {!myParticipant && !isCreator && (
                <Link href={`/quest-arena/join?code=${encodeURIComponent(competition.invite_code)}`} className="sq-button-primary">
                  Join this competition
                </Link>
              )}
              {myAttempt && (
                <span className="sq-badge" style={{ padding: "10px 14px" }}>
                  {asNumber(myAttempt.total_xp)} Arena XP earned
                </span>
              )}
            </div>
          </div>
        </section>

        {error && <div role="alert" style={{ ...errorStyle, marginTop: 18 }}>{error}</div>}

        {isCreator && (
          <section className="sq-card" style={{ marginTop: 20, padding: "clamp(20px, 3vw, 28px)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <span className="sq-badge">YOUR INVITATION</span>
                <h2 style={{ margin: "12px 0 6px", fontSize: 22, fontWeight: 900 }}>Invite participants</h2>
                <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>Share this link with Sahaba Quest users.</p>
              </div>
              <button type="button" className="sq-button-primary" onClick={() => void copyInvite()}>
                {copied ? "Copied!" : "Copy invitation link"}
              </button>
            </div>
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10 }}>
              <input readOnly value={inviteUrl} aria-label="Competition invitation link" style={inputStyle} onFocus={(event) => event.currentTarget.select()} />
              <button type="button" className="sq-button-secondary" onClick={() => void navigator.clipboard.writeText(competition.invite_code)}>
                Copy code
              </button>
            </div>
            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
              Invitation code: <strong style={{ letterSpacing: 1.5, color: "var(--foreground)" }}>{competition.invite_code}</strong>
            </div>
          </section>
        )}

        <section className="sq-card" style={{ marginTop: 20, padding: "clamp(20px, 3vw, 28px)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <span className="sq-badge">COMPETITION SCHEDULE</span>
              <h2 style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 900 }}>Important dates</h2>
            </div>
            <span className="sq-badge">{competition.status}</span>
          </div>
          <div className="arena-date-grid" style={{ marginTop: 20 }}>
            <DateCard label="Registration closes" value={formatDate(competition.registration_closes_at)} />
            <DateCard label="Competition starts" value={formatDate(competition.starts_at)} />
            <DateCard label="Competition ends" value={formatDate(competition.ends_at)} />
          </div>
        </section>

        <section className="sq-card" style={{ marginTop: 20, padding: "clamp(20px, 3vw, 28px)" }}>
          <span className="sq-badge">THE TWO TEAMS</span>
          <h2 style={{ margin: "12px 0 6px", fontSize: 22, fontWeight: 900 }}>Team registration</h2>
          <div className="arena-team-grid" style={{ marginTop: 18 }}>
            {teamCounts.map((team) => (
              <div key={team.id} style={{ padding: 22, border: "1px solid var(--border)", borderRadius: 18, background: "#fff" }}>
                <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 800 }}>TEAM {team.team_slot}</div>
                <div style={{ marginTop: 9, fontSize: 23, fontWeight: 900, overflowWrap: "anywhere" }}>{team.team_name}</div>
                <div style={{ marginTop: 10, fontSize: 14, color: "var(--muted)" }}>
                  <strong style={{ color: "var(--foreground)", fontSize: 20 }}>{team.count}</strong> registered
                </div>
              </div>
            ))}
          </div>
          <div className="arena-summary-grid" style={{ marginTop: 16 }}>
            <SummaryCard label="Registered participants" value={participantCount} />
            <SummaryCard label="Completed attempts" value={isCreator ? completedCount : leaderboard.length} />
            <SummaryCard label="Your team" value={myParticipant ? teams.find((team) => team.id === myParticipant.team_id)?.team_name || "Joined" : "Not joined"} />
          </div>
        </section>

        {isCreator && (
          <section className="sq-card" style={{ marginTop: 20, padding: "clamp(20px, 3vw, 28px)" }}>
            <span className="sq-badge">ORGANISER CONTROL PANEL</span>
            <h2 style={{ margin: "12px 0 6px", fontSize: 22, fontWeight: 900 }}>Competition overview</h2>
            <div className="arena-summary-grid" style={{ marginTop: 18 }}>
              <SummaryCard label="Completed attempts" value={completedCount} />
              <SummaryCard label="Team 1 average XP" value={asNumber(overviewValue(["out_team_1_average_xp", "team_1_average_xp", "team_1_avg_xp"], 0))} />
              <SummaryCard label="Team 2 average XP" value={asNumber(overviewValue(["out_team_2_average_xp", "team_2_average_xp", "team_2_avg_xp"], 0))} />
            </div>
            <div style={{ marginTop: 18, padding: 18, borderRadius: 14, background: "#f0fdfa", border: "1px solid #ccfbf1" }}>
              <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 800, letterSpacing: ".05em" }}>CURRENT RESULT</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900 }}>
                {competitionResult === "team_1"
                  ? teams.find((team) => team.team_slot === 1)?.team_name || "Team 1"
                  : competitionResult === "team_2"
                    ? teams.find((team) => team.team_slot === 2)?.team_name || "Team 2"
                    : competitionResult === "draw"
                      ? "It's a draw"
                      : "Result pending"}
              </div>
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 }}>
                Team winner is based on average XP per completed participant. Incomplete attempts are excluded.
              </p>
            </div>
          </section>
        )}

        <section className="sq-card" style={{ marginTop: 20, padding: "clamp(20px, 3vw, 28px)" }}>
          <span className="sq-badge">PARTICIPANTS</span>
          <h2 style={{ margin: "12px 0 6px", fontSize: 22, fontWeight: 900 }}>
            {isCreator ? "Registered participants" : "Your competition"}
          </h2>
          {isCreator ? (
            participants.length ? (
              <div style={{ overflowX: "auto", marginTop: 16 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Participant</th>
                      <th style={thStyle}>Team</th>
                      <th style={thStyle}>Attempt</th>
                      <th style={thStyle}>Answered</th>
                      <th style={thStyle}>Correct</th>
                      <th style={thStyle}>Arena XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {participants.map((participant) => (
                      <tr key={participant.id}>
                        <td style={tdStyle}>
                          <div style={{ fontWeight: 800 }}>{participant.display_name || participant.username || "Player"}</div>
                          {participant.username && <div style={{ color: "var(--muted)", fontSize: 12 }}>@{participant.username}</div>}
                          {participant.is_creator && <span className="sq-badge" style={{ marginTop: 5 }}>Organiser</span>}
                        </td>
                        <td style={tdStyle}>{participant.team_name || teams.find((team) => team.id === participant.team_id)?.team_name || "—"}</td>
                        <td style={tdStyle}>{participant.attempt_status || "Not started"}</td>
                        <td style={tdStyle}>{participant.questions_answered ?? 0}/10</td>
                        <td style={tdStyle}>{participant.correct_answers ?? 0}</td>
                        <td style={{ ...tdStyle, fontWeight: 900 }}>{participant.total_xp ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyText text="No participants have registered yet. Share your invitation link to bring players into the competition." />
            )
          ) : (
            <div style={{ marginTop: 14 }}>
              {myParticipant ? (
                <div style={noticeStyle}>
                  You are registered with <strong>{teams.find((team) => team.id === myParticipant.team_id)?.team_name || "your selected team"}</strong>.
                  Your team selection is locked for this competition.
                </div>
              ) : (
                <div style={noticeStyle}>
                  You have not joined this competition yet. Use the invitation link or code to register before registration closes.
                </div>
              )}
            </div>
          )}
        </section>

        <section className="sq-card" style={{ marginTop: 20, padding: "clamp(20px, 3vw, 28px)" }}>
          <span className="sq-badge">INDIVIDUAL LEADERBOARD</span>
          <h2 style={{ margin: "12px 0 6px", fontSize: 22, fontWeight: 900 }}>Top completed attempts</h2>
          <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
            Only completed attempts appear here. Ranking is based on Arena XP.
          </p>
          {leaderboard.length ? (
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Rank</th>
                    <th style={thStyle}>Player</th>
                    <th style={thStyle}>Team</th>
                    <th style={thStyle}>Correct</th>
                    <th style={thStyle}>Arena XP</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, index) => (
                    <tr key={`${entry.username}-${index}`}>
                      <td style={tdStyle}>#{entry.rank}</td>
                      <td style={{ ...tdStyle, fontWeight: 800 }}>{entry.display_name || (entry.username ? `@${entry.username}` : "Player")}</td>
                      <td style={tdStyle}>{entry.team_name || "—"}</td>
                      <td style={tdStyle}>{entry.correct_answers}</td>
                      <td style={{ ...tdStyle, fontWeight: 900 }}>{entry.total_xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyText text="The leaderboard will appear when participants complete their attempts." />
          )}
        </section>

        <div style={{ marginTop: 22, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/quest-arena" className="sq-button-secondary">Quest Arena home</Link>
          {isCreator && <Link href="/quest-arena/create" className="sq-button-secondary">Create another competition</Link>}
        </div>
      </div>

      <style jsx>{`
        .arena-date-grid, .arena-team-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .arena-team-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .arena-summary-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        @media (max-width: 760px) {
          .arena-date-grid, .arena-summary-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .arena-team-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

function DateCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={smallCardStyle}>
      <div style={smallLabelStyle}>{label}</div>
      <div style={{ fontWeight: 850, fontSize: 14, lineHeight: 1.5 }}>{value}</div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={smallCardStyle}>
      <div style={smallLabelStyle}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 23 }}>{value}</div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p style={{ margin: "18px 0 0", color: "var(--muted)", lineHeight: 1.65 }}>{text}</p>;
}

const smallCardStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid var(--border)",
  borderRadius: 14,
  background: "#fff",
  minWidth: 0,
};

const smallLabelStyle: React.CSSProperties = {
  color: "var(--muted)",
  fontSize: 12,
  fontWeight: 750,
  marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 0,
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "#fff",
  color: "var(--foreground)",
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  lineHeight: 1.6,
};

const noticeStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e40af",
  lineHeight: 1.6,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 650,
  textAlign: "left",
};

const thStyle: React.CSSProperties = {
  padding: "12px 14px",
  fontSize: 12,
  color: "var(--muted)",
  background: "#f8fafc",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "13px 14px",
  fontSize: 13,
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

