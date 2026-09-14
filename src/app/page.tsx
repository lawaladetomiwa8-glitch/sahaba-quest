"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    setUserEmail(user?.email ?? null);
  }

  async function handleLogin() {
    if (!email || !password) {
      setMessage("Please enter your email and password.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    
    setLoading(false);
    router.push("/dashboard");
  }

  async function handleLogout() {
    setLoading(true);

    await supabase.auth.signOut();

    setMessage("You have been logged out.");
    setLoading(false);
  }

  /* =========================================================
     LOGGED-IN EXPERIENCE
     ========================================================= */

  if (userEmail) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background:
            "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
        }}
      >
        <header className="sq-nav">
          <Link href="/dashboard" className="sq-logo">
            Sahaba Quest
          </Link>

          <Link
            href="/dashboard"
            className="sq-button-primary"
            style={{
              minHeight: "42px",
              padding: "0 16px",
              fontSize: "13px",
            }}
          >
            Dashboard →
          </Link>
        </header>

        <div
          className="sq-page"
          style={{
            display: "flex",
            alignItems: "center",
            minHeight: "calc(100vh - 72px)",
          }}
        >
          <div
            className="sq-container"
            style={{
              maxWidth: "700px",
            }}
          >
            <div
              className="sq-card"
              style={{
                padding: "48px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "76px",
                  height: "76px",
                  margin: "0 auto 22px",
                  borderRadius: "24px",
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "25px",
                  fontWeight: 900,
                }}
              >
                SQ
              </div>

              <span className="sq-badge">
                Account Active
              </span>

              <h1
                className="sq-title"
                style={{
                  marginTop: "18px",
                }}
              >
                Welcome back! 🎉
              </h1>

              <p
                className="sq-subtitle"
                style={{
                  maxWidth: "480px",
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                Your Sahaba Quest journey is ready. Continue
                learning, build your knowledge, and compete with
                other players.
              </p>

              <div
                style={{
                  marginTop: "24px",
                  padding: "15px",
                  borderRadius: "14px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
                  color: "var(--muted)",
                  fontSize: "14px",
                  wordBreak: "break-word",
                }}
              >
                {userEmail}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                  marginTop: "24px",
                }}
              >
                <Link
                  href="/dashboard"
                  className="sq-button-primary"
                >
                  Go to Dashboard →
                </Link>

                <button
                  className="sq-button-secondary"
                  onClick={handleLogout}
                  disabled={loading}
                >
                  {loading ? "Logging out..." : "Logout"}
                </button>
              </div>

              {message && (
                <p
                  style={{
                    marginTop: "18px",
                    color: "var(--muted)",
                    fontSize: "14px",
                  }}
                >
                  {message}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* =========================================================
     LANDING + SIGN-IN EXPERIENCE
     ========================================================= */

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)",
      }}
    >
      {/* NAVIGATION */}
      <header className="sq-nav">
        <Link href="/" className="sq-logo">
          Sahaba Quest
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <span
            className="landing-nav-text"
            style={{
              color: "var(--muted)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            Learn • Remember • Compete
          </span>

          <Link
            href="/signup"
            className="sq-button-primary"
            style={{
              minHeight: "42px",
              padding: "0 16px",
              fontSize: "13px",
            }}
          >
            Create Account
          </Link>
        </div>
      </header>

      {/* HERO */}
      <section className="sq-page">
        <div
          className="sq-container"
          style={{
            maxWidth: "1180px",
          }}
        >
          <div
            className="landing-hero"
            style={{
              display: "grid",
              gridTemplateColumns: "1.1fr 0.9fr",
              gap: "32px",
              alignItems: "stretch",
            }}
          >
            {/* HERO CONTENT */}
            <section
              className="sq-card"
              style={{
                padding: "56px",
                background:
                  "linear-gradient(145deg, #115e59 0%, #0f766e 60%, #149e93 100%)",
                color: "white",
                border: "none",
                overflow: "hidden",
                position: "relative",
                display: "flex",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: "360px",
                  height: "360px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)",
                  right: "-130px",
                  top: "-140px",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  width: "220px",
                  height: "220px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.05)",
                  left: "-100px",
                  bottom: "-100px",
                }}
              />

              <div
                style={{
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    borderRadius: "22px",
                    background: "rgba(255,255,255,0.13)",
                    border:
                      "1px solid rgba(255,255,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "24px",
                    fontWeight: 900,
                    marginBottom: "26px",
                  }}
                >
                  SQ
                </div>

                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 800,
                    letterSpacing: "1.5px",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.72)",
                  }}
                >
                  Learn • Remember • Compete
                </div>

                <h1
                  style={{
                    margin: "16px 0 18px",
                    fontSize: "clamp(42px, 6vw, 68px)",
                    lineHeight: 1,
                    letterSpacing: "-2px",
                    fontWeight: 900,
                  }}
                >
                  Know the
                  <br />
                  Sahabah.
                </h1>

                <p
                  style={{
                    maxWidth: "560px",
                    margin: 0,
                    fontSize: "17px",
                    lineHeight: 1.8,
                    color: "rgba(255,255,255,0.86)",
                  }}
                >
                  Sahaba Quest is a gamified Islamic learning
                  platform designed to help Muslims discover the
                  lives, sacrifices, character, and remarkable
                  stories of the Companions of the Prophet ﷺ.
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginTop: "28px",
                  }}
                >
                  <span
                    style={{
                      padding: "9px 13px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.12)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    🎮 Interactive Learning
                  </span>

                  <span
                    style={{
                      padding: "9px 13px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.12)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    🏆 Friendly Competition
                  </span>

                  <span
                    style={{
                      padding: "9px 13px",
                      borderRadius: "999px",
                      background: "rgba(255,255,255,0.12)",
                      fontSize: "12px",
                      fontWeight: 700,
                    }}
                  >
                    📚 Meaningful Knowledge
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "12px",
                    marginTop: "30px",
                  }}
                >
                  <Link
                    href="/signup"
                    className="landing-hero-button"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "50px",
                      padding: "0 22px",
                      borderRadius: "14px",
                      background: "white",
                      color: "var(--primary-dark)",
                      fontWeight: 800,
                    }}
                  >
                    Start Your Journey →
                  </Link>

                  <a
                    href="#about"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: "50px",
                      padding: "0 20px",
                      borderRadius: "14px",
                      border:
                        "1px solid rgba(255,255,255,0.22)",
                      color: "white",
                      fontWeight: 700,
                      fontSize: "14px",
                    }}
                  >
                    Learn More
                  </a>
                </div>
              </div>
            </section>

            {/* SIGN IN */}
            <section
              className="sq-card"
              style={{
                padding: "42px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  maxWidth: "460px",
                  width: "100%",
                  margin: "0 auto",
                }}
              >
                <span className="sq-badge">
                  Welcome back
                </span>

                <h2
                  style={{
                    margin: "18px 0 8px",
                    fontSize: "32px",
                    lineHeight: 1.15,
                    fontWeight: 900,
                    letterSpacing: "-0.7px",
                  }}
                >
                  Sign in
                </h2>

                <p className="sq-subtitle">
                  Continue your Sahaba Quest journey.
                </p>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleLogin();
                  }}
                  style={{
                    marginTop: "28px",
                  }}
                >
                  {/* EMAIL */}
                  <div style={{ marginBottom: "18px" }}>
                    <label
                      htmlFor="email"
                      className="sq-label"
                    >
                      Email address
                    </label>

                    <input
                      id="email"
                      type="email"
                      className="sq-input"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(event) =>
                        setEmail(event.target.value)
                      }
                      autoComplete="email"
                    />
                  </div>

                  {/* PASSWORD */}
                  <div style={{ marginBottom: "10px" }}>
                    <label
                      htmlFor="password"
                      className="sq-label"
                    >
                      Password
                    </label>

                    <div
                      style={{
                        position: "relative",
                      }}
                    >
                      <input
                        id="password"
                        type={
                          showPassword
                            ? "text"
                            : "password"
                        }
                        className="sq-input"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(event) =>
                          setPassword(event.target.value)
                        }
                        autoComplete="current-password"
                        style={{
                          paddingRight: "85px",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword(
                            (previous) => !previous
                          )
                        }
                        style={{
                          position: "absolute",
                          right: "10px",
                          top: "50%",
                          transform: "translateY(-50%)",
                          border: "none",
                          background: "transparent",
                          color: "var(--muted)",
                          fontSize: "13px",
                          fontWeight: 700,
                          padding: "8px",
                        }}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {/* FORGOT PASSWORD */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "flex-end",
                      marginBottom: "20px",
                    }}
                  >
                    <button
                      type="button"
                      style={{
                        border: "none",
                        background: "transparent",
                        padding: 0,
                        color: "var(--primary)",
                        fontSize: "13px",
                        fontWeight: 700,
                      }}
                      onClick={() =>
                        setMessage(
                          "Password reset will be available soon."
                        )
                      }
                    >
                      Forgot password?
                    </button>
                  </div>

                  {/* MESSAGE */}
                  {message && (
                    <div
                      style={{
                        marginBottom: "18px",
                        padding: "13px 15px",
                        borderRadius: "13px",
                        background: "var(--danger-light)",
                        border:
                          "1px solid rgba(220, 38, 38, 0.15)",
                        color: "var(--danger)",
                        fontSize: "13px",
                        lineHeight: 1.5,
                      }}
                    >
                      {message}
                    </div>
                  )}

                  {/* SIGN IN */}
                  <button
                    type="submit"
                    className="sq-button-primary"
                    disabled={loading}
                    style={{
                      width: "100%",
                      minHeight: "54px",
                      fontSize: "15px",
                    }}
                  >
                    {loading
                      ? "Signing in..."
                      : "Sign In →"}
                  </button>
                </form>

                {/* SIGN UP */}
                <div
                  style={{
                    marginTop: "24px",
                    paddingTop: "22px",
                    borderTop:
                      "1px solid var(--border)",
                    textAlign: "center",
                    color: "var(--muted)",
                    fontSize: "14px",
                  }}
                >
                  Don't have an account?{" "}
                  <Link
                    href="/signup"
                    style={{
                      color: "var(--primary)",
                      fontWeight: 800,
                    }}
                  >
                    Create one
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* WHAT IS SAHABA QUEST */}
          <section
            id="about"
            style={{
              marginTop: "70px",
            }}
          >
            <div
              style={{
                maxWidth: "700px",
                margin: "0 auto 30px",
                textAlign: "center",
              }}
            >
              <span className="sq-badge">
                Built for meaningful learning
              </span>

              <h2
                style={{
                  margin: "16px 0 10px",
                  fontSize: "32px",
                  fontWeight: 900,
                }}
              >
                More than just a quiz.
              </h2>

              <p className="sq-subtitle">
                Sahaba Quest is designed to turn learning about
                the Companions into an engaging, consistent habit.
              </p>
            </div>

            <div
              className="landing-features"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "18px",
              }}
            >
              <div
                className="sq-card"
                style={{
                  padding: "26px",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "15px",
                    background: "var(--primary-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "25px",
                  }}
                >
                  📖
                </div>

                <h3
                  style={{
                    margin: "18px 0 8px",
                    fontSize: "19px",
                    fontWeight: 800,
                  }}
                >
                  Learn the Sahabah
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "14px",
                    lineHeight: 1.7,
                  }}
                >
                  Explore meaningful questions about the lives,
                  character, sacrifices, and experiences of the
                  Companions.
                </p>
              </div>

              <div
                className="sq-card"
                style={{
                  padding: "26px",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "15px",
                    background: "var(--secondary-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "25px",
                  }}
                >
                  📈
                </div>

                <h3
                  style={{
                    margin: "18px 0 8px",
                    fontSize: "19px",
                    fontWeight: 800,
                  }}
                >
                  Track Your Growth
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "14px",
                    lineHeight: 1.7,
                  }}
                >
                  Build XP, maintain your streak, monitor your
                  progress, and see how your knowledge develops.
                </p>
              </div>

              <div
                className="sq-card"
                style={{
                  padding: "26px",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "15px",
                    background: "var(--success-light)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "25px",
                  }}
                >
                  🏆
                </div>

                <h3
                  style={{
                    margin: "18px 0 8px",
                    fontSize: "19px",
                    fontWeight: 800,
                  }}
                >
                  Compete & Grow
                </h3>

                <p
                  style={{
                    margin: 0,
                    color: "var(--muted)",
                    fontSize: "14px",
                    lineHeight: 1.7,
                  }}
                >
                  Challenge yourself and eventually compete with
                  friends, families, schools, communities, and
                  sponsored competitions.
                </p>
              </div>
            </div>
          </section>

          {/* CLOSING CTA */}
          <section
            className="sq-card"
            style={{
              marginTop: "28px",
              padding: "34px",
              textAlign: "center",
              background:
                "linear-gradient(135deg, var(--primary-light), var(--white))",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "26px",
                fontWeight: 900,
              }}
            >
              Start building your knowledge today.
            </h2>

            <p
              className="sq-subtitle"
              style={{
                maxWidth: "600px",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            >
              Begin your journey with the Companions of the
              Messenger of Allah ﷺ.
            </p>

            <Link
              href="/signup"
              className="sq-button-primary"
              style={{
                marginTop: "18px",
              }}
            >
              Create Your Free Account →
            </Link>
          </section>

          {/* FOOTER */}
          <footer
            style={{
              padding: "34px 0 10px",
              textAlign: "center",
              color: "var(--muted-light)",
              fontSize: "12px",
            }}
          >
            Sahaba Quest — Learn • Remember • Compete
          </footer>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 900px) {
          .landing-hero {
            grid-template-columns: 1fr !important;
          }

          .landing-features {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 650px) {
          .landing-nav-text {
            display: none !important;
          }

          .landing-hero > section:first-child {
            padding: 36px 28px !important;
          }

          .landing-hero > section:nth-child(2) {
            padding: 30px 22px !important;
          }

          .landing-features {
            grid-template-columns: 1fr !important;
          }

          .sq-card {
            border-radius: 20px;
          }
        }

        @media (max-width: 500px) {
          .landing-hero-button {
            width: 100%;
          }
        }
      `}</style>
    </main>
  );
}