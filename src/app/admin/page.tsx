"use client";

import { useEffect, useState } from "react";
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
};

function statusOf(c: Competition): "upcoming" | "live" | "ended" {
  const now = Date.now();
  const start = new Date(c.starts_at).getTime();
  const end = new Date(c.ends_at).getTime();
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

export default function AdminDashboardPage() {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadDashboard() {
    setLoading(true);
    setMessage("");

    const { data, error } = await supabase
      .from("sponsored_competitions")
      .select("id,sponsor_name,title,competition_type,starts_at,ends_at,is_published,display_order")
      .order("display_order", { ascending: true })
      .order("starts_at", { ascending: false });

    if (error) {
      setMessage(error.message);
    } else {
      setCompetitions((data ?? []) as Competition[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const counts = {
    total: competitions.length,
    published: competitions.filter(c => c.is_published).length,
    upcoming: competitions.filter(c => statusOf(c) === "upcoming").length,
    live: competitions.filter(c => statusOf(c) === "live").length,
    ended: competitions.filter(c => statusOf(c) === "ended").length,
  };

  return (
    <main>
      <section style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 28 }}>
        <div>
          <span className="sq-badge">Administration</span>
          <h1 className="sq-title" style={{ marginTop: 14, marginBottom: 8 }}>Admin Dashboard</h1>
          <p className="sq-subtitle" style={{ margin: 0 }}>
            Manage sponsored competitions, questions, announcements and results.
          </p>
        </div>
        <Link href="/admin/competitions/new" className="sq-button-primary">
          + Create Competition
        </Link>
      </section>

      {message && (
        <div className="sq-card" style={{ padding: 18, marginBottom: 24 }}>
          <strong>Unable to load dashboard</strong>
          <p className="sq-subtitle">{message}</p>
          <button type="button" className="sq-button-primary" style={{ border: 0, cursor: "pointer" }} onClick={loadDashboard}>
            Try Again
          </button>
        </div>
      )}

      <section className="admin-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(0,1fr))", gap: 14, marginBottom: 30 }}>
        {[
          ["Total", counts.total, "📊"],
          ["Published", counts.published, "🌐"],
          ["Upcoming", counts.upcoming, "⏳"],
          ["Live", counts.live, "🟢"],
          ["Ended", counts.ended, "🏁"],
        ].map(([label, value, icon]) => (
          <div className="sq-card" key={String(label)} style={{ padding: 20 }}>
            <div style={{ fontSize: 24 }}>{icon}</div>
            <div style={{ marginTop: 12, fontSize: 30, fontWeight: 900 }}>{value}</div>
            <div style={{ marginTop: 4, color: "var(--muted)", fontSize: 12, fontWeight: 800, textTransform: "uppercase" }}>
              {label}
            </div>
          </div>
        ))}
      </section>

      <section className="sq-card" style={{ overflow: "hidden" }}>
        <div style={{ padding: "22px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0 }}>Sponsored Competitions</h2>
            <p className="sq-subtitle" style={{ marginBottom: 0 }}>Create and manage competitions from one place.</p>
          </div>
          <Link href="/admin/competitions" className="sq-button-secondary">View All</Link>
        </div>

        {loading ? (
          <div style={{ padding: 50, textAlign: "center" }}>⏳<h3>Loading competitions...</h3></div>
        ) : competitions.length === 0 ? (
          <div style={{ padding: 55, textAlign: "center" }}>
            <div style={{ fontSize: 44 }}>🏆</div>
            <h3>No competitions yet</h3>
            <p className="sq-subtitle">Create your first sponsored competition to get started.</p>
            <Link href="/admin/competitions/new" className="sq-button-primary" style={{ display: "inline-block", marginTop: 12 }}>
              Create First Competition
            </Link>
          </div>
        ) : (
          competitions.slice(0, 8).map(c => {
            const status = statusOf(c);
            return (
              <Link
                key={c.id}
                href={`/admin/competitions/${c.id}`}
                style={{ display: "block", textDecoration: "none", color: "inherit", padding: "20px 24px", borderBottom: "1px solid var(--border)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 17 }}>{c.title}</strong>
                      <span style={{ padding: "5px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900, textTransform: "uppercase", border: "1px solid var(--border)" }}>
                        {status}
                      </span>
                      {!c.is_published && (
                        <span style={{ padding: "5px 8px", borderRadius: 999, fontSize: 10, fontWeight: 900, border: "1px solid var(--border)" }}>
                          Draft
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 7, color: "var(--muted)", fontSize: 13 }}>
                      Sponsor: <strong>{c.sponsor_name}</strong>
                    </div>
                    <div style={{ marginTop: 5, color: "var(--muted)", fontSize: 12 }}>
                      {c.competition_type} • Starts {formatDate(c.starts_at)}
                    </div>
                  </div>
                  <div style={{ fontSize: 22, color: "var(--muted)" }}>→</div>
                </div>
              </Link>
            );
          })
        )}
      </section>

      <style jsx>{`
        @media (max-width: 900px) {
          .admin-stats-grid { grid-template-columns: repeat(2,minmax(0,1fr)) !important; }
        }
        @media (max-width: 520px) {
          .admin-stats-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
