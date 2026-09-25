"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

type FamilyMember = {
  member_id: string;
  display_name: string;
};

type SessionResult = {
  session_token: string;
  member_id: string;
  display_name: string;
  family_id: string;
  expires_at: string;
};

const SESSION_KEY =
  "sahabaquest_family_member_session";

export default function FamilyMemberLoginPage() {
  const router = useRouter();

  const [members, setMembers] = useState<
    FamilyMember[]
  >([]);

  const [selectedMember, setSelectedMember] =
    useState<FamilyMember | null>(null);

  const [pin, setPin] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [verifying, setVerifying] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      setError("");

      /*
       * Make sure the Family Owner is authenticated.
       */
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(
          `Authentication check failed: ${userError.message}`
        );
      }

      if (!user) {
        router.replace("/login");
        return;
      }

      /*
       * Load active Family Members.
       */
      const {
        data,
        error: membersError,
      } = await supabase.rpc(
        "get_family_members_for_login"
      );

      if (membersError) {
        throw new Error(
          `Could not load Family Members: ${membersError.message}`
        );
      }

      setMembers(
        Array.isArray(data)
          ? (data as FamilyMember[])
          : []
      );
    } catch (err) {
      console.error(
        "Family Member login loading error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "We could not load your Family Members."
      );
    } finally {
      setLoading(false);
    }
  }

  function handlePinChange(
    value: string
  ) {
    /*
     * Only allow four numeric digits.
     */
    const cleaned = value
      .replace(/\D/g, "")
      .slice(0, 4);

    setPin(cleaned);
    setError("");
  }

  async function handleContinue() {
    if (!selectedMember) {
      setError(
        "Please select a Family Member first."
      );
      return;
    }

    if (pin.length !== 4) {
      setError(
        "Please enter the 4-digit PIN."
      );
      return;
    }

    try {
      setVerifying(true);
      setError("");

      /*
       * Verify the Family Member PIN.
       *
       * This creates the secure temporary
       * Family Member session.
       */
      const {
        data,
        error: verifyError,
      } = await supabase.rpc(
        "verify_family_member_pin",
        {
          p_member_id:
            selectedMember.member_id,
          p_pin: pin,
        }
      );

      if (verifyError) {
        throw new Error(
          verifyError.message ||
            "PIN verification failed."
        );
      }

      if (
        !data ||
        !Array.isArray(data) ||
        data.length === 0
      ) {
        throw new Error(
          "PIN verification did not create a Family Member session."
        );
      }

      const session =
        data[0] as SessionResult;

      if (!session.session_token) {
        throw new Error(
          "No Family Member session token was returned."
        );
      }

      /*
       * Save the secure member session.
       */
      sessionStorage.setItem(
        SESSION_KEY,
        session.session_token
      );

      /*
       * Clear the PIN from memory before redirecting.
       */
      setPin("");

      /*
       * Enter the real Family Member Dashboard.
       */
      router.replace(
        "/family-member-dashboard"
      );
    } catch (err) {
      console.error(
        "Family Member PIN verification error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Incorrect PIN. Please try again."
      );
    } finally {
      setVerifying(false);
    }
  }

  function handleBack() {
    setSelectedMember(null);
    setPin("");
    setError("");
  }

  /*
   * LOADING
   */
  if (loading) {
    return (
      <main className="sq-page">
        <div className="sq-container">
          <div
            className="sq-card"
            style={{
              maxWidth: "620px",
              margin: "80px auto",
              padding: "48px 32px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "64px",
                height: "64px",
                margin: "0 auto 20px",
                borderRadius: "20px",
                background:
                  "var(--primary-light)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary)",
                fontSize: "24px",
                fontWeight: 900,
              }}
            >
              SQ
            </div>

            <h1 className="sq-title">
              Sahaba Quest
            </h1>

            <p
              className="sq-subtitle"
              style={{
                marginTop: "12px",
              }}
            >
              Loading Family Members...
            </p>
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
      <div
        className="sq-container"
        style={{
          maxWidth: "720px",
          margin: "0 auto",
          paddingTop: "40px",
          paddingBottom: "60px",
        }}
      >
        {/* HEADER */}
        <div
          style={{
            textAlign: "center",
            marginBottom: "30px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 18px",
              borderRadius: "20px",
              background:
                "var(--primary-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary)",
              fontSize: "24px",
              fontWeight: 900,
            }}
          >
            SQ
          </div>

          <h1
            className="sq-title"
            style={{
              marginBottom: "8px",
            }}
          >
            Who is playing?
          </h1>

          <p className="sq-subtitle">
            Select a Family Member to continue
            your Sahaba Quest.
          </p>
        </div>

        {/* MAIN CARD */}
        <section
          className="sq-card"
          style={{
            padding: "30px",
          }}
        >
          {!selectedMember ? (
            <>
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "22px",
                }}
              >
                <div>
                  <div className="sq-badge">
                    Family Members
                  </div>

                  <h2
                    style={{
                      margin:
                        "12px 0 4px",
                      fontSize: "24px",
                      fontWeight: 900,
                    }}
                  >
                    Select your profile
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color:
                        "var(--muted)",
                      fontSize: "14px",
                    }}
                  >
                    Choose your name
                    and enter your PIN
                    on the next step.
                  </p>
                </div>

                <div
                  style={{
                    padding:
                      "8px 12px",
                    borderRadius: "999px",
                    background:
                      "var(--primary-light)",
                    color:
                      "var(--primary-dark)",
                    fontSize: "12px",
                    fontWeight: 800,
                    whiteSpace:
                      "nowrap",
                  }}
                >
                  {members.length}{" "}
                  member
                  {members.length ===
                  1
                    ? ""
                    : "s"}
                </div>
              </div>

              {error && (
                <div
                  style={{
                    marginBottom: "18px",
                    padding:
                      "13px 15px",
                    borderRadius: "14px",
                    background:
                      "#fef2f2",
                    color:
                      "#b91c1c",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  {error}
                </div>
              )}

              {members.length === 0 ? (
                <div
                  style={{
                    padding: "28px 20px",
                    borderRadius: "18px",
                    background:
                      "#f8faf9",
                    border:
                      "1px solid var(--border)",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: "36px",
                      marginBottom:
                        "12px",
                    }}
                  >
                    👨‍👩‍👧‍👦
                  </div>

                  <h3
                    style={{
                      margin:
                        "0 0 8px",
                      fontSize: "18px",
                      fontWeight: 900,
                    }}
                  >
                    No Family Members
                  </h3>

                  <p
                    style={{
                      margin: 0,
                      color:
                        "var(--muted)",
                      fontSize: "14px",
                      lineHeight: 1.6,
                    }}
                  >
                    Your Family Owner
                    has not added any
                    Family Members
                    yet.
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/family-dashboard"
                      )
                    }
                    className="sq-button-secondary"
                    style={{
                      marginTop:
                        "18px",
                      border: "none",
                      cursor:
                        "pointer",
                    }}
                  >
                    Back to Family
                    Dashboard
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gap: "12px",
                  }}
                >
                  {members.map(
                    (member) => (
                      <button
                        key={
                          member.member_id
                        }
                        type="button"
                        onClick={() =>
                          setSelectedMember(
                            member
                          )
                        }
                        style={{
                          width: "100%",
                          padding:
                            "18px",
                          borderRadius:
                            "18px",
                          border:
                            "1px solid var(--border)",
                          background:
                            "white",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: "16px",
                          cursor:
                            "pointer",
                          textAlign:
                            "left",
                          transition:
                            "transform 0.2s ease, box-shadow 0.2s ease",
                        }}
                      >
                        <span
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: "14px",
                          }}
                        >
                          <span
                            style={{
                              width:
                                "48px",
                              height:
                                "48px",
                              flexShrink:
                                0,
                              borderRadius:
                                "15px",
                              background:
                                "var(--primary-light)",
                              color:
                                "var(--primary-dark)",
                              display:
                                "flex",
                              alignItems:
                                "center",
                              justifyContent:
                                "center",
                              fontSize:
                                "20px",
                              fontWeight:
                                900,
                            }}
                          >
                            {member.display_name
                              .charAt(
                                0
                              )
                              .toUpperCase()}
                          </span>

                          <span>
                            <span
                              style={{
                                display:
                                  "block",
                                fontSize:
                                  "16px",
                                fontWeight:
                                  900,
                                color:
                                  "var(--foreground)",
                              }}
                            >
                              {
                                member.display_name
                              }
                            </span>

                            <span
                              style={{
                                display:
                                  "block",
                                marginTop:
                                  "4px",
                                fontSize:
                                  "12px",
                                color:
                                  "var(--muted)",
                              }}
                            >
                              Family
                              Member
                            </span>
                          </span>
                        </span>

                        <span
                          style={{
                            color:
                              "var(--primary)",
                            fontSize:
                              "20px",
                            fontWeight:
                              900,
                          }}
                        >
                          →
                        </span>
                      </button>
                    )
                  )}
                </div>
              )}

              <div
                style={{
                  marginTop: "22px",
                  textAlign: "center",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/family-dashboard"
                    )
                  }
                  style={{
                    border: "none",
                    background:
                      "transparent",
                    color:
                      "var(--muted)",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor:
                      "pointer",
                  }}
                >
                  ← Back to Family
                  Dashboard
                </button>
              </div>
            </>
          ) : (
            <>
              {/* SELECTED MEMBER */}
              <div
                style={{
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "72px",
                    height: "72px",
                    margin:
                      "0 auto 16px",
                    borderRadius: "22px",
                    background:
                      "var(--primary-light)",
                    color:
                      "var(--primary-dark)",
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    fontSize: "28px",
                    fontWeight: 900,
                  }}
                >
                  {selectedMember.display_name
                    .charAt(0)
                    .toUpperCase()}
                </div>

                <div className="sq-badge">
                  Family Member
                </div>

                <h2
                  style={{
                    margin:
                      "12px 0 6px",
                    fontSize: "28px",
                    fontWeight: 900,
                  }}
                >
                  {selectedMember.display_name}
                </h2>

                <p
                  style={{
                    margin: 0,
                    color:
                      "var(--muted)",
                    fontSize: "14px",
                  }}
                >
                  Enter your 4-digit PIN
                  to continue.
                </p>
              </div>

              {error && (
                <div
                  style={{
                    marginTop: "22px",
                    padding:
                      "13px 15px",
                    borderRadius: "14px",
                    background:
                      "#fef2f2",
                    color:
                      "#b91c1c",
                    fontSize: "13px",
                    lineHeight: 1.6,
                    textAlign:
                      "center",
                  }}
                >
                  {error}
                </div>
              )}

              {/* PIN */}
              <div
                style={{
                  marginTop: "26px",
                }}
              >
                <label
                  htmlFor="member-pin"
                  style={{
                    display:
                      "block",
                    marginBottom:
                      "9px",
                    fontSize:
                      "13px",
                    fontWeight: 800,
                  }}
                >
                  4-digit PIN
                </label>

                <input
                  id="member-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={4}
                  value={pin}
                  onChange={(event) =>
                    handlePinChange(
                      event.target.value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      pin.length ===
                        4 &&
                      !verifying
                    ) {
                      handleContinue();
                    }
                  }}
                  autoFocus
                  placeholder="••••"
                  style={{
                    width: "100%",
                    height: "58px",
                    borderRadius:
                      "16px",
                    border:
                      "1px solid var(--border)",
                    background:
                      "#f8faf9",
                    textAlign:
                      "center",
                    fontSize:
                      "26px",
                    fontWeight: 900,
                    letterSpacing:
                      "10px",
                    outline: "none",
                    boxSizing:
                      "border-box",
                  }}
                />
              </div>

              {/* ACTIONS */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  marginTop: "22px",
                }}
              >
                <button
                  type="button"
                  onClick={
                    handleBack
                  }
                  disabled={verifying}
                  className="sq-button-secondary"
                  style={{
                    flex: 1,
                    border: "none",
                    cursor:
                      verifying
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      verifying
                        ? 0.6
                        : 1,
                  }}
                >
                  ← Back
                </button>

                <button
                  type="button"
                  onClick={
                    handleContinue
                  }
                  disabled={
                    verifying ||
                    pin.length !== 4
                  }
                  className="sq-button-primary"
                  style={{
                    flex: 1,
                    border: "none",
                    cursor:
                      verifying ||
                      pin.length !== 4
                        ? "not-allowed"
                        : "pointer",
                    opacity:
                      verifying ||
                      pin.length !== 4
                        ? 0.6
                        : 1,
                  }}
                >
                  {verifying
                    ? "Verifying..."
                    : "Continue →"}
                </button>
              </div>
            </>
          )}
        </section>

        {/* SECURITY NOTE */}
        <div
          style={{
            marginTop: "18px",
            padding: "15px 18px",
            borderRadius: "15px",
            background:
              "var(--primary-light)",
            color:
              "var(--primary-dark)",
            fontSize: "12px",
            lineHeight: 1.6,
            textAlign: "center",
          }}
        >
          🔒 Your Family Member PIN is
          securely verified. No separate
          Sahaba Quest account is required.
        </div>
      </div>

      <style jsx>{`
        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }

        @media (max-width: 600px) {
          .sq-container {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
        }
      `}</style>
    </main>
  );
}