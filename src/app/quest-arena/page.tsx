"use client";



import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { AppNavbar } from "../../components/ui";

import { supabase } from "../../lib/supabase";



type AccountType = "free" | "individual" | "family";



type Competition = {

  id: string;

  creator_id: string;

  title: string;

  invite_code: string;

  status: string;

  starts_at: string;

  ends_at: string;

  registration_closes_at: string;

  created_at: string;

};



type Team = {

  id: string;

  competition_id: string;

  team_slot: number;

  team_name: string;

};



type Participant = {

  id: string;

  competition_id: string;

  user_id: string;

  team_id: string;

  is_creator: boolean;

};



type Attempt = {

  id: string;

  competition_id: string;

  user_id: string;

  status: string;

  questions_answered: number;

  total_xp: number;

};



type CompetitionCardData = {

  competition: Competition;

  teams: Team[];

  myParticipant: Participant | null;

  myAttempt: Attempt | null;

  isCreator: boolean;

};



function formatDate(value: string) {

  const formatted = new Intl.DateTimeFormat("en-GB", {

    day: "2-digit",

    month: "short",

    year: "numeric",

    hour: "numeric",

    minute: "2-digit",

    hour12: true,

    timeZone: "Africa/Lagos",

  }).format(new Date(value));



  return formatted.replace(/\b(am|pm)\b/i, (period) => period.toUpperCase());

}



function getCompetitionState(competition: Competition, now: number) {
  const start = new Date(competition.starts_at).getTime();
  const end = new Date(competition.ends_at).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return { label: "Closed", tone: "neutral" };
  }

  if (now >= end) return { label: "Closed", tone: "neutral" };
  if (competition.status !== "open") return { label: "Closed", tone: "neutral" };
  if (now < start) return { label: "Upcoming", tone: "blue" };

  return { label: "Live", tone: "green" };
}

function getAttemptLabel(attempt: Attempt | null) {

  if (!attempt) return "Not started";

  if (attempt.status === "completed") return `Completed · ${attempt.total_xp.toLocaleString()} XP`;

  if (attempt.status === "in_progress") return `${attempt.questions_answered}/10 answered`;

  if (attempt.status === "abandoned") return "Attempt closed";

  return attempt.status;

}



