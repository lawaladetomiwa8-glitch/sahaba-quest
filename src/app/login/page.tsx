"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "error" | "success"
  >("error");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace("/dashboard");
      }
    };

    checkUser();
  }, [router]);

  /*
   * Set up an Organisation account after login.
   *
   * Individual and Family accounts are left untouched.
   */
  const setupOrganisationIfNeeded = async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Unable to verify your account.");
    }

    const accountType =
      user.user_metadata?.account_type;

    /*
     * Only Organisation accounts need
     * organisation setup.
     */
    if (accountType !== "organisation") {
      return;
    }

    /*
     * The database function safely creates the
     * organisation and owner membership.
     *
     * It is idempotent, so calling it again
     * will not create duplicate organisations.
     */
    const { error } = await supabase.rpc(
      "setup_my_organization"
    );

    if (error) {
      console.error(
        "Organisation setup error:",
        error
      );

      throw new Error(
        "We couldn't finish setting up your organisation. Please try again."
      );
    }
  };

  /*
   * Handle login
   */
  const handleLogin = async (
    event?: FormEvent<HTMLFormElement>
  ) => {
    event?.preventDefault();

    setMessage("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessageType("error");
      setMessage(
        "Please enter your email and password."
      );
      return;
    }

    try {
      setLoading(true);

      const { error } =
        await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

      if (error) {
        setMessageType("error");
        setMessage(error.message);
        return;
      }

      /*
       * If this is an Organisation account,
       * make sure its Organisation record
       * and owner membership exist before
       * sending the user to the dashboard.
       */
      try {
        await setupOrganisationIfNeeded();
      } catch (organisationError) {
        console.error(
          "Organisation setup failed:",
          organisationError
        );

        setMessageType("error");
        setMessage(
          organisationError instanceof Error
            ? organisationError.message
            : "We couldn't finish setting up your organisation. Please try again."
        );

        return;
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Login error:", error);

      setMessageType("error");
      setMessage(
        "Something went wrong while signing in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Handle forgot password
   */
  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessageType("error");
      setMessage(
        "Please enter your email address first."
      );
      return;
    }

    try {
      setResetLoading(true);
      setMessage("");

      /*
       * Supabase will return the user to this page after
       * the email reset link is opened.
       */
      const redirectTo =
        `${window.location.origin}/update-password`;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        );

      if (error) {
        console.error(
          "Password reset error:",
          error
        );

        setMessageType("error");
        setMessage(error.message);
        return;
      }

      setMessageType("success");

      setMessage(
        "If an account exists with this email, a password reset link has been sent. Please check your inbox."
      );
    } catch (error) {
      console.error(
        "Unexpected password reset error:",
        error
      );

      setMessageType("error");

      setMessage(
        "Unable to send the password reset email. Please try again."
      );
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <main className="login-page">
      {/* =====================================================
          LEFT BRAND PANEL
      ====================================================== */}
      <section className="brand-panel">
        <div className="brand-content">
          <Link
            href="/"
            className="brand-logo"
          >
            SQ
          </Link>

          <span className="brand-badge">
            LEARN • REMEMBER • COMPETE
          </span>

          <h1>
            Know the
            <br />
            Sahabah.
          </h1>

          <p>
            Sahaba Quest is a gamified Islamic learning
            platform designed to help Muslims discover the
            lives, sacrifices, character, and remarkable
            stories of the Companions of the Prophet ﷺ.
          </p>

          <div className="feature-list">
            <div className="feature">
              <span className="feature-icon">
                🎮
              </span>

              <div>
                <strong>
                  Interactive Learning
                </strong>

                <p>
                  Learn through engaging questions,
                  challenges and quests.
                </p>
              </div>
            </div>

            <div className="feature">
              <span className="feature-icon">
                🏆
              </span>

              <div>
                <strong>
                  Friendly Competition
                </strong>

                <p>
                  Build XP and compete with other
                  learners.
                </p>
              </div>
            </div>

            <div className="feature">
              <span className="feature-icon">
                📚
              </span>

              <div>
                <strong>
                  Meaningful Knowledge
                </strong>

                <p>
                  Discover lessons from the lives of
                  the Sahabah.
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/"
            className="home-link"
          >
            ← Back to Sahaba Quest
          </Link>
        </div>
      </section>

      {/* =====================================================
          LOGIN PANEL
      ====================================================== */}
      <section className="login-panel">
        <div className="login-card">
          <div className="login-header">
            <span className="sq-badge">
              WELCOME BACK
            </span>

            <h2>Sign in</h2>

            <p>
              Continue your Sahaba Quest journey.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            {/* EMAIL */}
            <div className="form-group">
              <label
                htmlFor="email"
                className="form-label"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="you@example.com"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* PASSWORD */}
            <div className="form-group password-group">
              <label
                htmlFor="password"
                className="form-label"
              >
                Password
              </label>

              <div className="password-wrapper">
                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  className="form-input password-input"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (previous) => !previous
                    )
                  }
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </div>

            {/* FORGOT PASSWORD */}
            <div className="forgot-row">
              <button
                type="button"
                className="forgot-button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
              >
                {resetLoading
                  ? "Sending reset link..."
                  : "Forgot password?"}
              </button>
            </div>

            {/* MESSAGE */}
            {message && (
              <div
                className={`form-message ${
                  messageType === "success"
                    ? "success"
                    : "error"
                }`}
              >
                {message}
              </div>
            )}

            {/* LOGIN BUTTON */}
            <button
              type="submit"
              className="login-button"
              disabled={loading}
            >
              {loading
                ? "Signing in..."
                : "Sign In"}
            </button>
          </form>

          {/* SIGNUP */}
          <div className="signup-link">
            <span>
              Don't have an account?
            </span>

            <Link href="/signup">
              Create Account
            </Link>
          </div>

          <div className="security-note">
            🔒 Your account information is securely
            handled by Supabase authentication.
          </div>
        </div>
      </section>

      {/* =====================================================
          STYLES
      ====================================================== */}
      <style jsx>{`
        .login-page {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
          background: #f7faf9;
        }

        /* ================================================
           BRAND PANEL
        ================================================= */

        .brand-panel {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px;
          background: linear-gradient(
            145deg,
            #063f3b 0%,
            #075b55 55%,
            #08766d 100%
          );
          color: white;
          overflow: hidden;
        }

        .brand-panel::before {
          content: "";
          position: absolute;
          width: 480px;
          height: 480px;
          border-radius: 50%;
          border: 1px solid
            rgba(255, 255, 255, 0.08);
          top: -210px;
          right: -190px;
        }

        .brand-panel::after {
          content: "";
          position: absolute;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          border: 1px solid
            rgba(255, 255, 255, 0.06);
          bottom: -180px;
          left: -180px;
        }

        .brand-content {
          position: relative;
          z-index: 2;
          max-width: 520px;
        }

        .brand-logo {
          width: 72px;
          height: 72px;
          margin-bottom: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.13);
          border: 1px solid
            rgba(255, 255, 255, 0.18);
          color: white;
          text-decoration: none;
          font-size: 24px;
          font-weight: 900;
        }

        .brand-badge {
          display: inline-flex;
          padding: 8px 13px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.78);
          border: 1px solid
            rgba(255, 255, 255, 0.12);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        .brand-content h1 {
          margin: 20px 0 18px;
          font-size: clamp(44px, 5vw, 68px);
          line-height: 0.98;
          letter-spacing: -2.5px;
          font-weight: 900;
        }

        .brand-content > p {
          max-width: 520px;
          margin: 0;
          color: rgba(255, 255, 255, 0.84);
          font-size: 16px;
          line-height: 1.8;
        }

        .feature-list {
          display: grid;
          gap: 19px;
          margin-top: 38px;
        }

        .feature {
          display: flex;
          align-items: flex-start;
          gap: 13px;
        }

        .feature-icon {
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.09);
          font-size: 18px;
        }

        .feature strong {
          display: block;
          margin-bottom: 3px;
          font-size: 13px;
        }

        .feature p {
          margin: 0;
          color: rgba(255, 255, 255, 0.62);
          font-size: 11px;
          line-height: 1.6;
        }

        .home-link {
          display: inline-block;
          margin-top: 42px;
          color: rgba(255, 255, 255, 0.72);
          font-size: 12px;
          font-weight: 700;
          text-decoration: none;
        }

        .home-link:hover {
          color: white;
        }

        /* ================================================
           LOGIN PANEL
        ================================================= */

        .login-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 50px 30px;
        }

        .login-card {
          width: 100%;
          max-width: 480px;
        }

        .login-header {
          margin-bottom: 30px;
        }

        .sq-badge {
          display: inline-flex;
          padding: 7px 12px;
          border-radius: 999px;
          color: #08766d;
          background: #e8f4f2;
          border: 1px solid #cce7e3;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        .login-header h2 {
          margin: 17px 0 8px;
          color: #123b38;
          font-size: 34px;
          line-height: 1.1;
          letter-spacing: -1px;
          font-weight: 900;
        }

        .login-header p {
          margin: 0;
          color: #6b7c7a;
          font-size: 14px;
          line-height: 1.6;
        }

        /* ================================================
           FORM
        ================================================= */

        .form-group {
          margin-bottom: 19px;
        }

        .form-label {
          display: block;
          margin-bottom: 8px;
          color: #264744;
          font-size: 13px;
          font-weight: 700;
        }

        .form-input {
          width: 100%;
          height: 49px;
          padding: 0 14px;
          border: 1px solid #d7e4e2;
          border-radius: 11px;
          background: white;
          color: #183f3b;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }

        .form-input:focus {
          border-color: #08766d;
          box-shadow:
            0 0 0 3px
            rgba(8, 118, 109, 0.08);
        }

        .form-input::placeholder {
          color: #a1afad;
        }

        .password-wrapper {
          position: relative;
        }

        .password-input {
          padding-right: 75px;
        }

        .password-toggle {
          position: absolute;
          right: 10px;
          top: 50%;
          transform: translateY(-50%);
          border: none;
          background: transparent;
          color: #687a77;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          padding: 8px;
        }

        .password-toggle:hover {
          color: #08766d;
        }

        .forgot-row {
          display: flex;
          justify-content: flex-end;
          margin-top: -4px;
          margin-bottom: 20px;
        }

        .forgot-button {
          border: none;
          background: transparent;
          padding: 0;
          color: #08766d;
          font-family: inherit;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }

        .forgot-button:hover:not(:disabled) {
          text-decoration: underline;
        }

        .forgot-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        /* ================================================
           MESSAGE
        ================================================= */

        .form-message {
          margin-bottom: 18px;
          padding: 13px 15px;
          border-radius: 12px;
          font-size: 12px;
          line-height: 1.6;
        }

        .form-message.success {
          color: #08766d;
          background: #edf8f6;
          border: 1px solid #cde9e4;
        }

        .form-message.error {
          color: #a54141;
          background: #fff2f2;
          border: 1px solid #f0d3d3;
        }

        /* ================================================
           LOGIN BUTTON
        ================================================= */

        .login-button {
          width: 100%;
          min-height: 50px;
          border: none;
          border-radius: 12px;
          background: #08766d;
          color: white;
          font-family: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition:
            background 0.2s ease,
            transform 0.2s ease,
            opacity 0.2s ease;
        }

        .login-button:hover:not(:disabled) {
          background: #075e57;
          transform: translateY(-1px);
        }

        .login-button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        /* ================================================
           SIGNUP
        ================================================= */

        .signup-link {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 5px;
          margin-top: 23px;
          color: #778683;
          font-size: 12px;
        }

        .signup-link a {
          color: #08766d;
          font-weight: 800;
          text-decoration: none;
        }

        .signup-link a:hover {
          text-decoration: underline;
        }

        .security-note {
          margin-top: 20px;
          color: #9aa6a4;
          font-size: 9px;
          line-height: 1.6;
          text-align: center;
        }

        /* ================================================
           RESPONSIVE
        ================================================= */

        @media (max-width: 1050px) {
          .login-page {
            grid-template-columns: 1fr;
          }

          .brand-panel {
            min-height: 440px;
            padding: 50px 30px;
          }

          .brand-content {
            max-width: 700px;
          }

          .login-panel {
            padding: 50px 25px;
          }
        }

        @media (max-width: 600px) {
          .brand-panel {
            min-height: auto;
            padding: 38px 22px;
          }

          .brand-content h1 {
            font-size: 42px;
          }

          .brand-content > p {
            font-size: 14px;
          }

          .feature-list {
            margin-top: 28px;
            gap: 14px;
          }

          .home-link {
            margin-top: 30px;
          }

          .login-panel {
            padding: 35px 18px;
          }

          .login-header h2 {
            font-size: 29px;
          }
        }

        @media (max-width: 420px) {
          .brand-panel {
            padding: 30px 18px;
          }

          .brand-content h1 {
            font-size: 36px;
          }

          .login-panel {
            padding: 30px 15px;
          }
        }
      `}</style>
    </main>
  );
}