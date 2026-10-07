"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SchoolStudentLoginPage() {
  const router = useRouter();

  const [studentId, setStudentId] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");

    const cleanStudentId = studentId.trim().toUpperCase();
    const cleanPin = pin.trim();

    if (!cleanStudentId) {
      setMessageType("error");
      setMessage("Please enter your Student ID.");
      return;
    }

    if (!/^\d{6}$/.test(cleanPin)) {
      setMessageType("error");
      setMessage("Your PIN must be exactly 6 digits.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/schools/student-auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: cleanStudentId,
          pin: cleanPin,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.success) {
        setMessageType("error");
        setMessage(
          result?.message ||
            "We could not sign you in. Please check your Student ID and PIN."
        );
        return;
      }

      sessionStorage.setItem(
        "school_student_session_token",
        result.session.token
      );

      sessionStorage.setItem(
        "school_student_expires_at",
        result.session.expires_at
      );

      setMessageType("success");
      setMessage(
        result.message ||
          "Assalamu Alaikum. Your learning session has started."
      );

      router.replace("/schools/student-dashboard");
    } catch (error) {
      console.error("Student login error:", error);
      setMessageType("error");
      setMessage(
        "Something went wrong while signing you in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="sq-student-login-page">
      <div className="sq-student-login-shell">
        {/* BRAND PANEL */}
        <section className="sq-student-brand-panel">
          <div className="sq-brand-glow sq-brand-glow-one" />
          <div className="sq-brand-glow sq-brand-glow-two" />

          <div className="sq-student-brand-content">
            <Link href="/" className="sq-student-brand-logo">
              Sahaba Quest
            </Link>

            <div className="sq-student-brand-kicker">
              LEARN • REMEMBER • COMPETE
            </div>

            <h1>
              Your journey of
              <br />
              beneficial knowledge.
            </h1>

            <p className="sq-student-brand-copy">
              Learn about the Sahabah and Sahabiyat, test your knowledge,
              earn XP and grow through your Sahaba Quest journey.
            </p>

            <div className="sq-student-feature-list">
              <div className="sq-student-feature">
                <div className="sq-student-feature-icon">⚔️</div>
                <div>
                  <strong>Quest through knowledge</strong>
                  <span>Answer questions and progress through your levels.</span>
                </div>
              </div>

              <div className="sq-student-feature">
                <div className="sq-student-feature-icon">🏆</div>
                <div>
                  <strong>Earn XP and compete</strong>
                  <span>Build your score and rise on your class leaderboard.</span>
                </div>
              </div>

              <div className="sq-student-feature">
                <div className="sq-student-feature-icon">📖</div>
                <div>
                  <strong>Learn with purpose</strong>
                  <span>Discover the lives, character and sacrifices of the Sahabah.</span>
                </div>
              </div>
            </div>

            <div className="sq-student-brand-footer">
              May Allah increase you in beneficial knowledge.
            </div>
          </div>
        </section>

        {/* LOGIN PANEL */}
        <section className="sq-student-login-panel">
          <div className="sq-student-login-card">
            <div className="sq-student-mobile-logo">
              <Link href="/" className="sq-student-brand-logo">
                Sahaba Quest
              </Link>
            </div>

            <div className="sq-login-heading">
              <span className="sq-badge">STUDENT LOGIN</span>

              <h2>Assalamu Alaikum</h2>

              <p>
                Sign in with the Student ID and PIN provided by your
                school or madrasa.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="sq-student-login-form">
              <div>
                <label htmlFor="student-id" className="sq-label">
                  Student ID
                </label>

                <input
                  id="student-id"
                  value={studentId}
                  onChange={(event) =>
                    setStudentId(event.target.value.toUpperCase())
                  }
                  placeholder="e.g. SQ-303444-0002"
                  className="sq-input sq-student-login-input"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  disabled={loading}
                />

                <p className="sq-login-hint">
                  Your Student ID is provided by your school administrator.
                </p>
              </div>

              <div>
                <label htmlFor="student-pin" className="sq-label">
                  6-Digit PIN
                </label>

                <div className="sq-pin-wrapper">
                  <input
                    id="student-pin"
                    value={pin}
                    onChange={(event) => {
                      const value = event.target.value
                        .replace(/\D/g, "")
                        .slice(0, 6);
                      setPin(value);
                    }}
                    placeholder="••••••"
                    className="sq-input sq-student-login-input sq-pin-input"
                    type={showPin ? "text" : "password"}
                    inputMode="numeric"
                    autoComplete="current-password"
                    maxLength={6}
                    disabled={loading}
                  />

                  <button
                    type="button"
                    className="sq-pin-toggle"
                    onClick={() => setShowPin((current) => !current)}
                    aria-label={showPin ? "Hide PIN" : "Show PIN"}
                    disabled={loading}
                  >
                    {showPin ? "Hide" : "Show"}
                  </button>
                </div>

                <p className="sq-login-hint">
                  Enter the 6-digit PIN assigned to you.
                </p>
              </div>

              {message && (
                <div
                  className={`sq-login-message ${
                    messageType === "success"
                      ? "sq-login-message-success"
                      : "sq-login-message-error"
                  }`}
                  role="alert"
                >
                  <span className="sq-login-message-icon">
                    {messageType === "success" ? "✓" : "!"}
                  </span>
                  <span>{message}</span>
                </div>
              )}

              <button
                type="submit"
                className="sq-button-primary sq-student-login-button"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="sq-login-spinner" />
                    Signing in...
                  </>
                ) : (
                  <>Continue to Sahaba Quest →</>
                )}
              </button>
            </form>

            <div className="sq-student-login-divider">
              <span />
              <span>YOUR LEARNING JOURNEY</span>
              <span />
            </div>

            <div className="sq-student-login-note">
              <span className="sq-student-login-note-icon">🔐</span>
              <div>
                <strong>Keep your PIN private</strong>
                <p>
                  Your Student ID and PIN are for your personal Sahaba Quest
                  account. If you forget your PIN, ask your school administrator
                  to reset it.
                </p>
              </div>
            </div>

            <Link href="/" className="sq-student-back-link">
              ← Back to Sahaba Quest
            </Link>
          </div>
        </section>
      </div>

      <style jsx>{`
        .sq-student-login-page {
          min-height: 100vh;
          padding: 28px;
          background:
            radial-gradient(
              circle at top left,
              rgba(204, 251, 241, 0.85),
              transparent 34%
            ),
            var(--background);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sq-student-login-shell {
          width: 100%;
          max-width: 1180px;
          min-height: 720px;
          display: grid;
          grid-template-columns: 1fr 0.92fr;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          background: var(--white);
          box-shadow:
            0 24px 70px rgba(15, 118, 110, 0.11),
            0 4px 18px rgba(15, 118, 110, 0.05);
        }

        .sq-student-brand-panel {
          position: relative;
          overflow: hidden;
          padding: 58px 58px 44px;
          display: flex;
          align-items: center;
          background:
            linear-gradient(
              145deg,
              #115e59 0%,
              #0f766e 58%,
              #149e93 100%
            );
          color: var(--white);
        }

        .sq-brand-glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }

        .sq-brand-glow-one {
          width: 440px;
          height: 440px;
          right: -190px;
          top: -180px;
          background: rgba(255, 255, 255, 0.065);
        }

        .sq-brand-glow-two {
          width: 300px;
          height: 300px;
          left: -150px;
          bottom: -150px;
          background: rgba(255, 255, 255, 0.05);
        }

        .sq-student-brand-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 540px;
          margin: 0 auto;
        }

        .sq-student-brand-logo {
          display: inline-block;
          color: var(--white);
          font-size: 25px;
          font-weight: 900;
          letter-spacing: -0.6px;
        }

        .sq-student-brand-kicker {
          margin-top: 58px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 1.7px;
        }

        .sq-student-brand-content h1 {
          margin: 17px 0 18px;
          font-size: clamp(38px, 4.5vw, 58px);
          line-height: 1.02;
          letter-spacing: -2px;
          font-weight: 900;
        }

        .sq-student-brand-copy {
          max-width: 500px;
          margin: 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 15px;
          line-height: 1.75;
        }

        .sq-student-feature-list {
          display: grid;
          gap: 12px;
          margin-top: 34px;
        }

        .sq-student-feature {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 13px 14px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.065);
          backdrop-filter: blur(8px);
        }

        .sq-student-feature-icon {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: grid;
          place-items: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.1);
          font-size: 19px;
        }

        .sq-student-feature strong {
          display: block;
          font-size: 13px;
          font-weight: 800;
        }

        .sq-student-feature span {
          display: block;
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.67);
          font-size: 11.5px;
          line-height: 1.45;
        }

        .sq-student-brand-footer {
          margin-top: 34px;
          color: rgba(255, 255, 255, 0.58);
          font-size: 11px;
          line-height: 1.5;
        }

        .sq-student-login-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 52px;
          background: var(--white);
        }

        .sq-student-login-card {
          width: 100%;
          max-width: 430px;
        }

        .sq-student-mobile-logo {
          display: none;
        }

        .sq-login-heading .sq-badge {
          font-size: 11px;
          letter-spacing: 0.5px;
        }

        .sq-login-heading h2 {
          margin: 18px 0 8px;
          color: var(--foreground);
          font-size: 32px;
          line-height: 1.1;
          font-weight: 900;
          letter-spacing: -0.9px;
        }

        .sq-login-heading p {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.65;
        }

        .sq-student-login-form {
          display: grid;
          gap: 23px;
          margin-top: 32px;
        }

        .sq-student-login-input {
          height: 54px;
          padding: 0 16px;
          border-radius: 14px;
          font-size: 15px;
        }

        .sq-student-login-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 4px rgba(15, 118, 110, 0.1);
        }

        .sq-login-hint {
          margin: 7px 2px 0;
          color: var(--muted-light);
          font-size: 11px;
          line-height: 1.5;
        }

        .sq-pin-wrapper {
          position: relative;
        }

        .sq-pin-input {
          padding-right: 70px;
          letter-spacing: 4px;
          font-weight: 800;
        }

        .sq-pin-toggle {
          position: absolute;
          right: 7px;
          top: 7px;
          height: 40px;
          padding: 0 12px;
          border: 0;
          border-radius: 10px;
          background: var(--primary-light);
          color: var(--primary-dark);
          font-size: 12px;
          font-weight: 800;
        }

        .sq-pin-toggle:hover {
          background: #b9f5ea;
        }

        .sq-login-message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 13px 14px;
          border-radius: 14px;
          font-size: 13px;
          line-height: 1.55;
        }

        .sq-login-message-error {
          border: 1px solid #fecaca;
          background: var(--danger-light);
          color: var(--danger);
        }

        .sq-login-message-success {
          border: 1px solid #bbf7d0;
          background: var(--success-light);
          color: #166534;
        }

        .sq-login-message-icon {
          width: 22px;
          height: 22px;
          flex: 0 0 22px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.65);
          font-size: 11px;
          font-weight: 900;
        }

        .sq-student-login-button {
          width: 100%;
          min-height: 54px;
          margin-top: 1px;
          font-size: 14px;
        }

        .sq-login-spinner {
          width: 17px;
          height: 17px;
          border: 2px solid rgba(255, 255, 255, 0.45);
          border-top-color: white;
          border-radius: 50%;
          animation: sq-spin 0.7s linear infinite;
        }

        .sq-student-login-divider {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 10px;
          margin: 31px 0 20px;
          color: var(--muted-light);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .sq-student-login-divider span:first-child,
        .sq-student-login-divider span:last-child {
          height: 1px;
          background: var(--border);
        }

        .sq-student-login-note {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 15px;
          border: 1px solid #e5efed;
          border-radius: 15px;
          background: linear-gradient(
            135deg,
            #f7fffd 0%,
            #f8faf9 100%
          );
        }

        .sq-student-login-note-icon {
          width: 34px;
          height: 34px;
          flex: 0 0 34px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: var(--primary-light);
          font-size: 15px;
        }

        .sq-student-login-note strong {
          display: block;
          color: var(--foreground);
          font-size: 12px;
          font-weight: 800;
        }

        .sq-student-login-note p {
          margin: 4px 0 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.6;
        }

        .sq-student-back-link {
          display: block;
          margin-top: 25px;
          color: var(--muted);
          text-align: center;
          font-size: 12px;
          font-weight: 700;
          transition: color 0.2s ease;
        }

        .sq-student-back-link:hover {
          color: var(--primary-dark);
        }

        @keyframes sq-spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 900px) {
          .sq-student-login-page {
            padding: 18px;
          }

          .sq-student-login-shell {
            grid-template-columns: 1fr;
            min-height: auto;
            max-width: 620px;
          }

          .sq-student-brand-panel {
            display: none;
          }

          .sq-student-login-panel {
            padding: 42px 34px;
          }

          .sq-student-mobile-logo {
            display: block;
            margin-bottom: 34px;
          }

          .sq-student-mobile-logo .sq-student-brand-logo {
            color: var(--primary);
            font-size: 22px;
          }
        }

        @media (max-width: 560px) {
          .sq-student-login-page {
            min-height: 100dvh;
            padding: 0;
            align-items: stretch;
          }

          .sq-student-login-shell {
            min-height: 100dvh;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .sq-student-login-panel {
            padding: 28px 18px 24px;
            align-items: flex-start;
          }

          .sq-student-login-card {
            max-width: none;
            padding-top: 8px;
          }

          .sq-student-mobile-logo {
            margin-bottom: 52px;
          }

          .sq-login-heading h2 {
            font-size: 29px;
          }

          .sq-login-heading p {
            font-size: 13px;
          }

          .sq-student-login-form {
            gap: 21px;
            margin-top: 29px;
          }

          .sq-student-login-input {
            height: 52px;
          }

          .sq-student-login-divider {
            margin-top: 28px;
          }

          .sq-student-login-note {
            padding: 13px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sq-login-spinner {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
