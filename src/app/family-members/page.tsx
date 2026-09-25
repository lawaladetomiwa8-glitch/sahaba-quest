"use client";

import { FormEvent, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type FamilyMember = {
  member_id: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  total_xp: number;
  current_level: number;
  questions_answered: number;
  correct_answers: number;
  current_streak: number;
  best_streak: number;
  accuracy: number;
};

export default function FamilyMembersPage() {
  const router = useRouter();

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  useEffect(() => {
    void loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.account_type !== "family") {
        router.replace("/dashboard");
        return;
      }

      const { data, error: membersError } = await supabase.rpc(
        "get_family_members_for_owner"
      );

      if (membersError) throw membersError;

      setMembers(Array.isArray(data) ? (data as FamilyMember[]) : []);
    } catch (err) {
      console.error("Family members loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not load your Family Members."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setMessage("");
    setError("");

    const cleanName = displayName.trim();

    if (!cleanName) {
      setError("Please enter the Family Member's name.");
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError("PIN must be exactly 4 digits.");
      return;
    }

    if (pin !== confirmPin) {
      setError("The PINs do not match.");
      return;
    }

    if (members.length >= 5) {
      setError("You can add a maximum of 5 Family Members.");
      return;
    }

    try {
      setSaving(true);

      const { data, error: createError } = await supabase.rpc(
        "create_family_member",
        {
          p_display_name: cleanName,
          p_pin: pin,
        }
      );

      if (createError) throw createError;

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("The Family Member was not created.");
      }

      setDisplayName("");
      setPin("");
      setConfirmPin("");
      setMessage(
        `${cleanName} has been added successfully. Give them their 4-digit PIN so they can sign in through Family Member Login.`
      );

      await loadMembers();
    } catch (err) {
      console.error("Family member creation error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We could not create this Family Member."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <AppNavbar />
          <div
            className="sq-card"
            style={{
              maxWidth: "700px",
              margin: "70px auto",
              padding: "44px 30px",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "42px" }}>👨‍👩‍👧‍👦</div>
            <h1 className="sq-title" style={{ marginTop: "14px" }}>
              Family Members
            </h1>
            <p className="sq-subtitle">Loading your Family Members...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="sq-page"
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 32%), var(--background)",
      }}
    >
      <div className="sq-container">
        <div style={{ marginBottom: "28px" }}>
          <AppNavbar />
        </div>

        <section
          className="sq-card"
          style={{
            padding: "34px",
            background: "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
          }}
        >
          <span className="sq-badge">Family Management</span>
          <h1
            style={{
              margin: "14px 0 8px",
              fontSize: "clamp(30px, 5vw, 44px)",
              fontWeight: 900,
            }}
          >
            Add Family Members
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: "720px",
              color: "var(--muted)",
              lineHeight: 1.7,
            }}
          >
            Create up to 5 internal Family Member profiles. They do not need
            separate email accounts or subscriptions. Each member uses their
            name and 4-digit PIN to access their own dashboard and progress.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.1fr)",
            gap: "20px",
            marginTop: "20px",
          }}
        >
          <section className="sq-card" style={{ padding: "28px" }}>
            <div className="sq-badge">{members.length} / 5 Members</div>
            <h2 style={{ margin: "12px 0 6px", fontSize: "24px", fontWeight: 900 }}>
              Create a member
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
              Choose the member's display name and create their private PIN.
            </p>

            <form onSubmit={handleAddMember} style={{ marginTop: "22px" }}>
              <label style={{ display: "block", fontWeight: 800, marginBottom: "8px" }}>
                Member name
              </label>
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="e.g. Ahmed"
                disabled={saving || members.length >= 5}
                style={inputStyle}
              />

              <label style={{ display: "block", fontWeight: 800, margin: "18px 0 8px" }}>
                4-digit PIN
              </label>
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                inputMode="numeric"
                maxLength={4}
                type="password"
                disabled={saving || members.length >= 5}
                style={inputStyle}
              />

              <label style={{ display: "block", fontWeight: 800, margin: "18px 0 8px" }}>
                Confirm PIN
              </label>
              <input
                value={confirmPin}
                onChange={(event) => setConfirmPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="••••"
                inputMode="numeric"
                maxLength={4}
                type="password"
                disabled={saving || members.length >= 5}
                style={inputStyle}
              />

              {error && (
                <div style={alertStyle("error")}>{error}</div>
              )}

              {message && (
                <div style={alertStyle("success")}>{message}</div>
              )}

              <button
                type="submit"
                className="sq-button-primary"
                disabled={saving || members.length >= 5}
                style={{
                  width: "100%",
                  marginTop: "20px",
                  border: "none",
                  cursor: saving || members.length >= 5 ? "not-allowed" : "pointer",
                  opacity: saving || members.length >= 5 ? 0.6 : 1,
                }}
              >
                {saving ? "Adding Member..." : members.length >= 5 ? "5 Members Added" : "Add Family Member"}
              </button>
            </form>
          </section>

          <section className="sq-card" style={{ padding: "28px" }}>
            <div className="sq-badge">Family Overview</div>
            <h2 style={{ margin: "12px 0 6px", fontSize: "24px", fontWeight: 900 }}>
              Your Members
            </h2>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
              Their personal progress stays separate from the Family Owner's
              own Family Quest progress.
            </p>

            <div style={{ marginTop: "20px", display: "grid", gap: "12px" }}>
              {members.length === 0 ? (
                <div
                  style={{
                    padding: "24px",
                    borderRadius: "16px",
                    background: "rgba(15, 118, 110, 0.06)",
                    color: "var(--muted)",
                    lineHeight: 1.7,
                  }}
                >
                  No members yet. Create the first member on the left.
                </div>
              ) : (
                members.map((member) => (
                  <div
                    key={member.member_id}
                    style={{
                      padding: "17px",
                      border: "1px solid var(--border)",
                      borderRadius: "16px",
                      background: "var(--card)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "12px",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "17px" }}>
                          {member.display_name}
                        </strong>
                        <div style={{ marginTop: "4px", color: "var(--muted)", fontSize: "12px" }}>
                          Level {member.current_level} · {member.total_xp.toLocaleString()} XP
                        </div>
                      </div>

                      <span
                        className="sq-badge"
                        style={{
                          background: member.is_active ? "#dcfce7" : "#f1f5f9",
                          color: member.is_active ? "#166534" : "#64748b",
                          fontSize: "11px",
                        }}
                      >
                        {member.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: "8px",
                        marginTop: "14px",
                      }}
                    >
                      <MiniStat label="Questions" value={member.questions_answered} />
                      <MiniStat label="Correct" value={member.correct_answers} />
                      <MiniStat label="Accuracy" value={`${member.accuracy}%`} />
                    </div>
                  </div>
                ))
              )}
            </div>

            <a
              href="/family-member-login"
              className="sq-button-secondary"
              style={{
                display: "inline-flex",
                marginTop: "20px",
                textDecoration: "none",
              }}
            >
              Family Member Login →
            </a>
          </section>
        </section>

        <footer style={{ padding: "30px 0 8px", textAlign: "center", color: "var(--muted-light)", fontSize: "12px" }}>
          Sahaba Quest • Learn. Remember. Grow together.
        </footer>
      </div>

      <style jsx>{`
        @media (max-width: 850px) {
          section[style*="grid-template-columns: minmax(0, 0.9fr)"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        padding: "10px",
        borderRadius: "12px",
        background: "var(--background)",
      }}
    >
      <div style={{ color: "var(--muted)", fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ marginTop: "4px", fontWeight: 900, fontSize: "16px" }}>
        {value}
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  minHeight: "48px",
  padding: "0 14px",
  borderRadius: "12px",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  outline: "none",
  fontSize: "15px",
  boxSizing: "border-box",
};

function alertStyle(type: "error" | "success"): CSSProperties {
  return {
    marginTop: "16px",
    padding: "12px 14px",
    borderRadius: "12px",
    lineHeight: 1.5,
    fontSize: "13px",
    background: type === "error" ? "#fef2f2" : "#ecfdf5",
    color: type === "error" ? "#991b1b" : "#166534",
    border: `1px solid ${type === "error" ? "#fecaca" : "#bbf7d0"}`,
  };
}
