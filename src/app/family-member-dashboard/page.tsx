"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type MemberProgress = {
  member_id: string;
  display_name: string;
  family_id: string;
  total_xp: number;
  current_level: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
  accuracy: number;
  family_total_xp: number;
  family_member_count: number;
};

type ActiveMemberSession = {
  session_id: string;
  member_id: string;
  family_id: string;
  display_name: string;
  level: number;
  track: string;
  questions_answered: number;
  correct_answers: number;
  score: number;
  current_question_id: string | null;
  current_question_started_at: string | null;
  started_at: string;
};

type LeaderboardMember = {
  rank: number;
  member_id: string;
  display_name: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
  best_streak: number;
  questions_answered: number;
  correct_answers: number;
  accuracy: number;
  is_current_member: boolean;
};

const SESSION_KEY = "sahabaquest_family_member_session";

export default function FamilyMemberDashboardPage() {
  const router = useRouter();

  const [progress, setProgress] = useState<MemberProgress | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardMember[]>([]);
  const [activeQuestSession, setActiveQuestSession] = useState<ActiveMemberSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Loading your Family dashboard...");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setMessage("Loading your Family dashboard...");

      if (typeof window === "undefined") {
        return;
      }

      const token = sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        setMessage(
          "Your Family Member session has ended. Please return to the Family Member sign-in page."
        );
        return;
      }

      /*
       * Verify that the stored Family Member session is still active.
       */
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.rpc("get_family_member_session", {
        p_session_token: token,
      });

      if (sessionError) {
        console.error(
          "Family Member session lookup error:",
          sessionError
        );

        sessionStorage.removeItem(SESSION_KEY);

        setMessage(
          "Your Family Member session has expired. Please sign in again."
        );

        return;
      }

      if (
        !sessionData ||
        !Array.isArray(sessionData) ||
        sessionData.length === 0
      ) {
        sessionStorage.removeItem(SESSION_KEY);

        setMessage(
          "Your Family Member session has expired. Please sign in again."
        );

        return;
      }

      /*
       * Load Family Member progress.
       */
      const {
        data: progressData,
        error: progressError,
      } = await supabase.rpc("get_family_member_progress", {
        p_session_token: token,
      });

      if (progressError) {
        console.error(
          "Family Member progress error:",
          progressError
        );

        setMessage(
          `We could not load your progress: ${progressError.message}`
        );

        return;
      }

      if (
        !progressData ||
        !Array.isArray(progressData) ||
        progressData.length === 0
      ) {
        setMessage(
          "No Family Member progress was found."
        );

        return;
      }

      /*
       * Load ONLY this member's active quiz session.
       * This is the source of truth for the current 50-question level.
       * It does not create a session.
       */
      const {
        data: activeSessionData,
        error: activeSessionError,
      } = await supabase.rpc("get_family_member_active_session", {
        p_session_token: token,
      });

      if (activeSessionError) {
        console.error(
          "Family Member active session error:",
          activeSessionError
        );

        setActiveQuestSession(null);
      } else if (
        Array.isArray(activeSessionData) &&
        activeSessionData.length > 0
      ) {
        setActiveQuestSession(
          activeSessionData[0] as ActiveMemberSession
        );
      } else {
        setActiveQuestSession(null);
      }

      /*
       * Load private Family Member leaderboard.
       */
      const {
        data: leaderboardData,
        error: leaderboardError,
      } = await supabase.rpc("get_family_member_leaderboard", {
        p_session_token: token,
      });

      if (leaderboardError) {
        console.error(
          "Family Member leaderboard error:",
          leaderboardError
        );

        setMessage(
          `Your progress loaded, but the Family leaderboard could not be loaded: ${leaderboardError.message}`
        );

        setProgress(progressData[0] as MemberProgress);
        setLeaderboard([]);
        return;
      }

      /*
       * Supabase can return nullable numeric values when a progress
       * record was created before all counters were populated.
       *
       * Normalize the RPC response here so the UI never calls
       * methods such as `.toLocaleString()` on null.
       */
      const rawProgress = progressData[0] as Partial<MemberProgress>;

      const normalizedProgress: MemberProgress = {
        member_id: String(rawProgress.member_id ?? ""),
        display_name: String(
          rawProgress.display_name ?? "Family Member"
        ),
        family_id: String(rawProgress.family_id ?? ""),
        total_xp: Number(rawProgress.total_xp ?? 0),
        current_level: Number(rawProgress.current_level ?? 1),
        questions_answered: Number(
          rawProgress.questions_answered ?? 0
        ),
        correct_answers: Number(
          rawProgress.correct_answers ?? 0
        ),
        current_streak: Number(
          rawProgress.current_streak ?? 0
        ),
        best_streak: Number(
          rawProgress.best_streak ?? 0
        ),
        accuracy: Number(rawProgress.accuracy ?? 0),
        family_total_xp: Number(
          rawProgress.family_total_xp ?? 0
        ),
        family_member_count: Number(
          rawProgress.family_member_count ?? 0
        ),
      };

      setProgress(normalizedProgress);

      const normalizedLeaderboard: LeaderboardMember[] =
        Array.isArray(leaderboardData)
          ? (leaderboardData as Partial<LeaderboardMember>[]).map(
              (member) => ({
                rank: Number(member.rank ?? 0),
                member_id: String(member.member_id ?? ""),
                display_name: String(
                  member.display_name ?? "Family Member"
                ),
                total_xp: Number(member.total_xp ?? 0),
                current_level: Number(
                  member.current_level ?? 1
                ),
                current_streak: Number(
                  member.current_streak ?? 0
                ),
                best_streak: Number(
                  member.best_streak ?? 0
                ),
                questions_answered: Number(
                  member.questions_answered ?? 0
                ),
                correct_answers: Number(
                  member.correct_answers ?? 0
                ),
                accuracy: Number(member.accuracy ?? 0),
                is_current_member: Boolean(
                  member.is_current_member
                ),
              })
            )
          : [];

      setLeaderboard(normalizedLeaderboard);
      setMessage("");
    } catch (error) {
      console.error(
        "Family Member dashboard loading error:",
        error
      );

      setMessage(
        "Something went wrong while loading your Family dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    router.push("/family-member-login");
  }

  if (loading || !progress) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div
            className="sq-card"
            style={{
              maxWidth: "620px",
              margin: "80px auto",
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "20px",
                background: "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                fontSize: "24px",
                fontWeight: 900,
              }}
            >
              SQ
            </div>

            <h1 className="sq-title">
              Sahaba Quest
            </h1>

            <p
              className="sq-subtitle"
              style={{
                marginTop: "12px",
                lineHeight: 1.7,
              }}
            >
              {message}
            </p>

            {!loading && (
              <button
                type="button"
                onClick={() =>
                  router.push("/family-member-login")
                }
                className="sq-button-primary"
                style={{
                  marginTop: "22px",
                  minHeight: "46px",
                  padding: "0 20px",
                  border: "none",
                }}
              >
                Return to Family Member Sign In
              </button>
            )}
          </div>
        </div>
      </main>
    );
  }

  /*
   * CURRENT LEVEL PROGRESS
   *
   * Lifetime member totals are intentionally NOT used here.
   * The active game session is the source of truth for the current
   * 50-question level and therefore cannot leak into the Family Owner dashboard.
   */
  const questionsInCurrentLevel = Math.min(
    Number(activeQuestSession?.questions_answered ?? 0),
    50
  );

  const correctInCurrentLevel = Math.min(
    Number(activeQuestSession?.correct_answers ?? 0),
    50
  );

  const levelQuestionProgress =
    Math.min(
      (questionsInCurrentLevel / 50) * 100,
      100
    );

  const levelCorrectProgress = Math.min(
    (correctInCurrentLevel / 25) * 100,
    100
  );

  const levelAccuracy =
    questionsInCurrentLevel > 0
      ? Math.round(
          (correctInCurrentLevel / questionsInCurrentLevel) * 100
        )
      : 0;

  const memberQuestActionLabel =
    activeQuestSession
      ? "Continue Quest"
      : "Start Quest";

  const displayLevel =
    activeQuestSession?.level ??
    progress.current_level;

  const displayedLeaderboard =
    leaderboard.slice(0, 5);

  return (
    <main
      className="sq-page"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)",
      }}
    >
      <div className="sq-container">
        {/* NAVIGATION */}
        <div
          style={{
            marginBottom: "28px",
          }}
        >
          <AppNavbar />
        </div>

        {/* WELCOME HERO */}
        <section
          className="sq-card"
          style={{
            padding: "36px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: "-60px",
              top: "-80px",
              width: "220px",
              height: "220px",
              borderRadius: "50%",
              background: "var(--primary-light)",
              opacity: 0.6,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: "720px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
              }}
            >
              <span className="sq-badge">
                Level {displayLevel}
              </span>

              <span
                className="sq-badge"
                style={{
                  background: "#fef3c7",
                  color: "#92400e",
                }}
              >
                Family Member
              </span>
            </div>

            <h1
              style={{
                margin: "18px 0 8px",
                fontSize: "clamp(30px, 5vw, 48px)",
                lineHeight: 1.1,
                letterSpacing: "-1.2px",
                fontWeight: 900,
              }}
            >
              Assalamu alaikum,{" "}
              <span
                style={{
                  color: "var(--primary)",
                }}
              >
                {progress.display_name}
              </span>{" "}
              👋
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: "620px",
                color: "var(--muted)",
                fontSize: "17px",
                lineHeight: 1.7,
              }}
            >
              Welcome back to your Family Quest.
              Keep learning, build your streak,
              and see how you are progressing with
              your family.
            </p>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "26px",
              }}
            >
              <a
                href="/family-member-quiz"
                className="sq-button-primary"
              >
                🎮 {memberQuestActionLabel}
              </a>

              <button
                type="button"
                onClick={loadDashboard}
                className="sq-button-secondary"
                style={{
                  border: "none",
                  cursor: "pointer",
                }}
              >
                ↻ Refresh Progress
              </button>
            </div>
          </div>
        </section>

        {/* FAMILY ACCOUNT */}
        <section
          id="progress"
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "22px 26px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f8faf9 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "18px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="sq-badge">
                Family Quest
              </div>

              <h2
                style={{
                  margin: "9px 0 4px",
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                Your Family Progress
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Your personal progress is separate
                from the Family total and your
                Family members compete privately
                within this Family.
              </p>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="sq-button-secondary"
              style={{
                minHeight: "44px",
                padding: "0 18px",
                border: "1px solid var(--border)",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Switch Member
            </button>
          </div>
        </section>

        {/* STATS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginTop: "20px",
          }}
        >
          <div className="sq-stat">
            <div className="sq-stat-label">
              Current Level
            </div>

            <div className="sq-stat-value">
              {progress.current_level}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--primary)",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              Keep progressing
            </div>
          </div>

          <div className="sq-stat">
            <div className="sq-stat-label">
              Total XP
            </div>

            <div className="sq-stat-value">
              {Number(progress.total_xp ?? 0).toLocaleString()}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              Your Family Quest XP
            </div>
          </div>

          <div className="sq-stat">
            <div className="sq-stat-label">
              Current Streak
            </div>

            <div
              className="sq-stat-value"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              🔥 {progress.current_streak}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              Best: {progress.best_streak}
            </div>
          </div>

          <div className="sq-stat">
            <div className="sq-stat-label">
              Accuracy
            </div>

            <div className="sq-stat-value">
              {levelAccuracy}%
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              {correctInCurrentLevel} correct in this level
            </div>
          </div>
        </section>

        {/* FAMILY TOTAL */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "26px 28px",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="sq-badge">
                Family XP
              </div>

              <h2
                style={{
                  margin: "10px 0 5px",
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                {Number(progress.family_total_xp ?? 0).toLocaleString()} XP
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "13px",
                  lineHeight: 1.6,
                }}
              >
                Combined XP earned by active Family
                Members.
              </p>
            </div>

            <div
              style={{
                minWidth: "120px",
                textAlign: "right",
              }}
            >
              <div
                style={{
                  color: "var(--muted)",
                  fontSize: "12px",
                  fontWeight: 700,
                }}
              >
                Active Members
              </div>

              <div
                style={{
                  marginTop: "4px",
                  fontSize: "30px",
                  fontWeight: 900,
                  color: "var(--primary)",
                }}
              >
                {progress.family_member_count}
              </div>
            </div>
          </div>
        </section>

        {/* MAIN CONTENT GRID */}
        <section
          className="family-member-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.5fr) minmax(280px, 1fr)",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {/* YOUR JOURNEY */}
          <div
            className="sq-card"
            style={{
              padding: "28px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
              }}
            >
              <div>
                <div className="sq-badge">
                  Your Journey
                </div>

                <h2
                  style={{
                    margin: "16px 0 6px",
                    fontSize: "24px",
                    fontWeight: 800,
                  }}
                >
                  Level {displayLevel}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    lineHeight: 1.6,
                  }}
                >
                  Keep answering questions to
                  strengthen your knowledge.
                </p>
              </div>

              <div
                style={{
                  fontSize: "34px",
                  fontWeight: 900,
                  color: "var(--primary)",
                }}
              >
                {progress.total_xp}
              </div>
            </div>

            {/* QUESTIONS PROGRESS */}
            <div
              style={{
                marginTop: "28px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "9px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--muted)",
                  }}
                >
                  Level questions
                </span>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--primary)",
                  }}
                >
                  {questionsInCurrentLevel}/50
                </span>
              </div>

              <div className="sq-progress">
                <div
                  className="sq-progress-bar"
                  style={{
                    width: `${levelQuestionProgress}%`,
                  }}
                />
              </div>
            </div>

            {/* PASS PROGRESS */}
            <div
              style={{
                marginTop: "20px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "9px",
                }}
              >
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--muted)",
                  }}
                >
                  Correct answers needed
                </span>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--primary)",
                  }}
                >
                  {correctInCurrentLevel}/25
                </span>
              </div>

              <div className="sq-progress">
                <div
                  className="sq-progress-bar"
                  style={{
                    width: `${levelCorrectProgress}%`,
                  }}
                />
              </div>
            </div>

            {/* SMALL PROGRESS STATS */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(2, 1fr)",
                gap: "12px",
                marginTop: "24px",
              }}
            >
              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border:
                    "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Questions Answered This Level
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {questionsInCurrentLevel}
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border:
                    "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Correct Answers
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {correctInCurrentLevel}
                </div>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div
            className="sq-card"
            style={{
              padding: "28px",
            }}
          >
            <div className="sq-badge">
              Quick Actions
            </div>

            <h2
              style={{
                margin: "16px 0 18px",
                fontSize: "24px",
                fontWeight: 800,
              }}
            >
              What do you want to do?
            </h2>

            <div
              style={{
                display: "grid",
                gap: "12px",
              }}
            >
              <a
                href="/family-member-quiz"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background:
                    "var(--primary)",
                  color: "white",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  textDecoration: "none",
                }}
              >
                <span>🎮 Play Quiz</span>
                <span>→</span>
              </a>

              <button
                type="button"
                onClick={loadDashboard}
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background:
                    "var(--secondary-light)",
                  color: "#7c5d00",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "inherit",
                  textAlign: "left",
                }}
              >
                <span>📊 Refresh Progress</span>
                <span>→</span>
              </button>

              <button
                type="button"
                onClick={handleLogout}
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "#f1f5f3",
                  color: "var(--foreground)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "inherit",
                  textAlign: "left",
                }}
              >
                <span>👤 Switch Member</span>
                <span>→</span>
              </button>
            </div>
          </div>
        </section>

        {/* FAMILY LEADERBOARD */}
        <section
          id="leaderboard"
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <div className="sq-badge">
                Family Competition
              </div>

              <h2
                style={{
                  margin: "16px 0 6px",
                  fontSize: "24px",
                  fontWeight: 800,
                }}
              >
                Family Leaderboard
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  lineHeight: 1.6,
                }}
              >
                See how you are progressing
                alongside your Family Members.
              </p>
            </div>

            <div
              style={{
                color: "var(--muted)",
                fontSize: "13px",
                fontWeight: 700,
              }}
            >
              {leaderboard.length} active member
              {leaderboard.length === 1 ? "" : "s"}
            </div>
          </div>

          <div
            style={{
              marginTop: "24px",
              display: "grid",
              gap: "10px",
            }}
          >
            {displayedLeaderboard.length > 0 ? (
              displayedLeaderboard.map((member) => (
                <div
                  key={member.member_id}
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "52px minmax(0, 1fr) auto",
                    alignItems: "center",
                    gap: "14px",
                    padding: "16px",
                    borderRadius: "16px",
                    border:
                      member.is_current_member
                        ? "1px solid var(--primary)"
                        : "1px solid var(--border)",
                    background:
                      member.is_current_member
                        ? "var(--primary-light)"
                        : "#f8faf9",
                  }}
                >
                  <div
                    style={{
                      width: "42px",
                      height: "42px",
                      borderRadius: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background:
                        member.rank === 1
                          ? "#fef3c7"
                          : member.rank === 2
                          ? "#e5e7eb"
                          : member.rank === 3
                          ? "#fed7aa"
                          : "white",
                      color:
                        member.rank <= 3
                          ? "#92400e"
                          : "var(--foreground)",
                      fontWeight: 900,
                    }}
                  >
                    {member.rank <= 3
                      ? ["🥇", "🥈", "🥉"][
                          member.rank - 1
                        ]
                      : member.rank}
                  </div>

                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "15px",
                        }}
                      >
                        {member.display_name}
                      </strong>

                      {member.is_current_member && (
                        <span
                          className="sq-badge"
                          style={{
                            fontSize: "10px",
                            padding:
                              "4px 8px",
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: "4px",
                        color: "var(--muted)",
                        fontSize: "12px",
                      }}
                    >
                      Level {member.current_level}
                      {" • "}
                      {member.accuracy}% accuracy
                      {" • "}
                      🔥 {member.current_streak}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: "right",
                    }}
                  >
                    <div
                      style={{
                        color: "var(--primary)",
                        fontSize: "17px",
                        fontWeight: 900,
                      }}
                    >
                      {Number(member.total_xp ?? 0).toLocaleString()}
                    </div>

                    <div
                      style={{
                        color: "var(--muted)",
                        fontSize: "11px",
                        marginTop: "2px",
                      }}
                    >
                      XP
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border:
                    "1px solid var(--border)",
                  color: "var(--muted)",
                }}
              >
                No Family Member leaderboard
                data is available yet.
              </div>
            )}
          </div>
        </section>

        {/* LEARNING MOTIVATION */}
        <section
          className="sq-card"
          style={{
            marginTop: "20px",
            padding: "28px",
            background:
              "linear-gradient(135deg, #115e59, #0f766e)",
            color: "white",
            border: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "24px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                maxWidth: "700px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  opacity: 0.8,
                }}
              >
                Family Quest
              </div>

              <h2
                style={{
                  margin: "10px 0 8px",
                  fontSize: "26px",
                  fontWeight: 900,
                }}
              >
                Learn together.
                Grow together.
              </h2>

              <p
                style={{
                  margin: 0,
                  lineHeight: 1.7,
                  opacity: 0.85,
                }}
              >
                Every question is an
                opportunity to increase your
                knowledge and strengthen your
                connection with the lives of the
                Sahabah.
              </p>
            </div>

            <a
              href="/family-member-quiz"
              style={{
                minHeight: "50px",
                padding: "0 22px",
                borderRadius: "14px",
                background: "white",
                color: "var(--primary-dark)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              Continue Learning →
            </a>
          </div>
        </section>

        {/* FOOTER */}
        <footer
          style={{
            padding: "28px 0 8px",
            textAlign: "center",
            color: "var(--muted-light)",
            fontSize: "12px",
          }}
        >
          Sahaba Quest • Learn. Remember. Compete.
        </footer>
      </div>

      <style jsx>{`
        .family-member-main-grid {
          width: 100%;
        }

        @media (max-width: 800px) {
          .family-member-main-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }

          .family-member-main-grid > * {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 600px) {
          .family-member-main-grid .sq-card {
            padding: 22px !important;
          }
        }
      `}</style>
    </main>
  );
}
