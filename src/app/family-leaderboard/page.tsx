"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type FamilyLeaderboardRow = {
  user_id: string;
  display_name: string;
  username: string;
  monthly_xp: number;
  total_xp: number;
  current_level: number;
  current_streak: number;
};

type RankedPlayer = FamilyLeaderboardRow & {
  rank: number;
};

type Period = {
  id: string;
  label: string;
  start: Date | null;
  end: Date | null;
};

type MonthlyFamilyLeaderboardResult = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  monthly_xp: number | string | null;
  total_xp: number | string | null;
  current_level: number | null;
  current_streak: number | null;
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

const LEADERBOARD_START_YEAR = 2026;
const LEADERBOARD_START_MONTH = 8; // September (0-based)

function getLagosYearMonth(): {
  year: number;
  month: number;
} {
  const parts = new Intl.DateTimeFormat(
    "en-US",
    {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
    }
  ).formatToParts(new Date());

  const year = Number(
    parts.find((part) => part.type === "year")?.value
  );

  const month = Number(
    parts.find((part) => part.type === "month")?.value
  );

  return {
    year,
    month,
  };
}

function getMonthPeriods(): Period[] {
  const { year, month } = getLagosYearMonth();

  const periods: Period[] = [
    {
      id: "all-time",
      label: "All Time",
      start: null,
      end: null,
    },
  ];

  const startMonth = new Date(
    Date.UTC(
      LEADERBOARD_START_YEAR,
      LEADERBOARD_START_MONTH,
      1
    )
  );

  let currentMonth = new Date(
    Date.UTC(year, month - 1, 1)
  );

  while (currentMonth >= startMonth) {
    const nextMonth = new Date(
      Date.UTC(
        currentMonth.getUTCFullYear(),
        currentMonth.getUTCMonth() + 1,
        1
      )
    );

    periods.push({
      id: `${currentMonth.getUTCFullYear()}-${String(
        currentMonth.getUTCMonth() + 1
      ).padStart(2, "0")}`,
      label: currentMonth.toLocaleDateString(
        "en-US",
        {
          timeZone: "Africa/Lagos",
          month: "long",
          year: "numeric",
        }
      ),
      start: currentMonth,
      end: nextMonth,
    });

    currentMonth = new Date(
      Date.UTC(
        currentMonth.getUTCFullYear(),
        currentMonth.getUTCMonth() - 1,
        1
      )
    );
  }

  return periods;
}

function getPreviousMonthPeriod(
  selectedPeriod: Period
): Period | null {
  if (!selectedPeriod.start || !selectedPeriod.end) {
    return null;
  }

  const previousMonth = new Date(
    Date.UTC(
      selectedPeriod.start.getUTCFullYear(),
      selectedPeriod.start.getUTCMonth() - 1,
      1
    )
  );

  const leaderboardStart = new Date(
    Date.UTC(
      LEADERBOARD_START_YEAR,
      LEADERBOARD_START_MONTH,
      1
    )
  );

  if (previousMonth < leaderboardStart) {
    return null;
  }

  const previousMonthEnd = new Date(
    Date.UTC(
      selectedPeriod.start.getUTCFullYear(),
      selectedPeriod.start.getUTCMonth(),
      1
    )
  );

  return {
    id: `${previousMonth.getUTCFullYear()}-${String(
      previousMonth.getUTCMonth() + 1
    ).padStart(2, "0")}`,
    label: previousMonth.toLocaleDateString(
      "en-US",
      {
        timeZone: "Africa/Lagos",
        month: "long",
        year: "numeric",
      }
    ),
    start: previousMonth,
    end: previousMonthEnd,
  };
}

function sortLeaderboardPlayers(
  players: FamilyLeaderboardRow[]
): FamilyLeaderboardRow[] {
  return [...players].sort(
    (a: FamilyLeaderboardRow, b: FamilyLeaderboardRow) => {
      if (b.monthly_xp !== a.monthly_xp) {
        return b.monthly_xp - a.monthly_xp;
      }

      return b.total_xp - a.total_xp;
    }
  );
}

function addRanks(
  players: FamilyLeaderboardRow[]
): RankedPlayer[] {
  return players.map(
    (player: FamilyLeaderboardRow, index: number) => ({
      ...player,
      rank: index + 1,
    })
  );
}

function getCurrentMonthPeriod(): string {
  const { year, month } = getLagosYearMonth();

  return `${year}-${String(month).padStart(2, "0")}`;
}

