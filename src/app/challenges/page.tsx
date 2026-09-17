"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type Challenge = {
  id: string;
  title: string;
  description: string;
  icon: string;
  challenge_type: string;
  question_count: number;
  time_per_question: number;
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
};

type User = {
  id: string;
};

type ChallengeAttempt = {
  id: string;
  challenge_id: string;
  questions_answered: number;
  correct_answers: number;
  score: number;
  status: "in_progress" | "completed";
  passed: boolean | null;
};

export default function ChallengesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<
    Record<string, ChallengeAttempt>
  >({});

  const [isPremium, setIsPremium] = useState(false);

  const [loading, setLoading] = useState(true);
  const [startingChallenge, setStartingChallenge] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadChallenges();
  }, []);

  async function loadChallenges() {
    try {
      setLoading(true);
      setErrorMessage("");

      // ----------------------------------------
      // GET CURRENT USER
      // ----------------------------------------

      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (currentUser) {
        setUser({
          id: currentUser.id,
        });

        // --------------------------------------
        // CHECK ACTIVE SUBSCRIPTION
        // --------------------------------------

        const { data: subscriptionData, error: subscriptionError } =
          await supabase
            .from("subscriptions")
            .select(
              `
                status,
                current_period_end,
                subscription_plans (
                  plan_type,
                  display_name
                )
              `
            )
            .eq("user_id", currentUser.id)
            .eq("status", "active")
            .order("current_period_end", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

        if (!subscriptionError && subscriptionData) {
          const plan = Array.isArray(
            subscriptionData.subscription_plans
          )
            ? subscriptionData.subscription_plans[0]
            : subscriptionData.subscription_plans;

          const subscriptionIsActive =
            subscriptionData.status === "active" &&
            (!subscriptionData.current_period_end ||
              new Date(subscriptionData.current_period_end) >
                new Date());

          const premiumPlan =
            plan?.plan_type === "plus" ||
            plan?.plan_type === "family" ||
            plan?.plan_type === "school";

          setIsPremium(
            subscriptionIsActive && premiumPlan
          );
        }

        // --------------------------------------
        // LOAD USER'S CHALLENGE ATTEMPTS
        // --------------------------------------

        const {
          data: attemptData,
          error: attemptError,
        } = await supabase
          .from("challenge_attempts")
          .select(
            `
              id,
              challenge_id,
              questions_answered,
              correct_answers,
              score,
              status,
              passed
            `
          )
          .eq("user_id", currentUser.id);

        if (attemptError) {
          console.error(
            "Error loading challenge attempts:",
            attemptError
          );
        } else {
          const attemptMap: Record<
            string,
            ChallengeAttempt
          > = {};

          (attemptData || []).forEach((attempt) => {
            attemptMap[attempt.challenge_id] = attempt;
          });

          setAttempts(attemptMap);
        }
      }

      // ----------------------------------------
      // LOAD CHALLENGES
      // ----------------------------------------

      const {
        data: challengeData,
        error: challengeError,
      } = await supabase
        .from("challenges")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", {
          ascending: true,
        });

      if (challengeError) {
        throw challengeError;
      }

      setChallenges(challengeData || []);
    } catch (error) {
      console.error(
        "Error loading challenges:",
        error
      );

      setErrorMessage(
        "We couldn't load the challenges right now. Please refresh the page and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleStartChallenge(
    challenge: Challenge
  ) {
    setErrorMessage("");

    // ----------------------------------------
    // NOT LOGGED IN
    // ----------------------------------------

    if (!user) {
      window.location.href = "/login";
      return;
    }

    // ----------------------------------------
    // FRONTEND PREMIUM CHECK
    // ----------------------------------------

    if (challenge.is_premium && !isPremium) {
      window.location.href = "/pricing";
      return;
    }

    try {
      setStartingChallenge(challenge.id);

      // --------------------------------------
      // SECURE SERVER-SIDE CHECK
      // --------------------------------------

      const { data, error } = await supabase.rpc(
        "start_challenge",
        {
          p_challenge_id: challenge.id,
        }
      );

      if (error) {
        console.error(
          "Start challenge error:",
          error
        );

        if (
          error.message
            ?.toLowerCase()
            .includes(
              "premium subscription required"
            )
        ) {
          window.location.href = "/pricing";
          return;
        }

        throw error;
      }

      if (!data?.success) {
        throw new Error(
          "Unable to start challenge."
        );
      }

      // --------------------------------------
      // UPDATE LOCAL ATTEMPT STATE
      // --------------------------------------

      setAttempts((previous) => ({
        ...previous,
        [challenge.id]: {
          id: data.attempt_id,
          challenge_id: challenge.id,
          questions_answered:
            data.questions_answered ?? 0,
          correct_answers:
            data.correct_answers ?? 0,
          score: data.score ?? 0,
          status:
            data.status === "completed"
              ? "completed"
              : "in_progress",
          passed:
            data.passed ?? null,
        },
      }));

      // --------------------------------------
      // COMPLETED CHALLENGE
      // --------------------------------------

      if (
        data.action === "completed" ||
        data.status === "completed"
      ) {
        window.location.href =
          `/challenges/${challenge.id}/result?attempt=${data.attempt_id}`;

        return;
      }

      // --------------------------------------
      // NEW OR RESUMED CHALLENGE
      // --------------------------------------

      window.location.href =
        `/challenges/${challenge.id}?attempt=${data.attempt_id}`;
    } catch (error) {
      console.error(
        "Challenge start failed:",
        error
      );

      setErrorMessage(
        "We couldn't start this challenge. Please try again."
      );
    } finally {
      setStartingChallenge(null);
    }
  }

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

          <section style={{ marginBottom: "32px" }}>
            <span className="sq-badge">
              Compete & grow
            </span>

            <h1
              className="sq-title"
              style={{ marginTop: "16px" }}
            >
              Challenges 🏆
            </h1>

            <p
              className="sq-subtitle"
              style={{
                maxWidth: "680px",
              }}
            >
              Take on special challenges, test your
              Sahaba knowledge, and unlock new ways
              to compete and learn.
            </p>
          </section>


          {/* PREMIUM BANNER */}

          {!isPremium && (
            <section
              className="sq-card"
              style={{
                marginBottom: "28px",
                padding: "22px 24px",
                border:
                  "1px solid var(--secondary-light)",
                background:
                  "linear-gradient(135deg, var(--secondary-light), var(--background))",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "18px",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 900,
                      color: "#8a6a08",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                    }}
                  >
                    Premium Challenges
                  </div>

                  <h2
                    style={{
                      margin: "6px 0 5px",
                      fontSize: "20px",
                      fontWeight: 800,
                    }}
                  >
                    Unlock the full Challenge Arena
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "13px",
                      lineHeight: 1.6,
                      maxWidth: "650px",
                    }}
                  >
                    You can preview the challenges below
                    for free. Upgrade your account to
                    access Premium challenges and start
                    competing.
                  </p>
                </div>

                <Link
                  href="/pricing"
                  className="sq-button-primary"
                  style={{
                    whiteSpace: "nowrap",
                  }}
                >
                  View Premium →
                </Link>
              </div>
            </section>
          )}


          {/* ERROR */}

          {errorMessage && (
            <div
              className="sq-card"
              style={{
                marginBottom: "24px",
                padding: "16px 18px",
                border:
                  "1px solid var(--danger)",
                color: "var(--danger)",
                background:
                  "var(--danger-light)",
              }}
            >
              {errorMessage}
            </div>
          )}


          {/* FEATURED CHALLENGE */}

          <section
            className="sq-card"
            style={{
              padding: "32px",
              marginBottom: "32px",
              background:
                "linear-gradient(135deg, var(--primary-dark), var(--primary))",
              color: "white",
              border: "none",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: "240px",
                height: "240px",
                borderRadius: "50%",
                background:
                  "rgba(255,255,255,0.06)",
                right: "-80px",
                top: "-100px",
              }}
            />

            <div
              style={{
                position: "relative",
                maxWidth: "720px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "7px 12px",
                  borderRadius: "999px",
                  background:
                    "rgba(255,255,255,0.12)",
                  color:
                    "rgba(255,255,255,0.9)",
                  fontSize: "11px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                }}
              >
                Challenge Arena
              </span>

              <h2
                style={{
                  margin: "18px 0 10px",
                  fontSize: "30px",
                  lineHeight: 1.2,
                  fontWeight: 900,
                }}
              >
                Test what you know. Push yourself
                further.
              </h2>

              <p
                style={{
                  margin: 0,
                  color:
                    "rgba(255,255,255,0.8)",
                  fontSize: "15px",
                  lineHeight: 1.7,
                }}
              >
                Challenges are designed to take your
                Sahaba knowledge beyond ordinary quiz
                sessions. More focused topics,
                different time limits, and special
                competitions will make every challenge
                different.
              </p>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px",
                  marginTop: "24px",
                }}
              >
                <span
                  style={{
                    padding: "9px 13px",
                    borderRadius: "10px",
                    background:
                      "rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  🏆 Competitions
                </span>

                <span
                  style={{
                    padding: "9px 13px",
                    borderRadius: "10px",
                    background:
                      "rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  ⚡ Speed
                </span>

                <span
                  style={{
                    padding: "9px 13px",
                    borderRadius: "10px",
                    background:
                      "rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  🕌 Sahabah
                </span>

                <span
                  style={{
                    padding: "9px 13px",
                    borderRadius: "10px",
                    background:
                      "rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  🔥 Special Quests
                </span>
              </div>
            </div>
          </section>


          {/* CHALLENGE LIST */}

          <section>
            <div
              style={{
                marginBottom: "18px",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: 800,
                }}
              >
                Available Challenges
              </h2>

              <p
                style={{
                  margin: "6px 0 0",
                  color: "var(--muted)",
                  fontSize: "14px",
                }}
              >
                {isPremium
                  ? "Your Premium access is active. Choose a challenge and begin."
                  : "Preview the challenges below. Premium challenges require an active subscription."}
              </p>
            </div>


            {loading ? (
              <div
                className="sq-card"
                style={{
                  padding: "40px",
                  textAlign: "center",
                  color: "var(--muted)",
                }}
              >
                Loading challenges...
              </div>
            ) : (
              <div
                className="challenge-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: "18px",
                }}
              >
                {challenges.map(
                  (challenge) => {
                    const locked =
                      challenge.is_premium &&
                      !isPremium;

                    const starting =
                      startingChallenge ===
                      challenge.id;

                    const attempt =
                      attempts[challenge.id];

                    const hasAttempt =
                      !!attempt;

                    const isCompleted =
                      attempt?.status ===
                      "completed";

                    const hasProgress =
                      attempt?.status ===
                        "in_progress" &&
                      attempt.questions_answered >
                        0;

                    let buttonText =
                      "Start Challenge →";

                    if (isCompleted) {
                      buttonText =
                        "View Results →";
                    } else if (hasProgress) {
                      buttonText =
                        "Resume Challenge →";
                    }

                    return (
                      <div
                        key={challenge.id}
                        className="sq-card"
                        style={{
                          padding: "24px",
                          display: "flex",
                          flexDirection:
                            "column",
                          minHeight: "290px",
                          position:
                            "relative",
                          overflow:
                            "hidden",
                        }}
                      >

                        {/* LOCK */}

                        {locked && (
                          <div
                            style={{
                              position:
                                "absolute",
                              top: "16px",
                              right: "16px",
                              padding:
                                "6px 9px",
                              borderRadius:
                                "999px",
                              background:
                                "var(--secondary-light)",
                              color:
                                "#8a6a08",
                              fontSize:
                                "10px",
                              fontWeight:
                                900,
                            }}
                          >
                            🔒 PREMIUM
                          </div>
                        )}


                        {/* ICON */}

                        <div
                          style={{
                            width: "54px",
                            height: "54px",
                            borderRadius:
                              "16px",
                            background:
                              "var(--primary-light)",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize: "26px",
                          }}
                        >
                          {challenge.icon}
                        </div>


                        {/* TYPE */}

                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "8px",
                            marginTop:
                              "20px",
                          }}
                        >
                          <span
                            style={{
                              color:
                                "var(--muted)",
                              fontSize:
                                "11px",
                              fontWeight:
                                800,
                              textTransform:
                                "uppercase",
                              letterSpacing:
                                "0.6px",
                            }}
                          >
                            {
                              challenge.challenge_type
                            }
                          </span>

                          {/* IN PROGRESS BADGE */}

                          {hasProgress && (
                            <span
                              style={{
                                padding:
                                  "4px 7px",
                                borderRadius:
                                  "999px",
                                background:
                                  "var(--primary-light)",
                                color:
                                  "var(--primary-dark)",
                                fontSize:
                                  "9px",
                                fontWeight:
                                  900,
                                textTransform:
                                  "uppercase",
                              }}
                            >
                              In Progress
                            </span>
                          )}

                          {/* COMPLETED BADGE */}

                          {isCompleted && (
                            <span
                              style={{
                                padding:
                                  "4px 7px",
                                borderRadius:
                                  "999px",
                                background:
                                  attempt.passed
                                    ? "var(--primary-light)"
                                    : "var(--danger-light)",
                                color:
                                  attempt.passed
                                    ? "var(--primary-dark)"
                                    : "var(--danger)",
                                fontSize:
                                  "9px",
                                fontWeight:
                                  900,
                                textTransform:
                                  "uppercase",
                              }}
                            >
                              {attempt.passed
                                ? "Completed"
                                : "Finished"}
                            </span>
                          )}
                        </div>


                        {/* TITLE */}

                        <h3
                          style={{
                            margin:
                              "12px 0 8px",
                            fontSize:
                              "19px",
                            fontWeight:
                              800,
                          }}
                        >
                          {
                            challenge.title
                          }
                        </h3>


                        {/* DESCRIPTION */}

                        <p
                          style={{
                            margin: 0,
                            color:
                              "var(--muted)",
                            fontSize:
                              "14px",
                            lineHeight:
                              1.6,
                          }}
                        >
                          {
                            challenge.description
                          }
                        </p>


                        {/* DETAILS */}

                        <div
                          style={{
                            display:
                              "flex",
                            flexWrap:
                              "wrap",
                            gap: "8px",
                            marginTop:
                              "16px",
                          }}
                        >
                          <span
                            style={{
                              padding:
                                "6px 9px",
                              borderRadius:
                                "8px",
                              background:
                                "var(--muted-light)",
                              color:
                                "var(--foreground)",
                              fontSize:
                                "11px",
                              fontWeight:
                                700,
                            }}
                          >
                            {
                              challenge.question_count
                            }{" "}
                            Questions
                          </span>

                          <span
                            style={{
                              padding:
                                "6px 9px",
                              borderRadius:
                                "8px",
                              background:
                                "var(--muted-light)",
                              color:
                                "var(--foreground)",
                              fontSize:
                                "11px",
                              fontWeight:
                                700,
                            }}
                          >
                            {
                              challenge.time_per_question
                            }
                            s each
                          </span>

                          {/* PROGRESS */}

                          {hasAttempt &&
                            !locked &&
                            !isCompleted && (
                              <span
                                style={{
                                  padding:
                                    "6px 9px",
                                  borderRadius:
                                    "8px",
                                  background:
                                    "var(--primary-light)",
                                  color:
                                    "var(--primary-dark)",
                                  fontSize:
                                    "11px",
                                  fontWeight:
                                    800,
                                }}
                              >
                                {
                                  attempt.questions_answered
                                }
                                /
                                {
                                  challenge.question_count
                                }{" "}
                                answered
                              </span>
                            )}
                        </div>


                        {/* ACTION */}

                        <button
                          onClick={() =>
                            handleStartChallenge(
                              challenge
                            )
                          }
                          disabled={starting}
                          className={
                            locked
                              ? "sq-button-secondary"
                              : "sq-button-primary"
                          }
                          style={{
                            width: "100%",
                            marginTop:
                              "auto",
                            cursor: starting
                              ? "wait"
                              : "pointer",
                          }}
                        >
                          {starting
                            ? "Loading..."
                            : locked
                            ? "🔒 Upgrade to Access"
                            : buttonText}
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>


          {/* BACK TO PLAY */}

          <section
            className="sq-card"
            style={{
              marginTop: "28px",
              padding: "24px",
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: "18px",
                  fontWeight: 800,
                }}
              >
                Want to keep learning?
              </h3>

              <p
                style={{
                  margin:
                    "5px 0 0",
                  color:
                    "var(--muted)",
                  fontSize: "13px",
                }}
              >
                Continue your regular Sahaba
                Quest journey while exploring the
                Challenge Arena.
              </p>
            </div>

            <Link
              href="/quiz"
              className="sq-button-primary"
            >
              Play Quiz →
            </Link>
          </section>

        </div>
      </div>


      <style jsx>{`
        @media (max-width: 900px) {
          .challenge-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .challenge-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}