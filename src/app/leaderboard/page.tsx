"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type LeaderboardRow = {
  user_id: string;
  display_name: string;
  username: string;
  monthly_xp: number;
  total_xp: number;
  current_level: number;
  current_streak: number;
};

type RankedPlayer = LeaderboardRow & {
  rank: number;
};

type Climber = {
  user_id: string;
  display_name: string;
  username: string;
  current_rank: number;
  previous_rank: number;
  positions_gained: number;
  current_xp: number;
};

type Period = {
  id: string;
  label: string;
  start: Date | null;
  end: Date | null;
};

type MonthlyLeaderboardResult = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  monthly_xp: number | string | null;
  total_xp: number | string | null;
  current_level: number | null;
  current_streak: number | null;
};

type AllTimeLeaderboardResult = {
  user_id: string;
  total_xp: number | null;
  current_level: number | null;
  current_streak: number | null;
  profiles:
    | {
        display_name: string | null;
        username: string | null;
      }
    | {
        display_name: string | null;
        username: string | null;
      }[]
    | null;
};

/*
 * LEADERBOARD HISTORY STARTS HERE
 *
 * September = 8 because JavaScript months are zero-based:
 * January = 0
 * February = 1
 * ...
 * September = 8
 */
const LEADERBOARD_START_YEAR = 2026;
const LEADERBOARD_START_MONTH = 8;

function getMonthPeriods(): Period[] {
  const now = new Date();

  const periods: Period[] = [
    {
      id: "all-time",
      label: "All Time",
      start: null,
      end: null,
    },
  ];

  const startMonth = new Date(
    LEADERBOARD_START_YEAR,
    LEADERBOARD_START_MONTH,
    1
  );

  let currentMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    1
  );

  /*
   * Add only months from September 2026
   * up to the current month.
   */
  while (currentMonth >= startMonth) {
    const nextMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      1
    );

    periods.push({
      id: `${currentMonth.getFullYear()}-${String(
        currentMonth.getMonth() + 1
      ).padStart(2, "0")}`,
      label: currentMonth.toLocaleDateString(
        "en-US",
        {
          month: "long",
          year: "numeric",
        }
      ),
      start: currentMonth,
      end: nextMonth,
    });

    currentMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() - 1,
      1
    );
  }

  return periods;
}

function getPreviousMonthPeriod(
  selectedPeriod: Period
): Period | null {
  if (
    !selectedPeriod.start ||
    !selectedPeriod.end
  ) {
    return null;
  }

  const previousMonth = new Date(
    selectedPeriod.start.getFullYear(),
    selectedPeriod.start.getMonth() - 1,
    1
  );

  const leaderboardStart = new Date(
    LEADERBOARD_START_YEAR,
    LEADERBOARD_START_MONTH,
    1
  );

  /*
   * September 2026 is the first official
   * monthly leaderboard.
   *
   * Therefore September has no previous
   * leaderboard month to compare against.
   */
  if (previousMonth < leaderboardStart) {
    return null;
  }

  const previousMonthEnd = new Date(
    selectedPeriod.start.getFullYear(),
    selectedPeriod.start.getMonth(),
    1
  );

  return {
    id: `${previousMonth.getFullYear()}-${String(
      previousMonth.getMonth() + 1
    ).padStart(2, "0")}`,
    label: previousMonth.toLocaleDateString(
      "en-US",
      {
        month: "long",
        year: "numeric",
      }
    ),
    start: previousMonth,
    end: previousMonthEnd,
  };
}

function sortLeaderboardPlayers(
  players: LeaderboardRow[]
): LeaderboardRow[] {
  return [...players].sort(
    (a: LeaderboardRow, b: LeaderboardRow) => {
      if (b.monthly_xp !== a.monthly_xp) {
        return b.monthly_xp - a.monthly_xp;
      }

      return b.total_xp - a.total_xp;
    }
  );
}

function addRanks(
  players: LeaderboardRow[]
): RankedPlayer[] {
  return players.map(
    (player: LeaderboardRow, index: number) => ({
      ...player,
      rank: index + 1,
    })
  );
}

