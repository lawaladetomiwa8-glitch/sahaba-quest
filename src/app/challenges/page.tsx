"use client";

import Link from "next/link";
import { AppNavbar } from "../../components/ui";

const challenges = [
  {
    icon: "🏆",
    title: "Weekly Sahaba Challenge",
    description:
      "Test your knowledge of the Companions in this weekly community challenge.",
    status: "Coming Soon",
    type: "Community",
  },
  {
    icon: "🔥",
    title: "Streak Challenge",
    description:
      "Keep your learning streak alive and compete with other players.",
    status: "Coming Soon",
    type: "Personal",
  },
  {
    icon: "🌙",
    title: "Special Challenge",
    description:
      "Take part in special themed challenges designed around important Islamic occasions.",
    status: "Coming Soon",
    type: "Special",
  },
];

export default function ChallengesPage() {
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
            <span className="sq-badge">Compete & grow</span>

            <h1
              className="sq-title"
              style={{ marginTop: "16px" }}
            >
              Challenges 🏆
            </h1>

            <p
              className="sq-subtitle"
              style={{ maxWidth: "680px" }}
            >
              Take on special challenges, compete with other players,
              and put your Sahaba knowledge to the test.
            </p>
          </section>

          {/* FEATURED CHALLENGE */}
          <section
            className="sq-card"
            style={{
              padding: "32px",
              marginBottom: "28px",
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
                width: "220px",
                height: "220px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                right: "-70px",
                top: "-90px",
              }}
            />

            <div
              style={{
                position: "relative",
                maxWidth: "700px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "7px 12px",
                  borderRadius: "999px",
                  background: "rgba(255,255,255,0.12)",
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "12px",
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
                Something exciting is coming.
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.78)",
                  fontSize: "15px",
                  lineHeight: 1.7,
                }}
              >
                Challenges will give Sahaba Quest players new ways to
                compete, learn, and earn recognition. Community,
                family, school, and sponsored competitions will
                eventually live here.
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
                    background: "rgba(255,255,255,0.1)",
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
                    background: "rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  👨‍👩‍👧 Family
                </span>

                <span
                  style={{
                    padding: "9px 13px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  🏫 Schools
                </span>

                <span
                  style={{
                    padding: "9px 13px",
                    borderRadius: "10px",
                    background: "rgba(255,255,255,0.1)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  🤝 Sponsored
                </span>
              </div>
            </div>
          </section>

          {/* CHALLENGE LIST */}
          <section>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
                gap: "20px",
                marginBottom: "18px",
              }}
            >
              <div>
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
                  New challenges will appear here as they become
                  available.
                </p>
              </div>
            </div>

            <div
              className="challenge-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "18px",
              }}
            >
              {challenges.map((challenge) => (
                <div
                  key={challenge.title}
                  className="sq-card"
                  style={{
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    minHeight: "260px",
                  }}
                >
                  <div
                    style={{
                      width: "54px",
                      height: "54px",
                      borderRadius: "16px",
                      background: "var(--primary-light)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "26px",
                    }}
                  >
                    {challenge.icon}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      marginTop: "20px",
                    }}
                  >
                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "11px",
                        fontWeight: 800,
                        textTransform: "uppercase",
                        letterSpacing: "0.6px",
                      }}
                    >
                      {challenge.type}
                    </span>

                    <span
                      style={{
                        padding: "5px 9px",
                        borderRadius: "999px",
                        background: "var(--secondary-light)",
                        color: "#8a6a08",
                        fontSize: "10px",
                        fontWeight: 800,
                      }}
                    >
                      {challenge.status}
                    </span>
                  </div>

                  <h3
                    style={{
                      margin: "12px 0 8px",
                      fontSize: "19px",
                      fontWeight: 800,
                    }}
                  >
                    {challenge.title}
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color: "var(--muted)",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    {challenge.description}
                  </p>

                  <button
                    disabled
                    className="sq-button-secondary"
                    style={{
                      width: "100%",
                      marginTop: "auto",
                    }}
                  >
                    Coming Soon
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* BACK TO PLAY */}
          <section
            className="sq-card"
            style={{
              marginTop: "28px",
              padding: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "20px",
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
                  margin: "5px 0 0",
                  color: "var(--muted)",
                  fontSize: "13px",
                }}
              >
                Continue your Sahaba Quest journey while challenges
                are being prepared.
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