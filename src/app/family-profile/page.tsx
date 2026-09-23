"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type AccountType = "free" | "individual" | "family";

type ProfileData = {
  username: string;
  display_name: string;
  account_type: AccountType;
};

type SubscriptionData = {
  status: string;
  current_period_end: string | null;
  plan_type: "plus" | "family" | "school" | null;
  display_name: string | null;
};

type ProgressData = {
  current_level: number;
  total_xp: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
};

export default function FamilyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileData>({
    username: "",
    display_name: "",
    account_type: "free",
  });

  const [subscription, setSubscription] =
    useState<SubscriptionData | null>(null);

  const [progress, setProgress] = useState<ProgressData>({
    current_level: 1,
    total_xp: 0,
    questions_answered: 0,
    correct_answers: 0,
    current_streak: 0,
    best_streak: 0,
  });

  const [email, setEmail] = useState("");
  const [memberSince, setMemberSince] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | ""
  >("");

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      setMessageType("error");
      setLoading(false);
      return;
    }

    setEmail(user.email ?? "");

    if (user.created_at) {
      setMemberSince(
        new Date(user.created_at).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        })
      );
    }

    const [profileResult, progressResult, subscriptionResult] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("username, display_name, account_type")
          .eq("id", user.id)
          .single(),

        supabase
          .from("family_player_progress")
          .select(
            "current_level, total_xp, questions_answered, correct_answers, current_streak, best_streak"
          )
          .eq("user_id", user.id)
          .single(),

        supabase
          .from("subscriptions")
          .select(
            `
              status,
              current_period_end,
              subscription_plans (
                plan_type,
                display_name
              )
            `
          )
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("current_period_end", {
            ascending: false,
          })
          .limit(1)
          .maybeSingle(),
      ]);

    if (profileResult.error) {
      setMessage(profileResult.error.message);
      setMessageType("error");
      setLoading(false);
      return;
    }

    const rawAccountType = profileResult.data?.account_type;

    if (rawAccountType !== "family") {
      router.replace("/profile");
      return;
    }

    const accountType: AccountType = "family";

    setProfile({
      username: profileResult.data?.username ?? "",
      display_name: profileResult.data?.display_name ?? "",
      account_type: accountType,
    });

    setDisplayName(profileResult.data?.display_name ?? "");
    setUsername(profileResult.data?.username ?? "");

    if (progressResult.data) {
      setProgress({
        current_level: progressResult.data.current_level ?? 1,
        total_xp: progressResult.data.total_xp ?? 0,
        questions_answered:
          progressResult.data.questions_answered ?? 0,
        correct_answers:
          progressResult.data.correct_answers ?? 0,
        current_streak:
          progressResult.data.current_streak ?? 0,
        best_streak:
          progressResult.data.best_streak ?? 0,
      });
    }

    if (subscriptionResult.error) {
      console.error(
        "Subscription lookup error:",
        subscriptionResult.error
      );
      setSubscription(null);
    } else if (subscriptionResult.data) {
      const subscriptionPlan = Array.isArray(
        subscriptionResult.data.subscription_plans
      )
        ? subscriptionResult.data.subscription_plans[0] ?? null
        : subscriptionResult.data.subscription_plans ?? null;

      setSubscription({
        status: subscriptionResult.data.status,
        current_period_end:
          subscriptionResult.data.current_period_end ?? null,
        plan_type:
          subscriptionPlan?.plan_type === "plus" ||
          subscriptionPlan?.plan_type === "family" ||
          subscriptionPlan?.plan_type === "school"
            ? subscriptionPlan.plan_type
            : null,
        display_name: subscriptionPlan?.display_name ?? null,
      });
    } else {
      setSubscription(null);
    }

    setLoading(false);
  }

  async function saveProfile() {
    setMessage("");
    setMessageType("");

    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanDisplayName || !cleanUsername) {
      setMessage("Display name and username cannot be empty.");
      setMessageType("error");
      return;
    }

    if (cleanUsername.length < 3) {
      setMessage("Username must be at least 3 characters.");
      setMessageType("error");
      return;
    }

    if (!/^[a-z0-9_]+$/.test(cleanUsername)) {
      setMessage(
        "Username can only contain lowercase letters, numbers and underscores."
      );
      setMessageType("error");
      return;
    }

    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMessage("You are not logged in.");
      setMessageType("error");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: cleanDisplayName,
      })
      .eq("id", user.id);

    if (error) {
      const errorMessage = error.message.toLowerCase();

      if (errorMessage.includes("profiles_username_unique")) {
        setMessage(
          "That username is already taken. Please choose another username."
        );
      } else if (
        errorMessage.includes("profiles_display_name_unique")
      ) {
        setMessage(
          "That display name is already in use. Please choose another display name."
        );
      } else {
        setMessage(error.message);
      }

      setMessageType("error");
      setSaving(false);
      return;
    }

    setProfile({
      username: cleanUsername,
      display_name: cleanDisplayName,
      account_type: profile.account_type,
    });

    setUsername(cleanUsername);
    setDisplayName(cleanDisplayName);

    setMessage("Profile updated successfully.");
    setMessageType("success");
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const accuracy =
    progress.questions_answered > 0
      ? Math.round(
          (progress.correct_answers /
            progress.questions_answered) *
            100
        )
      : 0;

  const playerName = profile.display_name || "Player";

  const initials =
    playerName
      .trim()
      .split(/\s+/)
      .map((name) => name.charAt(0))
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  const membershipLabel = "Family Account";
  const membershipDescription = "Family plan";

  const subscriptionEndDate =
    subscription?.current_period_end
      ? new Date(
          subscription.current_period_end
        ).toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  if (loading) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div
            className="sq-card"
            style={{
              padding: "60px 30px",
              textAlign: "center",
            }}
          >
            <div className="sq-badge">SAHABA QUEST</div>

            <h1
              className="sq-title"
              style={{ marginTop: "20px" }}
            >
              Loading your profile...
            </h1>

            <p className="sq-subtitle">
              Getting your player information ready.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <AppNavbar />

      <main className="sq-page">
        <div className="sq-container">
          {/* Profile Header */}
          <section
            className="sq-card"
            style={{
              padding: "32px",
              marginBottom: "24px",
              background:
                "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
            }}
          >
            <div
              className="profile-header"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "24px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                }}
              >
                <div
                  style={{
                    width: "82px",
                    height: "82px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "24px",
                    background: "var(--primary)",
                    color: "white",
                    fontSize: "28px",
                    fontWeight: 900,
                    boxShadow:
                      "0 12px 28px rgba(15, 118, 110, 0.2)",
                  }}
                >
                  {initials}
                </div>

                <div>
                  <span className="sq-badge">
                    Family Profile
                  </span>

                  <h1
                    className="sq-title"
                    style={{ marginTop: "10px" }}
                  >
                    {playerName}
                  </h1>

                  <p className="sq-subtitle">
                    @{profile.username || "username"}
                  </p>
                </div>
              </div>

              <div
                style={{
                  textAlign: "right",
                  color: "var(--muted)",
                  fontSize: "14px",
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  Member since
                </div>

                <div
                  style={{
                    marginTop: "4px",
                    color: "var(--foreground)",
                    fontWeight: 800,
                  }}
                >
                  {memberSince || "Recently"}
                </div>
              </div>
            </div>
          </section>

          {/* Statistics */}
          <section
            className="profile-stats"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(4, minmax(0, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            <div className="sq-stat">
              <div className="sq-stat-label">
                Family Level
              </div>

              <div className="sq-stat-value">
                {progress.current_level}
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">
                Family XP
              </div>

              <div className="sq-stat-value">
                {progress.total_xp.toLocaleString()}
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">
                Accuracy
              </div>

              <div className="sq-stat-value">
                {accuracy}%
              </div>
            </div>

            <div className="sq-stat">
              <div className="sq-stat-label">
                Best Family Streak
              </div>

              <div className="sq-stat-value">
                {progress.best_streak}
              </div>
            </div>
          </section>

          {/* Main Profile Grid */}
          <div
            className="profile-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(0, 1.35fr) minmax(300px, 0.65fr)",
              gap: "24px",
            }}
          >
            {/* Personal Information */}
            <section
              className="sq-card"
              style={{ padding: "30px" }}
            >
              <div style={{ marginBottom: "24px" }}>
                <h2
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    fontWeight: 800,
                  }}
                >
                  Personal Information
                </h2>

                <p className="sq-subtitle">
                  Update the name and username shown on your
                  Sahaba Quest Family profile.
                </p>
              </div>

              {message && (
                <div
                  style={{
                    marginBottom: "20px",
                    padding: "14px 16px",
                    borderRadius: "14px",
                    background:
                      messageType === "success"
                        ? "var(--success-light)"
                        : "var(--danger-light)",
                    color:
                      messageType === "success"
                        ? "var(--success)"
                        : "var(--danger)",
                    fontSize: "14px",
                    fontWeight: 700,
                  }}
                >
                  {message}
                </div>
              )}

              <div style={{ marginBottom: "20px" }}>
                <label className="sq-label">
                  Display Name
                </label>

                <input
                  className="sq-input"
                  type="text"
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  placeholder="Your display name"
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

              <div style={{ marginBottom: "24px" }}>
                <label className="sq-label">
                  Username
                </label>

                <input
                  className="sq-input"
                  type="text"
                  value={username}
                  onChange={(event) =>
                    setUsername(
                      event.target.value
                        .toLowerCase()
                        .replace(/\s/g, "")
                    )
                  }
                  placeholder="Your username"
                />

                <p
                  style={{
                    margin: "7px 0 0",
                    color: "var(--muted)",
                    fontSize: "12px",
                  }}
                >
                  Lowercase letters, numbers and underscores.
                </p>
              </div>

              <button
                className="sq-button-primary"
                onClick={saveProfile}
                disabled={saving}
              >
                {saving
                  ? "Saving changes..."
                  : "Save Changes"}
              </button>
            </section>

            {/* Account */}
            <section
              className="sq-card"
              style={{ padding: "30px" }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 800,
                }}
              >
                Account
              </h2>

              <p className="sq-subtitle">
                Your Sahaba Quest account information.
              </p>

              <div
                style={{
                  marginTop: "24px",
                  display: "grid",
                  gap: "16px",
                }}
              >
                <div
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: "#f8faf9",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="sq-stat-label">
                    Email Address
                  </div>

                  <div
                    style={{
                      marginTop: "6px",
                      fontWeight: 700,
                      wordBreak: "break-word",
                    }}
                  >
                    {email}
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px",
                    borderRadius: "14px",
                    background: "#f8faf9",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div className="sq-stat-label">
                    Membership
                  </div>

                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: "6px",
                    }}
                  >
                    <span className="sq-badge">
                      {membershipLabel}
                    </span>

                    <span
                      style={{
                        color: "var(--muted)",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {membershipDescription}
                    </span>

                    {subscriptionEndDate && (
                      <span
                        style={{
                          color: "var(--muted)",
                          fontSize: "12px",
                        }}
                      >
                        Active until {subscriptionEndDate}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "28px",
                  paddingTop: "24px",
                  borderTop: "1px solid var(--border)",
                  display: "grid",
                  gap: "10px",
                }}
              >
                <Link
                  href="/family-dashboard"
                  className="sq-button-secondary"
                  style={{
                    width: "100%",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Family Dashboard
                </Link>

                <Link
                  href="/family-progress"
                  className="sq-button-secondary"
                  style={{
                    width: "100%",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Family Progress
                </Link>

                <Link
                  href="/family-quest"
                  className="sq-button-primary"
                  style={{
                    width: "100%",
                    textAlign: "center",
                    textDecoration: "none",
                  }}
                >
                  Play Family Quest
                </Link>

                <button
                  className="sq-button-secondary"
                  onClick={signOut}
                  style={{
                    width: "100%",
                    color: "var(--danger)",
                  }}
                >
                  Sign Out
                </button>
              </div>
            </section>
          </div>

          {/* Family Activity */}
          <section
            className="sq-card"
            style={{
              marginTop: "24px",
              padding: "30px",
            }}
          >
            <div style={{ marginBottom: "22px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 800,
                }}
              >
                Family Activity
              </h2>

              <p className="sq-subtitle">
                A quick look at your Family learning journey.
              </p>
            </div>

            <div
              className="profile-activity"
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",
                gap: "16px",
              }}
            >
              <div
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  background: "var(--primary-light)",
                }}
              >
                <div className="sq-stat-label">
                  Family Questions Answered
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "26px",
                    fontWeight: 900,
                    color: "var(--primary-dark)",
                  }}
                >
                  {progress.questions_answered.toLocaleString()}
                </div>
              </div>

              <div
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  background: "var(--secondary-light)",
                }}
              >
                <div className="sq-stat-label">
                  Current Family Streak
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "26px",
                    fontWeight: 900,
                  }}
                >
                  {progress.current_streak}
                </div>
              </div>

              <div
                style={{
                  padding: "20px",
                  borderRadius: "16px",
                  background: "var(--success-light)",
                }}
              >
                <div className="sq-stat-label">
                  Family Correct Answers
                </div>

                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "26px",
                    fontWeight: 900,
                    color: "var(--success)",
                  }}
                >
                  {progress.correct_answers.toLocaleString()}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <style jsx>{`
        @media (max-width: 900px) {
          .profile-header {
            align-items: flex-start !important;
            flex-direction: column !important;
          }

          .profile-header > div:last-child {
            text-align: left !important;
          }

          .profile-stats {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            ) !important;
          }

          .profile-grid {
            grid-template-columns: 1fr !important;
          }

          .profile-activity {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 520px) {
          .profile-stats {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </>
  );
}