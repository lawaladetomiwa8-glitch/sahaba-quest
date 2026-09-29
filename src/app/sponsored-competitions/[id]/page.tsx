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
};

type Announcement = {
  id: string;
  title: string;
  content: string;
  publish_at: string;
};

function statusOf(c: Competition) {
  if (!c.is_published) return "draft";
  const now = Date.now();
  if (now < new Date(c.starts_at).getTime()) return "upcoming";
  if (now < new Date(c.ends_at).getTime()) return "live";
  return "ended";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SponsoredCompetitionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [accountType, setAccountType] = useState<"free" | "individual" | "family">("free");
  const [hasPremium, setHasPremium] = useState(false);
  const [contact, setContact] = useState<{ whatsapp_number: string; whatsapp_consent: boolean } | null>(null);
  const [whatsapp, setWhatsapp] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingContact, setSavingContact] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        router.replace("/login");
        return;
      }

      const [competitionResult, announcementResult, profileResult, subscriptionResult, contactResult] = await Promise.all([
        supabase.from("sponsored_competitions")
          .select("id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published")
          .eq("id", id)
          .maybeSingle(),
        supabase.from("sponsored_announcements")
          .select("id,title,content,publish_at")
          .eq("competition_id", id)
          .eq("is_published", true)
          .lte("publish_at", new Date().toISOString())
          .order("display_order", { ascending: true })
          .order("publish_at", { ascending: true }),
        supabase.from("profiles").select("account_type").eq("id", auth.user.id).maybeSingle(),
        supabase.from("subscriptions")
          .select("id,current_period_end,status,subscription_plans!inner(plan_type)")
          .eq("user_id", auth.user.id)
          .eq("status", "active")
          .eq("subscription_plans.plan_type", "plus")
          .gt("current_period_end", new Date().toISOString())
          .limit(1)
          .maybeSingle(),
        supabase.from("sponsored_player_contacts")
          .select("whatsapp_number,whatsapp_consent")
          .eq("user_id", auth.user.id)
          .maybeSingle(),
      ]);

      if (!mounted) return;

      if (competitionResult.error || !competitionResult.data) {
        setMessage(competitionResult.error?.message || "Competition not found.");
        setLoading(false);
        return;
      }

      const type = (profileResult.data?.account_type || "free") as "free" | "individual" | "family";
      if (type === "family") {
        router.replace("/family-dashboard");
        return;
      }

      setCompetition(competitionResult.data as Competition);
      setAnnouncements((announcementResult.data ?? []) as Announcement[]);
      setAccountType(type);
      setHasPremium(Boolean(subscriptionResult.data));
      setContact((contactResult.data ?? null) as any);
      setLoading(false);
    }

    void load();
    return () => { mounted = false; };
  }, [id, router]);

  async function saveContactAndStart() {
    setMessage("");

    const value = whatsapp.trim();
    if (value.length < 7) {
      setMessage("Please enter a valid WhatsApp number.");
      return;
    }

    if (!consent) {
      setMessage("Please confirm the WhatsApp consent before continuing.");
      return;
    }

    setSavingContact(true);

    try {
      const { data, error } = await supabase.rpc("save_sponsored_player_contact", {
        p_whatsapp_number: value,
        p_whatsapp_consent: true,
      });

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data?.success === false) {
        setMessage(data?.message || "Unable to save your WhatsApp contact.");
        return;
      }

      const { data: startData, error: startError } = await supabase.rpc("start_sponsored_competition", {
        p_competition_id: id,
      });

      if (startError) {
        setMessage(startError.message);
        return;
      }

      if (!startData?.attempt_id) {
        setMessage("The competition could not be started.");
        return;
      }

      router.push(`/sponsored-competitions/${id}/play?attempt=${startData.attempt_id}`);
    } finally {
      setSavingContact(false);
    }
  }

  async function startExisting() {
    setMessage("");
    const { data, error } = await supabase.rpc("start_sponsored_competition", {
      p_competition_id: id,
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.attempt_id) {
      router.push(`/sponsored-competitions/${id}/play?attempt=${data.attempt_id}`);
    } else {
      setMessage("Unable to start the competition.");
    }
  }

  if (loading) {
    return <main style={{ padding: 60, textAlign: "center" }}>⏳<h3>Loading competition...</h3></main>;
  }

  if (!competition) {
    return <main className="sq-card" style={{ padding: 30 }}><h2>Competition not found</h2><p className="sq-subtitle">{message}</p></main>;
  }

  const status = statusOf(competition);
  const canParticipate = accountType === "individual" && hasPremium;
  const hasContact = Boolean(contact?.whatsapp_number && contact.whatsapp_consent);

  return (
    <main>
      <Link href="/sponsored-competitions" style={{ textDecoration: "none", color: "var(--muted)", fontSize: 13, fontWeight: 800 }}>
        ← Back to Sponsored Competitions
      </Link>

      <section className="sq-card" style={{ overflow: "hidden", marginTop: 18 }}>
        {competition.sponsor_banner_url && (
          <img src={competition.sponsor_banner_url} alt="" style={{ width: "100%", maxHeight: 300, objectFit: "cover", display: "block" }} />
        )}

        <div style={{ padding: 24 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            {competition.sponsor_logo_url && (
              <img src={competition.sponsor_logo_url} alt="" style={{ width: 58, height: 58, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 10 }} />
            )}
            <div>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 900 }}>SPONSORED BY</div>
              <strong>{competition.sponsor_name}</strong>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="sq-badge">{competition.competition_type}</span>
            <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid var(--border)", fontSize: 11, fontWeight: 900 }}>{status}</span>
          </div>

          <h1 className="sq-title" style={{ marginTop: 12, marginBottom: 8 }}>{competition.title}</h1>
          <p className="sq-subtitle" style={{ whiteSpace: "pre-wrap" }}>{competition.description || ""}</p>

          <div style={{ color: "var(--muted)", fontSize: 12, lineHeight: 1.8 }}>
            <div>Starts: {formatDate(competition.starts_at)}</div>
            <div>Ends: {formatDate(competition.ends_at)}</div>
          </div>
        </div>
      </section>

      {message && <section className="sq-card" style={{ padding: 16, marginTop: 18 }}><strong>Notice</strong><p className="sq-subtitle" style={{ marginBottom: 0 }}>{message}</p></section>}

      {!canParticipate && (
        <section className="sq-card" style={{ padding: 22, marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>Participation requires Individual Premium</h2>
          <p className="sq-subtitle">
            You can view the full competition, sponsor, rules and prizes. Joining the competition is available to Individual Premium accounts.
          </p>
          <Link href="/pricing" className="sq-button-primary">View Pricing</Link>
        </section>
      )}

      {canParticipate && status === "live" && (
        <section className="sq-card" style={{ padding: 22, marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>Ready to compete?</h2>
          <p className="sq-subtitle">
            You get one attempt for this competition. If you leave while your attempt is in progress, you can resume it.
          </p>

          {hasContact ? (
            <button type="button" className="sq-button-primary" onClick={startExisting} style={{ border: 0, cursor: "pointer" }}>
              Join / Resume Competition
            </button>
          ) : (
            <>
              <label style={{ display: "block", fontSize: 12, fontWeight: 800, marginBottom: 7 }}>WhatsApp Number *</label>
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="+234..."
                type="tel"
                style={{ width: "100%", maxWidth: 500, padding: "12px 13px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--background)", color: "inherit", boxSizing: "border-box" }}
              />

              <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginTop: 14, cursor: "pointer", maxWidth: 700 }}>
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  I consent to Sahaba Quest storing this WhatsApp number for sponsored competition winner/contact purposes.
                </span>
              </label>

              <button type="button" className="sq-button-primary" onClick={saveContactAndStart} disabled={savingContact} style={{ border: 0, cursor: savingContact ? "not-allowed" : "pointer", marginTop: 16, opacity: savingContact ? .7 : 1 }}>
                {savingContact ? "Saving..." : "Save & Start Competition"}
              </button>
            </>
          )}
        </section>
      )}

      {canParticipate && status === "upcoming" && (
        <section className="sq-card" style={{ padding: 22, marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>Coming Soon</h2>
          <p className="sq-subtitle">This competition is not live yet. You can return when it starts.</p>
        </section>
      )}

      {status === "ended" && (
        <section className="sq-card" style={{ padding: 22, marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>Competition Ended</h2>
          <p className="sq-subtitle">This competition is no longer accepting attempts.</p>
          <Link href="/sponsored-competitions" className="sq-button-secondary">View Competitions</Link>
        </section>
      )}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 18, marginTop: 20 }} className="info-grid">
        <div className="sq-card" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Rules</h2>
          <p className="sq-subtitle" style={{ whiteSpace: "pre-wrap" }}>{competition.rules || "No special rules have been added."}</p>
        </div>
        <div className="sq-card" style={{ padding: 22 }}>
          <h2 style={{ marginTop: 0 }}>Prizes</h2>
          <p className="sq-subtitle" style={{ whiteSpace: "pre-wrap" }}>{competition.prizes || "Prize details will be announced by the sponsor."}</p>
        </div>
      </section>

      {competition.sponsor_description && (
        <section className="sq-card" style={{ padding: 22, marginTop: 18 }}>
          <h2 style={{ marginTop: 0 }}>About the Sponsor</h2>
          <p className="sq-subtitle" style={{ whiteSpace: "pre-wrap" }}>{competition.sponsor_description}</p>
        </section>
      )}

      {announcements.length > 0 && (
        <section style={{ marginTop: 22 }}>
          <h2>Announcements</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {announcements.map((announcement) => (
              <article key={announcement.id} className="sq-card" style={{ padding: 18 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800 }}>{formatDate(announcement.publish_at)}</div>
                <h3 style={{ margin: "7px 0" }}>{announcement.title}</h3>
                <p className="sq-subtitle" style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>{announcement.content}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      <style jsx>{`
        @media (max-width: 760px) {
          .info-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
}