export default function LeaderboardPage() {
  const [players, setPlayers] = useState<
    RankedPlayer[]
  >([]);

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [loading, setLoading] = useState(true);

  const [message, setMessage] =
    useState("");

  const [selectedPeriod, setSelectedPeriod] =
    useState("all-time");

  const [climbers, setClimbers] = useState<
    Climber[]
  >([]);

  const periods = getMonthPeriods();

  useEffect(() => {
    loadLeaderboard();
  }, [selectedPeriod]);

  async function loadLeaderboard() {
    setLoading(true);
    setMessage("");
    setClimbers([]);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      setLoading(false);
      return;
    }

    setCurrentUserId(user.id);

    const selected = periods.find(
      (period: Period) =>
        period.id === selectedPeriod
    );

    if (!selected) {
      setMessage(
        "Unable to determine leaderboard period."
      );
      setLoading(false);
      return;
    }

    /*
     * ALL-TIME LEADERBOARD
     */
    if (selected.id === "all-time") {
      const { data, error } =
        await supabase
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
          .order("total_xp", {
            ascending: false,
          });

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      const allTimeData =
        (data ?? []) as unknown as AllTimeLeaderboardResult[];

      const formattedPlayers: LeaderboardRow[] =
        allTimeData.map(
          (
            player: AllTimeLeaderboardResult
          ) => {
            const profile = Array.isArray(
              player.profiles
            )
              ? player.profiles[0]
              : player.profiles;

            return {
              user_id: player.user_id,
              display_name:
                profile?.display_name ||
                "Player",
              username:
                profile?.username || "",
              monthly_xp:
                Number(
                  player.total_xp || 0
                ),
              total_xp:
                Number(
                  player.total_xp || 0
                ),
              current_level:
                Number(
                  player.current_level ||
                    1
                ),
              current_streak:
                Number(
                  player.current_streak ||
                    0
                ),
            };
          }
        );

      const sortedPlayers =
        sortLeaderboardPlayers(
          formattedPlayers
        );

      setPlayers(
        addRanks(sortedPlayers)
      );

      setLoading(false);
      return;
    }

    /*
     * MONTHLY LEADERBOARD
     */
    if (
      !selected.start ||
      !selected.end
    ) {
      setMessage(
        "Invalid leaderboard period."
      );
      setLoading(false);
      return;
    }

    const {
      data,
      error,
    } = await supabase.rpc(
      "get_monthly_leaderboard",
      {
        start_date:
          selected.start.toISOString(),
        end_date:
          selected.end.toISOString(),
      }
    );

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }

    const monthlyData =
      (data ?? []) as MonthlyLeaderboardResult[];

    const formattedPlayers: LeaderboardRow[] =
      monthlyData
        .filter(
          (
            player: MonthlyLeaderboardResult
          ) =>
            Number(
              player.monthly_xp || 0
            ) > 0
        )
        .map(
          (
            player: MonthlyLeaderboardResult
          ) => ({
            user_id: player.user_id,
            display_name:
              player.display_name ||
              "Player",
            username:
              player.username || "",
            monthly_xp:
              Number(
                player.monthly_xp || 0
              ),
            total_xp:
              Number(
                player.total_xp || 0
              ),
            current_level:
              Number(
                player.current_level ||
                  1
              ),
            current_streak:
              Number(
                player.current_streak ||
                  0
              ),
          })
        );

    const sortedPlayers =
      sortLeaderboardPlayers(
        formattedPlayers
      );

    const rankedPlayers =
      addRanks(sortedPlayers);

    setPlayers(rankedPlayers);

    /*
     * BIGGEST CLIMBERS
     */
    const previousPeriod =
      getPreviousMonthPeriod(
        selected
      );

    if (previousPeriod) {
      const {
        data: previousData,
        error: previousError,
      } = await supabase.rpc(
        "get_monthly_leaderboard",
        {
          start_date:
            previousPeriod.start!.toISOString(),
          end_date:
            previousPeriod.end!.toISOString(),
        }
      );

      if (!previousError) {
        const previousMonthlyData =
          (previousData ??
            []) as MonthlyLeaderboardResult[];

        const previousPlayers:
          LeaderboardRow[] =
          previousMonthlyData
            .filter(
              (
                player: MonthlyLeaderboardResult
              ) =>
                Number(
                  player.monthly_xp ||
                    0
                ) > 0
            )
            .map(
              (
                player: MonthlyLeaderboardResult
              ) => ({
                user_id:
                  player.user_id,
                display_name:
                  player.display_name ||
                  "Player",
                username:
                  player.username || "",
                monthly_xp:
                  Number(
                    player.monthly_xp ||
                      0
                  ),
                total_xp:
                  Number(
                    player.total_xp ||
                      0
                  ),
                current_level:
                  Number(
                    player.current_level ||
                      1
                  ),
                current_streak:
                  Number(
                    player.current_streak ||
                      0
                  ),
              })
            );

        const sortedPreviousPlayers =
          sortLeaderboardPlayers(
            previousPlayers
          );

        const rankedPreviousPlayers =
          addRanks(
            sortedPreviousPlayers
          );

        const previousRankMap =
          new Map<string, number>();

        rankedPreviousPlayers.forEach(
          (
            player: RankedPlayer
          ) => {
            previousRankMap.set(
              player.user_id,
              player.rank
            );
          }
        );

        const calculatedClimbers: Climber[] =
          rankedPlayers
            .map(
              (
                player: RankedPlayer
              ) => {
                const previousRank =
                  previousRankMap.get(
                    player.user_id
                  );

                if (
                  previousRank ===
                    undefined ||
                  previousRank <=
                    player.rank
                ) {
                  return null;
                }

                return {
                  user_id:
                    player.user_id,
                  display_name:
                    player.display_name,
                  username:
                    player.username,
                  current_rank:
                    player.rank,
                  previous_rank:
                    previousRank,
                  positions_gained:
                    previousRank -
                    player.rank,
                  current_xp:
                    player.monthly_xp,
                };
              }
            )
            .filter(
              (
                player
              ): player is Climber =>
                player !== null
            )
            .sort(
              (
                a: Climber,
                b: Climber
              ) =>
                b.positions_gained -
                a.positions_gained
            )
            .slice(0, 5);

        setClimbers(
          calculatedClimbers
        );
      }
    }

    setLoading(false);
  }

  const selectedPeriodLabel =
    periods.find(
      (period: Period) =>
        period.id === selectedPeriod
    )?.label || "All Time";

  const isAllTime =
    selectedPeriod === "all-time";

  const currentUser =
    players.find(
      (player: RankedPlayer) =>
        player.user_id ===
        currentUserId
    );

  const currentUserRank =
    currentUser?.rank ?? null;

  const topThree =
    players.slice(0, 3);

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
            alignItems:
              "center",
            justifyContent:
              "center",
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
                margin:
                  "0 auto 20px",
                width: "64px",
                height: "64px",
                fontSize: "18px",
              }}
            >
              🏆
            </div>

            <h2
              style={{
                margin: 0,
              }}
            >
              Loading leaderboard...
            </h2>

            <p className="sq-subtitle">
              We're getting the
              latest rankings.
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
            alignItems:
              "center",
            justifyContent:
              "center",
          }}
        >
          <div
            className="sq-card"
            style={{
              maxWidth: "500px",
              width: "100%",
              padding: "36px",
              textAlign:
                "center",
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Unable to load
              leaderboard
            </h2>

            <p className="sq-subtitle">
              {message}
            </p>

            <button
              type="button"
              className="sq-button-primary"
              style={{
                marginTop:
                  "20px",
                border: "none",
                cursor:
                  "pointer",
              }}
              onClick={
                loadLeaderboard
              }
            >
              Try Again
            </button>
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
        background:
          "var(--background)",
      }}
    >
      <AppNavbar />

      <div className="sq-page">
        <div className="sq-container">

          {/* HEADER */}
          <section
            style={{
              marginBottom:
                "28px",
            }}
          >
            <span className="sq-badge">
              Compete & grow
            </span>

            <h1
              className="sq-title"
              style={{
                marginTop:
                  "16px",
              }}
            >
              Global Leaderboard 🏆
            </h1>

            <p className="sq-subtitle">
              See how you rank among
              fellow Sahaba Quest
              players.
            </p>
          </section>

          {/* PERIOD SELECTOR */}
          <section
            className="sq-card"
            style={{
              marginBottom:
                "28px",
              padding: "20px",
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
                gap: "16px",
                flexWrap:
                  "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize:
                      "12px",
                    fontWeight:
                      800,
                    color:
                      "var(--muted)",
                    textTransform:
                      "uppercase",
                    letterSpacing:
                      "0.5px",
                  }}
                >
                  Ranking period
                </div>

                <div
                  style={{
                    marginTop:
                      "4px",
                    fontSize:
                      "20px",
                    fontWeight:
                      900,
                  }}
                >
                  {
                    selectedPeriodLabel
                  }
                </div>
              </div>

              <select
                value={
                  selectedPeriod
                }
                onChange={(
                  event
                ) =>
                  setSelectedPeriod(
                    event.target
                      .value
                  )
                }
                style={{
                  minWidth:
                    "210px",
                  padding:
                    "12px 14px",
                  borderRadius:
                    "10px",
                  border:
                    "1px solid var(--border)",
                  background:
                    "var(--background)",
                  color:
                    "var(--foreground)",
                  fontSize:
                    "14px",
                  fontWeight:
                    700,
                  outline:
                    "none",
                  cursor:
                    "pointer",
                }}
              >
                {periods.map(
                  (
                    period: Period
                  ) => (
                    <option
                      key={
                        period.id
                      }
                      value={
                        period.id
                      }
                    >
                      {
                        period.label
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div
              style={{
                marginTop:
                  "14px",
                paddingTop:
                  "14px",
                borderTop:
                  "1px solid var(--border)",
                color:
                  "var(--muted)",
                fontSize:
                  "13px",
                lineHeight:
                  1.6,
              }}
            >
              {isAllTime
                ? "All-time rankings are based on your total accumulated XP."
                : `Monthly rankings are based on XP earned during ${selectedPeriodLabel}.`}
            </div>
          </section>

          {players.length ===
          0 ? (
            /* EMPTY STATE */
            <div
              className="sq-card"
              style={{
                padding:
                  "60px 30px",
                textAlign:
                  "center",
              }}
            >
              <div
                style={{
                  fontSize:
                    "50px",
                  marginBottom:
                    "18px",
                }}
              >
                🏆
              </div>

              <h2
                style={{
                  margin: 0,
                }}
              >
                {isAllTime
                  ? "The leaderboard is waiting."
                  : `No rankings yet for ${selectedPeriodLabel}.`}
              </h2>

              <p className="sq-subtitle">
                {isAllTime
                  ? "Start playing to become one of the first players on the board."
                  : "Start playing this month to earn XP and appear on the leaderboard."}
              </p>

              <Link
                href="/quiz"
                className="sq-button-primary"
                style={{
                  marginTop:
                    "20px",
                }}
              >
                Start Playing
              </Link>
            </div>
          ) : (
            <>
              {/* PODIUM */}
              <section
                className="leaderboard-podium"
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: "18px",
                  alignItems:
                    "end",
                  marginBottom:
                    "28px",
                }}
              >
                {topThree.map(
                  (
                    player: RankedPlayer,
                    index: number
                  ) => {
                    const rank =
                      index + 1;

                    const isCurrentUser =
                      player.user_id ===
                      currentUserId;

                    const displayedXp =
                      isAllTime
                        ? player.total_xp
                        : player.monthly_xp;

                    return (
                      <div
                        key={
                          player.user_id
                        }
                        className="sq-card"
                        style={{
                          padding:
                            "28px 22px",
                          textAlign:
                            "center",
                          position:
                            "relative",
                          transform:
                            rank ===
                            1
                              ? "translateY(-12px)"
                              : "none",
                          border:
                            isCurrentUser
                              ? "2px solid var(--primary)"
                              : undefined,
                        }}
                      >
                        {rank ===
                          1 && (
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
                            {isAllTime
                              ? "All-Time Champion"
                              : `${selectedPeriodLabel} Champion`}
                          </div>
                        )}

                        {isCurrentUser && (
                          <div
                            style={{
                              position:
                                "absolute",
                              top:
                                "12px",
                              right:
                                "12px",
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

                        <div
                          style={{
                            fontSize:
                              "38px",
                            marginBottom:
                              "10px",
                          }}
                        >
                          {rank ===
                          1
                            ? "🥇"
                            : rank ===
                              2
                              ? "🥈"
                              : "🥉"}
                        </div>

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
                          {displayedXp.toLocaleString()}
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
                          XP
                        </div>

                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "center",
                            gap:
                              "14px",
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

              {/* BIGGEST CLIMBERS */}
              {!isAllTime &&
                climbers.length >
                  0 && (
                  <section
                    className="sq-card"
                    style={{
                      marginBottom:
                        "28px",
                      overflow:
                        "hidden",
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
                          gap: "10px",
                        }}
                      >
                        <span
                          style={{
                            fontSize:
                              "22px",
                          }}
                        >
                          📈
                        </span>

                        <div>
                          <h2
                            style={{
                              margin:
                                0,
                              fontSize:
                                "22px",
                              fontWeight:
                                800,
                            }}
                          >
                            Biggest Climbers
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
                            Players who have moved up the most positions compared with the previous month.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      {climbers.map(
                        (
                          player: Climber,
                          index: number
                        ) => (
                          <div
                            key={
                              player.user_id
                            }
                            style={{
                              display:
                                "grid",
                              gridTemplateColumns:
                                "45px 1fr auto",
                              alignItems:
                                "center",
                              gap:
                                "14px",
                              padding:
                                "16px 26px",
                              borderBottom:
                                index <
                                climbers.length -
                                  1
                                  ? "1px solid var(--border)"
                                  : undefined,
                            }}
                          >
                            <div
                              style={{
                                fontSize:
                                  "20px",
                                fontWeight:
                                  900,
                                color:
                                  "var(--muted)",
                              }}
                            >
                              #
                              {index +
                                1}
                            </div>

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
                              </div>

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
                                #
                                {
                                  player.previous_rank
                                }
                                {" → "}
                                #
                                {
                                  player.current_rank
                                }
                              </div>
                            </div>

                            <div
                              style={{
                                textAlign:
                                  "right",
                              }}
                            >
                              <div
                                style={{
                                  color:
                                    "var(--primary)",
                                  fontWeight:
                                    900,
                                }}
                              >
                                ↑{" "}
                                {
                                  player.positions_gained
                                }
                              </div>

                              <div
                                style={{
                                  marginTop:
                                    "3px",
                                  color:
                                    "var(--muted)",
                                  fontSize:
                                    "11px",
                                }}
                              >
                                positions
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}

              {/* PLAYER RANKINGS */}
              <section
                className="sq-card"
                style={{
                  overflow:
                    "hidden",
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
                          margin:
                            0,
                          fontSize:
                            "22px",
                          fontWeight:
                            800,
                        }}
                      >
                        Player Rankings
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
                        {isAllTime
                          ? "Rankings are based on total XP."
                          : `Rankings are based on XP earned in ${selectedPeriodLabel}.`}
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
                    (
                      player: RankedPlayer
                    ) => {
                      const isCurrentUser =
                        player.user_id ===
                        currentUserId;

                      const displayedXp =
                        isAllTime
                          ? player.total_xp
                          : player.monthly_xp;

                      return (
                        <div
                          key={
                            player.user_id
                          }
                          className="leaderboard-row"
                          style={{
                            display:
                              "grid",
                            gridTemplateColumns:
                              "70px 1fr 100px 90px 90px",
                            alignItems:
                              "center",
                            gap:
                              "16px",
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

                          <div
                            style={{
                              fontWeight:
                                800,
                              color:
                                "var(--primary)",
                            }}
                          >
                            {displayedXp.toLocaleString()}{" "}
                            XP
                          </div>

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

                {players.length >
                  100 && (
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
                    Showing the top
                    100 players.
                  </div>
                )}
              </section>

              {/* CURRENT USER POSITION */}
              {currentUserRank !==
                null && (
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
                    gap:
                      "20px",
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
                      Your position
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
                        currentUserRank
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
                        selectedPeriodLabel
                      }
                    </div>
                  </div>

                  <Link
                    href="/quiz"
                    className="sq-button-secondary"
                    style={{
                      border:
                        "none",
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
            grid-template-columns:
              1fr !important;
          }

          .leaderboard-podium > div {
            transform:
              none !important;
          }

          .leaderboard-row {
            grid-template-columns:
              55px 1fr 80px !important;
          }

          .leaderboard-row > div:nth-child(4),
          .leaderboard-row > div:nth-child(5) {
            display: none;
          }
        }

        @media (max-width: 520px) {
          .leaderboard-row {
            padding:
              16px !important;
            gap:
              10px !important;
          }

          select {
            width:
              100% !important;
            min-width:
              0 !important;
          }
        }
      `}</style>
    </main>
  );
}