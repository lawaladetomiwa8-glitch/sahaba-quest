"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type Profile = {
  username: string | null;
  display_name: string | null;
};

type Progress = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

export default function DashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [message, setMessage] = useState("Loading your dashboard...");

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      return;
    }

    const { data: profileData, error: profileError } =
      await supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .single();

    if (profileError) {
      setMessage(profileError.message);
      return;
    }

    const { data: progressData, error: progressError } =
      await supabase
        .from("player_progress")
        .select(
          "current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak"
        )
        .eq("user_id", user.id)
        .single();

    if (progressError) {
      setMessage(progressError.message);
      return;
    }

    setProfile(profileData);
    setProgress(progressData);
    setMessage("");
  }

  if (!profile || !progress) {
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

            <h1 className="sq-title">Sahaba Quest</h1>

            <p
              className="sq-subtitle"
              style={{ marginTop: "12px" }}
            >
              {message}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const playerName =
    profile.display_name || profile.username || "Player";

  const accuracy =
    progress.questions_answered > 0
      ? Math.round(
          (progress.correct_answers /
            progress.questions_answered) *
            100
        )
      : 0;

  const levelProgress = Math.min(
    (progress.total_xp % 1000) / 10,
    100
  );

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
        <div style={{ marginBottom: "28px" }}>
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
            <span className="sq-badge">
              Level {progress.current_level}
            </span>

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
              <span style={{ color: "var(--primary)" }}>
                {playerName}
              </span>
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
              Ready to continue your Sahaba journey?
              Test your knowledge, build your streak,
              and learn something valuable today.
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
                href="/quiz"
                className="sq-button-primary"
              >
                🎮 Continue Quest
              </a>

              <a
                href="/progress"
                className="sq-button-secondary"
              >
                View Progress
              </a>
            </div>
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
              {progress.total_xp.toLocaleString()}
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              Experience earned
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
              {accuracy}%
            </div>

            <div
              style={{
                marginTop: "6px",
                color: "var(--muted)",
                fontSize: "13px",
              }}
            >
              {progress.correct_answers} correct
            </div>
          </div>
        </section>

        {/* MAIN CONTENT GRID */}
        <section
          className="dashboard-main-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.5fr) minmax(280px, 1fr)",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          {/* PROGRESS CARD */}
          <div
            className="sq-card"
            style={{ padding: "28px" }}
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
                  Level {progress.current_level}
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

            <div style={{ marginTop: "28px" }}>
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
                  Level progress
                </span>

                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    color: "var(--primary)",
                  }}
                >
                  {Math.round(levelProgress)}%
                </span>
              </div>

              <div className="sq-progress">
                <div
                  className="sq-progress-bar"
                  style={{
                    width: `${levelProgress}%`,
                  }}
                />
              </div>
            </div>

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
                  border: "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  Questions Answered
                </div>

                <div
                  style={{
                    marginTop: "5px",
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  {progress.questions_answered}
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  borderRadius: "16px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
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
                  {progress.correct_answers}
                </div>
              </div>
            </div>
          </div>

          {/* QUICK ACTIONS */}
          <div
            className="sq-card"
            style={{ padding: "28px" }}
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
                href="/quiz"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "var(--primary)",
                  color: "white",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>🎮 Play Quiz</span>
                <span>→</span>
              </a>

              <a
                href="/leaderboard"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "var(--secondary-light)",
                  color: "#7c5d00",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>🏆 Leaderboard</span>
                <span>→</span>
              </a>

              <a
                href="/challenges"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "#f1f5f3",
                  color: "var(--foreground)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>🎯 Challenges</span>
                <span>→</span>
              </a>

              <a
                href="/profile"
                style={{
                  padding: "17px",
                  borderRadius: "16px",
                  background: "#f1f5f3",
                  color: "var(--foreground)",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>👤 My Profile</span>
                <span>→</span>
              </a>
            </div>
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
            <div style={{ maxWidth: "700px" }}>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 800,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                  opacity: 0.8,
                }}
              >
                Daily reminder
              </div>

              <h2
                style={{
                  margin: "10px 0 8px",
                  fontSize: "26px",
                  fontWeight: 900,
                }}
              >
                Learn about those who walked
                with the Prophet ﷺ.
              </h2>

              <p
                style={{
                  margin: 0,
                  lineHeight: 1.7,
                  opacity: 0.85,
                }}
              >
                Every question is an opportunity
                to increase your knowledge and
                strengthen your connection with the
                lives of the Sahabah.
              </p>
            </div>

            <a
              href="/quiz"
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
              }}
            >
              Start Learning →
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

      {/* RESPONSIVE DASHBOARD FIX */}
      <style jsx>{`
        @media (max-width: 800px) {
          .dashboard-main-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
            width: 100% !important;
          }

          .dashboard-main-grid > * {
            width: 100% !important;
            min-width: 0 !important;
          }
        }

        @media (max-width: 600px) {
          nav {
            margin-bottom: 18px !important;
          }

          .dashboard-main-grid {
            gap: 16px !important;
          }

          .dashboard-main-grid .sq-card {
            padding: 22px !important;
          }

          .dashboard-main-grid .sq-card > div:first-child {
            min-width: 0;
          }

          .dashboard-main-grid .sq-card h2 {
            line-height: 1.25 !important;
          }

          .dashboard-main-grid .sq-card p {
            max-width: 100% !important;
          }
        }
      `}</style>
    </main>
  );
}