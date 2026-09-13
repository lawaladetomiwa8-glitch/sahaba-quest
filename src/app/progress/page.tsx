"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type ProgressData = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

export default function ProgressPage() {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [displayName, setDisplayName] = useState("Player");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
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

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setMessage(profileError.message);
      setLoading(false);
      return;
    }

    const { data: playerProgress, error: progressError } = await supabase
      .from("player_progress")
      .select(
        "current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak"
      )
      .eq("user_id", user.id)
      .single();

    if (progressError) {
      setMessage(progressError.message);
      setLoading(false);
      return;
    }

    setDisplayName(profile?.display_name || "Player");
    setProgress(playerProgress);
    setLoading(false);
  }

  const accuracy =
    progress && progress.questions_answered > 0
      ? Math.round(
          (progress.correct_answers / progress.questions_answered) * 100
        )
      : 0;

  const xpIntoLevel = progress ? progress.total_xp % 1000 : 0;
  const levelProgress = Math.min((xpIntoLevel / 1000) * 100, 100);
  const xpToNextLevel = 1000 - xpIntoLevel;

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
              ✦
            </div>

            <h2 style={{ margin: 0 }}>Loading your progress...</h2>

            <p className="sq-subtitle">
              We're getting your latest learning statistics.
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
            <h2 style={{ marginTop: 0 }}>Unable to load progress</h2>

            <p className="sq-subtitle">{message}</p>

            <Link
              href="/"
              className="sq-button-primary"
              style={{ marginTop: "20px" }}
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* NAVIGATION */}
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

          <Link
            href="/progress"
            className="sq-nav-link"
            style={{
              background: "var(--primary-light)",
              color: "var(--primary-dark)",
            }}
          >
            Progress
          </Link>

          <Link href="/leaderboard" className="sq-nav-link">
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

      {/* MAIN CONTENT */}
      <div className="sq-page">
        <div className="sq-container">
          {/* HEADER */}
          <section style={{ marginBottom: "32px" }}>
            <span className="sq-badge">Your learning journey</span>

            <h1 className="sq-title" style={{ marginTop: "16px" }}>
              Your Progress, {displayName} 📈
            </h1>

            <p className="sq-subtitle">
              Keep learning, keep improving, and keep your streak alive.
            </p>
          </section>

          {/* STAT CARDS */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "18px",
              marginBottom: "24px",
            }}
          >
            <div className="sq-stat">
              <div className="sq-stat-label">Total XP</div>

              <div className="sq-stat-value">
                {progress?.total_xp.toLocaleString()}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Keep going
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">Current Level</div>

              <div className="sq-stat-value">
                {progress?.current_level}
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--muted)",
                  fontSize: "13px",
                  fontWeight: 600,
                }}
              >
                Level progress
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">Accuracy</div>

              <div className="sq-stat-value">{accuracy}%</div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--success)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Answer accuracy
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">Current Streak</div>

              <div className="sq-stat-value">
                {progress?.current_streak} 🔥
              </div>

              <div
                style={{
                  marginTop: "8px",
                  color: "var(--secondary)",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Best: {progress?.best_streak}
              </div>
            </div>
          </section>

          {/* LEVEL PROGRESS */}
          <section
            className="sq-card"
            style={{
              padding: "28px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "20px",
                marginBottom: "20px",
              }}
            >
              <div>
                <span className="sq-badge">Level {progress?.current_level}</span>

                <h2
                  style={{
                    margin: "14px 0 6px",
                    fontSize: "24px",
                    fontWeight: 800,
                  }}
                >
                  Your level journey
                </h2>

                <p className="sq-subtitle">
                  Earn XP by answering questions correctly.
                </p>
              </div>

              <div
                style={{
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    fontSize: "22px",
                    fontWeight: 900,
                    color: "var(--primary)",
                  }}
                >
                  {xpIntoLevel} XP
                </div>

                <div
                  style={{
                    color: "var(--muted)",
                    fontSize: "12px",
                    marginTop: "4px",
                  }}
                >
                  toward next level
                </div>
              </div>
            </div>

            <div className="sq-progress">
              <div
                className="sq-progress-bar"
                style={{ width: `${levelProgress}%` }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "10px",
                color: "var(--muted)",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              <span>Level {progress?.current_level}</span>

              <span>{xpToNextLevel} XP to next level</span>

              <span>Level {(progress?.current_level ?? 1) + 1}</span>
            </div>
          </section>

          {/* PERFORMANCE */}
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1.2fr 0.8fr",
              gap: "24px",
            }}
          >
            {/* QUESTIONS */}
            <div
              className="sq-card"
              style={{
                padding: "28px",
              }}
            >
              <div className="sq-badge">Performance</div>

              <h2
                style={{
                  margin: "16px 0 22px",
                  fontSize: "24px",
                  fontWeight: 800,
                }}
              >
                Your question statistics
              </h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: "#f8faf9",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Questions Answered
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress?.questions_answered}
                  </div>
                </div>

                <div
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: "#f8faf9",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--muted)",
                      fontSize: "13px",
                      fontWeight: 600,
                    }}
                  >
                    Correct Answers
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress?.correct_answers}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: "22px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                    }}
                  >
                    Accuracy
                  </span>

                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 800,
                      color: "var(--primary)",
                    }}
                  >
                    {accuracy}%
                  </span>
                </div>

                <div className="sq-progress">
                  <div
                    className="sq-progress-bar"
                    style={{ width: `${accuracy}%` }}
                  />
                </div>
              </div>
            </div>

            {/* STREAK */}
            <div
              className="sq-card"
              style={{
                padding: "28px",
                background:
                  "linear-gradient(145deg, var(--primary-dark), var(--primary))",
                color: "white",
                border: "none",
              }}
            >
              <div
                style={{
                  width: "58px",
                  height: "58px",
                  borderRadius: "18px",
                  background: "rgba(255,255,255,0.13)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "28px",
                }}
              >
                🔥
              </div>

              <h2
                style={{
                  margin: "20px 0 8px",
                  fontSize: "25px",
                  fontWeight: 800,
                }}
              >
                Keep the streak alive
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.75)",
                  lineHeight: 1.6,
                  fontSize: "14px",
                }}
              >
                Answer questions correctly to keep building your streak and
                earn bonus XP.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "28px",
                  marginTop: "28px",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress?.current_streak}
                  </div>

                  <div
                    style={{
                      color: "rgba(255,255,255,0.65)",
                      fontSize: "12px",
                    }}
                  >
                    Current
                  </div>
                </div>

                <div>
                  <div
                    style={{
                      fontSize: "30px",
                      fontWeight: 900,
                    }}
                  >
                    {progress?.best_streak}
                  </div>

                  <div
                    style={{
                      color: "rgba(255,255,255,0.65)",
                      fontSize: "12px",
                    }}
                  >
                    Best
                  </div>
                </div>
              </div>

              <Link
                href="/quiz"
                className="sq-button-secondary"
                style={{
                  marginTop: "28px",
                  width: "100%",
                  border: "none",
                }}
              >
                Continue Playing
              </Link>
            </div>
          </section>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .sq-container > section:first-of-type {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .sq-container > section:last-of-type {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 600px) {
          .sq-container > section:first-of-type {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}