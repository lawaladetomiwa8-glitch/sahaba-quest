"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type FamilyLeaderboardRow = {
  user_id: string;
  display_name: string;
  username: string;
  total_xp: number;
  current_level: number;
  current_streak: number;
};

type RankedPlayer = FamilyLeaderboardRow & {
  rank: number;
};

export default function FamilyLeaderboardPage() {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    setLoading(true);
    setMessage("");

    /*
     * GET CURRENT USER
     */
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    /*
     * LOAD FAMILY PROFILES
     *
     * We intentionally query profiles separately.
     *
     * family_player_progress does not currently have
     * a registered Supabase relationship with profiles.
     */
    const {
      data: familyProfiles,
      error: profilesError,
    } = await supabase
      .from("profiles")
      .select(
        `
          id,
          display_name,
          username,
          account_type
        `
      )
      .eq("account_type", "family");

    if (profilesError) {
      setMessage(profilesError.message);
      setLoading(false);
      return;
    }

    /*
     * GET FAMILY USER IDS
     */
    const familyUserIds = (familyProfiles ?? []).map(
      (profile: {
        id: string;
      }) => profile.id
    );

    /*
     * NO FAMILY PLAYERS YET
     */
    if (familyUserIds.length === 0) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    /*
     * LOAD FAMILY PROGRESS
     *
     * IMPORTANT:
     *
     * This uses family_player_progress.
     *
     * It does NOT use player_progress.
     *
     * Therefore Individual XP remains completely
     * separate from Family XP.
     */
    const {
      data: familyProgress,
      error: progressError,
    } = await supabase
      .from("family_player_progress")
      .select(
        `
          user_id,
          total_xp,
          current_level,
          current_streak
        `
      )
      .in("user_id", familyUserIds)
      .order("total_xp", {
        ascending: false,
      });

    if (progressError) {
      setMessage(progressError.message);
      setLoading(false);
      return;
    }

    /*
     * CREATE A QUICK PROFILE LOOKUP
     */
    const profileMap = new Map(
      (familyProfiles ?? []).map(
        (profile: {
          id: string;
          display_name: string | null;
          username: string | null;
          account_type: string;
        }) => [profile.id, profile]
      )
    );

    /*
     * COMBINE FAMILY PROFILE DATA
     * WITH FAMILY PROGRESS DATA
     */
    const formattedPlayers: FamilyLeaderboardRow[] = (
      familyProgress ?? []
    ).map(
      (player: {
        user_id: string;
        total_xp: number | null;
        current_level: number | null;
        current_streak: number | null;
      }) => {
        const profile = profileMap.get(player.user_id);

        return {
          user_id: player.user_id,

          display_name:
            profile?.display_name ||
            "Family Player",

          username:
            profile?.username || "",

          total_xp: Number(
            player.total_xp || 0
          ),

          current_level: Number(
            player.current_level || 1
          ),

          current_streak: Number(
            player.current_streak || 0
          ),
        };
      }
    );

    /*
     * ASSIGN RANKS
     */
    const rankedPlayers: RankedPlayer[] =
      formattedPlayers.map(
        (player, index) => ({
          ...player,
          rank: index + 1,
        })
      );

    setPlayers(rankedPlayers);
    setLoading(false);
  }

  /*
   * CURRENT USER
   */
  const currentUser = players.find(
    (player) =>
      player.user_id === currentUserId
  );

  /*
   * TOP THREE
   */
  const topThree = players.slice(0, 3);

  /*
   * TOP 100
   */
  const displayedPlayers =
    players.slice(0, 100);

  /*
   * LOADING STATE
   */
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
          <div
            style={{
              textAlign: "center",
            }}
          >
            <div
              className="sq-timer"
              style={{
                margin: "0 auto 20px",
                width: "64px",
                height: "64px",
                fontSize: "18px",
              }}
            >
              👨‍👩‍👧‍👦
            </div>

            <h2
              style={{
                margin: 0,
              }}
            >
              Loading Family leaderboard...
            </h2>

            <p className="sq-subtitle">
              We're getting the latest Family
              rankings.
            </p>
          </div>
        </div>
      </main>
    );
  }

  /*
   * ERROR STATE
   */
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
            <div
              style={{
                fontSize: "48px",
                marginBottom: "16px",
              }}
            >
              ⚠️
            </div>

            <h2
              style={{
                marginTop: 0,
              }}
            >
              Unable to load Family leaderboard
            </h2>

            <p className="sq-subtitle">
              {message}
            </p>

            <button
              type="button"
              className="sq-button-primary"
              style={{
                marginTop: "20px",
                border: "none",
                cursor: "pointer",
              }}
              onClick={loadLeaderboard}
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  /*
   * EMPTY STATE
   */
  if (players.length === 0) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "var(--background)",
        }}
      >
        <AppNavbar />

        <div className="sq-page">
          <div className="sq-container">

            <section
              style={{
                marginBottom: "28px",
              }}
            >
              <span className="sq-badge">
                Family journey
              </span>

              <h1
                className="sq-title"
                style={{
                  marginTop: "16px",
                }}
              >
                Family Leaderboard 🏆
              </h1>

              <p className="sq-subtitle">
                See how you rank among fellow
                Family Quest players.
              </p>
            </section>

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

              <h2
                style={{
                  margin: 0,
                }}
              >
                The Family leaderboard is waiting.
              </h2>

              <p className="sq-subtitle">
                Start Family Quest to earn Family
                XP and appear on the leaderboard.
              </p>

              <Link
                href="/family-quest"
                className="sq-button-primary"
                style={{
                  marginTop: "20px",
                }}
              >
                Start Family Quest
              </Link>
            </div>

          </div>
        </div>
      </main>
    );
  }

  /*
   * MAIN PAGE
   */
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--background)",
      }}
    >
      <AppNavbar />

      <div className="sq-page">
        <div className="sq-container">

          {/* HEADER */}
          <section
            style={{
              marginBottom: "28px",
            }}
          >
            <span className="sq-badge">
              Family journey
            </span>

            <h1
              className="sq-title"
              style={{
                marginTop: "16px",
              }}
            >
              Family Leaderboard 🏆
            </h1>

            <p className="sq-subtitle">
              See how you rank among fellow
              Family Quest players.
            </p>
          </section>

          {/* INFO CARD */}
          <section
            className="sq-card"
            style={{
              marginBottom: "28px",
              padding: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "16px",
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 800,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  Ranking period
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    fontSize: "20px",
                    fontWeight: 900,
                  }}
                >
                  All Time
                </div>
              </div>

              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "10px",
                  background:
                    "var(--primary-light)",
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                Family XP
              </div>
            </div>

            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop:
                  "1px solid var(--border)",
                color: "var(--muted)",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              Rankings are based on accumulated
              Family XP earned through Family Quest.
            </div>
          </section>

          {/* PODIUM */}
          {topThree.length > 0 && (
            <section
              className="family-leaderboard-podium"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, 1fr)",
                gap: "18px",
                alignItems: "end",
                marginBottom: "28px",
              }}
            >
              {topThree.map(
                (player, index) => {
                  const rank = index + 1;

                  const isCurrentUser =
                    player.user_id ===
                    currentUserId;

                  return (
                    <div
                      key={player.user_id}
                      className="sq-card"
                      style={{
                        padding:
                          "28px 22px",
                        textAlign:
                          "center",
                        position:
                          "relative",
                        transform:
                          rank === 1
                            ? "translateY(-12px)"
                            : "none",
                        border:
                          isCurrentUser
                            ? "2px solid var(--primary)"
                            : undefined,
                      }}
                    >
                      {/* CHAMPION LABEL */}
                      {rank === 1 && (
                        <div
                          style={{
                            marginBottom:
                              "8px",
                            fontSize:
                              "11px",
                            fontWeight:
                              900,
                            color:
                              "var(--primary)",
                            textTransform:
                              "uppercase",
                            letterSpacing:
                              "0.6px",
                          }}
                        >
                          Family XP Leader
                        </div>
                      )}

                      {/* YOU */}
                      {isCurrentUser && (
                        <div
                          style={{
                            position:
                              "absolute",
                            top: "12px",
                            right: "12px",
                            fontSize:
                              "11px",
                            fontWeight:
                              800,
                            color:
                              "var(--primary)",
                          }}
                        >
                          YOU
                        </div>
                      )}

                      {/* MEDAL */}
                      <div
                        style={{
                          fontSize:
                            "38px",
                          marginBottom:
                            "10px",
                        }}
                      >
                        {rank === 1
                          ? "🥇"
                          : rank === 2
                          ? "🥈"
                          : "🥉"}
                      </div>

                      {/* NAME */}
                      <div
                        style={{
                          fontSize:
                            "18px",
                          fontWeight:
                            800,
                        }}
                      >
                        {
                          player.display_name
                        }
                      </div>

                      {/* USERNAME */}
                      {player.username && (
                        <div
                          style={{
                            marginTop:
                              "4px",
                            color:
                              "var(--muted)",
                            fontSize:
                              "12px",
                          }}
                        >
                          @
                          {
                            player.username
                          }
                        </div>
                      )}

                      {/* XP */}
                      <div
                        style={{
                          marginTop:
                            "18px",
                          fontSize:
                            "28px",
                          fontWeight:
                            900,
                          color:
                            "var(--primary)",
                        }}
                      >
                        {player.total_xp.toLocaleString()}
                      </div>

                      <div
                        style={{
                          color:
                            "var(--muted)",
                          fontSize:
                            "12px",
                          fontWeight:
                            600,
                        }}
                      >
                        Family XP
                      </div>

                      {/* LEVEL / STREAK */}
                      <div
                        style={{
                          display:
                            "flex",
                          justifyContent:
                            "center",
                          gap: "14px",
                          marginTop:
                            "18px",
                          fontSize:
                            "12px",
                          color:
                            "var(--muted)",
                        }}
                      >
                        <span>
                          Level{" "}
                          {
                            player.current_level
                          }
                        </span>

                        <span>
                          🔥{" "}
                          {
                            player.current_streak
                          }
                        </span>
                      </div>
                    </div>
                  );
                }
              )}
            </section>
          )}

          {/* PLAYER RANKINGS */}
          <section
            className="sq-card"
            style={{
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding:
                  "24px 26px",
                borderBottom:
                  "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  display:
                    "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: "12px",
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize:
                        "22px",
                      fontWeight:
                        800,
                    }}
                  >
                    Family Player Rankings
                  </h2>

                  <p
                    style={{
                      margin:
                        "6px 0 0",
                      color:
                        "var(--muted)",
                      fontSize:
                        "13px",
                    }}
                  >
                    Rankings are based on total
                    Family XP.
                  </p>
                </div>

                <div
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      800,
                    color:
                      "var(--muted)",
                  }}
                >
                  Top 100
                </div>
              </div>
            </div>

            <div>
              {displayedPlayers.map(
                (player) => {
                  const isCurrentUser =
                    player.user_id ===
                    currentUserId;

                  return (
                    <div
                      key={
                        player.user_id
                      }
                      className="family-leaderboard-row"
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "70px 1fr 120px 90px 90px",
                        alignItems:
                          "center",
                        gap: "16px",
                        padding:
                          "18px 26px",
                        borderBottom:
                          "1px solid var(--border)",
                        background:
                          isCurrentUser
                            ? "var(--primary-light)"
                            : "transparent",
                      }}
                    >
                      {/* RANK */}
                      <div
                        style={{
                          fontWeight:
                            900,
                          color:
                            "var(--muted)",
                        }}
                      >
                        #
                        {
                          player.rank
                        }
                      </div>

                      {/* PLAYER */}
                      <div>
                        <div
                          style={{
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            player.display_name
                          }

                          {isCurrentUser && (
                            <span
                              style={{
                                marginLeft:
                                  "8px",
                                color:
                                  "var(--primary)",
                                fontSize:
                                  "11px",
                              }}
                            >
                              YOU
                            </span>
                          )}
                        </div>

                        {player.username && (
                          <div
                            style={{
                              marginTop:
                                "3px",
                              color:
                                "var(--muted)",
                              fontSize:
                                "12px",
                            }}
                          >
                            @
                            {
                              player.username
                            }
                          </div>
                        )}
                      </div>

                      {/* XP */}
                      <div
                        style={{
                          fontWeight:
                            800,
                          color:
                            "var(--primary)",
                        }}
                      >
                        {player.total_xp.toLocaleString()}{" "}
                        XP
                      </div>

                      {/* LEVEL */}
                      <div
                        style={{
                          fontSize:
                            "13px",
                          color:
                            "var(--muted)",
                          fontWeight:
                            700,
                        }}
                      >
                        Level{" "}
                        {
                          player.current_level
                        }
                      </div>

                      {/* STREAK */}
                      <div
                        style={{
                          fontSize:
                            "13px",
                          color:
                            "var(--muted)",
                          fontWeight:
                            700,
                        }}
                      >
                        🔥{" "}
                        {
                          player.current_streak
                        }
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            {players.length > 100 && (
              <div
                style={{
                  padding:
                    "16px 26px",
                  textAlign:
                    "center",
                  color:
                    "var(--muted)",
                  fontSize:
                    "12px",
                  fontWeight:
                    700,
                  background:
                    "var(--background)",
                }}
              >
                Showing the top 100 Family
                players.
              </div>
            )}
          </section>

          {/* CURRENT USER POSITION */}
          {currentUser && (
            <section
              className="sq-card"
              style={{
                marginTop:
                  "24px",
                padding:
                  "22px 26px",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "space-between",
                gap: "20px",
                background:
                  "var(--primary)",
                color:
                  "white",
                border:
                  "none",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      "12px",
                    color:
                      "rgba(255,255,255,0.7)",
                    fontWeight:
                      700,
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.5px",
                  }}
                >
                  Your Family position
                </div>

                <div
                  style={{
                    marginTop:
                      "5px",
                    fontSize:
                      "28px",
                    fontWeight:
                      900,
                  }}
                >
                  #
                  {
                    currentUser.rank
                  }
                </div>

                <div
                  style={{
                    marginTop:
                      "3px",
                    fontSize:
                      "12px",
                    color:
                      "rgba(255,255,255,0.75)",
                  }}
                >
                  {
                    currentUser.total_xp.toLocaleString()
                  }{" "}
                  Family XP
                </div>
              </div>

              <Link
                href="/family-quest"
                className="sq-button-secondary"
                style={{
                  border:
                    "none",
                }}
              >
                Earn More Family XP
              </Link>
            </section>
          )}

          {/* BACK TO FAMILY DASHBOARD */}
          <div
            style={{
              marginTop:
                "24px",
              textAlign:
                "center",
            }}
          >
            <Link
              href="/family-dashboard"
              style={{
                color:
                  "var(--muted)",
                fontSize:
                  "13px",
                fontWeight:
                  700,
                textDecoration:
                  "none",
              }}
            >
              ← Back to Family Dashboard
            </Link>
          </div>

        </div>
      </div>

      {/* RESPONSIVE STYLES */}
      <style jsx>{`
        @media (max-width: 800px) {
          .family-leaderboard-podium {
            grid-template-columns: 1fr !important;
          }

          .family-leaderboard-podium > div {
            transform: none !important;
          }

          .family-leaderboard-row {
            grid-template-columns:
              55px 1fr 90px !important;
          }

          .family-leaderboard-row > div:nth-child(4),
          .family-leaderboard-row > div:nth-child(5) {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .family-leaderboard-row {
            padding: 16px !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </main>
  );
}