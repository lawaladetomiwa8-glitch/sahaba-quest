"use client";

import { FormEvent, useState, type ReactNode } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type AccountType = "individual" | "family" | "organisation";

type OrganisationType =
  | "school"
  | "madrasa"
  | "mosque"
  | "islamic_academy"
  | "other";

type PasswordRequirementProps = {
  valid: boolean;
  children: ReactNode;
};

function PasswordRequirement({
  valid,
  children,
}: PasswordRequirementProps) {
  return (
    <div className={`password-requirement ${valid ? "valid" : ""}`}>
      <span className="requirement-icon">
        {valid ? "✓" : "○"}
      </span>

      <span>{children}</span>
    </div>
  );
}

export default function SignupPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [accountType, setAccountType] =
    useState<AccountType>("individual");

  const [organisationName, setOrganisationName] = useState("");

  const [organisationType, setOrganisationType] =
    useState<OrganisationType>("school");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  /*
   * Password requirements
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
   * Handle signup
   */
  const handleSignup = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setMessage("");
    setSuccess(false);

    /*
     * Clean user input
     */
    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    const cleanOrganisationName = organisationName.trim();

    /*
     * Basic validation
     */
    if (!cleanDisplayName) {
      setMessage("Please enter your display name.");
      return;
    }

    if (!cleanUsername) {
      setMessage("Please enter a username.");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage("Username must be at least 3 characters.");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setMessage(
        "Username can only contain lowercase letters, numbers, and underscores."
      );
      return;
    }

    if (!cleanEmail) {
      setMessage("Please enter your email address.");
      return;
    }

    if (!passwordIsValid) {
      setMessage(
        "Please make sure your password meets all the requirements."
      );
      return;
    }

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    /*
     * Organisation validation
     */
    if (
      accountType === "organisation" &&
      !cleanOrganisationName
    ) {
      setMessage("Please enter your organisation name.");
      return;
    }

    if (
      accountType === "organisation" &&
      cleanOrganisationName.length < 2
    ) {
      setMessage(
        "Organisation name must be at least 2 characters."
      );
      return;
    }

    if (
      accountType === "organisation" &&
      !organisationType
    ) {
      setMessage("Please select your organisation type.");
      return;
    }

    try {
      setLoading(true);

      /*
       * Check username and display name availability
       */
      const { data: nameCheck, error: nameCheckError } =
        await supabase.rpc("check_signup_names", {
          requested_username: cleanUsername,
          requested_display_name: cleanDisplayName,
        });

      if (nameCheckError) {
        console.error(
          "Name availability check error:",
          nameCheckError
        );

        setMessage(
          "Unable to check username availability. Please try again."
        );

        setLoading(false);
        return;
      }

      /*
       * Handle the response from the existing RPC.
       */
      if (nameCheck) {
        if (
          nameCheck.username_available === false ||
          nameCheck.username_exists === true
        ) {
          setMessage("That username is already taken.");
          setLoading(false);
          return;
        }

        if (
          nameCheck.display_name_available === false ||
          nameCheck.display_name_exists === true
        ) {
          setMessage("That display name is already taken.");
          setLoading(false);
          return;
        }
      }

      /*
       * Create Supabase account
       *
       * Organisation details are stored in Auth metadata.
       * The actual Organisation database record will be created
       * later, after the user confirms their email and signs in.
       */
      const { error: signupError } =
        await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: cleanDisplayName,
              username: cleanUsername,

              account_type: accountType,

              organisation_name:
                accountType === "organisation"
                  ? cleanOrganisationName
                  : null,

              organisation_type:
                accountType === "organisation"
                  ? organisationType
                  : null,
            },
          },
        });

      if (signupError) {
        console.error("Signup error:", signupError);

        if (
          signupError.message
            .toLowerCase()
            .includes("already registered")
        ) {
          setMessage(
            "An account with this email already exists. Please sign in instead."
          );
        } else {
          setMessage(signupError.message);
        }

        setLoading(false);
        return;
      }

      /*
       * Successful signup
       */
      setSuccess(true);

      if (accountType === "organisation") {
        setMessage(
          "Your account has been created successfully. Please check your email to confirm your account. After confirmation, sign in to complete your organisation setup."
        );
      } else {
        setMessage(
          "Your account has been created successfully. Please check your email to confirm your account."
        );
      }
    } catch (error) {
      console.error("Unexpected signup error:", error);

      setMessage(
        "Something went wrong while creating your account. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /*
   * Success screen
   */
  if (success) {
    return (
      <main className="signup-page">
        <section className="brand-panel">
          <div className="brand-content">
            <div className="brand-logo">SQ</div>

            <span className="brand-badge">
              LEARN • REMEMBER • COMPETE
            </span>

            <h1>Know the Sahabah.</h1>

            <p>
              Discover the lives, sacrifices, character, and
              achievements of the Companions of the Prophet ﷺ.
            </p>
          </div>
        </section>

        <section className="signup-panel">
          <div className="signup-card success-card">
            <div className="success-icon">✓</div>

            <span className="sq-badge">
              ACCOUNT CREATED
            </span>

            <h2>Welcome to Sahaba Quest!</h2>

            <p>{message}</p>

            <div className="success-note">
              <strong>Next step</strong>

              <span>
                Open your email and click the confirmation link
                before signing in.
              </span>
            </div>

            <Link
              href="/login"
              className="sq-button-primary"
            >
              Go to Sign In
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="signup-page">
      {/* =====================================================
          BRAND PANEL
      ====================================================== */}
      <section className="brand-panel">
        <div className="brand-content">
          <div className="brand-logo">SQ</div>

          <span className="brand-badge">
            LEARN • REMEMBER • COMPETE
          </span>

          <h1>Know the Sahabah.</h1>

          <p>
            Discover the lives, sacrifices, character, and
            achievements of the Companions of the Prophet ﷺ.
          </p>

          <div className="brand-features">
            <div className="brand-feature">
              <span>📖</span>

              <div>
                <strong>Learn</strong>

                <p>
                  Explore authentic stories and lessons from
                  the Sahabah.
                </p>
              </div>
            </div>

            <div className="brand-feature">
              <span>🏆</span>

              <div>
                <strong>Compete</strong>

                <p>
                  Challenge yourself and climb the leaderboard.
                </p>
              </div>
            </div>

            <div className="brand-feature">
              <span>🌙</span>

              <div>
                <strong>Remember</strong>

                <p>
                  Turn Islamic knowledge into lasting
                  understanding.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          SIGNUP PANEL
      ====================================================== */}
      <section className="signup-panel">
        <div className="signup-card">
          <div className="signup-header">
            <span className="sq-badge">
              CREATE YOUR ACCOUNT
            </span>

            <h2>Join Sahaba Quest</h2>

            <p>
              Choose how you want to experience Sahaba Quest.
            </p>
          </div>

          <form onSubmit={handleSignup}>
            {/* =================================================
                ACCOUNT TYPE
            ================================================== */}
            <div className="form-section">
              <label className="section-label">
                Account Type
              </label>

              <div className="account-type-grid">
                <button
                  type="button"
                  className={`account-type-card ${
                    accountType === "individual"
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setAccountType("individual")
                  }
                >
                  <span className="account-type-icon">
                    👤
                  </span>

                  <span className="account-type-title">
                    Individual
                  </span>

                  <span className="account-type-description">
                    Learn, progress and compete on your own.
                  </span>
                </button>

                <button
                  type="button"
                  className={`account-type-card ${
                    accountType === "family"
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setAccountType("family")
                  }
                >
                  <span className="account-type-icon">
                    👨‍👩‍👧‍👦
                  </span>

                  <span className="account-type-title">
                    Family
                  </span>

                  <span className="account-type-description">
                    Learn and compete together as a family.
                  </span>
                </button>

                <button
                  type="button"
                  className={`account-type-card ${
                    accountType === "organisation"
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    setAccountType("organisation")
                  }
                >
                  <span className="account-type-icon">
                    🏫
                  </span>

                  <span className="account-type-title">
                    Organisation
                  </span>

                  <span className="account-type-description">
                    Create a space for a school, madrasa or
                    Islamic organisation.
                  </span>
                </button>
              </div>
            </div>

            {/* =================================================
                ORGANISATION DETAILS
            ================================================== */}
            {accountType === "organisation" && (
              <div className="form-section organisation-section">
                <div className="form-group">
                  <label
                    htmlFor="organisationName"
                    className="form-label"
                  >
                    Organisation Name
                  </label>

                  <input
                    id="organisationName"
                    type="text"
                    value={organisationName}
                    onChange={(event) =>
                      setOrganisationName(
                        event.target.value
                      )
                    }
                    placeholder="e.g. Brightway International Academy"
                    className="form-input"
                    autoComplete="organization"
                  />

                  <span className="field-hint">
                    Enter the official name of your school,
                    madrasa, mosque or organisation.
                  </span>
                </div>

                <div className="form-group">
                  <label
                    htmlFor="organisationType"
                    className="form-label"
                  >
                    Organisation Type
                  </label>

                  <select
                    id="organisationType"
                    value={organisationType}
                    onChange={(event) =>
                      setOrganisationType(
                        event.target.value as OrganisationType
                      )
                    }
                    className="form-input"
                  >
                    <option value="school">
                      School
                    </option>

                    <option value="madrasa">
                      Madrasa
                    </option>

                    <option value="mosque">
                      Mosque
                    </option>

                    <option value="islamic_academy">
                      Islamic Academy
                    </option>

                    <option value="other">
                      Other
                    </option>
                  </select>
                </div>
              </div>
            )}

            {/* =================================================
                PERSONAL INFORMATION
            ================================================== */}
            <div className="form-section">
              <div className="form-row">
                <div className="form-group">
                  <label
                    htmlFor="displayName"
                    className="form-label"
                  >
                    Display Name
                  </label>

                  <input
                    id="displayName"
                    type="text"
                    value={displayName}
                    onChange={(event) =>
                      setDisplayName(
                        event.target.value
                      )
                    }
                    placeholder="Your name"
                    className="form-input"
                    autoComplete="name"
                  />
                </div>

                <div className="form-group">
                  <label
                    htmlFor="username"
                    className="form-label"
                  >
                    Username
                  </label>

                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(event) =>
                      setUsername(
                        event.target.value.toLowerCase()
                      )
                    }
                    placeholder="your_username"
                    className="form-input"
                    autoComplete="username"
                  />

                  <span className="field-hint">
                    Letters, numbers and underscores only.
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label
                  htmlFor="email"
                  className="form-label"
                >
                  Email Address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  className="form-input"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* =================================================
                PASSWORD
            ================================================== */}
            <div className="form-section">
              <div className="form-group">
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
                    value={password}
                    onChange={(event) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    placeholder="Create a strong password"
                    className="form-input password-input"
                    autoComplete="new-password"
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
                    }
                    aria-label={
                      showPassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              {/* Password requirements */}
              <div className="password-requirements">
                <div className="requirements-title">
                  Password must contain:
                </div>

                <div className="requirements-grid">
                  <PasswordRequirement
                    valid={
                      passwordRequirements.minLength
                    }
                  >
                    At least 8 characters
                  </PasswordRequirement>

                  <PasswordRequirement
                    valid={
                      passwordRequirements.uppercase
                    }
                  >
                    One uppercase letter
                  </PasswordRequirement>

                  <PasswordRequirement
                    valid={
                      passwordRequirements.lowercase
                    }
                  >
                    One lowercase letter
                  </PasswordRequirement>

                  <PasswordRequirement
                    valid={
                      passwordRequirements.number
                    }
                  >
                    One number
                  </PasswordRequirement>

                  <PasswordRequirement
                    valid={
                      passwordRequirements.special
                    }
                  >
                    One special character
                  </PasswordRequirement>
                </div>
              </div>

              {/* Confirm password */}
              <div className="form-group confirm-password-group">
                <label
                  htmlFor="confirmPassword"
                  className="form-label"
                >
                  Confirm Password
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
                        !showConfirmPassword
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
                      password === confirmPassword
                        ? "match"
                        : "no-match"
                    }`}
                  >
                    {password === confirmPassword
                      ? "✓ Passwords match"
                      : "Passwords do not match"}
                  </span>
                )}
              </div>
            </div>

            {/* =================================================
                MESSAGE
            ================================================== */}
            {message && (
              <div
                className={`form-message ${
                  success ? "success" : "error"
                }`}
              >
                {message}
              </div>
            )}

            {/* =================================================
                SUBMIT
            ================================================== */}
            <button
              type="submit"
              className="sq-button-primary signup-button"
              disabled={loading}
            >
              {loading
                ? "Creating Account..."
                : "Create Account"}
            </button>
          </form>

          {/* =================================================
              LOGIN LINK
          ================================================== */}
          <div className="login-link">
            <span>Already have an account?</span>

            <Link href="/login">
              Sign in
            </Link>
          </div>

          <div className="terms-text">
            By creating an account, you agree to use
            Sahaba Quest responsibly and respectfully.
          </div>
        </div>
      </section>

      {/* =====================================================
          PAGE STYLES
      ====================================================== */}
      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .signup-page {
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
          width: 450px;
          height: 450px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.08);
          top: -180px;
          right: -180px;
        }

        .brand-panel::after {
          content: "";
          position: absolute;
          width: 350px;
          height: 350px;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.06);
          bottom: -170px;
          left: -170px;
        }

        .brand-content {
          position: relative;
          z-index: 2;
          max-width: 500px;
        }

        .brand-logo {
          width: 70px;
          height: 70px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -1px;
          margin-bottom: 28px;
        }

        .brand-badge,
        .sq-badge {
          display: inline-flex;
          align-items: center;
          width: fit-content;
          padding: 7px 12px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.2px;
        }

        .brand-badge {
          color: #e5c46a;
          background: rgba(229, 196, 106, 0.1);
          border: 1px solid rgba(229, 196, 106, 0.2);
        }

        .brand-content h1 {
          margin: 22px 0 14px;
          font-size: clamp(40px, 4vw, 60px);
          line-height: 1.02;
          letter-spacing: -2.5px;
        }

        .brand-content > p {
          margin: 0;
          max-width: 440px;
          font-size: 16px;
          line-height: 1.8;
          color: rgba(255, 255, 255, 0.78);
        }

        .brand-features {
          display: grid;
          gap: 20px;
          margin-top: 48px;
        }

        .brand-feature {
          display: flex;
          gap: 15px;
          align-items: flex-start;
        }

        .brand-feature > span {
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255, 255, 255, 0.09);
          font-size: 19px;
        }

        .brand-feature strong {
          display: block;
          margin-bottom: 4px;
          font-size: 14px;
        }

        .brand-feature p {
          margin: 0;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
          line-height: 1.6;
        }

        /* ================================================
           SIGNUP PANEL
        ================================================= */

        .signup-panel {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 50px 30px;
          overflow-y: auto;
        }

        .signup-card {
          width: 100%;
          max-width: 650px;
        }

        .signup-header {
          margin-bottom: 28px;
        }

        .sq-badge {
          color: #08766d;
          background: #e8f4f2;
          border: 1px solid #cce7e3;
        }

        .signup-header h2 {
          margin: 15px 0 8px;
          color: #123b38;
          font-size: 32px;
          letter-spacing: -1px;
        }

        .signup-header p {
          margin: 0;
          color: #6b7c7a;
          font-size: 14px;
        }

        /* ================================================
           FORM
        ================================================= */

        .form-section {
          margin-bottom: 24px;
        }

        .section-label,
        .form-label {
          display: block;
          margin-bottom: 8px;
          color: #264744;
          font-size: 13px;
          font-weight: 700;
        }

        .account-type-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .account-type-card {
          appearance: none;
          border: 1px solid #dbe7e5;
          border-radius: 15px;
          background: white;
          padding: 17px 13px;
          text-align: left;
          cursor: pointer;
          transition:
            border-color 0.2s ease,
            background 0.2s ease,
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .account-type-card:hover {
          transform: translateY(-1px);
          border-color: #9ccdc7;
        }

        .account-type-card.selected {
          border-color: #08766d;
          background: #f0f9f7;
          box-shadow: 0 0 0 2px rgba(8, 118, 109, 0.08);
        }

        .account-type-icon {
          display: block;
          font-size: 24px;
          margin-bottom: 9px;
        }

        .account-type-title {
          display: block;
          color: #183f3b;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .account-type-description {
          display: block;
          color: #71817f;
          font-size: 10px;
          line-height: 1.5;
        }

        .organisation-section {
          padding: 16px;
          border-radius: 14px;
          background: #f2f8f7;
          border: 1px solid #dcebe8;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .form-group {
          margin-bottom: 18px;
        }

        .form-input {
          width: 100%;
          height: 48px;
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
          box-shadow: 0 0 0 3px rgba(8, 118, 109, 0.08);
        }

        .form-input::placeholder {
          color: #a1afad;
        }

        select.form-input {
          cursor: pointer;
        }

        .field-hint {
          display: block;
          margin-top: 6px;
          color: #84928f;
          font-size: 10px;
        }

        /* ================================================
           PASSWORD
        ================================================= */

        .password-wrapper {
          position: relative;
        }

        .password-input {
          padding-right: 72px;
        }

        .password-toggle {
          position: absolute;
          top: 50%;
          right: 10px;
          transform: translateY(-50%);
          border: 0;
          background: transparent;
          color: #08766d;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          padding: 7px;
        }

        .password-requirements {
          margin: -5px 0 20px;
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
          gap: 7px;
        }

        .password-requirement {
          display: flex;
          align-items: center;
          gap: 7px;
          color: #8a9795;
          font-size: 10px;
        }

        .password-requirement.valid {
          color: #08766d;
        }

        .requirement-icon {
          width: 17px;
          height: 17px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #e8eeed;
          font-size: 10px;
          font-weight: 800;
        }

        .password-requirement.valid .requirement-icon {
          color: white;
          background: #08766d;
        }

        .confirm-password-group {
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

        .sq-button-primary:hover:not(:disabled) {
          background: #075e57;
          transform: translateY(-1px);
        }

        .sq-button-primary:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .signup-button {
          margin-top: 20px;
        }

        /* ================================================
           LOGIN
        ================================================= */

        .login-link {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          margin-top: 22px;
          color: #778683;
          font-size: 12px;
        }

        .login-link a {
          color: #08766d;
          font-weight: 800;
          text-decoration: none;
        }

        .login-link a:hover {
          text-decoration: underline;
        }

        .terms-text {
          max-width: 460px;
          margin: 18px auto 0;
          color: #9aa6a4;
          font-size: 9px;
          line-height: 1.6;
          text-align: center;
        }

        /* ================================================
           SUCCESS
        ================================================= */

        .success-card {
          text-align: center;
        }

        .success-icon {
          width: 70px;
          height: 70px;
          margin: 0 auto 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #e8f6f3;
          color: #08766d;
          font-size: 30px;
          font-weight: 800;
        }

        .success-card h2 {
          margin: 18px 0 10px;
          color: #123b38;
          font-size: 30px;
          letter-spacing: -1px;
        }

        .success-card > p {
          margin: 0 auto;
          max-width: 500px;
          color: #6b7c7a;
          font-size: 14px;
          line-height: 1.7;
        }

        .success-note {
          display: flex;
          flex-direction: column;
          gap: 5px;
          margin: 25px 0;
          padding: 17px;
          border-radius: 13px;
          background: #f4f9f8;
          border: 1px solid #deebe8;
          color: #647571;
          font-size: 12px;
          line-height: 1.6;
        }

        .success-note strong {
          color: #08766d;
          font-size: 13px;
        }

        /* ================================================
           RESPONSIVE
        ================================================= */

        @media (max-width: 1050px) {
          .signup-page {
            grid-template-columns: 1fr;
          }

          .brand-panel {
            min-height: 330px;
            padding: 45px 30px;
          }

          .brand-content {
            max-width: 700px;
          }

          .brand-content h1 {
            font-size: 44px;
          }

          .brand-features {
            grid-template-columns: repeat(3, 1fr);
          }

          .signup-panel {
            padding: 45px 25px;
          }
        }

        @media (max-width: 700px) {
          .brand-panel {
            min-height: auto;
            padding: 35px 22px;
          }

          .brand-content h1 {
            font-size: 38px;
            letter-spacing: -1.8px;
          }

          .brand-content > p {
            font-size: 14px;
          }

          .brand-features {
            grid-template-columns: 1fr;
            gap: 14px;
            margin-top: 30px;
          }

          .brand-feature {
            padding: 10px 0;
          }

          .signup-panel {
            padding: 35px 18px;
          }

          .signup-header h2 {
            font-size: 28px;
          }

          .account-type-grid {
            grid-template-columns: 1fr;
          }

          .account-type-card {
            display: grid;
            grid-template-columns: 38px 1fr;
            column-gap: 10px;
            align-items: center;
            padding: 13px;
          }

          .account-type-icon {
            grid-row: span 2;
            margin: 0;
          }

          .account-type-title {
            margin-bottom: 2px;
          }

          .account-type-description {
            grid-column: 2;
          }

          .form-row {
            grid-template-columns: 1fr;
            gap: 0;
          }

          .requirements-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 420px) {
          .brand-panel {
            padding: 30px 18px;
          }

          .brand-content h1 {
            font-size: 34px;
          }

          .signup-panel {
            padding: 30px 15px;
          }

          .signup-header h2 {
            font-size: 25px;
          }
        }
      `}</style>
    </main>
  );
}