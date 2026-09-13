"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Home() {
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

    setMessage("Login successful! 🎉");
    setLoading(false);
  }

  async function handleLogout() {
    setLoading(true);

    await supabase.auth.signOut();

    setMessage("You have been logged out.");
    setLoading(false);
  }

  if (userEmail) {
    return (
      <main
        className="sq-page"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
        }}
      >
        <div
          className="sq-card"
          style={{
            width: "100%",
            maxWidth: "520px",
            padding: "42px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              margin: "0 auto 22px",
              borderRadius: "22px",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
              fontWeight: 900,
            }}
          >
            SQ
          </div>

          <span className="sq-badge">
            Account Active
          </span>

          <h1
            style={{
              margin: "18px 0 8px",
              fontSize: "32px",
              fontWeight: 900,
            }}
          >
            Welcome back! 🎉
          </h1>

          <p
            style={{
              margin: "0 auto",
              maxWidth: "400px",
              color: "var(--muted)",
              lineHeight: 1.7,
            }}
          >
            You are already signed in to your Sahaba
            Quest account.
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
              gap: "12px",
              marginTop: "24px",
            }}
          >
            <a
              href="/dashboard"
              className="sq-button-primary"
            >
              Go to Dashboard →
            </a>

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
      </main>
    );
  }

  return (
    <main
      className="sq-page"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1080px",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: "24px",
          alignItems: "stretch",
        }}
      >
        {/* BRAND PANEL */}
        <section
          className="sq-card"
          style={{
            padding: "48px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background:
              "linear-gradient(145deg, #115e59 0%, #0f766e 60%, #149e93 100%)",
            color: "white",
            border: "none",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: "300px",
              height: "300px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.07)",
              right: "-110px",
              top: "-100px",
            }}
          />

          <div
            style={{
              position: "absolute",
              width: "180px",
              height: "180px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              left: "-80px",
              bottom: "-70px",
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
                background: "rgba(255,255,255,0.14)",
                border:
                  "1px solid rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
                fontWeight: 900,
                marginBottom: "28px",
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
                opacity: 0.75,
              }}
            >
              Learn • Remember • Compete
            </div>

            <h1
              style={{
                margin: "14px 0 16px",
                fontSize: "clamp(38px, 5vw, 58px)",
                lineHeight: 1.02,
                letterSpacing: "-1.5px",
                fontWeight: 900,
              }}
            >
              Sahaba
              <br />
              Quest
            </h1>

            <p
              style={{
                maxWidth: "480px",
                margin: 0,
                fontSize: "17px",
                lineHeight: 1.8,
                opacity: 0.88,
              }}
            >
              Discover the lives, sacrifices and
              remarkable stories of the companions
              of the Prophet ﷺ — one question at a
              time.
            </p>

            <div
              style={{
                display: "flex",
                gap: "10px",
                flexWrap: "wrap",
                marginTop: "30px",
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
                🎮 Interactive Quizzes
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
                🏆 Competitions
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
                📚 Islamic Knowledge
              </span>
            </div>
          </div>
        </section>

        {/* SIGN IN PANEL */}
        <section
          className="sq-card"
          style={{
            padding: "42px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ maxWidth: "460px", width: "100%", margin: "0 auto" }}>
            <span className="sq-badge">
              Welcome back
            </span>

            <h2
              style={{
                margin: "18px 0 8px",
                fontSize: "34px",
                lineHeight: 1.15,
                fontWeight: 900,
                letterSpacing: "-0.7px",
              }}
            >
              Sign in to your account
            </h2>

            <p className="sq-subtitle">
              Continue your journey with the Sahabah.
            </p>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleLogin();
              }}
              style={{
                marginTop: "30px",
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

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: "22px",
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

              {/* ERROR / STATUS */}
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
                marginTop: "26px",
                paddingTop: "24px",
                borderTop:
                  "1px solid var(--border)",
                textAlign: "center",
                color: "var(--muted)",
                fontSize: "14px",
              }}
            >
              Don't have an account?{" "}
              <a
                href="/signup"
                style={{
                  color: "var(--primary)",
                  fontWeight: 800,
                }}
              >
                Create one
              </a>
            </div>

            <p
              style={{
                marginTop: "24px",
                textAlign: "center",
                color: "var(--muted-light)",
                fontSize: "11px",
                lineHeight: 1.5,
              }}
            >
              By continuing, you agree to use
              Sahaba Quest responsibly as a platform
              for Islamic learning and friendly
              competition.
            </p>
          </div>
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 850px) {
          main > div {
            grid-template-columns: 1fr !important;
          }

          main > div > section:first-child {
            display: none !important;
          }
        }

        @media (max-width: 600px) {
          .sq-card {
            padding: 28px 22px !important;
          }
        }
      `}</style>
    </main>
  );
}