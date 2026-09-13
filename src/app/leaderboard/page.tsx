"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  username: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
};

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<LeaderboardRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("player_progress")
      .select(
        `
          user_id,
          total_xp,
          current_level,
          current_streak,
          profiles!inner (
            display_name,
            username
          )
        `
      )
      .order("total_xp", { ascending: false })
      .limit(100);

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const formattedPlayers: LeaderboardRow[] = (data ?? []).map(
      (player: any) => ({
        user_id: player.user_id,
        display_name: player.profiles?.display_name || "Player",
        username: player.profiles?.username || "",
        total_xp: player.total_xp || 0,
        current_level: player.current_level || 1,
        current_streak: player.current_streak || 0,
      })
    );

    setPlayers(formattedPlayers);
    setLoading(false);
  }

  const currentUserIndex = players.findIndex(
    (player) => player.user_id === currentUserId
  );

  const currentUserRank =
    currentUserIndex >= 0 ? currentUserIndex + 1 : null;

  const topThree = players.slice(0, 3);

  if (loading) {
    return (
      <main className="sq-page">
        <div
          className="sq-container"
          style={{
            minHeight: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              className="sq-timer"
              style={{
                margin: "0 auto 20px",
                width: "64px",
                height: "64px",
                fontSize: "18px",
              }}
            >
              🏆
            </div>

            <h2 style={{ margin: 0 }}>Loading leaderboard...</h2>

            <p className="sq-subtitle">
              We're getting the latest rankings.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (message) {
    return (
      <main className="sq-page">
        <div
          className="sq-container"
          style={{
            minHeight: "80vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            className="sq-card"
            style={{
              maxWidth: "500px",
              width: "100%",
              padding: "36px",
              textAlign: "center",
            }}
          >
            <h2 style={{ marginTop: 0 }}>
              Unable to load leaderboard
            </h2>

            <p className="sq-subtitle">{message}</p>

            <Link
              href="/dashboard"
              className="sq-button-primary"
              style={{ marginTop: "20px" }}
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
      }}
    >
      <nav className="sq-nav">
        <Link href="/dashboard" className="sq-logo">
          Sahaba Quest
        </Link>

        <div className="sq-nav-links">
          <Link href="/dashboard" className="sq-nav-link">
            Home
          </Link>

          <Link href="/quiz" className="sq-nav-link">
            Play
          </Link>

          <Link href="/progress" className="sq-nav-link">
            Progress
          </Link>

          <Link
            href="/leaderboard"
            className="sq-nav-link"
            style={{
              background: "var(--primary-light)",
              color: "var(--primary-dark)",
            }}
          >
            Leaderboard
          </Link>

          <Link href="/challenges" className="sq-nav-link">
            Challenges
          </Link>

          <Link href="/profile" className="sq-nav-link">
            Profile
          </Link>
        </div>
      </nav>

      <div className="sq-page">
        <div className="sq-container">
          <section style={{ marginBottom: "32px" }}>
            <span className="sq-badge">Compete & grow</span>

            <h1
              className="sq-title"
              style={{ marginTop: "16px" }}
            >
              Global Leaderboard 🏆
            </h1>

            <p className="sq-subtitle">
              See how you rank among fellow Sahaba Quest players.
            </p>
          </section>

          {players.length === 0 ? (
            <div
              className="sq-card"
              style={{
                padding: "60px 30px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "50px",
                  marginBottom: "18px",
                }}
              >
                🏆
              </div>

              <h2 style={{ margin: 0 }}>
                The leaderboard is waiting.
              </h2>

              <p className="sq-subtitle">
                Start playing to become one of the first players
                on the board.
              </p>

              <Link
                href="/quiz"
                className="sq-button-primary"
                style={{ marginTop: "20px" }}
              >
                Start Playing
              </Link>
            </div>
          ) : (
            <>
              <section
                className="leaderboard-podium"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "18px",
                  alignItems: "end",
                  marginBottom: "28px",
                }}
              >
                {topThree.map((player, index) => {
                  const rank = index + 1;

                  const isCurrentUser =
                    player.user_id === currentUserId;

                  return (
                    <div
                      key={player.user_id}
                      className="sq-card"
                      style={{
                        padding: "28px 22px",
                        textAlign: "center",
                        position: "relative",
                        transform:
                          rank === 1
                            ? "translateY(-12px)"
                            : "none",
                        border: isCurrentUser
                          ? "2px solid var(--primary)"
                          : undefined,
                      }}
                    >
                      {isCurrentUser && (
                        <div
                          style={{
                            position: "absolute",
                            top: "12px",
                            right: "12px",
                            fontSize: "11px",
                            fontWeight: 800,
                            color: "var(--primary)",
                          }}
                        >
                          YOU
                        </div>
                      )}

                      <div
                        style={{
                          fontSize: "38px",
                          marginBottom: "10px",
                        }}
                      >
                        {rank === 1
                          ? "🥇"
                          : rank === 2
                            ? "🥈"
                            : "🥉"}
                      </div>

                      <div
                        style={{
                          fontSize: "18px",
                          fontWeight: 800,
                        }}
                      >
                        {player.display_name}
                      </div>

                      {player.username && (
                        <div
                          style={{
                            marginTop: "4px",
                            color: "var(--muted)",
                            fontSize: "12px",
                          }}
                        >
                          @{player.username}
                        </div>
                      )}

                      <div
                        style={{
                          marginTop: "18px",
                          fontSize: "28px",
                          fontWeight: 900,
                          color: "var(--primary)",
                        }}
                      >
                        {player.total_xp.toLocaleString()}
                      </div>

                      <div
                        style={{
                          color: "var(--muted)",
                          fontSize: "12px",
                          fontWeight: 600,
                        }}
                      >
                        XP
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: "14px",
                          marginTop: "18px",
                          fontSize: "12px",
                          color: "var(--muted)",
                        }}
                      >
                        <span>
                          Level {player.current_level}
                        </span>

                        <span>
                          🔥 {player.current_streak}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </section>

              <section
                className="sq-card"
                style={{ overflow: "hidden" }}
              >
                <div
                  style={{
                    padding: "24px 26px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "22px",
                      fontWeight: 800,
                    }}
                  >
                    Player Rankings
                  </h2>

                  <p
                    style={{
                      margin: "6px 0 0",
                      color: "var(--muted)",
                      fontSize: "13px",
                    }}
                  >
                    Rankings are based on total XP.
                  </p>
                </div>

                <div>
                  {players.map((player, index) => {
                    const rank = index + 1;

                    const isCurrentUser =
                      player.user_id === currentUserId;

                    return (
                      <div
                        key={player.user_id}
                        className="leaderboard-row"
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "70px 1fr 100px 90px 90px",
                          alignItems: "center",
                          gap: "16px",
                          padding: "18px 26px",
                          borderBottom:
                            "1px solid var(--border)",
                          background: isCurrentUser
                            ? "var(--primary-light)"
                            : "transparent",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 900,
                            color: "var(--muted)",
                          }}
                        >
                          #{rank}
                        </div>

                        <div>
                          <div
                            style={{
                              fontWeight: 800,
                            }}
                          >
                            {player.display_name}

                            {isCurrentUser && (
                              <span
                                style={{
                                  marginLeft: "8px",
                                  color: "var(--primary)",
                                  fontSize: "11px",
                                }}
                              >
                                YOU
                              </span>
                            )}
                          </div>

                          {player.username && (
                            <div
                              style={{
                                marginTop: "3px",
                                color: "var(--muted)",
                                fontSize: "12px",
                              }}
                            >
                              @{player.username}
                            </div>
                          )}
                        </div>

                        <div
                          style={{
                            fontWeight: 800,
                            color: "var(--primary)",
                          }}
                        >
                          {player.total_xp.toLocaleString()} XP
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--muted)",
                            fontWeight: 700,
                          }}
                        >
                          Level {player.current_level}
                        </div>

                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--muted)",
                            fontWeight: 700,
                          }}
                        >
                          🔥 {player.current_streak}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {currentUserRank !== null && (
                <section
                  className="sq-card"
                  style={{
                    marginTop: "24px",
                    padding: "22px 26px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "20px",
                    background: "var(--primary)",
                    color: "white",
                    border: "none",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.7)",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      Your current position
                    </div>

                    <div
                      style={{
                        marginTop: "5px",
                        fontSize: "28px",
                        fontWeight: 900,
                      }}
                    >
                      #{currentUserRank}
                    </div>
                  </div>

                  <Link
                    href="/quiz"
                    className="sq-button-secondary"
                    style={{
                      border: "none",
                    }}
                  >
                    Earn More XP
                  </Link>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 800px) {
          .leaderboard-podium {
            grid-template-columns: 1fr !important;
          }

          .leaderboard-podium > div {
            transform: none !important;
          }

          .leaderboard-row {
            grid-template-columns: 55px 1fr 80px !important;
          }

          .leaderboard-row > div:nth-child(4),
          .leaderboard-row > div:nth-child(5) {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .leaderboard-row {
            padding: 16px !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </main>
  );
}