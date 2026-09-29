"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Competition = {
  id: string;
  sponsor_name: string;
  sponsor_description: string | null;
  sponsor_banner_url: string | null;
  sponsor_logo_url: string | null;
  title: string;
  description: string | null;
  rules: string | null;
  prizes: string | null;
  competition_type: "weekly" | "monthly";
  starts_at: string;
  ends_at: string;
  is_published: boolean;
  display_order: number;
  created_at: string;
};

function getStatus(c: Competition) {
  if (!c.is_published) return "Draft";

  const now = Date.now();
  const start = new Date(c.starts_at).getTime();
  const end = new Date(c.ends_at).getTime();

  if (now < start) return "Upcoming";
  if (now < end) return "Live";
  return "Ended";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function CompetitionManagementPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [competition, setCompetition] =
    useState<Competition | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [announcementCount, setAnnouncementCount] =
    useState(0);
  const [participantCount, setParticipantCount] =
    useState(0);
  const [completedCount, setCompletedCount] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadCompetition() {
    setLoading(true);
    setMessage("");

    const id = params.id;

    const [
      competitionResult,
      questionsResult,
      announcementsResult,
      attemptsResult,
    ] = await Promise.all([
      supabase
        .from("sponsored_competitions")
        .select(
          "id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published,display_order,created_at"
        )
        .eq("id", id)
        .maybeSingle(),

      supabase
        .from("sponsored_questions")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", id),

      supabase
        .from("sponsored_announcements")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", id),

      supabase
        .from("sponsored_attempts")
        .select("id,user_id,status")
        .eq("competition_id", id),
    ]);

    if (competitionResult.error) {
      setMessage(competitionResult.error.message);
      setLoading(false);
      return;
    }

    if (!competitionResult.data) {
      setMessage("Competition not found.");
      setLoading(false);
      return;
    }

    setCompetition(
      competitionResult.data as Competition
    );
    setQuestionCount(questionsResult.count ?? 0);
    setAnnouncementCount(
      announcementsResult.count ?? 0
    );

    const attempts = attemptsResult.data ?? [];
    setParticipantCount(
      new Set(attempts.map((row) => row.user_id)).size
    );
    setCompletedCount(
      attempts.filter(
        (row) => row.status === "completed"
      ).length
    );

    setLoading(false);
  }

  useEffect(() => {
    loadCompetition();
  }, [params.id]);

  async function togglePublished() {
    if (!competition) return;

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase
      .from("sponsored_competitions")
      .update({
        is_published: !competition.is_published,
      })
      .eq("id", competition.id)
      .select(
        "id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published,display_order,created_at"
      )
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      setCompetition(data as Competition);
    }

    setBusy(false);
  }

  async function deleteCompetition() {
    if (!competition) return;

    const confirmed = window.confirm(
      "Delete this competition? This will also remove its related questions, announcements and competition records according to the database relationships. This action cannot be undone."
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    const { error } = await supabase
      .from("sponsored_competitions")
      .delete()
      .eq("id", competition.id);

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    router.replace("/admin/competitions");
  }

  if (loading) {
    return (
      <main style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 38 }}>⏳</div>
        <h3>Loading competition...</h3>
      </main>
    );
  }

  if (!competition) {
    return (
      <main>
        <Link
          href="/admin/competitions"
          style={{
            textDecoration: "none",
            color: "var(--muted)",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          ← Back to Competitions
        </Link>

        <div
          className="sq-card"
          style={{
            padding: 30,
            marginTop: 20,
          }}
        >
          <h2>Competition not found</h2>
          <p className="sq-subtitle">{message}</p>
        </div>
      </main>
    );
  }

  const status = getStatus(competition);

  return (
    <main>
      <div style={{ marginBottom: 22 }}>
        <Link
          href="/admin/competitions"
          style={{
            textDecoration: "none",
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ← Back to Competitions
        </Link>
      </div>

      {message && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 20,
          }}
        >
          <strong>Notice</strong>
          <p className="sq-subtitle">{message}</p>
        </div>
      )}

      <section
        className="sq-card"
        style={{
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 500px" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span className="sq-badge">
                {competition.competition_type}
              </span>

              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {status}
              </span>
            </div>

            <h1
              className="sq-title"
              style={{ marginTop: 14, marginBottom: 8 }}
            >
              {competition.title}
            </h1>

            <p className="sq-subtitle" style={{ margin: 0 }}>
              Sponsored by{" "}
              <strong>{competition.sponsor_name}</strong>
            </p>

            <p
              style={{
                marginTop: 8,
                color: "var(--muted)",
                fontSize: 12,
              }}
            >
              {formatDate(competition.starts_at)} →{" "}
              {formatDate(competition.ends_at)}
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="sq-button-secondary"
              onClick={togglePublished}
              disabled={busy}
              style={{
                border: "1px solid var(--border)",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {competition.is_published
                ? "Unpublish"
                : "Publish"}
            </button>

            <button
              type="button"
              className="sq-button-secondary"
              onClick={deleteCompetition}
              disabled={busy}
              style={{
                border: "1px solid var(--border)",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4,minmax(0,1fr))",
          gap: 14,
          marginBottom: 20,
        }}
        className="stats-grid"
      >
        {[
          ["Questions", questionCount, "❓"],
          ["Announcements", announcementCount, "📢"],
          ["Participants", participantCount, "👥"],
          ["Completed", completedCount, "🏁"],
        ].map(([label, value, icon]) => (
          <div
            className="sq-card"
            key={String(label)}
            style={{ padding: 20 }}
          >
            <div style={{ fontSize: 23 }}>{icon}</div>
            <div
              style={{
                marginTop: 9,
                fontSize: 27,
                fontWeight: 900,
              }}
            >
              {value}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                color: "var(--muted)",
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
          gap: 16,
          marginBottom: 20,
        }}
        className="management-grid"
      >
        <Link
          href={`/admin/competitions/${competition.id}/questions`}
          className="sq-card"
          style={{
            padding: 24,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 32 }}>❓</div>
          <h2 style={{ marginBottom: 6 }}>
            Questions
          </h2>
          <p className="sq-subtitle">
            Add and manage the manually authored competition
            questions, correct answers, time limits and XP.
          </p>
          <strong>
            Manage Questions →
          </strong>
        </Link>

        <Link
          href={`/admin/competitions/${competition.id}/announcements`}
          className="sq-card"
          style={{
            padding: 24,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 32 }}>📢</div>
          <h2 style={{ marginBottom: 6 }}>
            Announcements
          </h2>
          <p className="sq-subtitle">
            Prepare announcements and publish them at the
            appropriate time.
          </p>
          <strong>
            Manage Announcements →
          </strong>
        </Link>

        <Link
          href={`/admin/competitions/${competition.id}/results`}
          className="sq-card"
          style={{
            padding: 24,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 32 }}>🏆</div>
          <h2 style={{ marginBottom: 6 }}>
            Results & Winners
          </h2>
          <p className="sq-subtitle">
            Review completed attempts, leaderboard results and
            generate the top three winners.
          </p>
          <strong>
            View Results →
          </strong>
        </Link>

        <div
          className="sq-card"
          style={{
            padding: 24,
          }}
        >
          <div style={{ fontSize: 32 }}>🎨</div>
          <h2 style={{ marginBottom: 6 }}>
            Sponsor Branding
          </h2>

          <p className="sq-subtitle">
            Preview the sponsor branding currently attached to
            this competition.
          </p>

          {competition.sponsor_logo_url && (
            <img
              src={competition.sponsor_logo_url}
              alt="Sponsor logo"
              style={{
                width: 70,
                height: 70,
                objectFit: "contain",
                borderRadius: 8,
                border: "1px solid var(--border)",
                marginBottom: 10,
              }}
            />
          )}

          {competition.sponsor_banner_url && (
            <img
              src={competition.sponsor_banner_url}
              alt="Sponsor banner"
              style={{
                width: "100%",
                maxHeight: 150,
                objectFit: "cover",
                borderRadius: 10,
                border: "1px solid var(--border)",
              }}
            />
          )}
        </div>
      </section>

      <section
        className="sq-card"
        style={{ padding: 24 }}
      >
        <h2 style={{ marginTop: 0 }}>
          Competition Information
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2,minmax(0,1fr))",
            gap: 20,
          }}
          className="info-grid"
        >
          <div>
            <strong>Sponsor</strong>
            <p className="sq-subtitle">
              {competition.sponsor_name}
            </p>
          </div>

          <div>
            <strong>Type</strong>
            <p className="sq-subtitle">
              {competition.competition_type}
            </p>
          </div>

          <div>
            <strong>Description</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.description || "No description added."}
            </p>
          </div>

          <div>
            <strong>Sponsor Description</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.sponsor_description ||
                "No sponsor description added."}
            </p>
          </div>

          <div>
            <strong>Rules</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.rules || "No rules added."}
            </p>
          </div>

          <div>
            <strong>Prizes</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.prizes || "No prizes added."}
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 800px) {
          .stats-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .management-grid {
            grid-template-columns: 1fr !important;
          }

          .info-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
