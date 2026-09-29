"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Competition = {
  id: string;
  sponsor_name: string;
  title: string;
  competition_type: "weekly" | "monthly";
  starts_at: string;
  ends_at: string;
  is_published: boolean;
  display_order: number;
  created_at: string;
};

type Attempt = {
  id: string;
  competition_id: string;
  user_id: string;
  status: "in_progress" | "completed" | "expired";
};

type Filter =
  | "all"
  | "draft"
  | "upcoming"
  | "live"
  | "ended";

function getStatus(
  competition: Competition
): "draft" | "upcoming" | "live" | "ended" {
  if (!competition.is_published) return "draft";

  const now = Date.now();
  const start = new Date(competition.starts_at).getTime();
  const end = new Date(competition.ends_at).getTime();

  if (now < start) return "upcoming";
  if (now < end) return "live";
  return "ended";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function AdminCompetitionsPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");

  async function loadCompetitions() {
    setLoading(true);
    setErrorMessage("");

    const [competitionResult, attemptResult] = await Promise.all([
      supabase
        .from("sponsored_competitions")
        .select(
          "id,sponsor_name,title,competition_type,starts_at,ends_at,is_published,display_order,created_at"
        )
        .order("created_at", { ascending: false }),

      supabase
        .from("sponsored_attempts")
        .select("id,competition_id,user_id,status"),
    ]);

    if (competitionResult.error) {
      console.error(competitionResult.error);
      setErrorMessage(competitionResult.error.message);
      setLoading(false);
      return;
    }

    if (attemptResult.error) {
      console.error(attemptResult.error);
      setErrorMessage(attemptResult.error.message);
      setLoading(false);
      return;
    }

    setCompetitions((competitionResult.data ?? []) as Competition[]);
    setAttempts((attemptResult.data ?? []) as Attempt[]);
    setLoading(false);
  }

  useEffect(() => {
    loadCompetitions();
  }, []);

  const filteredCompetitions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return competitions.filter((competition) => {
      const status = getStatus(competition);

      const matchesFilter =
        filter === "all" ||
        status === filter;

      const matchesSearch =
        !term ||
        competition.title.toLowerCase().includes(term) ||
        competition.sponsor_name.toLowerCase().includes(term);

      return matchesFilter && matchesSearch;
    });
  }, [competitions, filter, search]);

  function getStats(competitionId: string) {
    const rows = attempts.filter(
      (attempt) => attempt.competition_id === competitionId
    );

    return {
      participants: new Set(rows.map((row) => row.user_id)).size,
      completed: rows.filter((row) => row.status === "completed").length,
      active: rows.filter((row) => row.status === "in_progress").length,
    };
  }

  const filterItems: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "draft", label: "Draft" },
    { value: "upcoming", label: "Upcoming" },
    { value: "live", label: "Live" },
    { value: "ended", label: "Ended" },
  ];

  return (
    <main>
      <section
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 24,
        }}
      >
        <div>
          <span className="sq-badge">Sponsored Post</span>
          <h1
            className="sq-title"
            style={{ marginTop: 14, marginBottom: 8 }}
          >
            Competitions
          </h1>
          <p className="sq-subtitle" style={{ margin: 0 }}>
            Create, publish and manage sponsored competitions.
          </p>
        </div>

        <Link
          href="/admin/competitions/new"
          className="sq-button-primary"
        >
          + Create Competition
        </Link>
      </section>

      {errorMessage && (
        <div
          className="sq-card"
          style={{
            padding: 18,
            marginBottom: 20,
          }}
        >
          <strong>Unable to load competitions</strong>
          <p className="sq-subtitle">{errorMessage}</p>
          <button
            type="button"
            className="sq-button-primary"
            style={{ border: 0, cursor: "pointer" }}
            onClick={loadCompetitions}
          >
            Try Again
          </button>
        </div>
      )}

      <section
        className="sq-card"
        style={{
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search title or sponsor..."
            style={{
              flex: "1 1 260px",
              minWidth: 220,
              padding: "11px 13px",
              border: "1px solid var(--border)",
              borderRadius: 10,
              background: "var(--background)",
              color: "inherit",
              outline: "none",
            }}
          />

          <div
            style={{
              display: "flex",
              gap: 6,
              overflowX: "auto",
              maxWidth: "100%",
            }}
          >
            {filterItems.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                style={{
                  border:
                    filter === item.value
                      ? "1px solid var(--primary)"
                      : "1px solid var(--border)",
                  background:
                    filter === item.value
                      ? "var(--primary-light)"
                      : "transparent",
                  color:
                    filter === item.value
                      ? "var(--primary)"
                      : "var(--muted)",
                  borderRadius: 999,
                  padding: "9px 13px",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="sq-card" style={{ overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 38 }}>⏳</div>
            <h3>Loading competitions...</h3>
          </div>
        ) : filteredCompetitions.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🏆</div>
            <h3>
              {competitions.length === 0
                ? "No competitions yet"
                : "No competitions match your search"}
            </h3>
            <p className="sq-subtitle">
              {competitions.length === 0
                ? "Create your first sponsored competition."
                : "Try another search or filter."}
            </p>

            {competitions.length === 0 && (
              <Link
                href="/admin/competitions/new"
                className="sq-button-primary"
                style={{
                  display: "inline-block",
                  marginTop: 10,
                }}
              >
                Create Competition
              </Link>
            )}
          </div>
        ) : (
          <div>
            {filteredCompetitions.map((competition) => {
              const status = getStatus(competition);
              const stats = getStats(competition.id);

              return (
                <div
                  key={competition.id}
                  style={{
                    padding: "20px 24px",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 18,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 420px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <h3
                          style={{
                            margin: 0,
                            fontSize: 18,
                          }}
                        >
                          {competition.title}
                        </h3>

                        <span
                          style={{
                            padding: "5px 9px",
                            borderRadius: 999,
                            border: "1px solid var(--border)",
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: "uppercase",
                          }}
                        >
                          {status}
                        </span>
                      </div>

                      <p
                        style={{
                          margin: "7px 0 0",
                          color: "var(--muted)",
                          fontSize: 13,
                        }}
                      >
                        Sponsor:{" "}
                        <strong>{competition.sponsor_name}</strong>
                      </p>

                      <p
                        style={{
                          margin: "5px 0 0",
                          color: "var(--muted)",
                          fontSize: 12,
                        }}
                      >
                        {competition.competition_type} •{" "}
                        {formatDate(competition.starts_at)} →{" "}
                        {formatDate(competition.ends_at)}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: 18,
                          flexWrap: "wrap",
                          marginTop: 14,
                          fontSize: 12,
                        }}
                      >
                        <span>
                          <strong>{stats.participants}</strong>{" "}
                          participants
                        </span>
                        <span>
                          <strong>{stats.completed}</strong>{" "}
                          completed
                        </span>
                        <span>
                          <strong>{stats.active}</strong>{" "}
                          in progress
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Link
                        href={`/admin/competitions/${competition.id}`}
                        className="sq-button-secondary"
                      >
                        Manage
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
