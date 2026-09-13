"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setSuccess(false);

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanDisplayName || !cleanUsername || !cleanEmail) {
      setMessage("Please fill in all required fields.");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setMessage(
        "Username can only contain lowercase letters, numbers and underscores."
      );
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      /*
       * Check username and display name before creating
       * the authentication account.
       */
      const { data: nameCheck, error: nameCheckError } = await supabase.rpc(
        "check_signup_names",
        {
          requested_username: cleanUsername,
          requested_display_name: cleanDisplayName,
        }
      );

      if (nameCheckError) {
        setMessage(
          "We could not verify your username and display name. Please try again."
        );
        setLoading(false);
        return;
      }

      const result = Array.isArray(nameCheck) ? nameCheck[0] : nameCheck;

      if (result?.username_taken) {
        setMessage(
          `The username "${cleanUsername}" is already taken. Please choose another username.`
        );
        setLoading(false);
        return;
      }

      if (result?.display_name_taken) {
        setMessage(
          `The display name "${cleanDisplayName}" is already in use. Please choose another display name.`
        );
        setLoading(false);
        return;
      }

      /*
       * Create the Supabase authentication account.
       * The display name and username are also stored in
       * user metadata so our profile trigger can use them.
       */
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            display_name: cleanDisplayName,
            username: cleanUsername,
          },
        },
      });

      if (error) {
        const errorMessage = error.message.toLowerCase();

        if (errorMessage.includes("username")) {
          setMessage(
            "That username is already taken. Please choose another username."
          );
        } else if (errorMessage.includes("display")) {
          setMessage(
            "That display name is already in use. Please choose another display name."
          );
        } else if (errorMessage.includes("already registered")) {
          setMessage(
            "An account with this email already exists. Please sign in instead."
          );
        } else {
          setMessage(error.message);
        }

        setLoading(false);
        return;
      }

      /*
       * Supabase may return no user when email confirmation
       * is required, so we use the absence of an error as
       * the successful signup signal.
       */
      if (data) {
        setSuccess(true);
        setMessage("");
      }
    } catch {
      setMessage(
        "Something went wrong while creating your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "var(--background)",
        }}
      >
        <div
          className="sq-card"
          style={{
            width: "100%",
            maxWidth: "520px",
            padding: "40px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "72px",
              height: "72px",
              margin: "0 auto 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              background: "var(--success-light)",
              color: "var(--success)",
              fontSize: "32px",
            }}
          >
            ✓
          </div>

          <h1 className="sq-title">Account created!</h1>

          <p
            className="sq-subtitle"
            style={{ marginTop: "16px" }}
          >
            We have sent a confirmation email to:
          </p>

          <p
            style={{
              margin: "12px 0 24px",
              fontWeight: 800,
              wordBreak: "break-word",
            }}
          >
            {email}
          </p>

          <p
            style={{
              marginBottom: "28px",
              color: "var(--muted)",
              lineHeight: 1.7,
            }}
          >
            Please check your email and click the confirmation link.
            After confirming your email, you can sign in to Sahaba Quest.
          </p>

          <Link
            href="/"
            className="sq-button-primary"
            style={{ width: "100%" }}
          >
            Go to Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(420px, 560px)",
        background: "var(--background)",
      }}
    >
      {/* Brand panel */}
      <section
        style={{
          minHeight: "100vh",
          padding: "60px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, var(--primary-dark), var(--primary))",
          color: "white",
        }}
      >
        <div style={{ maxWidth: "560px" }}>
          <div
            style={{
              display: "inline-flex",
              padding: "8px 14px",
              borderRadius: "999px",
              background: "rgba(255,255,255,0.12)",
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "24px",
            }}
          >
            SAHABA QUEST
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(42px, 5vw, 68px)",
              lineHeight: 1.05,
              fontWeight: 900,
              letterSpacing: "-2px",
            }}
          >
            Learn the lives of the Sahabah.
          </h1>

          <p
            style={{
              marginTop: "24px",
              maxWidth: "500px",
              fontSize: "18px",
              lineHeight: 1.8,
              color: "rgba(255,255,255,0.82)",
            }}
          >
            Build your knowledge, earn XP, maintain your streak and
            compete with other learners.
          </p>

          <div
            style={{
              marginTop: "40px",
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            {[
              "📚 Learn",
              "⚡ Earn XP",
              "🔥 Build Streaks",
              "🏆 Compete",
            ].map((item) => (
              <span
                key={item}
                style={{
                  padding: "10px 14px",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.1)",
                  fontSize: "14px",
                  fontWeight: 700,
                }}
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Signup panel */}
      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 28px",
          background: "var(--white)",
          overflowY: "auto",
        }}
      >
        <div style={{ width: "100%", maxWidth: "460px" }}>
          <div style={{ marginBottom: "32px" }}>
            <div className="sq-badge">Create your account</div>

            <h2
              style={{
                margin: "18px 0 0",
                fontSize: "34px",
                lineHeight: 1.15,
                fontWeight: 900,
              }}
            >
              Join Sahaba Quest
            </h2>

            <p className="sq-subtitle">
              Create your player profile and begin your journey.
            </p>
          </div>

          {message && (
            <div
              style={{
                marginBottom: "20px",
                padding: "14px 16px",
                borderRadius: "14px",
                background: "var(--danger-light)",
                color: "var(--danger)",
                fontSize: "14px",
                lineHeight: 1.5,
                fontWeight: 600,
              }}
            >
              {message}
            </div>
          )}

          <form onSubmit={handleSignup}>
            <div style={{ marginBottom: "18px" }}>
              <label className="sq-label">
                Display Name
              </label>

              <input
                className="sq-input"
                type="text"
                placeholder="e.g. Muadh"
                value={displayName}
                onChange={(event) =>
                  setDisplayName(event.target.value)
                }
                required
                autoComplete="name"
              />

              <p
                style={{
                  margin: "7px 0 0",
                  color: "var(--muted)",
                  fontSize: "12px",
                }}
              >
                This is the name other players will see.
              </p>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label className="sq-label">
                Username
              </label>

              <input
                className="sq-input"
                type="text"
                placeholder="e.g. muadh123"
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                      .toLowerCase()
                      .replace(/\s/g, "")
                  )
                }
                required
                autoComplete="username"
              />

              <p
                style={{
                  margin: "7px 0 0",
                  color: "var(--muted)",
                  fontSize: "12px",
                }}
              >
                Use lowercase letters, numbers and underscores.
              </p>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label className="sq-label">
                Email Address
              </label>

              <input
                className="sq-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                required
                autoComplete="email"
              />
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label className="sq-label">
                Password
              </label>

              <div style={{ position: "relative" }}>
                <input
                  className="sq-input"
                  style={{ paddingRight: "90px" }}
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  required
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "var(--primary)",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label className="sq-label">
                Confirm Password
              </label>

              <div style={{ position: "relative" }}>
                <input
                  className="sq-input"
                  style={{ paddingRight: "90px" }}
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Enter your password again"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                  autoComplete="new-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  style={{
                    position: "absolute",
                    right: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    border: "none",
                    background: "transparent",
                    color: "var(--primary)",
                    fontWeight: 700,
                    fontSize: "13px",
                  }}
                >
                  {showConfirmPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              className="sq-button-primary"
              type="submit"
              disabled={loading}
              style={{ width: "100%" }}
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p
            style={{
              marginTop: "24px",
              textAlign: "center",
              color: "var(--muted)",
              fontSize: "14px",
            }}
          >
            Already have an account?{" "}
            <Link
              href="/"
              style={{
                color: "var(--primary)",
                fontWeight: 800,
              }}
            >
              Sign in
            </Link>
          </p>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 850px) {
          main {
            grid-template-columns: 1fr !important;
          }

          main > section:first-child {
            display: none !important;
          }

          main > section:last-child {
            min-height: 100vh;
          }
        }
      `}</style>
    </main>
  );
}