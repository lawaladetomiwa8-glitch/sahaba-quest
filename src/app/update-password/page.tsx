"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [validSession, setValidSession] = useState(false);

  /*
   * =========================================================
   * PASSWORD REQUIREMENTS
   * =========================================================
   */

  const passwordRequirements = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };

  const passwordIsValid =
    passwordRequirements.minLength &&
    passwordRequirements.uppercase &&
    passwordRequirements.lowercase &&
    passwordRequirements.number &&
    passwordRequirements.special;

  /*
   * =========================================================
   * CHECK SUPABASE RECOVERY SESSION
   * =========================================================
   */

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) {
          return;
        }

        if (session) {
          setValidSession(true);
        } else {
          setValidSession(false);
          setMessage(
            "This password reset link is invalid or has expired. Please request a new password reset link."
          );
        }
      } catch (error) {
        console.error("Session check error:", error);

        if (!mounted) {
          return;
        }

        setValidSession(false);
        setMessage(
          "Unable to verify your password reset session. Please request a new reset link."
        );
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    };

    checkSession();

    /*
     * Listen for Supabase password recovery events.
     */
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) {
          return;
        }

        if (
          event === "PASSWORD_RECOVERY" &&
          session
        ) {
          setValidSession(true);
          setMessage("");
        }

        if (event === "SIGNED_OUT") {
          setValidSession(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /*
   * =========================================================
   * UPDATE PASSWORD
   * =========================================================
   */

  const handleUpdatePassword = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setMessage("");
    setSuccess(false);

    if (!validSession) {
      setMessage(
        "Your password reset session is invalid or has expired. Please request a new reset link."
      );
      return;
    }

    if (!passwordIsValid) {
      setMessage(
        "Please make sure your new password meets all the requirements."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);

      const { error } =
        await supabase.auth.updateUser({
          password,
        });

      if (error) {
        console.error(
          "Password update error:",
          error
        );

        setMessage(error.message);
        return;
      }

      setSuccess(true);
      setMessage(
        "Your password has been updated successfully."
      );

      /*
       * Redirect to dashboard after displaying
       * the success message.
       */
      setTimeout(() => {
        router.push("/dashboard");
      }, 1500);
    } catch (error) {
      console.error(
        "Unexpected password update error:",
        error
      );

      setMessage(
        "Something went wrong while updating your password. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * =========================================================
   * CHECKING SESSION SCREEN
   * =========================================================
   */

  if (checkingSession) {
    return (
      <main className="password-page">
        <section className="password-card status-card">
          <div className="sq-logo">
            SQ
          </div>

          <span className="sq-badge">
            SAHABA QUEST
          </span>

          <h1>
            Checking your reset link...
          </h1>

          <p>
            Please wait while we verify your
            password recovery session.
          </p>

          <div className="loading-spinner" />
        </section>

        <style jsx>{`
          .password-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px 20px;
            background: #f7faf9;
          }

          .password-card {
            width: 100%;
            max-width: 500px;
            padding: 42px;
            border-radius: 22px;
            background: white;
            border: 1px solid #e2ebe9;
            box-shadow: 0 15px 50px
              rgba(6, 63, 59, 0.08);
          }

          .status-card {
            text-align: center;
          }

          .sq-logo {
            width: 64px;
            height: 64px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 18px;
            background: #08766d;
            color: white;
            font-size: 20px;
            font-weight: 800;
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

          h1 {
            margin: 18px 0 10px;
            color: #123b38;
            font-size: 25px;
            letter-spacing: -0.7px;
          }

          p {
            margin: 0;
            color: #6b7c7a;
            font-size: 13px;
            line-height: 1.7;
          }

          .loading-spinner {
            width: 30px;
            height: 30px;
            margin: 25px auto 0;
            border: 3px solid #dceae7;
            border-top-color: #08766d;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }

          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media (max-width: 520px) {
            .password-card {
              padding: 30px 22px;
            }
          }
        `}</style>
      </main>
    );
  }

  /*
   * =========================================================
   * INVALID / EXPIRED SESSION
   * =========================================================
   */

  if (!validSession) {
    return (
      <main className="password-page">
        <section className="password-card status-card">
          <div className="status-icon error-icon">
            !
          </div>

          <span className="sq-badge">
            PASSWORD RESET
          </span>

          <h1>
            Reset link unavailable
          </h1>

          <p className="status-message">
            {message}
          </p>

          <Link
            href="/login"
            className="sq-button-primary"
          >
            Go to Sign In
          </Link>

          <Link
            href="/"
            className="back-link"
          >
            Back to Sahaba Quest
          </Link>
        </section>

        <style jsx>{`
          .password-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 30px 20px;
            background: #f7faf9;
          }

          .password-card {
            width: 100%;
            max-width: 500px;
            padding: 42px;
            border-radius: 22px;
            background: white;
            border: 1px solid #e2ebe9;
            box-shadow: 0 15px 50px
              rgba(6, 63, 59, 0.08);
          }

          .status-card {
            text-align: center;
          }

          .status-icon {
            width: 64px;
            height: 64px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-size: 28px;
            font-weight: 800;
          }

          .error-icon {
            color: #a54141;
            background: #fff1f1;
            border: 1px solid #f1d5d5;
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

          h1 {
            margin: 18px 0 10px;
            color: #123b38;
            font-size: 27px;
            letter-spacing: -0.8px;
          }

          .status-message {
            margin: 0 auto 25px;
            color: #6b7c7a;
            font-size: 13px;
            line-height: 1.7;
          }

          .sq-button-primary {
            width: 100%;
            min-height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            background: #08766d;
            color: white;
            text-decoration: none;
            font-size: 13px;
            font-weight: 800;
            transition: background 0.2s ease;
          }

          .sq-button-primary:hover {
            background: #075e57;
          }

          .back-link {
            display: block;
            margin-top: 18px;
            color: #08766d;
            text-decoration: none;
            font-size: 12px;
            font-weight: 700;
          }

          .back-link:hover {
            text-decoration: underline;
          }

          @media (max-width: 520px) {
            .password-card {
              padding: 30px 22px;
            }
          }
        `}</style>
      </main>
    );
  }

  /*
   * =========================================================
   * MAIN UPDATE PASSWORD SCREEN
   * =========================================================
   */

  return (
    <main className="password-page">
      <section className="password-card">
        <div className="sq-logo">
          SQ
        </div>

        <span className="sq-badge">
          PASSWORD RESET
        </span>

        <h1>
          Create a New Password
        </h1>

        <p className="intro-text">
          Choose a strong password for your
          Sahaba Quest account.
        </p>

        <form
          onSubmit={handleUpdatePassword}
        >
          {/* =============================================
              NEW PASSWORD
          ============================================== */}

          <div className="form-group">
            <label
              htmlFor="password"
              className="form-label"
            >
              New Password
            </label>

            <div className="password-wrapper">
              <input
                id="password"
                type={
                  showPassword
                    ? "text"
                    : "password"
                }
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                placeholder="Create a strong password"
                className="form-input password-input"
                autoComplete="new-password"
                autoFocus
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowPassword(
                    (previous) =>
                      !previous
                  )
                }
                aria-label={
                  showPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>
          </div>

          {/* =============================================
              PASSWORD REQUIREMENTS
          ============================================== */}

          <div className="password-requirements">
            <div className="requirements-title">
              Password must contain:
            </div>

            <div className="requirements-grid">
              <div
                className={`requirement ${
                  passwordRequirements.minLength
                    ? "valid"
                    : ""
                }`}
              >
                <span className="requirement-icon">
                  {passwordRequirements.minLength
                    ? "✓"
                    : "○"}
                </span>

                <span>
                  At least 8 characters
                </span>
              </div>

              <div
                className={`requirement ${
                  passwordRequirements.uppercase
                    ? "valid"
                    : ""
                }`}
              >
                <span className="requirement-icon">
                  {passwordRequirements.uppercase
                    ? "✓"
                    : "○"}
                </span>

                <span>
                  One uppercase letter
                </span>
              </div>

              <div
                className={`requirement ${
                  passwordRequirements.lowercase
                    ? "valid"
                    : ""
                }`}
              >
                <span className="requirement-icon">
                  {passwordRequirements.lowercase
                    ? "✓"
                    : "○"}
                </span>

                <span>
                  One lowercase letter
                </span>
              </div>

              <div
                className={`requirement ${
                  passwordRequirements.number
                    ? "valid"
                    : ""
                }`}
              >
                <span className="requirement-icon">
                  {passwordRequirements.number
                    ? "✓"
                    : "○"}
                </span>

                <span>
                  One number
                </span>
              </div>

              <div
                className={`requirement ${
                  passwordRequirements.special
                    ? "valid"
                    : ""
                }`}
              >
                <span className="requirement-icon">
                  {passwordRequirements.special
                    ? "✓"
                    : "○"}
                </span>

                <span>
                  One special character
                </span>
              </div>
            </div>
          </div>

          {/* =============================================
              CONFIRM PASSWORD
          ============================================== */}

          <div className="form-group confirm-group">
            <label
              htmlFor="confirmPassword"
              className="form-label"
            >
              Confirm New Password
            </label>

            <div className="password-wrapper">
              <input
                id="confirmPassword"
                type={
                  showConfirmPassword
                    ? "text"
                    : "password"
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Enter your password again"
                className="form-input password-input"
                autoComplete="new-password"
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() =>
                  setShowConfirmPassword(
                    (previous) =>
                      !previous
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? "Hide password"
                    : "Show password"
                }
              >
                {showConfirmPassword
                  ? "Hide"
                  : "Show"}
              </button>
            </div>

            {confirmPassword.length > 0 && (
              <span
                className={`password-match ${
                  password ===
                  confirmPassword
                    ? "match"
                    : "no-match"
                }`}
              >
                {password ===
                confirmPassword
                  ? "✓ Passwords match"
                  : "Passwords do not match"}
              </span>
            )}
          </div>

          {/* =============================================
              MESSAGE
          ============================================== */}

          {message && (
            <div
              className={`form-message ${
                success
                  ? "success"
                  : "error"
              }`}
            >
              {message}
            </div>
          )}

          {/* =============================================
              UPDATE BUTTON
          ============================================== */}

          <button
            type="submit"
            className="sq-button-primary"
            disabled={loading}
          >
            {loading
              ? "Updating Password..."
              : "Update Password"}
          </button>
        </form>

        <Link
          href="/login"
          className="back-link"
        >
          Back to Sign In
        </Link>
      </section>

      {/* =====================================================
          MAIN PAGE STYLES
      ====================================================== */}

      <style jsx>{`
        .password-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 30px 20px;
          background: #f7faf9;
        }

        .password-card {
          width: 100%;
          max-width: 500px;
          padding: 42px;
          border-radius: 22px;
          background: white;
          border: 1px solid #e2ebe9;
          box-shadow: 0 15px 50px
            rgba(6, 63, 59, 0.08);
        }

        .sq-logo {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 18px;
          background: #08766d;
          color: white;
          font-size: 20px;
          font-weight: 800;
        }

        .sq-badge {
          display: flex;
          width: fit-content;
          margin: 0 auto;
          padding: 7px 12px;
          border-radius: 999px;
          color: #08766d;
          background: #e8f4f2;
          border: 1px solid #cce7e3;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        h1 {
          margin: 18px 0 9px;
          color: #123b38;
          font-size: 29px;
          letter-spacing: -1px;
          text-align: center;
        }

        .intro-text {
          margin: 0 0 28px;
          color: #6b7c7a;
          font-size: 13px;
          line-height: 1.7;
          text-align: center;
        }

        /* ================================================
           FORM
        ================================================= */

        .form-group {
          margin-bottom: 18px;
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

        /* ================================================
           PASSWORD REQUIREMENTS
        ================================================= */

        .password-requirements {
          margin: -3px 0 20px;
          padding: 14px;
          border-radius: 12px;
          background: #f7faf9;
          border: 1px solid #e2ebe9;
        }

        .requirements-title {
          margin-bottom: 9px;
          color: #536966;
          font-size: 11px;
          font-weight: 800;
        }

        .requirements-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        .requirement {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #8a9795;
          font-size: 10px;
        }

        .requirement.valid {
          color: #08766d;
        }

        .requirement-icon {
          width: 17px;
          height: 17px;
          flex-shrink: 0;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #e8eeed;
          font-size: 10px;
          font-weight: 800;
        }

        .requirement.valid
          .requirement-icon {
          color: white;
          background: #08766d;
        }

        .confirm-group {
          margin-bottom: 0;
        }

        .password-match {
          display: block;
          margin-top: 6px;
          font-size: 10px;
          font-weight: 700;
        }

        .password-match.match {
          color: #08766d;
        }

        .password-match.no-match {
          color: #b54c4c;
        }

        /* ================================================
           MESSAGE
        ================================================= */

        .form-message {
          margin: 18px 0;
          padding: 12px 14px;
          border-radius: 10px;
          font-size: 12px;
          line-height: 1.6;
        }

        .form-message.error {
          color: #a54141;
          background: #fff2f2;
          border: 1px solid #f0d3d3;
        }

        .form-message.success {
          color: #08766d;
          background: #edf8f6;
          border: 1px solid #cde9e4;
        }

        /* ================================================
           BUTTON
        ================================================= */

        .sq-button-primary {
          width: 100%;
          min-height: 50px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 20px;
          padding: 0 18px;
          border: 0;
          border-radius: 12px;
          background: #08766d;
          color: white;
          text-decoration: none;
          font-family: inherit;
          font-size: 13px;
          font-weight: 800;
          cursor: pointer;
          transition:
            background 0.2s ease,
            transform 0.2s ease,
            opacity 0.2s ease;
        }

        .sq-button-primary:hover:not(
            :disabled
          ) {
          background: #075e57;
          transform: translateY(-1px);
        }

        .sq-button-primary:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        /* ================================================
           BACK LINK
        ================================================= */

        .back-link {
          display: block;
          margin-top: 20px;
          color: #08766d;
          text-decoration: none;
          font-size: 12px;
          font-weight: 700;
          text-align: center;
        }

        .back-link:hover {
          text-decoration: underline;
        }

        /* ================================================
           RESPONSIVE
        ================================================= */

        @media (max-width: 520px) {
          .password-page {
            padding: 20px 14px;
          }

          .password-card {
            padding: 30px 20px;
            border-radius: 18px;
          }

          h1 {
            font-size: 25px;
          }

          .requirements-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </main>
  );
}