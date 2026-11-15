"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useRouter,
} from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { AppNavbar } from "../../../components/ui";

type Competition = {
  id: string;
  sponsor_name: string;
  sponsor_description: string | null;
  sponsor_banner_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_image_url: string | null;
  sponsor_whatsapp: string | null;
  sponsor_instagram_url: string | null;
  sponsor_facebook_url: string | null;
  sponsor_tiktok_url: string | null;
  sponsor_website_url: string | null;
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

function statusOf(
  c: Competition
) {
  if (!c.is_published) {
    return "draft";
  }

  const now = Date.now();

  if (
    now <
    new Date(c.starts_at).getTime()
  ) {
    return "upcoming";
  }

  if (
    now <
    new Date(c.ends_at).getTime()
  ) {
    return "live";
  }

  return "ended";
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

function formatCompetitionType(value: Competition["competition_type"]) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function contentLines(value: string | null, fallback: string) {
  return (value || fallback)
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function sponsorWhatsAppUrl(value: string) {
  const digits = value.replace(/\\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}


function RegistrationCountdown({ startsAt }: { startsAt: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [startsAt]);

  const target = new Date(startsAt).getTime();
  const remaining = now === null ? null : Math.max(0, target - now);
  const totalSeconds = remaining === null ? null : Math.floor(remaining / 1000);
  const days = totalSeconds === null ? "--" : String(Math.floor(totalSeconds / 86400)).padStart(2, "0");
  const hours = totalSeconds === null ? "--" : String(Math.floor((totalSeconds % 86400) / 3600)).padStart(2, "0");
  const minutes = totalSeconds === null ? "--" : String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = totalSeconds === null ? "--" : String(totalSeconds % 60).padStart(2, "0");
  const opened = remaining !== null && remaining <= 0;

  return (
    <section
      aria-live="off"
      aria-label="Competition registration countdown"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        margin: "0 0 22px",
        padding: "12px 16px",
        border: "1px solid rgba(20, 184, 166, 0.2)",
        borderRadius: 16,
        background: "linear-gradient(100deg, rgba(20, 184, 166, 0.09), rgba(20, 184, 166, 0.025))",
      }}
    >
      <div style={{ minWidth: 180, flex: "1 1 220px" }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", color: "var(--primary)", textTransform: "uppercase" }}>
          {opened ? "Registration is open" : "Next competition registration"}
        </div>
        <div style={{ marginTop: 3, fontSize: 13, fontWeight: 750 }}>
          {opened ? "You can now enter the competition." : "Opening soon — get ready to participate."}
        </div>
      </div>
      {opened ? (
        <span style={{ color: "var(--primary)", fontSize: 13, fontWeight: 900, whiteSpace: "nowrap" }}>
          NOW OPEN
        </span>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[
            [days, "Days"],
            [hours, "Hrs"],
            [minutes, "Mins"],
            [seconds, "Secs"],
          ].map(([value, label]) => (
            <div key={label} style={{ minWidth: 48, textAlign: "center", padding: "6px 7px", borderRadius: 10, background: "var(--card, #fff)", border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 17, lineHeight: 1.1, fontWeight: 900, fontVariantNumeric: "tabular-nums" }}>{value}</div>
              <div style={{ marginTop: 3, fontSize: 9, color: "var(--muted)", fontWeight: 800, textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function SponsoredCompetitionDetailPage() {
  const params =
    useParams<{ id: string }>();

  const router = useRouter();

  const id = params.id;

  const [competition, setCompetition] =
    useState<Competition | null>(null);

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([]);

  const [contact, setContact] =
    useState<{
      whatsapp_number: string;
      whatsapp_consent: boolean;
    } | null>(null);

  const [whatsapp, setWhatsapp] =
    useState("");

  const [consent, setConsent] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [savingContact, setSavingContact] =
    useState(false);

  const [message, setMessage] =
    useState("");

  /*
   * ---------------------------------------------------------
   * LOAD COMPETITION
   * ---------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true;

    async function load() {
      const { data: auth } =
        await supabase.auth.getUser();

      if (!auth.user) {
        router.replace("/login");
        return;
      }

      const [
        competitionResult,
        announcementResult,
        profileResult,
        contactResult,
      ] = await Promise.all([
        supabase
          .from("sponsored_competitions")
          .select(
            "id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,sponsor_image_url,sponsor_whatsapp,sponsor_instagram_url,sponsor_facebook_url,sponsor_tiktok_url,sponsor_website_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published"
          )
          .eq("id", id)
          .maybeSingle(),

        supabase
          .from("sponsored_announcements")
          .select(
            "id,title,content,publish_at"
          )
          .eq("competition_id", id)
          .eq("is_published", true)
          .lte(
            "publish_at",
            new Date().toISOString()
          )
          .order("display_order", {
            ascending: true,
          })
          .order("publish_at", {
            ascending: true,
          }),

        supabase
          .from("profiles")
          .select("account_type")
          .eq("id", auth.user.id)
          .maybeSingle(),

        supabase
          .from(
            "sponsored_player_contacts"
          )
          .select(
            "whatsapp_number,whatsapp_consent"
          )
          .eq("user_id", auth.user.id)
          .maybeSingle(),
      ]);

      if (!mounted) {
        return;
      }

      if (
        competitionResult.error ||
        !competitionResult.data
      ) {
        setMessage(
          competitionResult.error?.message ||
            "Competition not found."
        );

        setLoading(false);
        return;
      }

      const type =
        (profileResult.data?.account_type ||
          "free") as
          | "free"
          | "individual"
          | "family";

      /*
       * Family accounts should not access
       * Sponsored Competitions.
       */
      if (type === "family") {
        router.replace(
          "/family-dashboard"
        );

        return;
      }

      setCompetition(
        competitionResult.data as Competition
      );

      setAnnouncements(
        (announcementResult.data ??
          []) as Announcement[]
      );

      setContact(
        (contactResult.data ??
          null) as any
      );

      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [id, router]);

  /*
   * ---------------------------------------------------------
   * SAVE WHATSAPP + START
   * ---------------------------------------------------------
   */
  async function saveContactAndStart() {
    setMessage("");

    const value =
      whatsapp.trim();

    if (value.length < 7) {
      setMessage(
        "Please enter a valid WhatsApp number."
      );

      return;
    }

    if (!consent) {
      setMessage(
        "Please confirm the WhatsApp consent before continuing."
      );

      return;
    }

    setSavingContact(true);

    try {
      const {
        data,
        error,
      } = await supabase.rpc(
        "save_sponsored_player_contact",
        {
          p_whatsapp_number: value,
          p_whatsapp_consent: true,
        }
      );

      if (error) {
        setMessage(error.message);
        return;
      }

      if (data?.success === false) {
        setMessage(
          data?.message ||
            "Unable to save your WhatsApp contact."
        );

        return;
      }

      const {
        data: startData,
        error: startError,
      } = await supabase.rpc(
        "start_sponsored_competition",
        {
          p_competition_id: id,
        }
      );

      if (startError) {
        setMessage(
          startError.message
        );

        return;
      }

      if (!startData?.attempt_id) {
        setMessage(
          "The competition could not be started."
        );

        return;
      }

      router.push(
        `/sponsored-competitions/${id}/play?attempt=${startData.attempt_id}`
      );
    } finally {
      setSavingContact(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * START / RESUME EXISTING ATTEMPT
   * ---------------------------------------------------------
   */
  async function startExisting() {
    setMessage("");

    const {
      data,
      error,
    } = await supabase.rpc(
      "start_sponsored_competition",
      {
        p_competition_id: id,
      }
    );

    if (error) {
      setMessage(error.message);
      return;
    }

    if (data?.attempt_id) {
      router.push(
        `/sponsored-competitions/${id}/play?attempt=${data.attempt_id}`
      );
    } else {
      setMessage(
        "Unable to start the competition."
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */
  if (loading) {
    return (
      <>
        <AppNavbar />

        <main
          style={{
            padding: 60,
            textAlign: "center",
          }}
        >
        ⏳
        <h3>
          Loading competition...
        </h3>
        </main>
      </>
    );
  }

  /*
   * ---------------------------------------------------------
   * NOT FOUND
   * ---------------------------------------------------------
   */
  if (!competition) {
    return (
      <>
        <AppNavbar />

        <main
          className="sq-card"
        style={{
          padding: 30,
        }}
      >
        <h2>
          Competition not found
        </h2>

        <p className="sq-subtitle">
          {message}
        </p>
        </main>
      </>
    );
  }

  const status =
    statusOf(competition);

  const hasContact = Boolean(
    contact?.whatsapp_number &&
      contact.whatsapp_consent
  );

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */
  return (
    <>
      <AppNavbar />

      <main className="competition-page" style={{ width: "min(100% - 32px, 1100px)", margin: "0 auto", padding: "22px 0 56px" }}>
        {status === "upcoming" && (
          <RegistrationCountdown startsAt={competition.starts_at} />
        )}

        <Link
          href="/sponsored-competitions"
        style={{
          textDecoration: "none",
          color: "var(--muted)",
          fontSize: 13,
          fontWeight: 800,
        }}
      >
        ← Back to Sponsored Competitions
      </Link>

      <section
        className="sq-card competition-hero"
        style={{
          overflow: "hidden",
          marginTop: 18,
        }}
      >
        <div
          className="competition-hero-inner"
          style={{
            padding: 30,
          }}
        >
          <div
            className="competition-badges"
            style={{
              marginTop: 4,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span className="sq-badge">
              {formatCompetitionType(competition.competition_type)}
            </span>

            <span
              style={{
                padding:
                  "6px 10px",
                borderRadius: 999,
                border:
                  "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 900,
              }}
            >
              {status}
            </span>
          </div>

          <h1
            className="sq-title competition-title"
            style={{
              marginTop: 18,
              marginBottom: 10,
            }}
          >
            {competition.title}
          </h1>

          <p
            className="sq-subtitle"
            style={{
              whiteSpace: "pre-wrap",
            }}
          >
            {competition.description ||
              ""}
          </p>

          <div
            className="competition-dates"
            style={{
              color: "var(--muted)",
              fontSize: 12,
              lineHeight: 1.9,
            }}
          >
            <div>
              Starts:{" "}
              {formatDate(
                competition.starts_at
              )}
            </div>

            <div>
              Ends:{" "}
              {formatDate(
                competition.ends_at
              )}
            </div>
          </div>

          {/* -------------------------------------------------
              LEADERBOARD BUTTON
             ------------------------------------------------- */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 20,
            }}
          >
            <Link
              href={`/sponsored-competitions/${id}/leaderboard`}
              className="sq-button-secondary"
            >
              🏆 View Leaderboard
            </Link>
          </div>
        </div>
      </section>

      {message && (
        <section
          className="sq-card"
          style={{
            padding: 16,
            marginTop: 18,
          }}
        >
          <strong>
            Notice
          </strong>

          <p
            className="sq-subtitle"
            style={{
              marginBottom: 0,
            }}
          >
            {message}
          </p>
        </section>
      )}

      {status === "live" && (
          <section
            className="sq-card participation-card"
            style={{
              padding: 26,
              marginTop: 20,
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Ready to compete?
            </h2>

            <p className="sq-subtitle">
              Sponsored competitions are free to enter for both Free and
              Individual accounts. You get one attempt for this competition.
              If you leave while your attempt is in progress, you can resume it.
            </p>

            {hasContact ? (
              <button
                type="button"
                className="sq-button-primary"
                onClick={startExisting}
                style={{
                  border: 0,
                  cursor: "pointer",
                }}
              >
                Join / Resume Competition
              </button>
            ) : (
              <>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 800,
                    marginBottom: 7,
                  }}
                >
                  WhatsApp Number *
                </label>

                <input
                  value={whatsapp}
                  onChange={(e) =>
                    setWhatsapp(
                      e.target.value
                    )
                  }
                  placeholder="+234..."
                  type="tel"
                  style={{
                    width: "100%",
                    maxWidth: 500,
                    padding:
                      "12px 13px",
                    border:
                      "1px solid var(--border)",
                    borderRadius: 10,
                    background:
                      "var(--background)",
                    color: "inherit",
                    boxSizing:
                      "border-box",
                  }}
                />

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems:
                      "flex-start",
                    marginTop: 14,
                    cursor: "pointer",
                    maxWidth: 700,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) =>
                      setConsent(
                        e.target.checked
                      )
                    }
                    style={{
                      marginTop: 3,
                    }}
                  />

                  <span
                    style={{
                      fontSize: 12,
                      color:
                        "var(--muted)",
                    }}
                  >
                    I consent to Sahaba
                    Quest storing this
                    WhatsApp number for
                    sponsored competition
                    winner/contact
                    purposes.
                  </span>
                </label>

                <button
                  type="button"
                  className="sq-button-primary"
                  onClick={
                    saveContactAndStart
                  }
                  disabled={
                    savingContact
                  }
                  style={{
                    border: 0,
                    cursor: savingContact
                      ? "not-allowed"
                      : "pointer",
                    marginTop: 16,
                    opacity:
                      savingContact
                        ? 0.7
                        : 1,
                  }}
                >
                  {savingContact
                    ? "Saving..."
                    : "Save & Start Competition"}
                </button>
              </>
            )}
          </section>
        )}

      {status === "upcoming" && (
          <section
            className="sq-card"
            style={{
              padding: 22,
              marginTop: 18,
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              Coming Soon
            </h2>

            <p className="sq-subtitle">
              This competition is not live
              yet. You can return when it
              starts.
            </p>

            <Link
              href={`/sponsored-competitions/${id}/leaderboard`}
              className="sq-button-secondary"
            >
              🏆 View Leaderboard
            </Link>
          </section>
        )}

      {status === "ended" && (
        <section
          className="sq-card"
          style={{
            padding: 22,
            marginTop: 18,
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            Competition Ended
          </h2>

          <p className="sq-subtitle">
            This competition is no longer
            accepting attempts.
          </p>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={`/sponsored-competitions/${id}/leaderboard`}
              className="sq-button-primary"
            >
              🏆 View Final Leaderboard
            </Link>

            <Link
              href="/sponsored-competitions"
              className="sq-button-secondary"
            >
              View Competitions
            </Link>
          </div>
        </section>
      )}

      {(competition.sponsor_name ||
        competition.sponsor_description ||
        competition.sponsor_image_url ||
        competition.sponsor_logo_url ||
        competition.sponsor_whatsapp ||
        competition.sponsor_instagram_url ||
        competition.sponsor_facebook_url ||
        competition.sponsor_tiktok_url ||
        competition.sponsor_website_url) && (
        <section
          className="sq-card sponsor-card"
          style={{
            padding: 26,
            marginTop: 22,
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              color: "var(--muted)",
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: ".14em",
              textTransform: "uppercase",
              marginBottom: 12,
            }}
          >
            Official Competition Sponsor
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            {(competition.sponsor_image_url || competition.sponsor_logo_url) && (
              <div
                style={{
                  width: 112,
                  height: 112,
                  flex: "0 0 112px",
                  borderRadius: 14,
                  overflow: "hidden",
                  border: "1px solid var(--border)",
                  background: "var(--background)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <img
                  src={competition.sponsor_image_url || competition.sponsor_logo_url || ""}
                  alt={`${competition.sponsor_name || "Competition sponsor"} profile`}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
            )}

            <div style={{ flex: "1 1 260px", minWidth: 0 }}>
              <h2 style={{ margin: "0 0 10px", fontSize: 22 }}>
                {competition.sponsor_name || "Our Sponsor"}
              </h2>

              {competition.sponsor_description ? (
                <p
                  className="sq-subtitle"
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    lineHeight: 1.8,
                  }}
                >
                  {competition.sponsor_description}
                </p>
              ) : (
                <p className="sq-subtitle" style={{ margin: 0 }}>
                  Thank you to our sponsor for supporting this competition.
                </p>
              )}

              {(competition.sponsor_whatsapp ||
                competition.sponsor_instagram_url ||
                competition.sponsor_facebook_url ||
                competition.sponsor_tiktok_url ||
                competition.sponsor_website_url) && (
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 9,
                    marginTop: 16,
                  }}
                >
                  {competition.sponsor_whatsapp && sponsorWhatsAppUrl(competition.sponsor_whatsapp) && (
                    <a
                      href={sponsorWhatsAppUrl(competition.sponsor_whatsapp) || undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sq-button-secondary"
                      style={{ textDecoration: "none" }}
                    >
                      WhatsApp
                    </a>
                  )}
                  {competition.sponsor_instagram_url && (
                    <a href={competition.sponsor_instagram_url} target="_blank" rel="noopener noreferrer" className="sq-button-secondary" style={{ textDecoration: "none" }}>
                      Instagram
                    </a>
                  )}
                  {competition.sponsor_facebook_url && (
                    <a href={competition.sponsor_facebook_url} target="_blank" rel="noopener noreferrer" className="sq-button-secondary" style={{ textDecoration: "none" }}>
                      Facebook
                    </a>
                  )}
                  {competition.sponsor_tiktok_url && (
                    <a href={competition.sponsor_tiktok_url} target="_blank" rel="noopener noreferrer" className="sq-button-secondary" style={{ textDecoration: "none" }}>
                      TikTok
                    </a>
                  )}
                  {competition.sponsor_website_url && (
                    <a href={competition.sponsor_website_url} target="_blank" rel="noopener noreferrer" className="sq-button-secondary" style={{ textDecoration: "none" }}>
                      Website
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
          gap: 18,
          marginTop: 20,
        }}
        className="info-grid"
      >
        <div
          className="sq-card rules-card"
          style={{
            padding: 24,
          }}
        >
          <div className="detail-card-heading rules-heading">
            <span className="detail-heading-icon" aria-hidden="true">✦</span>
            <div>
              <span className="detail-eyebrow">PLAY FAIR • PLAY SMART</span>
              <h2>Competition Rules</h2>
              <p>Keep these guidelines in mind before you begin.</p>
            </div>
          </div>

          <div className="rules-list">
            {contentLines(competition.rules, "No special rules have been added.").map((rule, index) => (
              <div className="rule-item" key={`${index}-${rule}`}>
                <span className="rule-number">{String(index + 1).padStart(2, "0")}</span>
                <p>{rule.replace(/^\d+[.)]\s*/, "")}</p>
                <span className="rule-check" aria-hidden="true">✓</span>
              </div>
            ))}
          </div>
        </div>

        <div
          className="sq-card prizes-card"
          style={{
            padding: 24,
          }}
        >
          <div className="detail-card-heading prizes-heading">
            <span className="detail-heading-icon" aria-hidden="true">🏆</span>
            <div>
              <span className="detail-eyebrow">THE REWARD AWAITS</span>
              <h2>Prizes to Be Won</h2>
              <p>Give it your best and earn your place on the podium.</p>
            </div>
          </div>

          <div className="prize-list">
            {contentLines(competition.prizes, "Prize details will be announced by the sponsor.").map((prize, index) => {
              const isTotal = /total|prize pool/i.test(prize);
              const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "★";
              return (
                <div className={`prize-item${isTotal ? " prize-total" : ""}`} key={`${index}-${prize}`}>
                  <span className="prize-medal" aria-hidden="true">{isTotal ? "✧" : medal}</span>
                  <span>{prize}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {announcements.length > 0 && (
        <section
          style={{
            marginTop: 22,
          }}
        >
          <h2>
            Announcements
          </h2>

          <div
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            {announcements.map(
              (announcement) => (
                <article
                  key={
                    announcement.id
                  }
                  className="sq-card announcement-card"
                  style={{
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      color:
                        "var(--muted)",
                      fontWeight: 800,
                    }}
                  >
                    {formatDate(
                      announcement.publish_at
                    )}
                  </div>

                  <h3
                    style={{
                      margin:
                        "7px 0",
                    }}
                  >
                    {
                      announcement.title
                    }
                  </h3>

                  <p
                    className="sq-subtitle"
                    style={{
                      whiteSpace:
                        "pre-wrap",
                      marginBottom: 0,
                    }}
                  >
                    {
                      announcement.content
                    }
                  </p>
                </article>
              )
            )}
          </div>
        </section>
      )}

      <style jsx>{`
        .competition-page { color: var(--foreground, #173436); }
        .competition-page :global(.sq-card) {
          border-radius: 20px;
          box-shadow: 0 12px 34px rgba(13, 54, 51, .065);
          border: 1px solid rgba(16, 105, 97, .12);
        }
        .competition-page :global(.competition-hero) {
          position: relative;
          isolation: isolate;
          color: #fff;
          background:
            radial-gradient(circle at 88% 12%, rgba(222, 190, 105, .2), transparent 28%),
            linear-gradient(125deg, #073b3c 0%, #075d58 58%, #123e42 100%);
          background-size: cover;
          background-position: center;
          border: 1px solid rgba(221, 191, 113, .42);
          box-shadow: 0 20px 48px rgba(7, 59, 60, .2);
        }
        .competition-hero::before, .competition-hero::after {
          content: "";
          position: absolute;
          z-index: -1;
          width: 190px;
          height: 190px;
          border: 1px solid rgba(235, 208, 137, .2);
          border-radius: 34px;
          transform: rotate(45deg);
          pointer-events: none;
        }
        .competition-hero::before { right: -75px; top: -100px; }
        .competition-hero::after { right: 105px; bottom: -165px; width: 145px; height: 145px; }
        .competition-hero-inner { position: relative; z-index: 1; }
        .competition-hero :global(.sq-title) {
          color: #fff;
          font-size: clamp(28px, 4.4vw, 43px);
          line-height: 1.12;
          letter-spacing: -.035em;
        }
        .competition-hero :global(.sq-subtitle) {
          max-width: 820px;
          color: rgba(255,255,255,.82);
          line-height: 1.85;
        }
        .competition-badges :global(.sq-badge) {
          color: #183d3b;
          background: linear-gradient(135deg, #f0d98f, #d6b45c);
          border: 0;
          font-weight: 900;
        }
        .competition-badges span:last-child {
          color: #fff;
          background: rgba(255,255,255,.12);
          border-color: rgba(255,255,255,.32) !important;
          text-transform: uppercase;
          letter-spacing: .08em;
        }
        .competition-dates {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 24px;
          margin-top: 20px;
          color: rgba(255,255,255,.86) !important;
        }
        .competition-dates > div {
          padding: 10px 13px;
          border: 1px solid rgba(255,255,255,.16);
          border-radius: 12px;
          background: rgba(255,255,255,.08);
        }
        .competition-hero :global(.sq-button-secondary) {
          display: inline-flex;
          padding: 11px 16px;
          border-radius: 12px;
          color: #173b39;
          background: linear-gradient(135deg, #f0d98f, #d6b45c);
          border: 0;
          font-weight: 900;
          text-decoration: none;
        }
        .participation-card {
          background: linear-gradient(130deg, #fff 0%, #f0f8f5 100%);
          border-color: #d8e9e2 !important;
        }
        .participation-card h2 { color: #124d49; font-size: 23px; }
        .participation-card :global(.sq-subtitle) { max-width: 800px; line-height: 1.85; }
        .participation-card input[type="tel"] {
          border: 1px solid #cbded7 !important;
          border-radius: 12px !important;
          min-height: 46px;
          background: #fff !important;
        }
        .participation-card :global(.sq-button-primary) {
          border-radius: 12px;
          background: linear-gradient(135deg, #087d76, #075b59);
          box-shadow: 0 8px 20px rgba(7, 91, 89, .18);
          padding: 12px 19px;
        }
        .sponsor-card {
          position: relative;
          overflow: hidden;
          background: linear-gradient(125deg, #f6f0dc 0%, #fffdf7 55%, #eff7f2 100%);
          border-color: #e9dfc0 !important;
        }
        .sponsor-card::after {
          content: "✦";
          position: absolute;
          right: 25px;
          top: 10px;
          color: rgba(166, 132, 57, .12);
          font-size: 100px;
          pointer-events: none;
        }
        .sponsor-card > div:first-child {
          color: #94732d !important;
          letter-spacing: .16em !important;
        }
        .sponsor-card img {
          border-radius: 15px;
          background: #fff;
          padding: 5px;
          box-sizing: border-box;
        }
        .sponsor-card h2 { color: #283f3c; font-size: 25px; }
        .sponsor-card :global(.sq-subtitle) { color: #62736d; line-height: 1.85; }
        .sponsor-card a {
          border-radius: 10px;
          padding: 9px 13px;
          background: rgba(255,255,255,.8);
          border: 1px solid #e5d9b8;
          color: #6e5725;
          font-weight: 800;
        }
        .rules-card {
          position: relative;
          overflow: hidden;
          background: radial-gradient(circle at 100% 0%, rgba(24, 139, 122, .12), transparent 34%), linear-gradient(145deg, #eaf5f1, #fff 72%);
          border-color: #cfe5dc !important;
        }
        .prizes-card {
          position: relative;
          overflow: hidden;
          background: radial-gradient(circle at 100% 0%, rgba(213, 174, 76, .2), transparent 36%), linear-gradient(145deg, #fff7e5, #fff 72%);
          border-color: #ead9ad !important;
        }
        .detail-card-heading { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
        .detail-heading-icon { width: 54px; height: 54px; flex: 0 0 54px; display: grid; place-items: center; border-radius: 17px; font-size: 25px; box-shadow: 0 8px 18px rgba(20, 65, 57, .12); }
        .rules-heading .detail-heading-icon { color: #fff; background: linear-gradient(145deg, #087d70, #064b49); }
        .prizes-heading .detail-heading-icon { color: #614812; background: linear-gradient(145deg, #f7df9c, #d5ae4c); }
        .detail-eyebrow { display: block; margin-bottom: 4px; color: #8b7541; font-size: 9px; font-weight: 950; letter-spacing: .16em; }
        .detail-card-heading h2 { margin: 0; color: #183f3b; font-size: 23px; letter-spacing: -.025em; }
        .detail-card-heading p { margin: 5px 0 0; color: #71817b; font-size: 12px; line-height: 1.5; }
        .rules-list, .prize-list { display: grid; gap: 10px; }
        .rule-item { display: grid; grid-template-columns: 38px minmax(0,1fr) 22px; align-items: center; gap: 11px; padding: 13px 12px; border: 1px solid #dcebe5; border-radius: 14px; background: rgba(255,255,255,.82); box-shadow: 0 4px 12px rgba(17,75,64,.035); }
        .rule-number { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 11px; color: #fff; background: linear-gradient(145deg, #0b8174, #07534f); font-size: 11px; font-weight: 950; }
        .rule-item p { margin: 0; color: #435b55; font-size: 13px; line-height: 1.65; }
        .rule-check { color: #159477; font-weight: 950; }
        .prize-item { display: flex; align-items: center; gap: 13px; padding: 15px; border: 1px solid #eee1bf; border-radius: 14px; background: rgba(255,255,255,.86); color: #51452b; font-size: 13px; font-weight: 800; box-shadow: 0 5px 14px rgba(116,85,24,.045); }
        .prize-medal { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 40px; border-radius: 13px; background: #fbf0d2; font-size: 20px; }
        .prize-item:nth-child(1) .prize-medal { background: #fff0c2; }
        .prize-item:nth-child(2) .prize-medal { background: #edf0f3; }
        .prize-item:nth-child(3) .prize-medal { background: #f8e4d7; }
        .prize-item.prize-total { margin-top: 5px; border-color: #c9a64d; color: #fff; background: linear-gradient(110deg, #174f49, #0b7567); font-size: 15px; box-shadow: 0 10px 22px rgba(11,91,78,.17); }
        .prize-item.prize-total .prize-medal { color: #634b13; background: linear-gradient(145deg, #f9e4a9, #d6b45c); }
        .announcement-card { background: linear-gradient(110deg, #fff, #f5faf8); }
        .announcement-card h3 { color: #174d49; }
        .competition-page :global(.sq-button-primary),
        .competition-page :global(.sq-button-secondary) {
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .competition-page :global(.sq-button-primary:hover),
        .competition-page :global(.sq-button-secondary:hover) {
          transform: translateY(-2px);
        }
        @media (max-width: 760px) {
          .info-grid { grid-template-columns: 1fr !important; }
          .competition-hero-inner { padding: 22px !important; }
          .competition-hero :global(.sq-title) { font-size: 28px; }
          .competition-dates { flex-direction: column; gap: 8px; }
          .sponsor-card > div:nth-child(2) { gap: 14px !important; }
          .sponsor-card img { width: 96px !important; height: 96px !important; }
          .detail-card-heading { align-items: flex-start; }
          .detail-card-heading h2 { font-size: 20px; }
          .rule-item { grid-template-columns: 34px minmax(0,1fr); }
          .rule-check { display: none; }
        }
      `}</style>
      </main>
    </>
  );
}