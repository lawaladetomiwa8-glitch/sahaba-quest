"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import TurnstileWidget from "../../components/TurnstileWidget";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetSignal, setCaptchaResetSignal] = useState(0);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "error" | "success"
  >("error");

  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* =====================================================
     PASSWORD RESET REDIRECT

     IMPORTANT:
     This must point directly to the password reset page.
  ====================================================== */

  const PASSWORD_RESET_REDIRECT =
    "https://sahabaquest.com.ng/update-password";

  /* =====================================================
     CLEAR ANY OLD FAMILY MEMBER SESSION
  ====================================================== */

  useEffect(() => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(
        "sahabaquest_family_member_session"
      );
    }
  }, []);

  /* =====================================================
     CHECK WHETHER CURRENT URL IS A PASSWORD RECOVERY URL

     We must NOT treat a recovery session as a normal
     logged-in session.
  ====================================================== */

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const checkRecoveryUrl = () => {
      const url = new URL(window.location.href);

      const type =
        url.searchParams.get("type");

      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, "")
      );

      const hashType =
        hashParams.get("type");

      const hasAccessToken =
        hashParams.has("access_token");

      const isRecovery =
        type === "recovery" ||
        hashType === "recovery" ||
        hasAccessToken;

      if (isRecovery) {
        router.replace("/update-password");
      }
    };

    checkRecoveryUrl();
  }, [router]);

  /* =====================================================
     SUPABASE AUTH STATE LISTENER

     PASSWORD_RECOVERY must ALWAYS go to the
     update-password page.
  ====================================================== */

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (
          event === "PASSWORD_RECOVERY" &&
          session
        ) {
          router.replace("/update-password");
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  /* =====================================================
     ROUTE AUTHENTICATED USER

     IMPORTANT ACCOUNT ORDER:

     1. Active Admin
     2. Organisation
     3. Family
     4. Individual / Free

     Admin accounts are deliberately checked BEFORE
     profiles/account_type so administrators are never
     treated as normal players.
  ====================================================== */

  const routeAuthenticatedUser = async (user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }) => {
    // TEMPORARY DEBUGGING: remove these logs after identifying the redirect.
    console.log("[AUTH ROUTING] routeAuthenticatedUser called");
    console.log("[AUTH ROUTING] User ID:", user.id);
    console.log("[AUTH ROUTING] Email:", user.email ?? "(email unavailable)");

    const metadataAccountType =
      typeof user.user_metadata?.account_type === "string"
        ? user.user_metadata.account_type.trim().toLowerCase()
        : "";

    /*
     * ROUTING ORDER
     * 1. Super admin
     * 2. Active school administrator
     * 3. Existing organization space / organization setup
     * 4. Family account
     * 5. Individual or free player
     *
     * Keep this function as the single routing source for both
     * fresh sign-ins and sessions already active in the browser.
     */

    // 1. SUPER ADMIN: only the explicit super_admin role may use /admin.
    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id, role, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (adminError) {
      console.error(
        "[Sahaba Quest] Admin lookup failed:",
        adminError
      );
      throw new Error(
        "We couldn't verify your account permissions. Please try signing in again."
      );
    }

    if (adminUser?.role?.trim().toLowerCase() === "super_admin") {
      console.log("[AUTH ROUTING] Super admin found. Redirecting to /admin");
      window.location.replace("/admin");
      return;
    }

    // 2. SCHOOL ADMIN: school administrators are stored separately
    // in school_admins. Only active assignments qualify.
    const { data: schoolAdmins, error: schoolAdminError } = await supabase
      .from("school_admins")
      .select("id, school_id, role, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(1);

    if (schoolAdminError) {
      console.error(
        "[Sahaba Quest] School-admin lookup failed:",
        schoolAdminError
      );
      throw new Error(
        "We couldn't verify your school account. Please try signing in again."
      );
    }

    console.log(
      "[AUTH ROUTING] Active school-admin assignments found:",
      schoolAdmins?.length ?? 0
    );

    if (schoolAdmins && schoolAdmins.length > 0) {
      console.log(
        "[AUTH ROUTING] Active school admin found for this user. Redirecting to /schools/dashboard:",
        user.id
      );
      window.location.replace("/schools/dashboard");
      return;
    }

    console.log(
      "[AUTH ROUTING] No active school-admin assignment found for user:",
      user.id
    );

    // 3. Read the profile account type. In this database, standard
    // players may have account_type "free" as well as "individual".
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error(
        "[Sahaba Quest] Profile lookup failed:",
        profileError
      );
      throw new Error(
        "We couldn't identify your account type. Please try signing in again."
      );
    }

    const profileAccountType =
      typeof profile?.account_type === "string"
        ? profile.account_type.trim().toLowerCase()
        : "";

    const accountType = profileAccountType || metadataAccountType;

    console.log("[AUTH ROUTING] Profile account_type:", profileAccountType || "(missing)");
    console.log("[AUTH ROUTING] Metadata account_type:", metadataAccountType || "(missing)");
    console.log("[AUTH ROUTING] Resolved account_type:", accountType || "(missing)");

    const isOrganizationAccount =
      accountType === "organisation" ||
      accountType === "organization" ||
      metadataAccountType === "organisation" ||
      metadataAccountType === "organization";

    // Check for an existing organization space before sending a user
    // to a player dashboard. This preserves the existing organization
    // membership/owner flow.
    const {
      data: organizationSpace,
      error: organizationError,
    } = await supabase.rpc("get_my_organization_space");

    if (organizationError) {
      console.error(
        "[Sahaba Quest] Organization lookup failed:",
        organizationError
      );

      // A failed organization lookup must not turn a clearly identified
      // family/player into an organization account or block those users.
      // Organization accounts, however, must be verified before routing.
      if (isOrganizationAccount) {
        throw new Error(
          "We couldn't verify your organization account. Please try signing in again."
        );
      }

      if (accountType === "family") {
        window.location.replace("/family-dashboard");
        return;
      }

      if (accountType === "individual" || accountType === "free") {
        window.location.replace("/dashboard");
        return;
      }

      throw new Error(
        "We couldn't determine your account space. Please try signing in again."
      );
    }

    console.log(
      "[AUTH ROUTING] Organization space records found:",
      Array.isArray(organizationSpace) ? organizationSpace.length : "(not an array)"
    );

    if (Array.isArray(organizationSpace) && organizationSpace.length > 0) {
      console.log("[AUTH ROUTING] Redirecting to /organization");
      window.location.replace("/organization");
      return;
    }

    // 4. First-time organization setup. Only attempt setup when the
    // account metadata/profile explicitly identifies an organization.
    if (isOrganizationAccount) {
      const { error: setupError } = await supabase.rpc(
        "setup_my_organization"
      );

      if (setupError) {
        console.error(
          "[Sahaba Quest] Organization setup failed:",
          setupError
        );
        throw new Error(
          "We couldn't finish setting up your organization. Please try again."
        );
      }

      const {
        data: createdOrganizationSpace,
        error: verifyError,
      } = await supabase.rpc("get_my_organization_space");

      if (verifyError) {
        console.error(
          "[Sahaba Quest] Organization verification failed:",
          verifyError
        );
        throw new Error(
          "Your organization setup could not be verified. Please sign in again."
        );
      }

      if (
        !Array.isArray(createdOrganizationSpace) ||
        createdOrganizationSpace.length === 0
      ) {
        throw new Error(
          "We couldn't find your organization after setup. Please sign in again."
        );
      }

      window.location.replace("/organization");
      return;
    }

    // 5. Family accounts and ordinary player accounts.
    if (accountType === "family") {
      console.log("[AUTH ROUTING] Family account detected. Redirecting to /family-dashboard:", user.id);
      window.location.replace("/family-dashboard");
      return;
    }

    if (accountType === "individual" || accountType === "free") {
      console.log("[AUTH ROUTING] Individual/free account detected. Redirecting to /dashboard:", user.id);
      window.location.replace("/dashboard");
      return;
    }

    // Do not silently send an unrecognized account to the wrong dashboard.
    console.error(
      "[Sahaba Quest] Unrecognized account type:",
      accountType || "(missing)"
    );
    throw new Error(
      "We couldn't identify your account type. Please contact Sahaba Quest support."
    );
  };

  /* =====================================================
     CHECK EXISTING NORMAL AUTH SESSION

     IMPORTANT:
     Do not redirect recovery sessions to dashboard.
  ====================================================== */

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      try {
        /*
         * First check whether the browser is currently
         * handling a password recovery.
         */

        if (
          typeof window !== "undefined"
        ) {
          const url = new URL(
            window.location.href
          );

          const type =
            url.searchParams.get("type");

          const hashParams =
            new URLSearchParams(
              window.location.hash.replace(
                /^#/,
                ""
              )
            );

          const hashType =
            hashParams.get("type");

          const hasAccessToken =
            hashParams.has(
              "access_token"
            );

          const isRecovery =
            type === "recovery" ||
            hashType === "recovery" ||
            hasAccessToken;

          if (isRecovery) {
            router.replace(
              "/update-password"
            );

            return;
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!mounted || !user) {
          return;
        }

        /*
         * =================================================
         * IMPORTANT:
         *
         * Route the existing session through the SAME
         * account-resolution logic used during login.
         *
         * This means an already authenticated admin
         * will also go to /admin.
         * =================================================
         */

        console.log(
          "[AUTH ROUTING] Routing an existing session from the login page:",
          user.id,
          user.email ?? "(email unavailable)"
        );
        await routeAuthenticatedUser(user);

      } catch (error) {
        console.error(
          "Existing session check error:",
          error
        );
      }
    };

    checkUser();

    return () => {
      mounted = false;
    };

    // This effect intentionally runs when the login page
    // mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /* =====================================================
     HANDLE NORMAL LOGIN
  ====================================================== */

  const handleLogin = async (
    event?: FormEvent<HTMLFormElement>
  ) => {
    event?.preventDefault();

    setMessage("");

    const cleanEmail =
      email.trim().toLowerCase();

    if (
      !cleanEmail ||
      !password
    ) {
      setMessageType("error");

      setMessage(
        "Please enter your email and password."
      );

      return;
    }

    if (!captchaToken) {
      setMessageType("error");
      setMessage("Please complete the security verification before signing in.");
      return;
    }

    try {
      setLoading(true);

      /*
       * Clear any old Family Member browser session.
       */

      if (
        typeof window !== "undefined"
      ) {
        sessionStorage.removeItem(
          "sahabaquest_family_member_session"
        );
      }

      const {
        data,
        error,
      } =
        await supabase.auth.signInWithPassword(
          {
            email: cleanEmail,
            password,
            options: { captchaToken },
          }
        );

      if (error) {
        console.error(
          "Login error:",
          error
        );

        setMessageType("error");

        setMessage(
          error.message ===
            "Invalid login credentials"
            ? "Incorrect email or password."
            : error.message
        );

        return;
      }

      if (!data.user) {
        setMessageType("error");

        setMessage(
          "We couldn't verify your account. Please try again."
        );

        return;
      }

      /*
       * =================================================
       * ROUTE ACCOUNT
       *
       * Admin is checked first.
       * Organisation is checked next.
       * Family / Individual follows.
       * =================================================
       */

      console.log(
        "[AUTH ROUTING] Routing immediately after fresh sign-in:",
        data.user.id,
        data.user.email ?? "(email unavailable)"
      );
      await routeAuthenticatedUser(data.user);

    } catch (error) {
      console.error(
        "Unexpected login error:",
        error
      );

      setMessageType("error");

      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while signing in. Please try again."
      );
    } finally {
      setCaptchaResetSignal((signal) => signal + 1);
      setLoading(false);
    }
  };

  /* =====================================================
     HANDLE FORGOT PASSWORD
  ====================================================== */

  const handleForgotPassword = async () => {
    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      setMessageType("error");

      setMessage(
        "Please enter your email address first."
      );

      return;
    }

    if (!captchaToken) {
      setMessageType("error");
      setMessage("Please complete the security verification before requesting a password reset.");
      return;
    }

    try {
      setResetLoading(true);
      setMessage("");

      /*
       * IMPORTANT:
       * Always use the production password reset page.
       */

      const redirectTo =
        PASSWORD_RESET_REDIRECT;

      console.log(
        "Password reset redirect:",
        redirectTo
      );

      const {
        error,
      } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
            captchaToken,
          }
        );

      if (error) {
        console.error(
          "Password reset error:",
          error
        );

        setMessageType("error");

        setMessage(
          error.message
        );

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
      setCaptchaResetSignal((signal) => signal + 1);
      setResetLoading(false);
    }
  };

  /* =====================================================
     PAGE
  ====================================================== */

  return (
    <main className="login-page">

      {/* =================================================
          LEFT BRAND PANEL
      ================================================== */}

      <section className="brand-panel">

        <div className="brand-content">

          <div
            className="brand-logo"
          >
            <img
              src="https://cdn.phototourl.com/member/2026-09-30-957223ee-05a5-4299-9fc6-c4ca9f12695a.png"
              alt="Sahaba Quest"
            />
          </div>

          <span className="brand-badge">
            LEARN • REMEMBER • COMPETE
          </span>

          <h1>
            Know the
            <br />
            Sahabah.
          </h1>

          <p>
            Sahaba Quest is a gamified Islamic
            learning platform designed to help
            Muslims discover the lives, sacrifices,
            character, and remarkable stories of
            the Companions of the Prophet ﷺ.
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
                  Discover lessons from the lives
                  of the Sahabah.
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

      {/* =================================================
          LOGIN PANEL
      ================================================== */}

      <section className="login-panel">

        <div className="login-card">

          <div className="login-header">

            <span className="sq-badge">
              WELCOME BACK
            </span>

            <h2>
              Sign in
            </h2>

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
                  setEmail(
                    event.target.value
                  )
                }
                autoComplete="email"
                autoFocus
                disabled={loading}
                required
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
                  disabled={loading}
                  required
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
                  disabled={loading}
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>

              </div>

            </div>

            <TurnstileWidget
              action="auth"
              resetSignal={captchaResetSignal}
              onTokenChange={setCaptchaToken}
            />

            {/* FORGOT PASSWORD */}

            <div className="forgot-row">

              <button
                type="button"
                className="forgot-button"
                onClick={
                  handleForgotPassword
                }
                disabled={
                  resetLoading ||
                  loading
                }
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
              disabled={
                loading ||
                resetLoading
              }
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
            🔒 Your account information is
            securely handled by Supabase
            authentication.
          </div>

        </div>

      </section>

      {/* =================================================
          STYLES
      ================================================== */}

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
          background:
            linear-gradient(
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
          border:
            1px solid
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
          border:
            1px solid
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
          width: 58px;
          height: 58px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border:
            1px solid
            rgba(255, 255, 255, 0.2);
          overflow: hidden;
          margin-bottom: 24px;
        }

        .brand-logo img {
          width: 48px;
          height: 48px;
          max-width: 48px;
          max-height: 48px;
          object-fit: contain;
          display: block;
        }

        .brand-badge {
          display: inline-flex;
          padding: 8px 13px;
          border-radius: 999px;
          background:
            rgba(255, 255, 255, 0.08);
          color:
            rgba(255, 255, 255, 0.78);
          border:
            1px solid
            rgba(255, 255, 255, 0.12);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.3px;
        }

        .brand-content h1 {
          margin: 20px 0 18px;
          font-size:
            clamp(44px, 5vw, 68px);
          line-height: 0.98;
          letter-spacing: -2.5px;
          font-weight: 900;
        }

        .brand-content > p {
          max-width: 520px;
          margin: 0;
          color:
            rgba(255, 255, 255, 0.84);
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
          background:
            rgba(255, 255, 255, 0.09);
          font-size: 18px;
        }

        .feature strong {
          display: block;
          margin-bottom: 3px;
          font-size: 13px;
        }

        .feature p {
          margin: 0;
          color:
            rgba(255, 255, 255, 0.62);
          font-size: 11px;
          line-height: 1.6;
        }

        .home-link {
          display: inline-block;
          margin-top: 42px;
          color:
            rgba(255, 255, 255, 0.72);
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
          border:
            1px solid #cce7e3;
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
          border:
            1px solid #d7e4e2;
          border-radius: 11px;
          background: white;
          color: #183f3b;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
          box-sizing: border-box;
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
          transform:
            translateY(-50%);
          border: none;
          background: transparent;
          color: #687a77;
          font-family: inherit;
          font-size: 11px;
          font-weight: 800;
          cursor: pointer;
          padding: 8px;
        }

        .password-toggle:hover:not(:disabled) {
          color: #08766d;
        }

        .password-toggle:disabled {
          cursor: not-allowed;
          opacity: 0.5;
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
          border:
            1px solid #cde9e4;
        }

        .form-message.error {
          color: #a54141;
          background: #fff2f2;
          border:
            1px solid #f0d3d3;
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
          transform:
            translateY(-1px);
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
            padding:
              50px 25px;
          }

        }

        @media (max-width: 600px) {

          .brand-panel {
            min-height: auto;
            padding:
              38px 22px;
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
            padding:
              35px 18px;
          }

          .login-header h2 {
            font-size: 29px;
          }

        }

        @media (max-width: 420px) {

          .brand-panel {
            padding:
              30px 18px;
          }

          .brand-content h1 {
            font-size: 36px;
          }

          .login-panel {
            padding:
              30px 15px;
          }

        }

      `}</style>

    </main>
  );
}