export default function FamilyLeaderboardPage() {
  const [players, setPlayers] = useState<RankedPlayer[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState("all-time");
  const [climbers, setClimbers] = useState<Climber[]>([]);

  const periods = getMonthPeriods();

  useEffect(() => {
    void loadLeaderboard();
  }, [selectedPeriod]);

  async function loadLeaderboard() {
    setLoading(true);
    setMessage("");
    setClimbers([]);

    try {
      /*
       * GET CURRENT USER
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setMessage("You are not logged in.");
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const selected = periods.find(
        (period) => period.id === selectedPeriod
      );

      if (!selected) {
        setMessage("Unable to determine leaderboard period.");
        setLoading(false);
        return;
      }

      /*
       * ---------------------------------------------------------
       * ALL-TIME FAMILY LEADERBOARD
       * ---------------------------------------------------------
       *
       * Family XP remains completely separate from Individual XP.
       * This continues to read family_player_progress.total_xp.
       */
      if (selected.id === "all-time") {
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
          throw profilesError;
        }

        const familyUserIds = (familyProfiles ?? []).map(
          (profile: { id: string }) => profile.id
        );

        if (familyUserIds.length === 0) {
          setPlayers([]);
          setLoading(false);
          return;
        }

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
          throw progressError;
        }

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
                profile?.display_name || "Family Player",
              username: profile?.username || "",
              monthly_xp: Number(player.total_xp || 0),
              total_xp: Number(player.total_xp || 0),
              current_level: Number(
                player.current_level || 1
              ),
              current_streak: Number(
                player.current_streak || 0
              ),
            };
          }
        );

        const rankedPlayers = addRanks(
          sortLeaderboardPlayers(formattedPlayers)
        );

        setPlayers(rankedPlayers);
        setLoading(false);
        return;
      }

      /*
       * ---------------------------------------------------------
       * MONTHLY FAMILY LEADERBOARD
       * ---------------------------------------------------------
       *
       * Monthly Family XP is calculated server-side from the actual
       * Family XP earning records, rather than trying to derive a
       * monthly value from lifetime total_xp.
       */
      if (!selected.start || !selected.end) {
        setMessage("Invalid leaderboard period.");
        setLoading(false);
        return;
      }

      const {
        data: monthlyData,
        error: monthlyError,
      } = await supabase.rpc(
        "get_monthly_family_leaderboard",
        {
          start_date: selected.start
            .toISOString()
            .slice(0, 10),
          end_date: selected.end
            .toISOString()
            .slice(0, 10),
        }
      );

      if (monthlyError) {
        throw monthlyError;
      }

      const monthlyRows =
        (monthlyData ?? []) as MonthlyFamilyLeaderboardResult[];

      const formattedPlayers: FamilyLeaderboardRow[] =
        monthlyRows
          .filter(
            (player) =>
              Number(player.monthly_xp || 0) > 0
          )
          .map((player) => ({
            user_id: player.user_id,
            display_name:
              player.display_name || "Family Player",
            username: player.username || "",
            monthly_xp: Number(
              player.monthly_xp || 0
            ),
            total_xp: Number(
              player.total_xp || 0
            ),
            current_level: Number(
              player.current_level || 1
            ),
            current_streak: Number(
              player.current_streak || 0
            ),
          }));

      const rankedPlayers = addRanks(
        sortLeaderboardPlayers(formattedPlayers)
      );

      setPlayers(rankedPlayers);

      /*
       * ---------------------------------------------------------
       * BIGGEST CLIMBERS
       * ---------------------------------------------------------
       */
      const previousPeriod =
        getPreviousMonthPeriod(selected);

      if (previousPeriod) {
        const {
          data: previousData,
          error: previousError,
        } = await supabase.rpc(
          "get_monthly_family_leaderboard",
          {
            start_date: previousPeriod.start!
              .toISOString()
              .slice(0, 10),
            end_date: previousPeriod.end!
              .toISOString()
              .slice(0, 10),
          }
        );

        if (!previousError) {
          const previousRows =
            (previousData ??
              []) as MonthlyFamilyLeaderboardResult[];

          const previousPlayers: FamilyLeaderboardRow[] =
            previousRows
              .filter(
                (player) =>
                  Number(player.monthly_xp || 0) > 0
              )
              .map((player) => ({
                user_id: player.user_id,
                display_name:
                  player.display_name || "Family Player",
                username: player.username || "",
                monthly_xp: Number(
                  player.monthly_xp || 0
                ),
                total_xp: Number(
                  player.total_xp || 0
                ),
                current_level: Number(
                  player.current_level || 1
                ),
                current_streak: Number(
                  player.current_streak || 0
                ),
              }));

          const rankedPreviousPlayers =
            addRanks(
              sortLeaderboardPlayers(
                previousPlayers
              )
            );

          const previousRankMap =
            new Map<string, number>();

          rankedPreviousPlayers.forEach(
            (player) => {
              previousRankMap.set(
                player.user_id,
                player.rank
              );
            }
          );

          const calculatedClimbers: Climber[] =
            rankedPlayers
              .map((player) => {
                const previousRank =
                  previousRankMap.get(
                    player.user_id
                  );

                if (
                  previousRank === undefined ||
                  previousRank <= player.rank
                ) {
                  return null;
                }

                return {
                  user_id: player.user_id,
                  display_name:
                    player.display_name,
                  username: player.username,
                  current_rank: player.rank,
                  previous_rank: previousRank,
                  positions_gained:
                    previousRank - player.rank,
                  current_xp:
                    player.monthly_xp,
                };
              })
              .filter(
                (player): player is Climber =>
                  player !== null
              )
              .sort(
                (a, b) =>
                  b.positions_gained -
                  a.positions_gained
              )
              .slice(0, 5);

          setClimbers(calculatedClimbers);
        }
      }
    } catch (error: any) {
      console.error("Family leaderboard loading error:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error,
      });

      setMessage(
        error?.message ||
          "We couldn't load the Family leaderboard."
      );
    } finally {
      setLoading(false);
    }
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

  const selectedPeriodLabel =
    periods.find(
      (period) => period.id === selectedPeriod
    )?.label || "All Time";

  const isAllTime =
    selectedPeriod === "all-time";

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
                {isAllTime
                    ? "The Family leaderboard is waiting."
                    : `No Family rankings yet for ${selectedPeriodLabel}.`}
              </h2>

              <p className="sq-subtitle">
                {isAllTime
                  ? "Start Family Quest to earn Family XP and appear on the leaderboard."
                  : `Earn Family XP during ${selectedPeriodLabel} to appear on the leaderboard.`}
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

          {/* PERIOD SELECTOR */}
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
                  {selectedPeriodLabel}
                </div>
              </div>

              <select
                value={selectedPeriod}
                onChange={(event) =>
                  setSelectedPeriod(event.target.value)
                }
                style={{
                  minWidth: "210px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  color: "var(--foreground)",
                  fontSize: "14px",
                  fontWeight: 700,
                  outline: "none",
                  cursor: "pointer",
                }}
              >
                {periods.map((period) => (
                  <option
                    key={period.id}
                    value={period.id}
                  >
                    {period.label}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                marginTop: "14px",
                paddingTop: "14px",
                borderTop: "1px solid var(--border)",
                color: "var(--muted)",
                fontSize: "13px",
                lineHeight: 1.6,
              }}
            >
              {isAllTime
                ? "All-time rankings are based on your total accumulated Family XP."
                : `Monthly rankings are based on Family XP earned during ${selectedPeriodLabel}.`}
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
                          {isAllTime
                            ? "All-Time Family Champion"
                            : `${selectedPeriodLabel} Family Champion`}
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
                        {(isAllTime
                          ? player.total_xp
                          : player.monthly_xp
                        ).toLocaleString()}
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
                        {isAllTime
                          ? "Family XP"
                          : `${selectedPeriodLabel} XP`}
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

          {/* BIGGEST CLIMBERS */}
          {!isAllTime &&
            climbers.length > 0 && (
              <section
                className="sq-card"
                style={{
                  marginBottom: "28px",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "24px 26px",
                    borderBottom:
                      "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "22px",
                      }}
                    >
                      📈
                    </span>

                    <div>
                      <h2
                        style={{
                          margin: 0,
                          fontSize: "22px",
                          fontWeight: 800,
                        }}
                      >
                        Biggest Climbers
                      </h2>

                      <p
                        style={{
                          margin: "6px 0 0",
                          color: "var(--muted)",
                          fontSize: "13px",
                        }}
                      >
                        Families that moved up the most positions compared with the previous month.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  {climbers.map((player, index) => (
                    <div
                      key={player.user_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "45px 1fr auto",
                        alignItems: "center",
                        gap: "14px",
                        padding: "16px 26px",
                        borderBottom:
                          index < climbers.length - 1
                            ? "1px solid var(--border)"
                            : undefined,
                      }}
                    >
                      <div
                        style={{
                          fontSize: "20px",
                          fontWeight: 900,
                          color: "var(--muted)",
                        }}
                      >
                        #{index + 1}
                      </div>

                      <div>
                        <div
                          style={{
                            fontWeight: 800,
                          }}
                        >
                          {player.display_name}
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
                          textAlign: "right",
                        }}
                      >
                        <div
                          style={{
                            color: "var(--primary)",
                            fontWeight: 900,
                          }}
                        >
                          +{player.positions_gained}
                        </div>

                        <div
                          style={{
                            marginTop: "3px",
                            color: "var(--muted)",
                            fontSize: "12px",
                          }}
                        >
                          positions
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                    {isAllTime
                      ? "Family Player Rankings"
                      : `${selectedPeriodLabel} Family Rankings`}
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
                      ? "Rankings are based on total Family XP."
                      : `Rankings are based on Family XP earned during ${selectedPeriodLabel}.`}
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
                        {(isAllTime
                          ? player.total_xp
                          : player.monthly_xp
                        ).toLocaleString()}{" "}
                        {isAllTime
                          ? "Family XP"
                          : "XP"}
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
                Showing the top 100 Families.
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
                  {(isAllTime
                    ? currentUser.total_xp
                    : currentUser.monthly_xp
                  ).toLocaleString()}{" "}
                  {isAllTime
                    ? "Family XP"
                    : `${selectedPeriodLabel} XP`}
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