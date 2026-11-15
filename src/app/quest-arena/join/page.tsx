"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppNavbar } from "../../../components/ui";
import { supabase } from "../../../lib/supabase";

type PreviewRow = Record<string, unknown>;

type TeamOption = {
  slot: 1 | 2;
  id: string | null;
  name: string;
  participantCount: number;
};

type CompetitionPreview = {
  id: string;
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  registrationClosesAt: string | null;
  registrationOpen: boolean;
  alreadyJoined: boolean;
  joinedTeamName: string | null;
  teams: [TeamOption, TeamOption];
};

function readValue(row: PreviewRow, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return undefined;
}

function readString(row: PreviewRow, keys: string[], fallback = ""): string {
  const value = readValue(row, keys);
  return typeof value === "string" ? value : fallback;
}

function readNumber(row: PreviewRow, keys: string[]): number {
  const value = readValue(row, keys);
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readBoolean(row: PreviewRow, keys: string[], fallback = false): boolean {
  const value = readValue(row, keys);
  if (typeof value === "boolean") return value;
  if (value === "true" || value === 1) return true;
  if (value === "false" || value === 0) return false;
  return fallback;
}

function mapPreview(row: PreviewRow): CompetitionPreview {
  const teamOneName = readString(row, [
    "out_team_1_name", "team_1_name", "team_one_name", "team1_name",
  ], "Team 1");
  const teamTwoName = readString(row, [
    "out_team_2_name", "team_2_name", "team_two_name", "team2_name",
  ], "Team 2");

  return {
    id: readString(row, ["out_competition_id", "competition_id", "id"]),
    title: readString(row, ["out_title", "title", "competition_title"], "Quest Arena Competition"),
    status: readString(row, ["out_status", "status"], "open"),
    startsAt: readString(row, ["out_starts_at", "starts_at"], "") || null,
    endsAt: readString(row, ["out_ends_at", "ends_at"], "") || null,
    registrationClosesAt: readString(row, [
      "out_registration_closes_at", "registration_closes_at",
    ], "") || null,
    registrationOpen: readBoolean(row, [
      "out_registration_open", "registration_open", "is_registration_open",
    ], false),
    alreadyJoined: readBoolean(row, [
      "out_already_joined", "already_joined", "has_joined",
    ], false),
    joinedTeamName: readString(row, [
      "out_joined_team_name", "joined_team_name", "my_team_name",
    ], "") || null,
    teams: [
      {
        slot: 1,
        id: readString(row, ["out_team_1_id", "team_1_id", "team_one_id"]) || null,
        name: teamOneName,
        participantCount: readNumber(row, [
          "out_team_1_participant_count", "team_1_participant_count",
          "team_1_count", "team_one_count",
        ]),
      },
      {
        slot: 2,
        id: readString(row, ["out_team_2_id", "team_2_id", "team_two_id"]) || null,
        name: teamTwoName,
        participantCount: readNumber(row, [
          "out_team_2_participant_count", "team_2_participant_count",
          "team_2_count", "team_two_count",
        ]),
      },
    ],
  };
}

function formatDate(value: string | null): string {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}

function JoinCompetitionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = useMemo(
    () => (searchParams.get("code") || "").trim().toUpperCase(),
    [searchParams]
  );

  const [preview, setPreview] = useState<CompetitionPreview | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<1 | 2 | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPreview = useCallback(async () => {
    if (!code) {
      setError("This invitation link does not contain a valid competition code.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        const returnPath = `/quest-arena/join?code=${encodeURIComponent(code)}`;
        router.replace(`/signup?redirectTo=${encodeURIComponent(returnPath)}`);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile || !["free", "individual"].includes(profile.account_type)) {
        router.replace(profile?.account_type === "family" ? "/family-dashboard" : "/dashboard");
        return;
      }

      const { data, error: previewError } = await supabase.rpc(
        "quest_arena_get_invitation_preview",
        { p_invite_code: code }
      );

      if (previewError) throw previewError;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== "object") {
        throw new Error("We could not find a competition with this invitation code.");
      }

      const mapped = mapPreview(row as PreviewRow);
      if (!mapped.id) {
        throw new Error(
          "The invitation preview returned incomplete competition details. Please contact support."
        );
      }

      setPreview(mapped);
      if (mapped.alreadyJoined) setNotice("You have already joined this competition.");
    } catch (loadError) {
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [code, router]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function joinCompetition() {
    if (!preview || !selectedTeam) {
      setError("Please select a team before continuing.");
      return;
    }

    setJoining(true);
    setError("");
    setNotice("");

    try {
      const { data, error: joinError } = await supabase.rpc(
        "quest_arena_join_competition",
        {
          p_invite_code: code,
          p_team_slot: selectedTeam,
        }
      );

      if (joinError) throw joinError;

      const row = Array.isArray(data) ? data[0] : data;
      const competitionId =
        row && typeof row === "object"
          ? String(
              (row as Record<string, unknown>).out_competition_id ||
              (row as Record<string, unknown>).competition_id ||
              preview.id
            )
          : preview.id;

      router.push(`/quest-arena/competition/${competitionId}`);
    } catch (joinError) {
      setError(errorMessage(joinError));
    } finally {
      setJoining(false);
    }
  }

  const registrationClosed =
    !preview?.registrationOpen || preview?.status !== "open";

  return (
    <main className="sq-page" style={{ minHeight: "100vh", paddingBottom: 48 }}>
      <div className="sq-container" style={{ maxWidth: 1040 }}>
        <AppNavbar />

        <div style={{ margin: "24px 0 18px" }}>
          <Link
            href="/quest-arena"
            style={{ color: "var(--primary)", fontWeight: 750, textDecoration: "none" }}
          >
            ← Back to Quest Arena
          </Link>
        </div>

        <section
          className="sq-card"
          style={{
            padding: "clamp(24px, 5vw, 42px)",
            background: "linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              width: 210,
              height: 210,
              borderRadius: "50%",
              right: -70,
              top: -90,
              background: "var(--primary-light)",
              opacity: 0.65,
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <span className="sq-badge">⚔️ QUEST ARENA INVITATION</span>
            <h1
              style={{
                margin: "16px 0 8px",
                fontSize: "clamp(28px, 5vw, 42px)",
                lineHeight: 1.12,
                fontWeight: 900,
                letterSpacing: "-1px",
              }}
            >
              Join the competition
            </h1>
            <p style={{ margin: 0, maxWidth: 680, color: "var(--muted)", lineHeight: 1.7 }}>
              You have been invited to compete with other Sahaba Quest learners.
              Review the competition details and choose the team you want to represent.
            </p>
          </div>
        </section>

        {loading && (
          <section className="sq-card" style={{ marginTop: 20, padding: 30, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>⏳</div>
            <strong>Loading invitation details...</strong>
            <p style={{ color: "var(--muted)", marginBottom: 0 }}>Please wait while we verify this invitation.</p>
          </section>
        )}

        {!loading && error && !preview && (
          <section className="sq-card" style={{ marginTop: 20, padding: 28 }}>
            <div role="alert" style={alertStyle}>{error}</div>
            <button type="button" className="sq-button-primary" onClick={() => void loadPreview()} style={{ marginTop: 18 }}>
              Try again
            </button>
          </section>
        )}

        {!loading && preview && (
          <>
            <section className="sq-card" style={{ marginTop: 20, padding: "clamp(22px, 4vw, 32px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div style={{ minWidth: 0, flex: "1 1 360px" }}>
                  <span className="sq-badge">COMPETITION DETAILS</span>
                  <h2 style={{ margin: "14px 0 8px", fontSize: "clamp(23px, 4vw, 32px)", fontWeight: 900, overflowWrap: "anywhere" }}>
                    {preview.title}
                  </h2>
                  <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
                    One attempt • 10 questions • 30 seconds per question • Maximum 1,000 Arena XP
                  </p>
                </div>
                <span
                  className="sq-badge"
                  style={{
                    background: registrationClosed ? "#fff7ed" : "#ecfdf5",
                    color: registrationClosed ? "#9a3412" : "#047857",
                    whiteSpace: "nowrap",
                  }}
                >
                  {registrationClosed ? "Registration closed" : "Registration open"}
                </span>
              </div>

              <div className="join-info-grid" style={{ marginTop: 26 }}>
                <InfoItem label="Competition starts" value={formatDate(preview.startsAt)} />
                <InfoItem label="Competition ends" value={formatDate(preview.endsAt)} />
                <InfoItem label="Registration closes" value={formatDate(preview.registrationClosesAt)} />
              </div>
            </section>

            <section className="sq-card" style={{ marginTop: 20, padding: "clamp(22px, 4vw, 32px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <span className="sq-badge">CHOOSE YOUR SIDE</span>
                  <h2 style={{ margin: "12px 0 6px", fontSize: 24, fontWeight: 900 }}>Select one team</h2>
                  <p style={{ margin: 0, color: "var(--muted)" }}>Your team selection is recorded when you join.</p>
                </div>
              </div>

              <div className="join-team-grid" style={{ marginTop: 22 }}>
                {preview.teams.map((team) => {
                  const active = selectedTeam === team.slot;
                  return (
                    <button
                      key={team.slot}
                      type="button"
                      disabled={registrationClosed || preview.alreadyJoined}
                      onClick={() => setSelectedTeam(team.slot)}
                      aria-pressed={active}
                      style={{
                        textAlign: "left",
                        padding: 22,
                        borderRadius: 18,
                        border: active ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: active ? "var(--primary-light)" : "#fff",
                        color: "var(--foreground)",
                        cursor: registrationClosed || preview.alreadyJoined ? "not-allowed" : "pointer",
                        opacity: registrationClosed || preview.alreadyJoined ? 0.75 : 1,
                        minHeight: 132,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 12, fontWeight: 850, color: "var(--muted)", letterSpacing: ".06em" }}>
                          TEAM {team.slot}
                        </span>
                        <span style={{ fontSize: 20 }}>{active ? "✓" : "⚑"}</span>
                      </div>
                      <div style={{ marginTop: 12, fontSize: 22, fontWeight: 900, overflowWrap: "anywhere" }}>{team.name}</div>
                      <div style={{ marginTop: 7, fontSize: 13, color: "var(--muted)" }}>
                        {team.participantCount} {team.participantCount === 1 ? "participant" : "participants"} joined
                      </div>
                    </button>
                  );
                })}
              </div>

              {preview.alreadyJoined && (
                <div style={{ ...noticeStyle, marginTop: 20 }}>
                  You have already joined{preview.joinedTeamName ? ` ${preview.joinedTeamName}` : " this competition"}.
                  You cannot register for the other team.
                </div>
              )}

              {registrationClosed && !preview.alreadyJoined && (
                <div style={{ ...noticeStyle, marginTop: 20 }}>
                  Registration is closed for this competition. You can still view the competition if you are already a participant.
                </div>
              )}

              {error && <div role="alert" style={{ ...alertStyle, marginTop: 18 }}>{error}</div>}
              {notice && !preview.alreadyJoined && <div style={{ ...noticeStyle, marginTop: 18 }}>{notice}</div>}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
                {preview.alreadyJoined ? (
                  <Link href={`/quest-arena/competition/${preview.id}`} className="sq-button-primary">
                    Open competition
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="sq-button-primary"
                    disabled={joining || registrationClosed || !selectedTeam}
                    onClick={() => void joinCompetition()}
                    style={{ opacity: joining || registrationClosed || !selectedTeam ? 0.6 : 1 }}
                  >
                    {joining ? "Joining team..." : "Confirm and join team"}
                  </button>
                )}
                <Link href="/quest-arena" className="sq-button-secondary">Return to Quest Arena</Link>
              </div>
            </section>
          </>
        )}
      </div>

      <style jsx>{`
        .join-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }
        .join-team-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }
        @media (max-width: 700px) {
          .join-info-grid { grid-template-columns: 1fr; }
          .join-team-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 16, borderRadius: 14, border: "1px solid var(--border)", background: "#fff", minWidth: 0 }}>
      <div style={{ color: "var(--muted)", fontSize: 12, fontWeight: 750, marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.5, overflowWrap: "anywhere" }}>{value}</div>
    </div>
  );
}

const alertStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  background: "#fef2f2",
  border: "1px solid #fecaca",
  color: "#991b1b",
  lineHeight: 1.6,
};

const noticeStyle: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1e40af",
  lineHeight: 1.6,
};

export default function QuestArenaJoinPage() {
  return (
    <Suspense
      fallback={
        <main className="sq-page" style={{ minHeight: "100vh", padding: 32 }}>
          <div className="sq-container" style={{ maxWidth: 1040 }}>
            <AppNavbar />
            <section className="sq-card" style={{ marginTop: 24, padding: 30, textAlign: "center" }}>
              Loading invitation...
            </section>
          </div>
        </main>
      }
    >
      <JoinCompetitionContent />
    </Suspense>
  );
}