export default function QuestArenaPage() {

  const router = useRouter();



  const [loading, setLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [joinCode, setJoinCode] = useState("");

  const [competitions, setCompetitions] = useState<CompetitionCardData[]>([]);

  const [playerName, setPlayerName] = useState("Player");
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [hidingCompetitionId, setHidingCompetitionId] = useState<string | null>(null);



  const loadArena = useCallback(async (showRefresh = false) => {

    if (showRefresh) setRefreshing(true);

    else setLoading(true);



    setErrorMessage("");



    try {

      const {

        data: { user },

        error: authError,

      } = await supabase.auth.getUser();



      if (authError) throw authError;



      if (!user) {

        router.replace("/login");

        return;

      }



      const { data: profile, error: profileError } = await supabase

        .from("profiles")

        .select("account_type, display_name, username")

        .eq("id", user.id)

        .maybeSingle();



      if (profileError) throw profileError;



      const accountType = profile?.account_type as AccountType | undefined;



      if (accountType === "family") {

        router.replace("/family-dashboard");

        return;

      }



      if (accountType !== "free" && accountType !== "individual") {

        setErrorMessage("Your account is not eligible to use Quest Arena.");

        setCompetitions([]);

        return;

      }



      setPlayerName(

        profile?.display_name || profile?.username || "Player"

      );



      // Row-level security limits this query to competitions the

      // signed-in user created or joined.

      const { data: competitionRows, error: competitionError } = await supabase

        .from("quest_arena_competitions")

        .select(

          "id, creator_id, title, invite_code, status, starts_at, ends_at, registration_closes_at, created_at"

        )

        .order("created_at", { ascending: false });



      if (competitionError) throw competitionError;



      const competitionList = (competitionRows || []) as Competition[];

      const { data: hiddenRows, error: hiddenError } = await supabase
        .from("quest_arena_hidden_competitions")
        .select("competition_id")
        .eq("user_id", user.id);

      if (hiddenError) throw hiddenError;

      const hiddenCompetitionIds = new Set(
        (hiddenRows || []).map((row: { competition_id: string }) => row.competition_id)
      );

      const visibleCompetitionList = competitionList.filter(
        (competition) => !hiddenCompetitionIds.has(competition.id)
      );

      if (visibleCompetitionList.length === 0) {
        setCompetitions([]);
        return;
      }

      const competitionIds = visibleCompetitionList.map((item) => item.id);

      const [

        { data: teamRows, error: teamError },

        { data: participantRows, error: participantError },

        { data: attemptRows, error: attemptError },

      ] = await Promise.all([

        supabase

          .from("quest_arena_teams")

          .select("id, competition_id, team_slot, team_name")

          .in("competition_id", competitionIds),

        supabase

          .from("quest_arena_participants")

          .select("id, competition_id, user_id, team_id, is_creator")

          .in("competition_id", competitionIds),

        supabase

          .from("quest_arena_attempts")

          .select("id, competition_id, user_id, status, questions_answered, total_xp")

          .eq("user_id", user.id)

          .in("competition_id", competitionIds),

      ]);



      if (teamError) throw teamError;

      if (participantError) throw participantError;

      if (attemptError) throw attemptError;



      const allTeams = (teamRows || []) as Team[];

      const allParticipants = (participantRows || []) as Participant[];

      const allAttempts = (attemptRows || []) as Attempt[];



      const cards = visibleCompetitionList.map((competition) => ({

        competition,

        teams: allTeams

          .filter((team) => team.competition_id === competition.id)

          .sort((a, b) => a.team_slot - b.team_slot),

        myParticipant:

          allParticipants.find(

            (participant) =>

              participant.competition_id === competition.id &&

              participant.user_id === user.id

          ) || null,

        myAttempt:

          allAttempts.find(

            (attempt) => attempt.competition_id === competition.id

          ) || null,

        isCreator: competition.creator_id === user.id,

      }));



      setCompetitions(cards);

    } catch (error) {

      console.error("Quest Arena loading error:", error);

      setErrorMessage(

        error instanceof Error

          ? error.message

          : "We could not load Quest Arena. Please try again."

      );

    } finally {

      setLoading(false);

      setRefreshing(false);

    }

  }, [router]);



  useEffect(() => {

    void loadArena();

  }, [loadArena]);



  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 15_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activeCompetitions = useMemo(
    () =>
      competitions.filter(
        ({ competition }) => getCompetitionState(competition, currentTime).label !== "Closed"
      ),
    [competitions, currentTime]
  );

  const pastCompetitions = useMemo(
    () =>
      competitions.filter(
        ({ competition }) => getCompetitionState(competition, currentTime).label === "Closed"
      ),
    [competitions, currentTime]
  );

  function submitJoinCode(event: FormEvent<HTMLFormElement>) {

    event.preventDefault();

    const cleanedCode = joinCode.trim().toUpperCase();



    if (!cleanedCode) return;



    router.push(

      `/quest-arena/join?code=${encodeURIComponent(cleanedCode)}`

    );

  }



  async function hideCompetitionFromDashboard(competitionId: string, title: string) {
    const confirmed = window.confirm(
      `Remove "${title}" from your Quest Arena dashboard? This will only hide it for you. Other participants and the organiser will still see it.`
    );
    if (!confirmed) return;

    setHidingCompetitionId(competitionId);
    setErrorMessage("");

    try {
      const { error } = await supabase.rpc("quest_arena_hide_competition", {
        p_competition_id: competitionId,
      });
      if (error) throw error;

      setCompetitions((current) =>
        current.filter((item) => item.competition.id !== competitionId)
      );
    } catch (error) {
      console.error("Quest Arena personal hide error:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not remove this competition from your dashboard. Please try again."
      );
    } finally {
      setHidingCompetitionId(null);
    }
  }

  function renderCompetitionCard(item: CompetitionCardData) {

    const { competition, teams, myParticipant, myAttempt, isCreator } = item;

    const state = getCompetitionState(competition, currentTime);



    const myTeam = myParticipant

      ? teams.find((team) => team.id === myParticipant.team_id)

      : null;



    return (

      <article className="arena-competition-card" key={competition.id}>

        <div className="arena-card-main">

          <div className="arena-card-heading">

            <span className={`arena-status arena-status-${state.tone}`}>

              <span className="arena-status-dot" />

              {state.label}

            </span>

            <span className="arena-created-date">

              Created on: <strong>{formatDate(competition.created_at)}</strong>

            </span>

          </div>



          <div className="arena-card-title">

            <span className="arena-card-kicker">COMPETITION TITLE</span>

            <h3>{competition.title}</h3>

          </div>



          <section className="arena-team-section" aria-label="Competing teams">

            <h4 className="arena-subheading">Competing teams</h4>

            <div className="arena-team-preview">

              {teams.map((team) => (

                <div className={`arena-team-chip arena-team-chip-${team.team_slot}`} key={team.id}>

                  <span className="arena-team-symbol">

                    {team.team_slot === 1 ? "Ⅰ" : "Ⅱ"}

                  </span>

                  <span className="arena-team-copy">

                    <small>TEAM {team.team_slot}</small>

                    <strong>{team.team_name}</strong>

                  </span>

                </div>

              ))}

            </div>

          </section>



          {isCreator && (

            <div className="arena-invite-strip">

              <div className="arena-invite-copy">

                <span className="arena-detail-label">INVITATION CODE</span>

                <strong>{competition.invite_code}</strong>

              </div>

              <button

                type="button"

                className="arena-copy-link-button"

                onClick={() => {

                  void navigator.clipboard.writeText(

                    `${window.location.origin}/quest-arena/join?code=${competition.invite_code}`

                  );

                }}

              >

                <span aria-hidden="true">↗</span>

                Copy invite link

              </button>

            </div>

          )}

        </div>



        <aside className="arena-card-side">

          <div className="arena-side-block">

            <span className="arena-detail-label">COMPETITION SCHEDULE</span>

            <div className="arena-schedule-row">

              <span className="arena-schedule-marker arena-start-marker" />

              <div>

                <small>Starts:</small>

                <strong>{formatDate(competition.starts_at)}</strong>

              </div>

            </div>

            <div className="arena-schedule-row">

              <span className="arena-schedule-marker arena-end-marker" />

              <div>

                <small>Ends:</small>

                <strong>{formatDate(competition.ends_at)}</strong>

              </div>

            </div>

          </div>



          <div className="arena-side-block arena-player-block">

            <span className="arena-detail-label">{myParticipant ? "YOUR TEAM" : "YOUR ROLE"}</span>

            <strong className="arena-player-team">

              {myParticipant

                ? myTeam?.team_name || "Registered"

                : isCreator ? "Competition organiser" : "Not registered"}

            </strong>

            <span className="arena-attempt-label">

              {getAttemptLabel(myAttempt)}

            </span>

          </div>



          <Link

            className="arena-open-button"

            href={`/quest-arena/competition/${competition.id}`}

          >

            View competition <span aria-hidden="true">→</span>

          </Link>

          {state.label === "Closed" && (
            <button
              type="button"
              className="arena-hide-button"
              onClick={() => void hideCompetitionFromDashboard(competition.id, competition.title)}
              disabled={hidingCompetitionId === competition.id}
            >
              {hidingCompetitionId === competition.id
                ? "Removing..."
                : "Remove from my dashboard"}
            </button>
          )}

        </aside>

      </article>

    );

  }



  return (

    <>

      <AppNavbar />



      <main className="sq-page arena-page">

        <div className="sq-container arena-container">

          <section className="arena-hero">

            <div className="arena-hero-content">

              <div className="arena-eyebrow">

                <span>⚔</span> SAHABA QUEST COMPETITION MODE

              </div>

              <h1>Quest Arena</h1>

              <p>

                Bring people together, choose your sides and test your

                knowledge of the Sahaba. Create a competition or join one

                using an invitation code.

              </p>



              <div className="arena-hero-actions">

                <Link href="/quest-arena/create" className="arena-create-action">

                  <span className="arena-create-action-icon" aria-hidden="true">＋</span>

                  <span className="arena-create-action-copy">

                    <strong>Create a competition</strong>

                    <small>Set up your teams and invite participants</small>

                  </span>

                  <span className="arena-create-action-arrow" aria-hidden="true">→</span>

                </Link>

              </div>

            </div>



            <div className="arena-hero-art" aria-hidden="true">

              <div className="arena-emblem">

                <span className="arena-emblem-top">S Q</span>

                <span className="arena-emblem-swords">⚔</span>

                <span className="arena-emblem-bottom">QUEST ARENA</span>

              </div>

              <div className="arena-orbit arena-orbit-one" />

              <div className="arena-orbit arena-orbit-two" />

              <span className="arena-spark arena-spark-one">✦</span>

              <span className="arena-spark arena-spark-two">✧</span>

            </div>

          </section>



          <section className="arena-welcome-row">

            <div>

              <p className="arena-section-kicker">YOUR ARENA</p>

              <h2>Welcome back, {playerName}</h2>

              <p className="arena-muted">

                Your competitions and team battles are all in one place.

              </p>

            </div>

            <button

              type="button"

              className="arena-refresh-button"

              onClick={() => void loadArena(true)}

              disabled={refreshing || loading}

            >

              <span aria-hidden="true">↻</span>

              {refreshing ? "Refreshing..." : "Refresh"}

            </button>

          </section>



          <section className="arena-how-grid" aria-label="How Quest Arena works">

            <div className="arena-how-card">

              <span className="arena-how-icon">⚔</span>

              <div>

                <strong>Two teams</strong>

                <p>Every competition has two teams with names chosen by its organiser.</p>

              </div>

            </div>

            <div className="arena-how-card">

              <span className="arena-how-icon">10</span>

              <div>

                <strong>10 questions</strong>

                <p>Each participant gets one attempt with 30 seconds per question.</p>

              </div>

            </div>

            <div className="arena-how-card">

              <span className="arena-how-icon">★</span>

              <div>

                <strong>Team average wins</strong>

                <p>The winning team is decided by average XP among completed attempts.</p>

              </div>

            </div>

          </section>



          <section className="arena-join-panel" id="join-arena">

            <div>

              <p className="arena-section-kicker">GOT AN INVITATION?</p>

              <h2>Join a competition</h2>

              <p>Enter the invitation code shared by the competition organiser.</p>

            </div>

            <form className="arena-join-form" onSubmit={submitJoinCode}>

              <label className="sr-only" htmlFor="arena-invite-code">

                Invitation code

              </label>

              <input

                id="arena-invite-code"

                type="text"

                value={joinCode}

                onChange={(event) => setJoinCode(event.target.value.toUpperCase())}

                placeholder="Enter invitation code"

                maxLength={32}

                autoComplete="off"

              />

              <button type="submit" disabled={!joinCode.trim()}>

                Continue <span aria-hidden="true">→</span>

              </button>

            </form>

          </section>



          {errorMessage && (

            <div className="arena-alert" role="alert">

              <strong>Unable to load Quest Arena</strong>

              <span>{errorMessage}</span>

              <button type="button" onClick={() => void loadArena()}>

                Try again

              </button>

            </div>

          )}



          {loading ? (

            <div className="arena-loading-card">

              <span className="arena-spinner" />

              <strong>Loading your competitions...</strong>

              <p>Please wait while we get your Arena ready.</p>

            </div>

          ) : (

            <>

              <section className="arena-list-section">

                <div className="arena-list-heading">

                  <div>

                    <p className="arena-section-kicker">IN PROGRESS & UPCOMING</p>

                    <h2>Your competitions</h2>

                  </div>

                  <span className="arena-count">{activeCompetitions.length}</span>

                </div>



                {activeCompetitions.length > 0 ? (

                  <div className="arena-competition-grid">

                    {activeCompetitions.map(renderCompetitionCard)}

                  </div>

                ) : (

                  <div className="arena-empty-state">

                    <span className="arena-empty-icon">⚔</span>

                    <h3>Your Arena is waiting</h3>

                    <p>

                      You have not created or joined any open competitions yet.

                      Start one or use an invitation code to join a team.

                    </p>

                    <Link href="/quest-arena/create" className="arena-primary-button">

                      Create your first competition

                    </Link>

                  </div>

                )}

              </section>



              {pastCompetitions.length > 0 && (

                <section className="arena-list-section arena-past-section">

                  <div className="arena-list-heading">

                    <div>

                      <p className="arena-section-kicker">YOUR RECORD</p>

                      <h2>Past competitions</h2>

                    </div>

                    <span className="arena-count">{pastCompetitions.length}</span>

                  </div>

                  <div className="arena-competition-grid">

                    {pastCompetitions.map(renderCompetitionCard)}

                  </div>

                </section>

              )}

            </>

          )}



          <section className="arena-rules-note">

            <span className="arena-rules-icon">ⓘ</span>

            <p>

              <strong>Fair play:</strong> One attempt per participant. Each

              question has a 30-second server-controlled timer. Correct answers

              earn 100 Arena XP; incorrect or timed-out answers earn 0 XP.

              Arena XP is separate from your normal Sahaba Quest progress.

            </p>

          </section>

        </div>

      </main>



      <style jsx global>{`

        .arena-page {

          min-height: 100vh;

          padding-top: 34px;

          padding-bottom: 70px;

          background: var(--background, #f6f9f8);

        }



        .arena-container {

          max-width: 1180px;

        }



        .arena-hero {

          position: relative;

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 28px;

          min-height: 300px;

          overflow: hidden;

          padding: 42px 48px;

          border-radius: 26px;

          color: #ffffff;

          background:

            radial-gradient(circle at 82% 18%, rgba(255,255,255,.13), transparent 24%),

            linear-gradient(120deg, #073f3b 0%, #08766d 58%, #0b8b7e 100%);

          box-shadow: 0 18px 44px rgba(6, 63, 59, .16);

        }



        .arena-hero-content {

          position: relative;

          z-index: 2;

          max-width: 650px;

        }



        .arena-eyebrow {

          display: inline-flex;

          align-items: center;

          gap: 9px;

          margin-bottom: 16px;

          color: #d9f2eb;

          font-size: 11px;

          font-weight: 900;

          letter-spacing: 1.5px;

        }



        .arena-eyebrow span {

          display: grid;

          width: 28px;

          height: 28px;

          place-items: center;

          border: 1px solid rgba(255,255,255,.3);

          border-radius: 9px;

          font-size: 17px;

        }



        .arena-hero h1 {

          margin: 0;

          color: #ffffff;

          font-size: clamp(36px, 5vw, 54px);

          line-height: 1.05;

          font-weight: 950;

          letter-spacing: -1.8px;

        }



        .arena-hero-content > p {

          max-width: 580px;

          margin: 16px 0 24px;

          color: rgba(255,255,255,.84);

          font-size: 15px;

          line-height: 1.75;

        }



        .arena-hero-actions {

          display: flex;

          flex-wrap: wrap;

          gap: 11px;

        }



        .arena-primary-button,

        .arena-secondary-button,

        .arena-open-button {

          min-height: 46px;

          display: inline-flex;

          align-items: center;

          justify-content: center;

          gap: 9px;

          padding: 0 19px;

          border-radius: 12px;

          text-decoration: none;

          font-size: 13px;

          font-weight: 850;

          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;

        }



        .arena-primary-button {

          color: #07534d;

          background: #ffffff;

          box-shadow: 0 6px 16px rgba(0,0,0,.12);

        }



        .arena-primary-button:hover,

        .arena-secondary-button:hover,

        .arena-open-button:hover {

          transform: translateY(-2px);

        }

        .arena-hide-button {
          display: inline-flex;
          width: 100%;
          min-height: 38px;
          align-items: center;
          justify-content: center;
          margin-top: 9px;
          padding: 0 12px;
          border: 1px solid #e5c9c5;
          border-radius: 10px;
          color: #98483f;
          background: #fff8f7;
          font-size: 11px;
          font-weight: 850;
          cursor: pointer;
          transition: background .18s ease, border-color .18s ease;
        }
        .arena-hide-button:hover:not(:disabled) {
          border-color: #d9aaa4;
          background: #fff0ee;
        }
        .arena-hide-button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }



        .arena-secondary-button {

          color: #ffffff;

          border: 1px solid rgba(255,255,255,.45);

          background: rgba(255,255,255,.08);

        }



        .arena-hero-art {

          position: relative;

          display: grid;

          flex: 0 0 280px;

          width: 280px;

          height: 230px;

          place-items: center;

        }



        .arena-emblem {

          position: relative;

          z-index: 2;

          display: flex;

          width: 164px;

          height: 164px;

          flex-direction: column;

          align-items: center;

          justify-content: center;

          border: 1px solid rgba(255,255,255,.52);

          border-radius: 50%;

          background: rgba(3, 54, 50, .42);

          box-shadow: 0 0 0 10px rgba(255,255,255,.06), 0 0 44px rgba(255,255,255,.12);

        }



        .arena-emblem-top {

          color: #e9d59a;

          font-size: 13px;

          font-weight: 950;

          letter-spacing: 4px;

        }



        .arena-emblem-swords {

          margin: 4px 0;

          color: #f2d58a;

          font-size: 56px;

          line-height: 1;

        }



        .arena-emblem-bottom {

          color: #e9f5f2;

          font-size: 8px;

          font-weight: 900;

          letter-spacing: 2px;

        }



        .arena-orbit {

          position: absolute;

          width: 235px;

          height: 235px;

          border: 1px solid rgba(255,255,255,.22);

          border-radius: 50%;

        }



        .arena-orbit-two {

          width: 270px;

          height: 190px;

          transform: rotate(-35deg);

          border-color: rgba(233,213,154,.28);

        }



        .arena-spark {

          position: absolute;

          color: #f2d58a;

          font-size: 26px;

        }



        .arena-spark-one { top: 12px; right: 30px; }

        .arena-spark-two { bottom: 20px; left: 26px; }



        .arena-welcome-row,

        .arena-list-heading {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 16px;

        }



        .arena-welcome-row {

          margin: 36px 0 18px;

        }



        .arena-section-kicker {

          margin: 0 0 7px;

          color: #08766d;

          font-size: 10px;

          font-weight: 950;

          letter-spacing: 1.35px;

        }



        .arena-welcome-row h2,

        .arena-join-panel h2,

        .arena-list-heading h2 {

          margin: 0;

          color: var(--foreground, #173b38);

          font-size: 23px;

          font-weight: 900;

          letter-spacing: -.55px;

        }



        .arena-muted {

          margin: 7px 0 0;

          color: var(--muted, #647875);

          font-size: 13px;

        }



        .arena-refresh-button {

          display: inline-flex;

          align-items: center;

          gap: 8px;

          min-height: 40px;

          padding: 0 14px;

          border: 1px solid var(--border, #dce8e5);

          border-radius: 10px;

          color: var(--foreground, #173b38);

          background: #ffffff;

          font-size: 12px;

          font-weight: 800;

          cursor: pointer;

        }



        .arena-refresh-button:disabled {

          opacity: .55;

          cursor: not-allowed;

        }



        .arena-how-grid {

          display: grid;

          grid-template-columns: repeat(3, minmax(0, 1fr));

          gap: 14px;

          margin: 18px 0 22px;

        }



        .arena-how-card {

          display: flex;

          align-items: flex-start;

          gap: 13px;

          min-width: 0;

          padding: 18px;

          border: 1px solid var(--border, #dce8e5);

          border-radius: 16px;

          background: #ffffff;

        }



        .arena-how-icon {

          display: grid;

          flex: 0 0 42px;

          width: 42px;

          height: 42px;

          place-items: center;

          border-radius: 12px;

          color: #08766d;

          background: #e8f5f2;

          font-size: 18px;

          font-weight: 950;

        }



        .arena-how-card strong {

          display: block;

          margin: 1px 0 5px;

          color: var(--foreground, #173b38);

          font-size: 13px;

          font-weight: 900;

        }



        .arena-how-card p {

          margin: 0;

          color: var(--muted, #647875);

          font-size: 11px;

          line-height: 1.6;

        }



        .arena-join-panel {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 24px;

          margin: 22px 0 38px;

          padding: 23px 25px;

          border: 1px solid #d7e9e5;

          border-radius: 18px;

          background: linear-gradient(110deg, #edf8f5, #ffffff);

        }



        .arena-join-panel h2 {

          font-size: 19px;

        }



        .arena-join-panel p:last-child {

          margin: 6px 0 0;

          color: var(--muted, #647875);

          font-size: 12px;

        }



        .arena-join-form {

          display: flex;

          flex: 0 1 430px;

          gap: 9px;

        }



        .arena-join-form input {

          flex: 1;

          min-width: 0;

          height: 46px;

          padding: 0 14px;

          border: 1px solid #d2e1de;

          border-radius: 11px;

          outline: none;

          color: #173b38;

          background: #ffffff;

          font-size: 13px;

          font-weight: 750;

          letter-spacing: 1px;

        }



        .arena-join-form input:focus {

          border-color: #08766d;

          box-shadow: 0 0 0 3px rgba(8,118,109,.1);

        }



        .arena-join-form button {

          min-width: 112px;

          height: 46px;

          padding: 0 14px;

          border: 0;

          border-radius: 11px;

          color: #ffffff;

          background: #08766d;

          font-size: 12px;

          font-weight: 850;

          cursor: pointer;

        }



        .arena-join-form button:disabled {

          opacity: .45;

          cursor: not-allowed;

        }



        .arena-list-section {

          margin-top: 32px;

        }



        .arena-list-heading {

          margin-bottom: 16px;

        }



        .arena-list-heading h2 {

          font-size: 21px;

        }



        .arena-count {

          display: grid;

          min-width: 34px;

          height: 34px;

          padding: 0 9px;

          place-items: center;

          border-radius: 10px;

          color: #08766d;

          background: #e5f3f0;

          font-size: 12px;

          font-weight: 900;

        }



        .arena-hero-action {

          display: inline-flex;

          min-height: 48px;

          min-width: 190px;

          align-items: center;

          justify-content: center;

          gap: 11px;

          padding: 0 17px;

          border-radius: 12px;

          text-decoration: none;

          font-size: 13px;

          font-weight: 850;

          box-sizing: border-box;

          transition: transform .18s ease, box-shadow .18s ease, background .18s ease;

        }



        .arena-hero-action:hover {

          transform: translateY(-2px);

          box-shadow: 0 9px 22px rgba(5, 35, 43, .18);

        }



        .arena-hero-actions .arena-primary-button.arena-hero-action {

          color: #ffffff;

          background: linear-gradient(135deg, #087f78, #075e68);

          border: 1px solid rgba(255,255,255,.18);

          box-shadow: 0 7px 18px rgba(3, 52, 59, .2);

        }



        .arena-hero-actions .arena-secondary-button.arena-hero-action {

          color: #ffffff;

          background: rgba(255,255,255,.10);

          border: 1px solid rgba(255,255,255,.42);

          backdrop-filter: blur(8px);

        }



        .arena-action-icon {

          display: grid;

          width: 25px;

          height: 25px;

          flex: 0 0 25px;

          place-items: center;

          border-radius: 8px;

          background: rgba(255,255,255,.16);

          font-size: 17px;

          line-height: 1;

        }



        .arena-action-arrow {

          margin-left: auto;

          opacity: .8;

          font-size: 16px;

        }



        .arena-competition-grid {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 16px;

        }



        .arena-competition-card {

          min-width: 0;

          padding: 21px;

          border: 1px solid #dce9e7;

          border-radius: 18px;

          background: linear-gradient(180deg, #ffffff 0%, #fbfdfd 100%);

          box-shadow: 0 8px 24px rgba(10, 60, 55, .065);

          overflow: hidden;

          transition: transform .18s ease, box-shadow .18s ease;

        }



        .arena-competition-card:hover {

          transform: translateY(-2px);

          box-shadow: 0 13px 30px rgba(10, 60, 55, .10);

        }



        .arena-card-topline {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 10px;

        }



        .arena-status {

          display: inline-flex;

          align-items: center;

          gap: 7px;

          padding: 6px 9px;

          border-radius: 20px;

          font-size: 10px;

          font-weight: 900;

        }



        .arena-status-dot {

          width: 7px;

          height: 7px;

          border-radius: 50%;

          background: currentColor;

        }



        .arena-status-green { color: #087b52; background: #e6f7ef; }

        .arena-status-blue { color: #2863a6; background: #eaf2ff; }

        .arena-status-amber { color: #95640c; background: #fff5dc; }

        .arena-status-neutral { color: #647875; background: #edf1f0; }



        .arena-created-date {

          display: inline-flex;

          align-items: center;

          justify-content: flex-end;

          flex-wrap: wrap;

          gap: 4px;

          color: #758783;

          font-size: 10px;

          text-align: right;

        }



        .arena-created-date strong {

          color: #526a65;

          font-weight: 800;

        }



        .arena-card-title {

          margin: 17px 0 15px;

          padding: 0 0 14px;

          border-bottom: 1px solid #edf2f1;

        }



        .arena-card-kicker {

          margin: 0 0 7px;

          color: #81938f;

          font-size: 9px;

          font-weight: 900;

          letter-spacing: .14em;

        }



        .arena-competition-card h3 {

          margin: 0;

          color: var(--foreground, #173b38);

          font-size: 19px;

          line-height: 1.35;

          font-weight: 900;

          overflow-wrap: anywhere;

        }



        .arena-team-section {

          margin: 0 0 15px;

        }



        .arena-team-preview {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 9px;

        }



        .arena-team-chip {

          display: flex;

          align-items: center;

          gap: 9px;

          min-width: 0;

          min-height: 54px;

          padding: 10px;

          border: 1px solid #e5eeec;

          border-radius: 12px;

          color: #31534f;

          background: #f5f9f8;

          font-size: 11px;

          font-weight: 800;

          overflow-wrap: anywhere;

        }



        .arena-team-chip-2 {

          background: #f7f7fb;

          border-color: #e9e8f1;

        }



        .arena-team-name {

          min-width: 0;

          line-height: 1.35;

        }



        .arena-team-symbol {

          display: grid;

          flex: 0 0 24px;

          width: 24px;

          height: 24px;

          place-items: center;

          border-radius: 7px;

          color: #08766d;

          background: #dcefeb;

          font-size: 11px;

          font-weight: 950;

        }



        .arena-card-details {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 9px;

          margin: 16px 0;

          padding-bottom: 15px;

          border-bottom: 1px solid #edf1f0;

        }



        .arena-date-box {

          min-width: 0;

          padding: 11px 12px;

          border: 1px solid #e8efed;

          border-radius: 11px;

          background: #f8fbfa;

        }



        .arena-date-box strong {

          color: #294b46;

          font-size: 11px;

          line-height: 1.45;

          overflow-wrap: anywhere;

        }



        .arena-card-details > div,

        .arena-your-status {

          display: flex;

          flex-direction: column;

          gap: 5px;

          min-width: 0;

        }



        .arena-detail-label {

          color: var(--muted, #71827f);

          font-size: 10px;

          font-weight: 750;

        }



        .arena-card-details strong,

        .arena-your-status strong {

          color: #254541;

          font-size: 11px;

          font-weight: 850;

          overflow-wrap: anywhere;

        }



        .arena-card-footer {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 12px;

        }



        .arena-attempt-label {

          color: var(--muted, #71827f);

          font-size: 10px;

        }



        .arena-open-button {

          min-height: 39px;

          flex-shrink: 0;

          padding: 0 12px;

          color: #ffffff;

          background: #08766d;

          font-size: 11px;

        }



        .arena-invite-strip {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 10px;

          margin-top: 16px;

          padding: 10px 12px;

          border-radius: 10px;

          color: #536d69;

          background: #f6f9f8;

          font-size: 10px;

        }



        .arena-invite-strip strong {

          margin-left: 5px;

          color: #174d47;

          letter-spacing: 1px;

        }



        .arena-invite-strip button {

          padding: 5px 8px;

          border: 1px solid #d7e5e1;

          border-radius: 7px;

          color: #08766d;

          background: #ffffff;

          font-size: 10px;

          font-weight: 850;

          cursor: pointer;

        }



        .arena-empty-state,

        .arena-loading-card {

          display: flex;

          flex-direction: column;

          align-items: center;

          padding: 42px 20px;

          border: 1px dashed #cbded9;

          border-radius: 18px;

          background: rgba(255,255,255,.75);

          text-align: center;

        }



        .arena-empty-icon {

          display: grid;

          width: 58px;

          height: 58px;

          margin-bottom: 14px;

          place-items: center;

          border-radius: 18px;

          color: #08766d;

          background: #e7f4f1;

          font-size: 27px;

        }



        .arena-empty-state h3,

        .arena-loading-card strong {

          margin: 0;

          color: #244541;

          font-size: 16px;

          font-weight: 900;

        }



        .arena-empty-state p,

        .arena-loading-card p {

          max-width: 440px;

          margin: 8px 0 18px;

          color: var(--muted, #71827f);

          font-size: 12px;

          line-height: 1.7;

        }



        .arena-empty-state .arena-primary-button {

          color: #ffffff;

          background: #08766d;

        }



        .arena-spinner {

          width: 28px;

          height: 28px;

          margin-bottom: 13px;

          border: 3px solid #dcebe7;

          border-top-color: #08766d;

          border-radius: 50%;

          animation: arena-spin .8s linear infinite;

        }



        @keyframes arena-spin {

          to { transform: rotate(360deg); }

        }



        .arena-alert {

          display: flex;

          flex-direction: column;

          gap: 7px;

          margin: 18px 0;

          padding: 15px 17px;

          border: 1px solid #f0d5d2;

          border-radius: 12px;

          color: #8d3028;

          background: #fff6f5;

          font-size: 12px;

        }



        .arena-alert button {

          align-self: flex-start;

          margin-top: 4px;

          padding: 7px 10px;

          border: 1px solid #e8c3bf;

          border-radius: 8px;

          color: #8d3028;

          background: #ffffff;

          font-size: 11px;

          font-weight: 850;

          cursor: pointer;

        }



        .arena-past-section {

          margin-top: 42px;

        }



        .arena-rules-note {

          display: flex;

          align-items: flex-start;

          gap: 11px;

          margin-top: 34px;

          padding: 15px 17px;

          border: 1px solid #dce9e6;

          border-radius: 13px;

          background: #f0f7f5;

        }



        .arena-rules-icon {

          color: #08766d;

          font-size: 17px;

          font-weight: 900;

        }



        .arena-rules-note p {

          margin: 0;

          color: #536d69;

          font-size: 11px;

          line-height: 1.7;

        }



        .arena-rules-note strong {

          color: #244541;

        }



        .sr-only {

          position: absolute;

          width: 1px;

          height: 1px;

          padding: 0;

          margin: -1px;

          overflow: hidden;

          clip: rect(0,0,0,0);

          white-space: nowrap;

          border: 0;

        }



        .arena-card-footer {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 14px;

          padding-top: 2px;

        }



        .arena-your-status {

          padding: 2px 0;

        }



        .arena-your-status > strong {

          color: #244b45;

          font-size: 13px;

          overflow-wrap: anywhere;

        }



        .arena-attempt-label {

          color: #71847f;

          font-size: 10px;

          line-height: 1.4;

        }



        .arena-open-button {

          display: inline-flex;

          min-height: 40px;

          align-items: center;

          justify-content: center;

          gap: 8px;

          padding: 0 13px;

          border-radius: 10px;

          color: #ffffff;

          background: #08766d;

          text-decoration: none;

          font-size: 11px;

          font-weight: 850;

          white-space: nowrap;

        }



        .arena-invite-strip {

          display: flex;

          align-items: center;

          justify-content: space-between;

          gap: 12px;

          margin-top: 17px;

          padding: 12px;

          border: 1px dashed #cbded9;

          border-radius: 12px;

          background: #f4f9f7;

        }



        .arena-invite-copy {

          display: flex;

          min-width: 0;

          flex-direction: column;

          gap: 4px;

        }



        .arena-invite-copy strong {

          color: #174f49;

          font-size: 12px;

          letter-spacing: .06em;

          overflow-wrap: anywhere;

        }



        .arena-invite-strip button {

          flex: 0 0 auto;

          min-height: 34px;

          padding: 0 11px;

          border: 1px solid #c7ddd7;

          border-radius: 9px;

          color: #17665e;

          background: #ffffff;

          font-size: 10px;

          font-weight: 850;

          cursor: pointer;

        }



        @media (max-width: 900px) {

          .arena-hero { padding: 34px 30px; }

          .arena-hero-art { flex-basis: 220px; transform: scale(.88); }

          .arena-how-grid { grid-template-columns: 1fr; }

        }



        @media (max-width: 680px) {

          .arena-page { padding-top: 22px; }

          .arena-hero {

            min-height: 0;

            padding: 29px 22px;

            border-radius: 20px;

          }

          .arena-hero-art { display: none; }

          .arena-hero h1 { font-size: 38px; }

          .arena-hero-content > p { font-size: 13px; }

          .arena-welcome-row { align-items: flex-start; }

          .arena-welcome-row h2 { font-size: 20px; }

          .arena-join-panel {

            align-items: stretch;

            flex-direction: column;

            padding: 19px;

          }

          .arena-join-form { flex: auto; width: 100%; }

          .arena-competition-grid { grid-template-columns: 1fr; }

          .arena-card-footer { align-items: flex-start; }

          .arena-open-button { white-space: nowrap; }

        }



        @media (max-width: 420px) {

          .arena-hero-actions { flex-direction: column; }

          .arena-hero-actions > * { width: 100%; }

          .arena-hero-action { justify-content: flex-start; }

          .arena-action-arrow { margin-left: auto; }

          .arena-join-form { flex-direction: column; }

          .arena-join-form button { width: 100%; }

          .arena-card-topline { align-items: flex-start; flex-direction: column; }

          .arena-created-date { text-align: left; }

          .arena-card-footer { flex-direction: column; align-items: stretch; }

          .arena-open-button { width: 100%; }

          .arena-invite-strip { align-items: stretch; flex-direction: column; }

          .arena-invite-strip button { width: 100%; }

          .arena-team-preview { grid-template-columns: 1fr; }

        }



        @media (prefers-reduced-motion: reduce) {

          .arena-spinner { animation: none; }

          .arena-primary-button,

          .arena-secondary-button,

          .arena-open-button { transition: none; }

        }

        /* Quest Arena page layout refinements */

        .arena-hero-actions {

          display: flex;

          align-items: flex-start;

          margin-top: 24px;

        }



        .arena-create-action {

          display: flex;

          width: min(100%, 340px);

          min-height: 76px;

          align-items: center;

          gap: 14px;

          padding: 14px 18px;

          border: 1px solid rgba(255,255,255,.65);

          border-radius: 16px;

          color: #07534d !important;

          background: #ffffff;

          box-shadow: 0 10px 28px rgba(0, 28, 32, .20);

          text-decoration: none !important;

          transition: transform .18s ease, box-shadow .18s ease;

          box-sizing: border-box;

        }

        .arena-create-action:hover {

          transform: translateY(-3px);

          box-shadow: 0 15px 32px rgba(0, 28, 32, .26);

        }

        .arena-create-action-icon {

          display: grid;

          width: 42px;

          height: 42px;

          flex: 0 0 42px;

          place-items: center;

          border-radius: 12px;

          color: #ffffff;

          background: linear-gradient(135deg, #087f78, #075b61);

          font-size: 25px;

          font-weight: 500;

        }

        .arena-create-action-copy {

          display: flex;

          min-width: 0;

          flex: 1;

          flex-direction: column;

          gap: 5px;

        }

        .arena-create-action-copy strong {

          color: #124e49;

          font-size: 14px;

          font-weight: 900;

        }

        .arena-create-action-copy small {

          color: #6b817d;

          font-size: 10px;

          line-height: 1.4;

        }

        .arena-create-action-arrow {

          color: #08766d;

          font-size: 20px;

          font-weight: 800;

        }



        .arena-competition-grid {

          display: grid;

          grid-template-columns: minmax(0, 1fr);

          gap: 18px;

        }

        .arena-competition-card {

          display: grid;

          grid-template-columns: minmax(0, 1.65fr) minmax(245px, .85fr);

          min-width: 0;

          overflow: hidden;

          border: 1px solid #d9e6e2;

          border-radius: 20px;

          background: #ffffff;

          box-shadow: 0 9px 28px rgba(17, 62, 55, .075);

        }

        .arena-card-main {

          min-width: 0;

          padding: 24px 26px;

          background: #ffffff;

        }

        .arena-card-heading {

          display: flex;

          align-items: center;

          justify-content: space-between;

          flex-wrap: wrap;

          gap: 10px;

          padding-bottom: 15px;

          border-bottom: 1px solid #edf2f0;

        }

        .arena-created-date {

          display: inline-flex;

          align-items: center;

          flex-wrap: wrap;

          gap: 5px;

          color: #778984;

          font-size: 11px;

        }

        .arena-created-date strong {

          color: #405d56;

          font-weight: 800;

        }

        .arena-card-title {

          margin: 20px 0 22px;

        }

        .arena-card-kicker,

        .arena-detail-label {

          display: block;

          margin: 0 0 8px;

          color: #82938e;

          font-size: 9px;

          font-weight: 900;

          letter-spacing: .13em;

        }

        .arena-card-title h3 {

          margin: 0;

          color: #183f39;

          font-size: clamp(19px, 2vw, 24px);

          line-height: 1.3;

          font-weight: 900;

          overflow-wrap: anywhere;

        }

        .arena-subheading {

          margin: 0 0 12px;

          color: #31534d;

          font-size: 13px;

          font-weight: 900;

        }

        .arena-team-preview {

          display: grid;

          grid-template-columns: repeat(2, minmax(0, 1fr));

          gap: 12px;

        }

        .arena-team-chip {

          display: flex;

          min-width: 0;

          min-height: 76px;

          align-items: center;

          gap: 12px;

          padding: 14px;

          border: 1px solid #dcece7;

          border-radius: 14px;

          color: #24534b;

          background: #eef8f4;

          box-sizing: border-box;

        }

        .arena-team-chip-2 {

          border-color: #e4e1f2;

          color: #4b4776;

          background: #f4f2fb;

        }

        .arena-team-symbol {

          display: grid;

          width: 36px;

          height: 36px;

          flex: 0 0 36px;

          place-items: center;

          border-radius: 11px;

          color: #ffffff;

          background: #17816f;

          font-size: 15px;

          font-weight: 900;

        }

        .arena-team-chip-2 .arena-team-symbol { background: #7770a9; }

        .arena-team-copy {

          display: flex;

          min-width: 0;

          flex-direction: column;

          gap: 5px;

        }

        .arena-team-copy small {

          color: #82948e;

          font-size: 9px;

          font-weight: 900;

          letter-spacing: .1em;

        }

        .arena-team-copy strong {

          color: inherit;

          font-size: 13px;

          line-height: 1.35;

          overflow-wrap: anywhere;

        }

        .arena-invite-strip {

          display: flex;

          align-items: center;

          justify-content: space-between;

          flex-wrap: wrap;

          gap: 12px;

          margin-top: 22px;

          padding: 14px 15px;

          border: 1px solid #dcebe5;

          border-radius: 13px;

          background: #f5faf7;

        }

        .arena-invite-copy {

          display: flex;

          min-width: 0;

          flex-direction: column;

          gap: 5px;

        }

        .arena-invite-copy .arena-detail-label { margin: 0; }

        .arena-invite-copy strong {

          color: #174f49;

          font-size: 13px;

          letter-spacing: .08em;

          overflow-wrap: anywhere;

        }

        .arena-copy-link-button {

          display: inline-flex;

          min-height: 40px;

          align-items: center;

          justify-content: center;

          gap: 8px;

          padding: 0 14px;

          border: 1px solid #b9d9cd;

          border-radius: 10px;

          color: #ffffff;

          background: #08766d;

          font-size: 11px;

          font-weight: 850;

          cursor: pointer;

          transition: background .18s ease, transform .18s ease;

        }

        .arena-copy-link-button:hover {

          transform: translateY(-1px);

          background: #075e57;

        }



        .arena-card-side {

          display: flex;

          min-width: 0;

          flex-direction: column;

          gap: 18px;

          padding: 24px 22px;

          border-left: 1px solid #e3ece9;

          background: linear-gradient(160deg, #f5faf8 0%, #edf5f2 100%);

        }

        .arena-side-block {

          padding: 0 0 16px;

          border-bottom: 1px solid #dce8e3;

        }

        .arena-schedule-row {

          display: flex;

          align-items: flex-start;

          gap: 10px;

          margin-top: 13px;

        }

        .arena-schedule-marker {

          width: 9px;

          height: 9px;

          flex: 0 0 9px;

          margin-top: 4px;

          border-radius: 50%;

          background: #16836e;

          box-shadow: 0 0 0 4px #dcefe7;

        }

        .arena-end-marker {

          background: #7770a9;

          box-shadow: 0 0 0 4px #e9e6f5;

        }

        .arena-schedule-row div {

          display: flex;

          min-width: 0;

          flex-direction: column;

          gap: 4px;

        }

        .arena-schedule-row small {

          color: #81918c;

          font-size: 10px;

          font-weight: 800;

        }

        .arena-schedule-row strong {

          color: #34534c;

          font-size: 11px;

          line-height: 1.45;

          overflow-wrap: anywhere;

        }

        .arena-player-block {

          display: flex;

          flex-direction: column;

          align-items: flex-start;

          gap: 6px;

        }

        .arena-player-team {

          color: #244b43;

          font-size: 14px;

          font-weight: 900;

          overflow-wrap: anywhere;

        }

        .arena-attempt-label {

          color: #71847e;

          font-size: 10px;

          line-height: 1.4;

        }

        .arena-open-button {

          display: flex;

          width: 100%;

          min-height: 44px;

          align-items: center;

          justify-content: center;

          gap: 9px;

          margin-top: auto;

          padding: 0 14px;

          border-radius: 11px;

          color: #ffffff !important;

          background: #08766d;

          text-decoration: none !important;

          font-size: 12px;

          font-weight: 900;

          box-sizing: border-box;

          transition: background .18s ease, transform .18s ease;

        }

        .arena-open-button:hover {

          transform: translateY(-1px);

          background: #075e57;

        }

        @media (max-width: 760px) {

          .arena-competition-card { grid-template-columns: minmax(0, 1fr); }

          .arena-card-side {

            border-top: 1px solid #e3ece9;

            border-left: 0;

          }

        }

        @media (max-width: 520px) {

          .arena-card-main, .arena-card-side { padding: 18px; }

          .arena-team-preview { grid-template-columns: minmax(0, 1fr); }

          .arena-invite-strip { align-items: stretch; flex-direction: column; }

          .arena-copy-link-button, .arena-create-action { width: 100%; }

        }



      `}</style>

    </>

  );

}
