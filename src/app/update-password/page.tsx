"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "error" | "success"
  >("error");

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setMessage(
          "This password reset link is invalid or has expired. Please request a new reset link."
        );
        setMessageType("error");
      }

      setCheckingSession(false);
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMessage("");
        setMessageType("success");
        setCheckingSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword() {
    if (!password || !confirmPassword) {
      setMessageType("error");
      setMessage("Please enter your new password twice.");
      return;
    }

    if (password.length < 6) {
      setMessageType("error");
      setMessage(
        "Your password must be at least 6 characters long."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessageType("error");
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      setMessageType("error");
      setMessage(error.message);
      return;
    }

    setMessageType("success");
    setMessage(
      "Your password has been updated successfully. Redirecting to your dashboard..."
    );

    setTimeout(() => {
      router.push("/dashboard");
    }, 1800);
  }

  if (checkingSession) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
          padding: "24px",
        }}
      >
        <div
          className="sq-card"
          style={{
            width: "100%",
            maxWidth: "480px",
            padding: "42px",
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
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "21px",
              fontWeight: 900,
            }}
          >
            SQ
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "28px",
              fontWeight: 900,
            }}
          >
            Checking reset link...
          </h1>

          <p
            className="sq-subtitle"
            style={{
              marginTop: "10px",
            }}
          >
            Please wait a moment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: "20px",
          }}
        >
          <Link
            href="/"
            className="sq-logo"
            style={{
              display: "inline-block",
            }}
          >
            Sahaba Quest
          </Link>
        </div>

        <div
          className="sq-card"
          style={{
            padding: "42px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 20px",
              borderRadius: "20px",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "21px",
              fontWeight: 900,
            }}
          >
            SQ
          </div>

          <div
            style={{
              textAlign: "center",
            }}
          >
            <span className="sq-badge">
              Account Security
            </span>

            <h1
              style={{
                margin: "18px 0 8px",
                fontSize: "32px",
                lineHeight: 1.15,
                fontWeight: 900,
                letterSpacing: "-0.7px",
              }}
            >
              Set a new password
            </h1>

            <p className="sq-subtitle">
              Choose a new password for your Sahaba Quest account.
            </p>
          </div>

          <div style={{ marginTop: "28px" }}>
            {/* NEW PASSWORD */}
            <div style={{ marginBottom: "18px" }}>
              <label
                htmlFor="new-password"
                className="sq-label"
              >
                New password
              </label>

              <div
                style={{
                  position: "relative",
                }}
              >
                <input
                  id="new-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  className="sq-input"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  autoComplete="new-password"
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

            {/* CONFIRM PASSWORD */}
            <div style={{ marginBottom: "18px" }}>
              <label
                htmlFor="confirm-password"
                className="sq-label"
              >
                Confirm new password
              </label>

              <div
                style={{
                  position: "relative",
                }}
              >
                <input
                  id="confirm-password"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  className="sq-input"
                  placeholder="Enter your new password again"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  style={{
                    paddingRight: "85px",
                  }}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
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
                  {showConfirmPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            {/* MESSAGE */}
            {message && (
              <div
                style={{
                  marginBottom: "18px",
                  padding: "13px 15px",
                  borderRadius: "13px",
                  background:
                    messageType === "success"
                      ? "var(--success-light)"
                      : "var(--danger-light)",
                  border:
                    messageType === "success"
                      ? "1px solid rgba(22, 163, 74, 0.15)"
                      : "1px solid rgba(220, 38, 38, 0.15)",
                  color:
                    messageType === "success"
                      ? "var(--success)"
                      : "var(--danger)",
                  fontSize: "13px",
                  lineHeight: 1.5,
                }}
              >
                {message}
              </div>
            )}

            {/* UPDATE PASSWORD */}
            <button
              type="button"
              className="sq-button-primary"
              onClick={handleUpdatePassword}
              disabled={loading}
              style={{
                width: "100%",
                minHeight: "54px",
                fontSize: "15px",
              }}
            >
              {loading
                ? "Updating password..."
                : "Update Password →"}
            </button>

            <div
              style={{
                marginTop: "22px",
                textAlign: "center",
              }}
            >
              <Link
                href="/"
                style={{
                  color: "var(--primary)",
                  fontSize: "13px",
                  fontWeight: 800,
                }}
              >
                ← Back to Sign In
              </Link>
            </div>
          </div>
        </div>

        <p
          style={{
            marginTop: "20px",
            textAlign: "center",
            color: "var(--muted-light)",
            fontSize: "12px",
          }}
        >
          Sahaba Quest — Learn • Remember • Compete
        </p>
      </div>

      <style jsx>{`
        @media (max-width: 500px) {
          .sq-card {
            padding: 28px 20px !important;
          }
        }
      `}</style>
    </main>
  );
}