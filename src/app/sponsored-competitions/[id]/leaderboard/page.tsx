"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Competition = {
  id: string;
  sponsor_name: string;
  sponsor_logo_url?: string | null;
  sponsor_banner_url?: string | null;
  title: string;
  description?: string | null;
  competition_type: "weekly" | "monthly";
  starts_at: string;
  ends_at: string;
  is_published: boolean;
};

type LeaderboardRow = {
  rank: number;
  display_name: string;
  username: string;
  total_xp: number;
  correct_answers: number;
  total_questions: number;
  total_answer_time_ms: number;
  completed_at: string;
  is_current_user: boolean;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function getRankIcon(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

export default function SponsoredCompetitionLeaderboardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const competitionId = params.id;

  const [competition, setCompetition] =
    useState<Competition | null>(null);

  const [leaderboard, setLeaderboard] =
    useState<LeaderboardRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");

  const loadLeaderboard = useCallback(
    async (showRefreshState = false) => {
      if (!competitionId) return;

      if (showRefreshState) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace("/login");
          return;
        }

        /*
         * ---------------------------------------------------------
         * LOAD COMPETITION
         * ---------------------------------------------------------
         */

        const {
          data: competitionData,
          error: competitionError,
        } = await supabase
          .from("sponsored_competitions")
          .select(
            `
              id,
              sponsor_name,
              sponsor_logo_url,
              sponsor_banner_url,
              title,
              description,
              competition_type,
              starts_at,
              ends_at,
              is_published
            `
          )
          .eq("id", competitionId)
          .eq("is_published", true)
          .maybeSingle();

        if (competitionError) {
          throw new Error(competitionError.message);
        }

        if (!competitionData) {
          throw new Error(
            "Sponsored competition not found."
          );
        }

        setCompetition(
          competitionData as Competition
        );

        /*
         * ---------------------------------------------------------
         * LOAD SECURE LEADERBOARD
         * ---------------------------------------------------------
         */

        const {
          data: leaderboardData,
          error: leaderboardError,
        } = await supabase.rpc(
          "get_sponsored_leaderboard",
          {
            p_competition_id: competitionId,
          }
        );

        if (leaderboardError) {
          throw new Error(
            leaderboardError.message
          );
        }

        const rows = (
          (leaderboardData ?? []) as LeaderboardRow[]
        ).map((row, index) => ({
          ...row,
          rank: Number(
            row.rank ?? index + 1
          ),
          total_xp: Number(
            row.total_xp ?? 0
          ),
          correct_answers: Number(
            row.correct_answers ?? 0
          ),
          total_questions: Number(
            row.total_questions ?? 0
          ),
          total_answer_time_ms: Number(
            row.total_answer_time_ms ?? 0
          ),
          is_current_user: Boolean(
            row.is_current_user
          ),
        }));

        setLeaderboard(rows);
      } catch (error) {
        console.error(
          "Sponsored leaderboard loading error:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the sponsored leaderboard."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [competitionId, router]
  );

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 42 }}>
            🏆
          </div>

          <h2>
            Loading Sponsored Leaderboard...
          </h2>

          <p
            style={{
              color: "var(--muted)",
              marginTop: 8,
            }}
          >
            Please wait.
          </p>
        </div>
      </main>
    );
  }

  if (message || !competition) {
    return (
      <main
        style={{
          minHeight: "100vh",
          padding: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <section
          className="sq-card"
          style={{
            width: "100%",
            maxWidth: 650,
            padding: 30,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48 }}>
            ⚠️
          </div>

          <h1
            className="sq-title"
            style={{ marginTop: 12 }}
          >
            Unable to Load Leaderboard
          </h1>

          <p
            className="sq-subtitle"
            style={{ marginTop: 10 }}
          >
            {message ||
              "This sponsored competition could not be found."}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 22,
            }}
          >
            <Link
              href="/sponsored-competitions"
              className="sq-button-primary"
            >
              Sponsored Competitions
            </Link>

            {competitionId && (
              <Link
                href={`/sponsored-competitions/${competitionId}`}
                className="sq-button-secondary"
              >
                Competition
              </Link>
            )}
          </div>
        </section>
      </main>
    );
  }

  const now = Date.now();
  const start = new Date(
    competition.starts_at
  ).getTime();
  const end = new Date(
    competition.ends_at
  ).getTime();

  const isUpcoming = now < start;
  const isLive =
    now >= start && now < end;
  const isEnded = now >= end;

  const topThree =
    leaderboard.slice(0, 3);

  const currentPlayer =
    leaderboard.find(
      (player) =>
        player.is_current_user
    );

  return (
    <main
      style={{
        minHeight: "100vh",
        paddingBottom: 60,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "28px 18px 0",
        }}
      >
        {/* HEADER */}

        <section
          className="sq-card"
          style={{
            padding: 24,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems:
                "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                minWidth: 0,
              }}
            >
              {competition.sponsor_logo_url ? (
                <img
                  src={
                    competition.sponsor_logo_url
                  }
                  alt={
                    competition.sponsor_name
                  }
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 12,
                    objectFit: "contain",
                    border:
                      "1px solid var(--border)",
                    background: "#fff",
                    padding: 5,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent:
                      "center",
                    background:
                      "var(--primary-light)",
                    fontSize: 28,
                    flexShrink: 0,
                  }}
                >
                  🏆
                </div>
              )}

              <div
                style={{
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color:
                      "var(--muted)",
                    textTransform:
                      "uppercase",
                    letterSpacing: ".04em",
                  }}
                >
                  Sponsored Competition
                </div>

                <h1
                  className="sq-title"
                  style={{
                    margin:
                      "5px 0 0",
                    fontSize: 28,
                  }}
                >
                  {competition.title}
                </h1>

                <p
                  style={{
                    margin:
                      "6px 0 0",
                    color:
                      "var(--muted)",
                    fontSize: 14,
                  }}
                >
                  Sponsored by{" "}
                  <strong>
                    {
                      competition.sponsor_name
                    }
                  </strong>
                </p>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              {isLive && (
                <span className="sq-badge">
                  🔴 LIVE
                </span>
              )}

              {isUpcoming && (
                <span className="sq-badge">
                  UPCOMING
                </span>
              )}

              {isEnded && (
                <span className="sq-badge">
                  ENDED
                </span>
              )}

              <span className="sq-badge">
                {competition.competition_type.toUpperCase()}
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 22,
            }}
          >
            <Link
              href={`/sponsored-competitions/${competition.id}`}
              className="sq-button-secondary"
            >
              ← Competition
            </Link>

            {isLive && (
              <Link
                href={`/sponsored-competitions/${competition.id}`}
                className="sq-button-primary"
              >
                Join Competition
              </Link>
            )}
          </div>
        </section>

        {/* COMPETITION INFORMATION */}

        <section
          className="sq-card"
          style={{
            padding: 20,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(190px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 15,
                border:
                  "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color:
                    "var(--muted)",
                  fontWeight: 800,
                }}
              >
                STARTS
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {formatDate(
                  competition.starts_at
                )}
              </div>
            </div>

            <div
              style={{
                padding: 15,
                border:
                  "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color:
                    "var(--muted)",
                  fontWeight: 800,
                }}
              >
                ENDS
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontWeight: 800,
                  fontSize: 14,
                }}
              >
                {formatDate(
                  competition.ends_at
                )}
              </div>
            </div>

            <div
              style={{
                padding: 15,
                border:
                  "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color:
                    "var(--muted)",
                  fontWeight: 800,
                }}
              >
                PLAYERS
              </div>

              <div
                style={{
                  marginTop: 6,
                  fontWeight: 900,
                  fontSize: 20,
                }}
              >
                {leaderboard.length}
              </div>
            </div>
          </div>
        </section>

        {/* CURRENT PLAYER */}

        {currentPlayer && (
          <section
            className="sq-card"
            style={{
              padding: 20,
              marginBottom: 18,
              border:
                "2px solid var(--primary)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 11,
                    color:
                      "var(--muted)",
                    fontWeight: 800,
                    letterSpacing:
                      ".05em",
                  }}
                >
                  YOUR RESULT
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 23,
                    fontWeight: 900,
                  }}
                >
                  {getRankIcon(
                    currentPlayer.rank
                  )}{" "}
                  Rank{" "}
                  {currentPlayer.rank}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <div
                  style={{
                    padding:
                      "10px 15px",
                    borderRadius: 10,
                    background:
                      "var(--primary-light)",
                    textAlign:
                      "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color:
                        "var(--muted)",
                    }}
                  >
                    SPONSORED XP
                  </div>

                  <strong
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: 20,
                    }}
                  >
                    {
                      currentPlayer.total_xp
                    }
                  </strong>
                </div>

                <div
                  style={{
                    padding:
                      "10px 15px",
                    borderRadius: 10,
                    background:
                      "var(--background)",
                    border:
                      "1px solid var(--border)",
                    textAlign:
                      "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color:
                        "var(--muted)",
                    }}
                  >
                    CORRECT
                  </div>

                  <strong
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: 20,
                    }}
                  >
                    {
                      currentPlayer.correct_answers
                    }
                    /
                    {
                      currentPlayer.total_questions
                    }
                  </strong>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* PODIUM */}

        {topThree.length > 0 && (
          <section
            className="sq-card"
            style={{
              padding: 24,
              marginBottom: 18,
            }}
          >
            <div
              style={{
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color:
                    "var(--muted)",
                  letterSpacing:
                    ".06em",
                }}
              >
                TOP PERFORMERS
              </div>

              <h2
                style={{
                  margin:
                    "6px 0 0",
                  fontSize: 25,
                }}
              >
                🏆 Sponsored
                Leaderboard
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 14,
                marginTop: 24,
              }}
            >
              {topThree.map(
                (player) => (
                  <div
                    key={`${player.username}-${player.rank}`}
                    style={{
                      border:
                        "1px solid var(--border)",
                      borderRadius: 16,
                      padding: 20,
                      textAlign:
                        "center",
                      background:
                        player.is_current_user
                          ? "var(--primary-light)"
                          : "var(--background)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 38,
                      }}
                    >
                      {getRankIcon(
                        player.rank
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontWeight: 900,
                        fontSize: 17,
                        overflowWrap:
                          "anywhere",
                      }}
                    >
                      {
                        player.display_name ||
                        "Player"
                      }
                    </div>

                    {player.username && (
                      <div
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                          color:
                            "var(--muted)",
                          overflowWrap:
                            "anywhere",
                        }}
                      >
                        @{player.username}
                      </div>
                    )}

                    {player.is_current_user && (
                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 11,
                          fontWeight: 900,
                        }}
                      >
                        YOU
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 15,
                        fontSize: 25,
                        fontWeight: 900,
                      }}
                    >
                      {
                        player.total_xp
                      }
                    </div>

                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 800,
                        color:
                          "var(--muted)",
                      }}
                    >
                      SPONSORED XP
                    </div>

                    <div
                      style={{
                        marginTop: 12,
                        fontSize: 13,
                      }}
                    >
                      {
                        player.correct_answers
                      }
                      /
                      {
                        player.total_questions
                      }{" "}
                      correct
                    </div>

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color:
                          "var(--muted)",
                      }}
                    >
                      Time:{" "}
                      {formatTime(
                        player.total_answer_time_ms
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </section>
        )}

        {/* FULL LEADERBOARD */}

        <section
          className="sq-card"
          style={{
            padding: 20,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 18,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 22,
                }}
              >
                {isEnded
                  ? "Final Leaderboard"
                  : "Current Leaderboard"}
              </h2>

              <p
                className="sq-subtitle"
                style={{
                  margin:
                    "5px 0 0",
                }}
              >
                Higher Sponsored XP
                ranks first.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void loadLeaderboard(
                  true
                )
              }
              disabled={refreshing}
              className="sq-button-secondary"
              style={{
                cursor: refreshing
                  ? "not-allowed"
                  : "pointer",
                opacity: refreshing
                  ? 0.65
                  : 1,
              }}
            >
              {refreshing
                ? "Refreshing..."
                : "↻ Refresh"}
            </button>
          </div>

          {leaderboard.length ===
          0 ? (
            <div
              style={{
                padding:
                  "45px 20px",
                textAlign:
                  "center",
                border:
                  "1px dashed var(--border)",
                borderRadius: 14,
              }}
            >
              <div
                style={{
                  fontSize: 42,
                }}
              >
                🏆
              </div>

              <h3
                style={{
                  marginTop: 10,
                }}
              >
                No completed
                attempts yet
              </h3>

              <p
                className="sq-subtitle"
                style={{
                  maxWidth: 500,
                  margin:
                    "8px auto 0",
                }}
              >
                Once players
                complete the
                competition,
                their results
                will appear
                here.
              </p>
            </div>
          ) : (
            <div
              style={{
                overflowX:
                  "auto",
                WebkitOverflowScrolling:
                  "touch",
              }}
            >
              <table
                style={{
                  width: "100%",
                  minWidth: 760,
                  borderCollapse:
                    "collapse",
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom:
                        "1px solid var(--border)",
                    }}
                  >
                    <th
                      style={{
                        textAlign:
                          "left",
                        padding:
                          "12px 10px",
                        fontSize: 11,
                        color:
                          "var(--muted)",
                      }}
                    >
                      RANK
                    </th>

                    <th
                      style={{
                        textAlign:
                          "left",
                        padding:
                          "12px 10px",
                        fontSize: 11,
                        color:
                          "var(--muted)",
                      }}
                    >
                      PLAYER
                    </th>

                    <th
                      style={{
                        textAlign:
                          "right",
                        padding:
                          "12px 10px",
                        fontSize: 11,
                        color:
                          "var(--muted)",
                      }}
                    >
                      SPONSORED XP
                    </th>

                    <th
                      style={{
                        textAlign:
                          "right",
                        padding:
                          "12px 10px",
                        fontSize: 11,
                        color:
                          "var(--muted)",
                      }}
                    >
                      CORRECT
                    </th>

                    <th
                      style={{
                        textAlign:
                          "right",
                        padding:
                          "12px 10px",
                        fontSize: 11,
                        color:
                          "var(--muted)",
                      }}
                    >
                      TOTAL TIME
                    </th>

                    <th
                      style={{
                        textAlign:
                          "right",
                        padding:
                          "12px 10px",
                        fontSize: 11,
                        color:
                          "var(--muted)",
                      }}
                    >
                      COMPLETED
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {leaderboard.map(
                    (player) => (
                      <tr
                        key={`${player.username}-${player.rank}`}
                        style={{
                          borderBottom:
                            "1px solid var(--border)",
                          background:
                            player.is_current_user
                              ? "var(--primary-light)"
                              : "transparent",
                        }}
                      >
                        <td
                          style={{
                            padding:
                              "14px 10px",
                            fontWeight:
                              900,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {getRankIcon(
                            player.rank
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 10px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight:
                                800,
                            }}
                          >
                            {
                              player.display_name ||
                              "Player"
                            }

                            {player.is_current_user && (
                              <span
                                style={{
                                  marginLeft:
                                    8,
                                  fontSize:
                                    10,
                                  fontWeight:
                                    900,
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
                                  2,
                                color:
                                  "var(--muted)",
                                fontSize:
                                  12,
                              }}
                            >
                              @
                              {
                                player.username
                              }
                            </div>
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 10px",
                            textAlign:
                              "right",
                            fontWeight:
                              900,
                            fontSize:
                              16,
                          }}
                        >
                          {
                            player.total_xp
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 10px",
                            textAlign:
                              "right",
                            fontWeight:
                              700,
                          }}
                        >
                          {
                            player.correct_answers
                          }
                          /
                          {
                            player.total_questions
                          }
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 10px",
                            textAlign:
                              "right",
                            fontWeight:
                              700,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {formatTime(
                            player.total_answer_time_ms
                          )}
                        </td>

                        <td
                          style={{
                            padding:
                              "14px 10px",
                            textAlign:
                              "right",
                            color:
                              "var(--muted)",
                            fontSize:
                              12,
                            whiteSpace:
                              "nowrap",
                          }}
                        >
                          {formatDate(
                            player.completed_at
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* RANKING RULES */}

        <section
          className="sq-card"
          style={{
            padding: 20,
            marginTop: 18,
          }}
        >
          <h3
            style={{
              marginTop: 0,
              marginBottom: 10,
            }}
          >
            How Sponsored Ranking Works
          </h3>

          <ol
            style={{
              margin: 0,
              paddingLeft: 22,
              color: "var(--muted)",
              lineHeight: 1.7,
              fontSize: 14,
            }}
          >
            <li>
              Higher Sponsored XP ranks
              higher.
            </li>

            <li>
              If XP is tied, more correct
              answers rank higher.
            </li>

            <li>
              If those are also tied, the
              lower total answer time ranks
              higher.
            </li>

            <li>
              If everything is still tied,
              the earlier completion time
              ranks higher.
            </li>
          </ol>

          <p
            style={{
              marginBottom: 0,
              marginTop: 14,
              color: "var(--muted)",
              fontSize: 13,
            }}
          >
            Sponsored XP is completely
            separate from your normal
            Sahaba Quest XP and does not
            affect the normal global
            leaderboard.
          </p>
        </section>
      </div>
    </main>
  );
}