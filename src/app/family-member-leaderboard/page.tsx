"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

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

export default function FamilyMemberLeaderboardPage() {
  const router = useRouter();

  const [leaderboard, setLeaderboard] = useState<
    LeaderboardMember[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadLeaderboard();
  }, []);

  async function loadLeaderboard() {
    try {
      setLoading(true);
      setMessage("");

      if (typeof window === "undefined") {
        return;
      }

      const token =
        sessionStorage.getItem(SESSION_KEY);

      if (!token) {
        router.replace("/family-member-login");
        return;
      }

      /*
       * ---------------------------------------------------------
       * VERIFY FAMILY MEMBER SESSION
       * ---------------------------------------------------------
       */
      const {
        data: sessionData,
        error: sessionError,
      } = await supabase.rpc(
        "get_family_member_session",
        {
          p_session_token: token,
        }
      );

      if (sessionError) {
        console.error(
          "Family Member session error:",
          sessionError
        );

        sessionStorage.removeItem(SESSION_KEY);

        router.replace("/family-member-login");
        return;
      }

      if (
        !sessionData ||
        !Array.isArray(sessionData) ||
        sessionData.length === 0
      ) {
        sessionStorage.removeItem(SESSION_KEY);

        router.replace("/family-member-login");
        return;
      }

      /*
       * ---------------------------------------------------------
       * LOAD FAMILY MEMBER LEADERBOARD
       * ---------------------------------------------------------
       */
      const {
        data: leaderboardData,
        error: leaderboardError,
      } = await supabase.rpc(
        "get_family_member_leaderboard",
        {
          p_session_token: token,
        }
      );

      if (leaderboardError) {
        console.error(
          "Family Member leaderboard error:",
          leaderboardError
        );

        setMessage(
          leaderboardError.message ||
            "The Family leaderboard could not be loaded."
        );

        setLeaderboard([]);
        return;
      }

      setLeaderboard(
        Array.isArray(leaderboardData)
          ? (leaderboardData as LeaderboardMember[])
          : []
      );
    } catch (error) {
      console.error(
        "Family Member leaderboard loading error:",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while loading the Family leaderboard."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleBackToDashboard() {
    router.push("/family-member-dashboard");
  }

  function handleSwitchMember() {
    sessionStorage.removeItem(SESSION_KEY);
    router.push("/family-member-login");
  }

  return (
    <main
      className="sq-page"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)",
      }}
    >
      <AppNavbar />

      <div
        className="sq-container"
        style={{
          paddingBottom: "60px",
        }}
      >
        {loading ? (
          <section
            className="sq-card"
            style={{
              maxWidth: "760px",
              margin: "50px auto",
              padding: "48px 28px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "20px",
                background:
                  "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                fontSize: "26px",
                fontWeight: 900,
              }}
            >
              ★
            </div>

            <h1 className="sq-title">
              Family Leaderboard
            </h1>

            <p
              className="sq-subtitle"
              style={{
                marginTop: "12px",
              }}
            >
              Loading your Family ranking...
            </p>
          </section>
        ) : message ? (
          <section
            className="sq-card"
            style={{
              maxWidth: "760px",
              margin: "50px auto",
              padding: "40px 28px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "20px",
                background: "#fef2f2",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#b91c1c",
                fontSize: "26px",
                fontWeight: 900,
              }}
            >
              !
            </div>

            <h1 className="sq-title">
              Unable to Load Leaderboard
            </h1>

            <p
              className="sq-subtitle"
              style={{
                marginTop: "12px",
                color: "#b91c1c",
              }}
            >
              {message}
            </p>

            <div
              style={{
                marginTop: "24px",
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => void loadLeaderboard()}
                className="sq-button-primary"
                style={{
                  border: "none",
                  minHeight: "46px",
                  padding: "0 20px",
                }}
              >
                Try Again
              </button>

              <button
                type="button"
                onClick={handleBackToDashboard}
                className="sq-button-secondary"
                style={{
                  minHeight: "46px",
                  padding: "0 20px",
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* PAGE HEADER */}
            <section
              className="sq-card"
              style={{
                marginTop: "28px",
                padding: "32px 28px",
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
                    FAMILY COMPETITION
                  </div>

                  <h1
                    style={{
                      margin: "16px 0 8px",
                      fontSize:
                        "clamp(28px, 5vw, 38px)",
                      fontWeight: 900,
                      lineHeight: 1.15,
                    }}
                  >
                    Family Leaderboard
                  </h1>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      lineHeight: 1.7,
                      maxWidth: "650px",
                    }}
                  >
                    See how you are progressing
                    alongside the other members of
                    your Family.
                  </p>
                </div>

                <div
                  style={{
                    minWidth: "110px",
                    textAlign: "center",
                    padding: "14px 16px",
                    borderRadius: "16px",
                    background:
                      "var(--primary-light)",
                    border:
                      "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--primary)",
                      fontSize: "24px",
                      fontWeight: 900,
                    }}
                  >
                    {leaderboard.length}
                  </div>

                  <div
                    style={{
                      marginTop: "3px",
                      color: "var(--muted)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    Active Member
                    {leaderboard.length === 1
                      ? ""
                      : "s"}
                  </div>
                </div>
              </div>
            </section>

            {/* LEADERBOARD */}
            <section
              className="sq-card"
              style={{
                marginTop: "20px",
                padding: "28px",
              }}
            >
              {leaderboard.length > 0 ? (
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  {leaderboard.map((member) => (
                    <div
                      key={member.member_id}
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "56px minmax(0, 1fr) auto",
                        alignItems: "center",
                        gap: "16px",
                        padding: "18px",
                        borderRadius: "18px",
                        border: member.is_current_member
                          ? "2px solid var(--primary)"
                          : "1px solid var(--border)",
                        background:
                          member.is_current_member
                            ? "var(--primary-light)"
                            : "#f8faf9",
                      }}
                    >
                      {/* RANK */}
                      <div
                        style={{
                          width: "46px",
                          height: "46px",
                          borderRadius: "15px",
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
                          border:
                            "1px solid var(--border)",
                          color:
                            member.rank <= 3
                              ? "#92400e"
                              : "var(--foreground)",
                          fontWeight: 900,
                          fontSize:
                            member.rank <= 3
                              ? "22px"
                              : "16px",
                        }}
                      >
                        {member.rank <= 3
                          ? ["🥇", "🥈", "🥉"][
                              member.rank - 1
                            ]
                          : member.rank}
                      </div>

                      {/* MEMBER INFORMATION */}
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
                              fontSize: "17px",
                              lineHeight: 1.3,
                            }}
                          >
                            {member.display_name}
                          </strong>

                          {member.is_current_member && (
                            <span
                              className="sq-badge"
                              style={{
                                fontSize: "10px",
                                padding: "4px 8px",
                              }}
                            >
                              You
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            marginTop: "7px",
                            color: "var(--muted)",
                            fontSize: "12px",
                            lineHeight: 1.6,
                          }}
                        >
                          Level {member.current_level}
                          {" • "}
                          {member.accuracy}% accuracy
                          {" • "}
                          {member.questions_answered}{" "}
                          questions
                        </div>

                        <div
                          style={{
                            marginTop: "4px",
                            color: "var(--muted)",
                            fontSize: "12px",
                          }}
                        >
                          🔥 Current streak:{" "}
                          {member.current_streak}
                          {" • "}
                          Best streak:{" "}
                          {member.best_streak}
                        </div>
                      </div>

                      {/* XP */}
                      <div
                        style={{
                          textAlign: "right",
                          minWidth: "75px",
                        }}
                      >
                        <div
                          style={{
                            color: "var(--primary)",
                            fontSize: "20px",
                            fontWeight: 900,
                          }}
                        >
                          {member.total_xp.toLocaleString()}
                        </div>

                        <div
                          style={{
                            color: "var(--muted)",
                            fontSize: "11px",
                            marginTop: "2px",
                            fontWeight: 700,
                          }}
                        >
                          XP
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    padding: "28px 20px",
                    borderRadius: "16px",
                    background: "#f8faf9",
                    border:
                      "1px solid var(--border)",
                    color: "var(--muted)",
                    textAlign: "center",
                  }}
                >
                  No Family Member leaderboard
                  data is available yet.
                </div>
              )}
            </section>

            {/* ACTIONS */}
            <section
              style={{
                marginTop: "20px",
                display: "flex",
                justifyContent: "center",
                gap: "10px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={handleBackToDashboard}
                className="sq-button-primary"
                style={{
                  minHeight: "46px",
                  padding: "0 22px",
                  border: "none",
                }}
              >
                ← Back to Dashboard
              </button>

              <button
                type="button"
                onClick={handleSwitchMember}
                className="sq-button-secondary"
                style={{
                  minHeight: "46px",
                  padding: "0 22px",
                }}
              >
                ⇄ Switch Member
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}