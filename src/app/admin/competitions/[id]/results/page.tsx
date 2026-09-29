"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type ResultRow = {
  rank: number;
  user_id: string;
  display_name: string;
  username: string;
  whatsapp_number: string | null;
  whatsapp_consent: boolean;
  total_xp: number;
  correct_answers: number;
  total_questions: number;
  total_answer_time_ms: number;
  completed_at: string;
  winner_position: number | null;
};

type Competition = {
  id: string;
  title: string;
  sponsor_name: string;
  starts_at: string;
  ends_at: string;
  is_published: boolean;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${minutes}m ${remaining}s`;
}

function whatsappUrl(number: string) {
  const cleaned = number.replace(/[^\d+]/g, "");
  const normalized = cleaned.startsWith("+")
    ? cleaned.slice(1)
    : cleaned;

  return `https://wa.me/${normalized}`;
}

export default function SponsoredResultsPage() {
  const params = useParams<{ id: string }>();
  const competitionId = params.id;

  const [competition, setCompetition] =
    useState<Competition | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadResults() {
    setLoading(true);
    setMessage("");

    const [competitionResult, resultsResult] =
      await Promise.all([
        supabase
          .from("sponsored_competitions")
          .select(
            "id,title,sponsor_name,starts_at,ends_at,is_published"
          )
          .eq("id", competitionId)
          .maybeSingle(),

        supabase.rpc(
          "get_sponsored_admin_results",
          {
            p_competition_id: competitionId,
          }
        ),
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

    if (resultsResult.error) {
      setMessage(resultsResult.error.message);
      setLoading(false);
      return;
    }

    setCompetition(competitionResult.data as Competition);
    setResults((resultsResult.data ?? []) as ResultRow[]);
    setLoading(false);
  }

  useEffect(() => {
    loadResults();
  }, [competitionId]);

  const filteredResults = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return results;

    return results.filter((row) =>
      [
        row.display_name,
        row.username,
        row.whatsapp_number ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [results, search]);

  async function generateWinners() {
    if (!competition) return;

    const confirmed = window.confirm(
      "Generate the top 3 winners using Sponsored XP, correct answers, total answer time and completion time as the tie-break order?"
    );

    if (!confirmed) return;

    setGenerating(true);
    setMessage("");

    const { data, error } = await supabase.rpc(
      "generate_sponsored_winners",
      {
        p_competition_id: competitionId,
      }
    );

    if (error) {
      setMessage(error.message);
      setGenerating(false);
      return;
    }

    setMessage(
      `${Number(data ?? 0)} winner record(s) generated successfully.`
    );

    await loadResults();
    setGenerating(false);
  }

  const winners = results.filter(
    (row) => row.winner_position !== null
  );

  const completedCount = results.length;

  return (
    <main>
      <div style={{ marginBottom: 22 }}>
        <Link
          href={`/admin/competitions/${competitionId}`}
          style={{
            textDecoration: "none",
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ← Back to Competition
        </Link>

        {competition && (
          <div style={{ marginTop: 14 }}>
            <span className="sq-badge">Results & Winners</span>

            <h1
              className="sq-title"
              style={{ marginTop: 10, marginBottom: 6 }}
            >
              {competition.title}
            </h1>

            <p className="sq-subtitle" style={{ margin: 0 }}>
              Sponsored by{" "}
              <strong>{competition.sponsor_name}</strong>
            </p>
          </div>
        )}
      </div>

      {message && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 18,
          }}
        >
          <strong>Notice</strong>
          <p
            className="sq-subtitle"
            style={{ marginBottom: 0 }}
          >
            {message}
          </p>
        </div>
      )}

      <section
        className="stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4,minmax(0,1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        {[
          ["Completed", completedCount, "🏁"],
          ["Winners", winners.length, "🏆"],
          [
            "Highest XP",
            results[0]?.total_xp ?? 0,
            "⭐",
          ],
          [
            "Top Correct",
            results[0]?.correct_answers ?? 0,
            "✓",
          ],
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
                color: "var(--muted)",
                fontSize: 11,
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
        className="sq-card"
        style={{
          padding: 20,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              Winner Generation
            </h2>

            <p className="sq-subtitle" style={{ marginBottom: 0 }}>
              The top three are determined automatically using the
              competition's fixed ranking rules.
            </p>
          </div>

          <button
            type="button"
            className="sq-button-primary"
            onClick={generateWinners}
            disabled={generating || results.length === 0}
            style={{
              border: 0,
              cursor:
                generating || results.length === 0
                  ? "not-allowed"
                  : "pointer",
              opacity:
                generating || results.length === 0
                  ? 0.6
                  : 1,
            }}
          >
            {generating
              ? "Generating..."
              : "Generate Top 3 Winners"}
          </button>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 10,
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "var(--muted)",
            fontSize: 12,
          }}
        >
          Ranking order: <strong>Sponsored XP</strong> →{" "}
          <strong>correct answers</strong> →{" "}
          <strong>lower total answer time</strong> →{" "}
          <strong>earlier completion time</strong>.
        </div>
      </section>

      <section
        className="sq-card"
        style={{
          padding: 16,
          marginBottom: 20,
        }}
      >
        <input
          value={search}
          onChange={(event) =>
            setSearch(event.target.value)
          }
          placeholder="Search player name, username or WhatsApp number..."
          style={{
            width: "100%",
            padding: "12px 13px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--background)",
            color: "inherit",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </section>

      <section
        className="sq-card"
        style={{ overflow: "hidden" }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2 style={{ margin: 0 }}>
            Completed Participants
          </h2>

          <p className="sq-subtitle" style={{ marginBottom: 0 }}>
            Admin-only results. WhatsApp details are not exposed on
            the public leaderboard.
          </p>
        </div>

        {loading ? (
          <div
            style={{
              padding: 60,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 38 }}>⏳</div>
            <h3>Loading results...</h3>
          </div>
        ) : filteredResults.length === 0 ? (
          <div
            style={{
              padding: 55,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 44 }}>🏁</div>
            <h3>
              {results.length === 0
                ? "No completed participants yet"
                : "No results match your search"}
            </h3>
            <p className="sq-subtitle">
              Completed competition attempts will appear here.
            </p>
          </div>
        ) : (
          <div>
            {filteredResults.map((row) => {
              const isWinner =
                row.winner_position !== null;

              return (
                <article
                  key={row.user_id}
                  style={{
                    padding: "20px 24px",
                    borderBottom:
                      "1px solid var(--border)",
                  }}
                >
                  <div
                    className="result-row"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "auto 1fr auto",
                      gap: 16,
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                          isWinner
                            ? "var(--primary-light)"
                            : "var(--background)",
                        border:
                          "1px solid var(--border)",
                        fontWeight: 900,
                      }}
                    >
                      {isWinner
                        ? row.winner_position === 1
                          ? "🥇"
                          : row.winner_position === 2
                          ? "🥈"
                          : "🥉"
                        : `#${row.rank}`}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          flexWrap: "wrap",
                        }}
                      >
                        <strong
                          style={{ fontSize: 16 }}
                        >
                          {row.display_name}
                        </strong>

                        {row.username && (
                          <span
                            style={{
                              color: "var(--muted)",
                              fontSize: 12,
                            }}
                          >
                            @{row.username}
                          </span>
                        )}

                        {isWinner && (
                          <span
                            style={{
                              padding: "5px 8px",
                              borderRadius: 999,
                              background:
                                "var(--primary-light)",
                              color:
                                "var(--primary)",
                              fontSize: 10,
                              fontWeight: 900,
                              textTransform:
                                "uppercase",
                            }}
                          >
                            Winner #{row.winner_position}
                          </span>
                        )}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 16,
                          flexWrap: "wrap",
                          marginTop: 8,
                          color: "var(--muted)",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        <span>
                          ⭐ {row.total_xp} XP
                        </span>

                        <span>
                          ✓ {row.correct_answers}/
                          {row.total_questions}
                        </span>

                        <span>
                          ⏱{" "}
                          {formatDuration(
                            row.total_answer_time_ms
                          )}
                        </span>

                        <span>
                          🕒{" "}
                          {formatDate(
                            row.completed_at
                          )}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        minWidth: 180,
                        textAlign: "right",
                      }}
                    >
                      {row.whatsapp_consent &&
                      row.whatsapp_number ? (
                        <div>
                          <div
                            style={{
                              fontSize: 12,
                              fontWeight: 800,
                            }}
                          >
                            {row.whatsapp_number}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              justifyContent:
                                "flex-end",
                              gap: 8,
                              marginTop: 7,
                            }}
                          >
                            <button
                              type="button"
                              className="sq-button-secondary"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(
                                    row.whatsapp_number!
                                  );
                                  setMessage(
                                    "WhatsApp number copied."
                                  );
                                } catch {
                                  setMessage(
                                    "Unable to copy the WhatsApp number."
                                  );
                                }
                              }}
                              style={{
                                border:
                                  "1px solid var(--border)",
                                cursor:
                                  "pointer",
                                fontSize: 11,
                              }}
                            >
                              Copy
                            </button>

                            <a
                              href={whatsappUrl(
                                row.whatsapp_number
                              )}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="sq-button-primary"
                              style={{
                                textDecoration:
                                  "none",
                                fontSize: 11,
                              }}
                            >
                              Contact
                            </a>
                          </div>
                        </div>
                      ) : (
                        <span
                          style={{
                            color: "var(--muted)",
                            fontSize: 11,
                          }}
                        >
                          No WhatsApp consent/contact
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <style jsx>{`
        @media (max-width: 850px) {
          .stats-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .result-row {
            grid-template-columns: auto 1fr !important;
          }

          .result-row > :last-child {
            grid-column: 1 / -1;
            text-align: left !important;
            padding-left: 62px;
          }

          .result-row > :last-child > div {
            justify-content: flex-start !important;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr !important;
          }

          .result-row {
            grid-template-columns: 1fr !important;
          }

          .result-row > :last-child {
            padding-left: 0;
          }
        }
      `}</style>
    </main>
  );
}
