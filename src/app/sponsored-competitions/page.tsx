"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

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

type AccountType = "free" | "individual" | "family";

function statusOf(c: Competition) {
  if (!c.is_published) return "draft";

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

function formatHistoryDate(value: string) {
  const date = new Date(value);
  const day = date.getDate();
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : day % 10 === 1
        ? "st"
        : day % 10 === 2
          ? "nd"
          : day % 10 === 3
            ? "rd"
            : "th";

  const monthAndYear = new Intl.DateTimeFormat("en-NG", {
    month: "long",
    year: "numeric",
  }).format(date);

  return `${day}${suffix} ${monthAndYear}`;
}

function getCountdown(value: string) {
  const difference = new Date(value).getTime() - Date.now();

  if (difference <= 0) return "Starting soon";

  const totalMinutes = Math.floor(difference / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function splitText(value: string | null) {
  if (!value) return [];
  return value
    .split(/\r?\n|•/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

export default function SponsoredCompetitionsPage() {
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMessage("");

      const { data: auth } = await supabase.auth.getUser();

      if (!auth.user) {
        router.replace("/login");
        return;
      }

      const [profileResult, subscriptionResult, competitionResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("account_type")
            .eq("id", auth.user.id)
            .maybeSingle(),

          supabase
            .from("subscriptions")
            .select(
              "id,current_period_end,status,subscription_plans!inner(plan_type)"
            )
            .eq("user_id", auth.user.id)
            .eq("status", "active")
            .eq("subscription_plans.plan_type", "plus")
            .gt("current_period_end", new Date().toISOString())
            .limit(1)
            .maybeSingle(),

          supabase
            .from("sponsored_competitions")
            .select(
              "id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published"
            )
            .eq("is_published", true)
            .order("starts_at", { ascending: false }),
        ]);

      if (!mounted) return;

      if (profileResult.error) {
        setMessage(profileResult.error.message);
        setLoading(false);
        return;
      }

      const type = profileResult.data?.account_type as
        | AccountType
        | undefined;

      if (type === "family") {
        router.replace("/family-dashboard");
        return;
      }

      setAccountType(type ?? "free");
      setHasPremium(Boolean(subscriptionResult.data));

      if (competitionResult.error) {
        setMessage(competitionResult.error.message);
        setLoading(false);
        return;
      }

      setCompetitions((competitionResult.data ?? []) as Competition[]);
      setLoading(false);
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [router]);

  const active = useMemo(
    () => competitions.filter((c) => statusOf(c) === "live"),
    [competitions]
  );

  const upcoming = useMemo(
    () => competitions.filter((c) => statusOf(c) === "upcoming"),
    [competitions]
  );

  const ended = useMemo(
    () => competitions.filter((c) => statusOf(c) === "ended"),
    [competitions]
  );

  const featured = active[0] ?? upcoming[0] ?? null;
  const canParticipate = accountType === "individual" && hasPremium;

  function join(c: Competition) {
    if (statusOf(c) !== "live") return;

    if (accountType !== "individual" || !hasPremium) {
      router.push("/pricing");
      return;
    }

    router.push(`/sponsored-competitions/${c.id}`);
  }

  if (loading) {
    return (
      <>
        <AppNavbar />

        <main className="sq-sponsored-loading">
          <div className="sq-sponsored-spinner">🏆</div>
        <h3>Loading sponsored competitions...</h3>
        <p>Preparing the latest competitions for you.</p>

        <style jsx>{`
          .sq-sponsored-loading {
            min-height: 55vh;
            display: grid;
            place-items: center;
            align-content: center;
            gap: 8px;
            text-align: center;
            padding: 40px 20px;
          }

          .sq-sponsored-loading h3 {
            margin: 0;
          }

          .sq-sponsored-loading p {
            margin: 0;
            color: var(--muted);
          }

          .sq-sponsored-spinner {
            width: 64px;
            height: 64px;
            display: grid;
            place-items: center;
            border-radius: 20px;
            background: linear-gradient(
              135deg,
              rgba(20, 184, 166, 0.18),
              rgba(59, 130, 246, 0.14)
            );
            font-size: 30px;
            animation: sqFloat 1.8s ease-in-out infinite;
          }

          @keyframes sqFloat {
            0%,
            100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-7px);
            }
          }
          `}</style>
        </main>
      </>
    );
  }

  return (
    <>
      <AppNavbar />

      <main className="sq-sponsored-page">
      <section className="sq-sponsored-hero">
        <div className="sq-sponsored-hero-glow sq-glow-one" />
        <div className="sq-sponsored-hero-glow sq-glow-two" />

        <div className="sq-sponsored-hero-copy">
          <div className="sq-sponsored-kicker">
            <span className="sq-live-dot" />
            SAHABA QUEST SPONSORED COMPETITIONS
          </div>

          <h1>
            Learn something.
            <br />
            <span>Challenge yourself.</span>
            <br />
            Make your mark.
          </h1>

          <p>
            Take part in special Islamic knowledge competitions brought to you
            by Muslim organizations and brands. Test what you know, answer
            under pressure, earn Sponsored XP and climb the competition
            leaderboard.
          </p>

          <div className="sq-sponsored-hero-actions">
            {active.length > 0 ? (
              <button
                type="button"
                className="sq-sponsored-primary"
                onClick={() => join(active[0])}
              >
                <span>🏆</span>
                {canParticipate ? "Enter Live Competition" : "Explore Live Competition"}
              </button>
            ) : upcoming.length > 0 ? (
              <button
                type="button"
                className="sq-sponsored-primary"
                onClick={() =>
                  document
                    .getElementById("sq-upcoming")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                <span>📅</span>
                See Upcoming Competitions
              </button>
            ) : (
              <Link href="/dashboard" className="sq-sponsored-primary">
                <span>←</span>
                Back to Dashboard
              </Link>
            )}

            <a href="#how-it-works" className="sq-sponsored-secondary">
              How it works
            </a>
          </div>

          <div className="sq-sponsored-trust-row">
            <span>✓ Separate Sponsored XP</span>
            <span>✓ Timed questions</span>
            <span>✓ Competition leaderboard</span>
          </div>
        </div>

        <div className="sq-sponsored-hero-art">
          <div className="sq-trophy-orbit sq-orbit-one" />
          <div className="sq-trophy-orbit sq-orbit-two" />

          <div className="sq-trophy-card">
            <div className="sq-trophy-card-top">
              <span className="sq-mini-label">SPONSORED</span>
              <span className="sq-mini-live">
                {active.length > 0 ? "LIVE" : "QUEST"}
              </span>
            </div>

            <div className="sq-trophy">🏆</div>

            <div className="sq-trophy-title">
              Knowledge.
              <br />
              Speed. Accuracy.
            </div>

            <div className="sq-score-lines">
              <div>
                <span>Sponsored XP</span>
                <strong>+150</strong>
              </div>
              <div>
                <span>Correct answers</span>
                <strong>✓</strong>
              </div>
              <div>
                <span>Leaderboard</span>
                <strong>#1</strong>
              </div>
            </div>
          </div>

          <div className="sq-floating-pill sq-pill-one">⚡ Speed Bonus</div>
          <div className="sq-floating-pill sq-pill-two">🎯 Correct Answer</div>
          <div className="sq-floating-pill sq-pill-three">🏅 Top 3</div>
        </div>
      </section>

      {accountType === "free" && (
        <section className="sq-access-banner">
          <div className="sq-access-icon">✨</div>
          <div className="sq-access-copy">
            <strong>Explore the competition world.</strong>
            <p>
              You can view sponsors, competitions, rules and prizes. An active
              Individual Premium subscription is required to participate.
            </p>
          </div>
          <Link href="/pricing" className="sq-access-button">
            View Premium
          </Link>
        </section>
      )}

      {message && (
        <section className="sq-sponsored-notice">
          <strong>Notice</strong>
          <span>{message}</span>
        </section>
      )}

      {featured && (
        <section className="sq-featured-section">
          <div className="sq-section-heading">
            <div>
              <span className="sq-section-kicker">
                {statusOf(featured) === "live" ? "HAPPENING NOW" : "UP NEXT"}
              </span>
              <h2>
                {statusOf(featured) === "live"
                  ? "The competition is on."
                  : "Something exciting is coming."}
              </h2>
            </div>

            <span className="sq-section-count">
              {statusOf(featured) === "live"
                ? `${active.length} live`
                : `${upcoming.length} upcoming`}
            </span>
          </div>

          <FeaturedCompetition
            competition={featured}
            premium={canParticipate}
            onJoin={join}
          />
        </section>
      )}

      <section className="sq-feature-strip" id="how-it-works">
        <div className="sq-section-heading compact">
          <div>
            <span className="sq-section-kicker">WHY COMPETE?</span>
            <h2>More than a quiz.</h2>
          </div>
        </div>

        <div className="sq-feature-grid">
          <Feature
            number="01"
            icon="🧠"
            title="Learn while competing"
            text="Build Islamic knowledge while testing yourself in a real competition setting."
          />
          <Feature
            number="02"
            icon="⚡"
            title="Speed matters"
            text="Answer correctly and quickly to earn extra Sponsored XP through the speed bonus."
          />
          <Feature
            number="03"
            icon="🏆"
            title="Your own leaderboard"
            text="Track your competition performance separately from your normal Sahaba Quest XP."
          />
          <Feature
            number="04"
            icon="🎁"
            title="Compete for prizes"
            text="Take part in special competitions where sponsors can offer prizes and recognition."
          />
        </div>
      </section>

      {active.length > 1 && (
        <section className="sq-competition-section">
          <SectionTitle
            kicker="LIVE NOW"
            title="Choose your challenge."
            subtitle="These competitions are currently open for eligible participants."
          />

          <div className="sq-competition-grid">
            {active.slice(1).map((competition) => (
              <CompetitionCard
                key={competition.id}
                competition={competition}
                onJoin={join}
                premium={canParticipate}
              />
            ))}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="sq-competition-section" id="sq-upcoming">
          <SectionTitle
            kicker="COMING SOON"
            title="Get ready."
            subtitle="Keep an eye on the next sponsored competitions and their opening times."
          />

          <div className="sq-competition-grid">
            {upcoming.map((competition) => (
              <CompetitionCard
                key={competition.id}
                competition={competition}
                onJoin={join}
                premium={canParticipate}
              />
            ))}
          </div>
        </section>
      )}

      {ended.length > 0 && (
        <section className="sq-competition-section sq-past-section">
          <div className="sq-history-heading">
            <span className="sq-history-kicker">COMPETITION HISTORY</span>
            <h2>Past competitions.</h2>
            <p>
              Revisit completed competitions, see who competed and view the
              final leaderboard.
            </p>
          </div>

          <div className="sq-history-list">
            {ended.map((competition) => (
              <PastCompetitionCard
                key={competition.id}
                competition={competition}
              />
            ))}
          </div>
        </section>
      )}

      {competitions.length === 0 && (
        <section className="sq-empty-state">
          <div className="sq-empty-icon">🏆</div>
          <span className="sq-section-kicker">THE STAGE IS BEING PREPARED</span>
          <h2>No sponsored competitions yet.</h2>
          <p>
            New competitions will appear here when they are published by
            Sahaba Quest.
          </p>
        </section>
      )}

      <section className="sq-sponsored-bottom">
        <div>
          <span className="sq-section-kicker">YOUR SPONSORED XP</span>
          <h2>A separate space for competition.</h2>
          <p>
            Your Sponsored XP is intentionally separate from your normal Sahaba
            Quest progress. That means competition performance has its own
            leaderboard and history.
          </p>
        </div>

        <div className="sq-bottom-stats">
          <div>
            <strong>⚡</strong>
            <span>Speed bonus</span>
          </div>
          <div>
            <strong>🎯</strong>
            <span>Accuracy</span>
          </div>
          <div>
            <strong>🏅</strong>
            <span>Top 3 winners</span>
          </div>
        </div>
      </section>

      <style jsx>{`
        .sq-sponsored-page {
          width: 100%;
          min-width: 0;
          overflow-x: hidden;
          padding-bottom: 48px;
        }

        .sq-sponsored-hero {
          position: relative;
          width: calc(100vw - 48px);
          max-width: 1440px;
          min-height: 400px;
          margin-left: 50%;
          transform: translateX(-50%);
          overflow: hidden;
          border-radius: 24px;
          padding: clamp(30px, 4vw, 48px);
          display: grid;
          grid-template-columns: minmax(0, 1.12fr) minmax(280px, 0.88fr);
          gap: 22px;
          align-items: center;
          background:
            radial-gradient(circle at 78% 35%, rgba(45, 212, 191, 0.25), transparent 32%),
            radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.25), transparent 36%),
            linear-gradient(135deg, #071b22 0%, #0a3034 52%, #0b2633 100%);
          color: white;
          box-shadow: 0 24px 70px rgba(4, 20, 30, 0.22);
        }

        .sq-sponsored-hero-copy {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 650px;
          min-width: 0;
        }

        .sq-sponsored-kicker,
        .sq-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .sq-sponsored-kicker {
          color: #8ff7e5;
        }

        .sq-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #35e4b8;
          box-shadow: 0 0 0 5px rgba(53, 228, 184, 0.12);
        }

        .sq-sponsored-hero h1 {
          max-width: 650px;
          margin: 16px 0 16px;
          font-size: clamp(36px, 4.4vw, 56px);
          line-height: 1.02;
          letter-spacing: -0.042em;
          text-wrap: balance;
        }

        .sq-sponsored-hero h1 span {
          color: #75ead8;
        }

        .sq-sponsored-hero p {
          max-width: 590px;
          margin: 0;
          color: rgba(255, 255, 255, 0.76);
          font-size: clamp(13px, 1.35vw, 15px);
          line-height: 1.65;
          text-wrap: pretty;
        }

        .sq-sponsored-hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          margin-top: 22px;
        }

        .sq-sponsored-primary,
        .sq-sponsored-secondary,
        .sq-access-button {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 11px;
          padding: 0 16px;
          font-weight: 900;
          font-size: 12px;
          text-decoration: none;
          white-space: nowrap;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .sq-sponsored-primary {
          border: 0;
          color: #052326;
          background: #79ead9;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(78, 224, 199, 0.22);
        }

        .sq-sponsored-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 34px rgba(78, 224, 199, 0.3);
        }

        .sq-sponsored-secondary {
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.22);
          background: rgba(255, 255, 255, 0.06);
        }

        .sq-sponsored-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .sq-sponsored-trust-row {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 18px;
        }

        .sq-sponsored-trust-row span {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(255, 255, 255, 0.055);
          color: rgba(255, 255, 255, 0.68);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.01em;
        }

        .sq-sponsored-hero-art {
          position: relative;
          min-height: 310px;
          display: grid;
          place-items: center;
        }

        .sq-trophy-card {
          position: relative;
          z-index: 2;
          width: min(300px, 82%);
          padding: 21px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.09);
          backdrop-filter: blur(18px);
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.25),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transform: rotate(2deg);
        }

        .sq-trophy-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .sq-mini-label,
        .sq-mini-live {
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .sq-mini-label {
          color: rgba(255, 255, 255, 0.56);
        }

        .sq-mini-live {
          color: #7ff0d9;
        }

        .sq-trophy {
          width: 86px;
          height: 86px;
          display: grid;
          place-items: center;
          margin: 22px auto 12px;
          border-radius: 50%;
          font-size: 55px;
          background: radial-gradient(circle, rgba(255, 230, 139, 0.2), rgba(255, 255, 255, 0.04));
          box-shadow: 0 0 50px rgba(255, 216, 112, 0.12);
        }

        .sq-trophy-title {
          text-align: center;
          font-size: 19px;
          line-height: 1.08;
          font-weight: 900;
          letter-spacing: -0.03em;
        }

        .sq-score-lines {
          display: grid;
          gap: 7px;
          margin-top: 20px;
        }

        .sq-score-lines > div {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.13);
          font-size: 11px;
          color: rgba(255, 255, 255, 0.62);
        }

        .sq-score-lines strong {
          color: white;
        }

        .sq-floating-pill {
          position: absolute;
          z-index: 3;
          padding: 10px 13px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          color: white;
          font-size: 10px;
          font-weight: 900;
          box-shadow: 0 12px 30px rgba(0, 0, 0, 0.18);
        }

        .sq-pill-one {
          top: 9%;
          right: 2%;
        }

        .sq-pill-two {
          left: 1%;
          bottom: 17%;
        }

        .sq-pill-three {
          right: 4%;
          bottom: 5%;
        }

        .sq-trophy-orbit {
          position: absolute;
          border: 1px solid rgba(117, 234, 216, 0.14);
          border-radius: 50%;
        }

        .sq-orbit-one {
          width: 330px;
          height: 330px;
        }

        .sq-orbit-two {
          width: 420px;
          height: 420px;
          border-color: rgba(255, 255, 255, 0.06);
        }

        .sq-sponsored-hero-glow {
          position: absolute;
          border-radius: 50%;
          filter: blur(2px);
          pointer-events: none;
        }

        .sq-glow-one {
          width: 260px;
          height: 260px;
          left: 45%;
          top: -140px;
          background: rgba(53, 228, 184, 0.12);
        }

        .sq-glow-two {
          width: 300px;
          height: 300px;
          right: -100px;
          bottom: -120px;
          background: rgba(59, 130, 246, 0.12);
        }

        .sq-access-banner {
          margin-top: 22px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 17px 18px;
          border: 1px solid rgba(20, 184, 166, 0.22);
          border-radius: 18px;
          background: linear-gradient(
            100deg,
            rgba(20, 184, 166, 0.1),
            rgba(59, 130, 246, 0.06)
          );
        }

        .sq-access-icon {
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: rgba(20, 184, 166, 0.12);
          font-size: 20px;
        }

        .sq-access-copy {
          flex: 1;
          min-width: 0;
        }

        .sq-access-copy strong {
          display: block;
          margin-bottom: 3px;
        }

        .sq-access-copy p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
        }

        .sq-access-button {
          flex: 0 0 auto;
          color: white;
          background: var(--primary);
        }

        .sq-sponsored-notice {
          margin-top: 20px;
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 14px 16px;
          border-radius: 14px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.18);
          font-size: 12px;
        }

        .sq-featured-section,
        .sq-feature-strip,
        .sq-competition-section,
        .sq-sponsored-bottom {
          margin-top: 54px;
        }

        .sq-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: end;
          gap: 20px;
          margin-bottom: 18px;
        }

        .sq-section-heading.compact {
          margin-bottom: 18px;
        }

        .sq-section-kicker {
          color: var(--primary);
        }

        .sq-section-heading h2 {
          margin: 5px 0 0;
          font-size: clamp(24px, 3vw, 34px);
          line-height: 1.05;
          letter-spacing: -0.035em;
        }

        .sq-section-count {
          padding: 7px 11px;
          border-radius: 999px;
          background: var(--primary-light);
          color: var(--primary);
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
        }

        .sq-featured-card {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 0.88fr) minmax(340px, 1.12fr);
          min-height: 285px;
          border-radius: 24px;
          border: 1px solid var(--border);
          background: var(--card, white);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.07);
        }

        .sq-featured-media {
          position: relative;
          min-height: 285px;
          background:
            linear-gradient(135deg, rgba(10, 45, 51, 0.95), rgba(20, 125, 115, 0.74)),
            var(--primary-light);
        }

        .sq-featured-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0.72;
        }

        .sq-featured-media-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 22px;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08),
            rgba(0, 0, 0, 0.58)
          );
          color: white;
        }

        .sq-featured-status {
          align-self: flex-start;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          font-size: 10px;
          font-weight: 900;
        }

        .sq-featured-media-copy h3 {
          margin: 0 0 6px;
          font-size: clamp(28px, 4vw, 48px);
          line-height: 0.98;
          letter-spacing: -0.04em;
        }

        .sq-featured-media-copy p {
          margin: 0;
          max-width: 560px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 12px;
          line-height: 1.55;
        }

        .sq-featured-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 30px;
        }

        .sq-sponsor-line {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .sq-sponsor-logo {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          object-fit: contain;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: white;
        }

        .sq-sponsor-name {
          font-size: 12px;
          font-weight: 900;
        }

        .sq-sponsor-caption {
          display: block;
          color: var(--muted);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .sq-featured-content h3 {
          margin: 0 0 9px;
          font-size: 24px;
          line-height: 1.05;
          letter-spacing: -0.025em;
        }

        .sq-featured-content > p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.65;
        }

        .sq-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 20px;
        }

        .sq-meta-box {
          padding: 10px;
          border-radius: 11px;
          background: var(--primary-light);
        }

        .sq-meta-box span {
          display: block;
          color: var(--muted);
          font-size: 9px;
          font-weight: 800;
        }

        .sq-meta-box strong {
          display: block;
          margin-top: 2px;
          font-size: 12px;
        }

        .sq-featured-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 18px;
        }

        .sq-featured-actions button,
        .sq-featured-actions a {
          flex: 1;
        }

        .sq-feature-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .sq-feature-item {
          position: relative;
          min-width: 0;
          min-height: 190px;
          padding: 20px 18px 18px;
          border: 1px solid var(--border);
          border-radius: 18px;
          background: var(--card, white);
          overflow: hidden;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            border-color 160ms ease;
        }

        .sq-feature-item::before {
          content: "";
          position: absolute;
          top: 0;
          left: 18px;
          right: 18px;
          height: 3px;
          border-radius: 0 0 999px 999px;
          background: linear-gradient(90deg, var(--primary), rgba(20, 184, 166, 0.12));
        }

        .sq-feature-item::after {
          content: "";
          position: absolute;
          width: 90px;
          height: 90px;
          right: -42px;
          bottom: -48px;
          border-radius: 50%;
          background: var(--primary-light);
          pointer-events: none;
        }

        .sq-feature-item:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.08);
          border-color: rgba(20, 184, 166, 0.32);
        }

        .sq-feature-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 18px;
        }

        .sq-feature-number {
          color: var(--muted);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.12em;
        }

        .sq-feature-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: linear-gradient(
            135deg,
            var(--primary-light),
            rgba(20, 184, 166, 0.04)
          );
          border: 1px solid rgba(20, 184, 166, 0.12);
          font-size: 20px;
        }

        .sq-feature-item h3 {
          margin: 0 0 8px;
          font-size: 15px;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }

        .sq-feature-item p {
          max-width: 270px;
          margin: 0;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.65;
        }

        .sq-competition-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .sq-competition-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid var(--border);
          border-radius: 19px;
          background: var(--card, white);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.045);
          transition:
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .sq-competition-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.08);
        }

        .sq-card-banner {
          position: relative;
          height: 165px;
          overflow: hidden;
          background:
            radial-gradient(circle at 25% 20%, rgba(255, 255, 255, 0.3), transparent 24%),
            linear-gradient(135deg, rgba(15, 118, 110, 0.96), rgba(30, 64, 175, 0.9));
        }

        .sq-card-banner img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .sq-card-banner-placeholder {
          height: 100%;
          display: grid;
          place-items: center;
          font-size: 48px;
        }

        .sq-card-status {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 6px 9px;
          border-radius: 999px;
          color: white;
          background: rgba(0, 0, 0, 0.34);
          backdrop-filter: blur(8px);
          font-size: 9px;
          font-weight: 900;
        }

        .sq-card-content {
          padding: 18px;
        }

        .sq-card-sponsor {
          display: flex;
          align-items: center;
          gap: 9px;
        }

        .sq-card-logo {
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          object-fit: contain;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: white;
        }

        .sq-card-sponsor small {
          display: block;
          color: var(--muted);
          font-size: 8px;
          font-weight: 900;
          letter-spacing: 0.07em;
        }

        .sq-card-sponsor strong {
          display: block;
          font-size: 11px;
        }

        .sq-card-content h3 {
          margin: 15px 0 7px;
          font-size: 17px;
          line-height: 1.1;
        }

        .sq-card-description {
          margin: 0;
          min-height: 39px;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.55;
        }

        .sq-card-meta {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 7px;
          margin-top: 14px;
        }

        .sq-card-meta div {
          padding: 9px;
          border-radius: 9px;
          background: var(--primary-light);
        }

        .sq-card-meta span {
          display: block;
          color: var(--muted);
          font-size: 8px;
          font-weight: 800;
        }

        .sq-card-meta strong {
          display: block;
          margin-top: 2px;
          font-size: 10px;
        }

        .sq-card-button {
          width: 100%;
          min-height: 42px;
          margin-top: 13px;
          border: 0;
          border-radius: 10px;
          color: white;
          background: var(--primary);
          font-weight: 900;
          font-size: 11px;
          cursor: pointer;
        }

        .sq-card-button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .sq-card-note {
          margin: 8px 0 0;
          text-align: center;
          color: var(--muted);
          font-size: 9px;
        }

        .sq-past-section {
          position: relative;
          overflow: hidden;
          padding: clamp(28px, 4vw, 46px);
          border: 1px solid rgba(20, 184, 166, 0.14);
          border-radius: 28px;
          background:
            radial-gradient(circle at 12% 0%, rgba(20, 184, 166, 0.1), transparent 30%),
            radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.08), transparent 32%),
            linear-gradient(145deg, rgba(248, 252, 251, 0.98), rgba(239, 248, 246, 0.96));
          box-shadow: 0 18px 50px rgba(7, 50, 52, 0.06);
        }

        .sq-history-heading {
          position: relative;
          z-index: 1;
          max-width: 720px;
          margin: 0 auto 26px;
          text-align: center;
        }

        .sq-history-kicker {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 30px;
          padding: 0 12px;
          border: 1px solid rgba(20, 184, 166, 0.2);
          border-radius: 999px;
          background: rgba(20, 184, 166, 0.08);
          color: var(--primary);
          font-size: 10px;
          font-weight: 950;
          letter-spacing: 0.14em;
        }

        .sq-history-heading h2 {
          margin: 12px 0 7px;
          color: #123b38;
          font-size: clamp(28px, 3.4vw, 38px);
          line-height: 1.05;
          letter-spacing: -0.04em;
          font-weight: 950;
        }

        .sq-history-heading p {
          max-width: 560px;
          margin: 0 auto;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.65;
        }

        .sq-history-list {
          position: relative;
          z-index: 1;
          width: min(100%, 1040px);
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .sq-history-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(18, 59, 56, 0.1);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.94);
          box-shadow: 0 14px 34px rgba(7, 50, 52, 0.07);
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            border-color 160ms ease;
        }

        .sq-history-card:hover {
          transform: translateY(-3px);
          border-color: rgba(20, 184, 166, 0.28);
          box-shadow: 0 20px 42px rgba(7, 50, 52, 0.1);
        }

        .sq-history-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto;
          height: 4px;
          background: linear-gradient(90deg, var(--primary), #6ee7d5, #93c5fd);
        }

        .sq-history-card-banner {
          position: relative;
          height: 118px;
          overflow: hidden;
          background:
            radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.28), transparent 25%),
            linear-gradient(135deg, #0c3f43, #167c72 55%, #2857a4);
        }

        .sq-history-card-banner img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          opacity: 0.7;
          filter: saturate(0.78) brightness(0.82);
        }

        .sq-history-card-banner::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, rgba(6, 28, 32, 0.04), rgba(6, 28, 32, 0.48));
        }

        .sq-history-status {
          position: absolute;
          z-index: 2;
          left: 15px;
          top: 14px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          min-height: 30px;
          padding: 0 10px;
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 999px;
          background: rgba(5, 31, 34, 0.64);
          backdrop-filter: blur(9px);
          color: white;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.08em;
        }

        .sq-history-status span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #8de8d7;
          box-shadow: 0 0 0 4px rgba(141, 232, 215, 0.12);
        }

        .sq-history-card-content {
          padding: 20px;
        }

        .sq-history-sponsor {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .sq-history-sponsor-icon {
          width: 38px;
          height: 38px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(20, 184, 166, 0.16);
          border-radius: 11px;
          background: linear-gradient(135deg, var(--primary-light), rgba(20, 184, 166, 0.05));
          font-size: 18px;
        }

        .sq-history-sponsor-icon img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: white;
        }

        .sq-history-sponsor-copy {
          min-width: 0;
        }

        .sq-history-sponsor-copy span {
          display: block;
          margin-bottom: 2px;
          color: var(--muted);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .sq-history-sponsor-copy strong {
          display: block;
          overflow: hidden;
          color: #173f3b;
          font-size: 12px;
          font-weight: 900;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sq-history-card h3 {
          margin: 15px 0 6px;
          color: #123b38;
          font-size: 20px;
          line-height: 1.12;
          letter-spacing: -0.025em;
        }

        .sq-history-card-description {
          margin: 0;
          min-height: 36px;
          color: var(--muted);
          font-size: 11px;
          line-height: 1.6;
        }

        .sq-history-details {
          display: grid;
          grid-template-columns: 1.35fr 0.85fr;
          gap: 8px;
          margin-top: 16px;
        }

        .sq-history-detail {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          padding: 10px;
          border: 1px solid rgba(20, 184, 166, 0.1);
          border-radius: 12px;
          background: rgba(20, 184, 166, 0.055);
        }

        .sq-history-detail-wide {
          grid-column: 1 / -1;
        }

        .sq-history-detail-icon {
          width: 31px;
          height: 31px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border-radius: 9px;
          background: white;
          border: 1px solid rgba(20, 184, 166, 0.12);
          font-size: 14px;
        }

        .sq-history-detail-copy {
          min-width: 0;
        }

        .sq-history-detail-copy span {
          display: block;
          margin-bottom: 2px;
          color: var(--muted);
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.07em;
          text-transform: uppercase;
        }

        .sq-history-detail-copy strong {
          display: block;
          overflow: hidden;
          color: #173f3b;
          font-size: 10.5px;
          font-weight: 900;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sq-history-results {
          width: 100%;
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
          padding: 0 15px;
          border-radius: 11px;
          color: #073c37;
          background: linear-gradient(135deg, #7bead9, #55d4c5);
          box-shadow: 0 9px 22px rgba(20, 184, 166, 0.16);
          font-size: 11px;
          font-weight: 950;
          text-decoration: none;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .sq-history-results:hover {
          transform: translateY(-2px);
          box-shadow: 0 13px 28px rgba(20, 184, 166, 0.22);
        }

        .sq-history-results-arrow {
          font-size: 15px;
          line-height: 1;
        }

        .sq-empty-state {
          margin-top: 50px;
          padding: 70px 25px;
          text-align: center;
          border: 1px dashed var(--border);
          border-radius: 24px;
          background: var(--card, white);
        }

        .sq-empty-icon {
          width: 70px;
          height: 70px;
          display: grid;
          place-items: center;
          margin: 0 auto 17px;
          border-radius: 22px;
          background: var(--primary-light);
          font-size: 32px;
        }

        .sq-empty-state h2 {
          margin: 7px 0 8px;
        }

        .sq-empty-state p {
          max-width: 500px;
          margin: 0 auto;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .sq-sponsored-bottom {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 0.75fr);
          gap: 24px;
          align-items: center;
          padding: 32px;
          border-radius: 24px;
          color: white;
          background:
            radial-gradient(circle at 85% 20%, rgba(53, 228, 184, 0.18), transparent 25%),
            linear-gradient(135deg, #082a32, #103f45);
        }

        .sq-sponsored-bottom h2 {
          margin: 6px 0 8px;
          font-size: clamp(25px, 3vw, 36px);
          letter-spacing: -0.035em;
        }

        .sq-sponsored-bottom p {
          max-width: 650px;
          margin: 0;
          color: rgba(255, 255, 255, 0.67);
          font-size: 12px;
          line-height: 1.7;
        }

        .sq-sponsored-bottom .sq-section-kicker {
          color: #7ff0d9;
        }

        .sq-bottom-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .sq-bottom-stats div {
          min-width: 0;
          padding: 15px 10px;
          text-align: center;
          border-radius: 13px;
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .sq-bottom-stats strong {
          display: block;
          font-size: 22px;
          margin-bottom: 7px;
        }

        .sq-bottom-stats span {
          color: rgba(255, 255, 255, 0.63);
          font-size: 9px;
          font-weight: 800;
        }

        @media (max-width: 760px) {
          .sq-past-section {
            padding: 24px 16px;
            border-radius: 23px;
          }

          .sq-history-list {
            grid-template-columns: 1fr;
          }

          .sq-history-card-banner {
            height: 125px;
          }
        }

        @media (max-width: 520px) {
          .sq-history-heading h2 {
            font-size: 29px;
          }

          .sq-history-card-content {
            padding: 17px;
          }

          .sq-history-details {
            grid-template-columns: 1fr;
          }

          .sq-history-detail-wide {
            grid-column: auto;
          }
        }

        @media (max-width: 1050px) {
          .sq-sponsored-hero {
            grid-template-columns: minmax(0, 1fr) minmax(250px, 0.72fr);
            min-height: 380px;
            padding: 34px;
          }

          .sq-feature-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .sq-competition-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 820px) {
          .sq-sponsored-hero {
            width: 100%;
            max-width: none;
            margin-left: 0;
            transform: none;
            grid-template-columns: 1fr;
            padding: 34px 26px;
          }

          .sq-sponsored-hero-art {
            min-height: 300px;
          }

          .sq-featured-card {
            grid-template-columns: 1fr;
          }

          .sq-featured-media {
            min-height: 260px;
          }

          .sq-sponsored-bottom {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 620px) {
          .sq-sponsored-hero {
            min-height: auto;
            padding: 28px 20px;
            border-radius: 21px;
          }

          .sq-sponsored-hero h1 {
            max-width: 100%;
            font-size: clamp(34px, 10.5vw, 48px);
            line-height: 1.03;
          }

          .sq-sponsored-hero p {
            max-width: 100%;
            font-size: 13px;
            line-height: 1.62;
          }

          .sq-sponsored-hero-actions {
            align-items: stretch;
            flex-direction: column;
          }

          .sq-sponsored-primary,
          .sq-sponsored-secondary {
            width: 100%;
          }

          .sq-sponsored-trust-row {
            display: grid;
            gap: 7px;
          }

          .sq-sponsored-hero-art {
            min-height: 270px;
          }

          .sq-trophy-card {
            width: min(300px, 86%);
          }

          .sq-floating-pill {
            font-size: 8px;
            padding: 8px 10px;
          }

          .sq-pill-one {
            right: 0;
          }

          .sq-pill-two {
            left: 0;
          }

          .sq-pill-three {
            right: 0;
          }

          .sq-orbit-one {
            width: 310px;
            height: 310px;
          }

          .sq-orbit-two {
            width: 390px;
            height: 390px;
          }

          .sq-access-banner {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .sq-access-copy {
            flex-basis: calc(100% - 62px);
          }

          .sq-access-button {
            width: 100%;
          }

          .sq-section-heading {
            align-items: flex-start;
            flex-direction: column;
            gap: 8px;
          }

          .sq-feature-grid,
          .sq-competition-grid {
            grid-template-columns: 1fr;
          }

          .sq-feature-item {
            min-height: 0;
            padding: 18px;
          }

          .sq-featured-content {
            padding: 22px;
          }

          .sq-featured-actions {
            flex-direction: column;
            align-items: stretch;
          }

          .sq-sponsored-bottom {
            padding: 24px 20px;
            border-radius: 20px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sq-sponsored-primary,
          .sq-sponsored-secondary,
          .sq-feature-item,
          .sq-competition-card {
            transition: none;
          }

          .sq-sponsored-spinner {
            animation: none;
          }
        }
        `}</style>
      </main>
    </>
  );
}

function FeaturedCompetition({
  competition,
  premium,
  onJoin,
}: {
  competition: Competition;
  premium: boolean;
  onJoin: (competition: Competition) => void;
}) {
  const status = statusOf(competition);
  const rules = splitText(competition.rules);
  const prizes = splitText(competition.prizes);

  return (
    <article className="sq-featured-card">
      <div className="sq-featured-media">
        {competition.sponsor_banner_url ? (
          <img src={competition.sponsor_banner_url} alt="" />
        ) : null}

        <div className="sq-featured-media-overlay">
          <span className="sq-featured-status">
            {status === "live"
              ? "● LIVE NOW"
              : `STARTS IN ${getCountdown(competition.starts_at).toUpperCase()}`}
          </span>

          <div className="sq-featured-media-copy">
            <h3>{competition.title}</h3>
            <p>
              {competition.sponsor_description ||
                "A special sponsored Sahaba Quest competition."}
            </p>
          </div>
        </div>
      </div>

      <div className="sq-featured-content">
        <div className="sq-sponsor-line">
          {competition.sponsor_logo_url ? (
            <img
              src={competition.sponsor_logo_url}
              alt=""
              className="sq-sponsor-logo"
            />
          ) : (
            <div className="sq-sponsor-logo" />
          )}

          <div>
            <span className="sq-sponsor-caption">SPONSORED BY</span>
            <span className="sq-sponsor-name">{competition.sponsor_name}</span>
          </div>
        </div>

        <h3>{status === "live" ? "Ready to compete?" : "Mark your calendar."}</h3>

        <p>
          {competition.description ||
            "Challenge yourself with a special Islamic knowledge competition."}
        </p>

        <div className="sq-meta-grid">
          <div className="sq-meta-box">
            <span>FORMAT</span>
            <strong>{competition.competition_type}</strong>
          </div>

          <div className="sq-meta-box">
            <span>STARTS</span>
            <strong>{formatDate(competition.starts_at)}</strong>
          </div>

          <div className="sq-meta-box">
            <span>ENDS</span>
            <strong>{formatDate(competition.ends_at)}</strong>
          </div>

          <div className="sq-meta-box">
            <span>RULES</span>
            <strong>{rules.length || "See details"}</strong>
          </div>

          <div className="sq-meta-box">
            <span>PRIZES</span>
            <strong>{prizes.length ? "Available" : "See details"}</strong>
          </div>
        </div>

        <div className="sq-featured-actions">
          <button
            type="button"
            className="sq-featured-primary"
            disabled={status !== "live"}
            onClick={() => onJoin(competition)}
            style={{
              opacity: status === "live" ? 1 : 0.55,
              cursor: status === "live" ? "pointer" : "not-allowed",
              border: 0,
            }}
          >
            {status === "live"
              ? premium
                ? "Join Competition"
                : "View Access"
              : "Coming Soon"}
          </button>

          {status === "live" && !premium && (
            <Link href="/pricing" className="sq-featured-secondary">
              Get Premium
            </Link>
          )}
        </div>
      </div>

      <style jsx>{`
        .sq-featured-card {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 0.88fr) minmax(340px, 1.12fr);
          min-height: 285px;
          border-radius: 24px;
          border: 1px solid var(--border);
          background: var(--card, white);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.07);
        }

        .sq-featured-media {
          position: relative;
          min-height: 285px;
          background:
            linear-gradient(135deg, rgba(10, 45, 51, 0.95), rgba(20, 125, 115, 0.74)),
            var(--primary-light);
        }

        .sq-featured-media img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          opacity: 0.72;
        }

        .sq-featured-media-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 22px;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08),
            rgba(0, 0, 0, 0.58)
          );
          color: white;
        }

        .sq-featured-status {
          align-self: flex-start;
          padding: 7px 10px;
          border-radius: 999px;
          background: rgba(0, 0, 0, 0.28);
          border: 1px solid rgba(255, 255, 255, 0.2);
          backdrop-filter: blur(8px);
          font-size: 10px;
          font-weight: 900;
        }

        .sq-featured-media-copy h3 {
          margin: 0 0 6px;
          font-size: clamp(28px, 4vw, 48px);
          line-height: 0.98;
          letter-spacing: -0.04em;
        }

        .sq-featured-media-copy p {
          margin: 0;
          max-width: 560px;
          color: rgba(255, 255, 255, 0.78);
          font-size: 12px;
          line-height: 1.55;
        }

        .sq-featured-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 30px;
        }

        .sq-sponsor-line {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
        }

        .sq-sponsor-logo {
          width: 42px;
          height: 42px;
          flex: 0 0 auto;
          object-fit: contain;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: white;
        }

        .sq-sponsor-caption {
          display: block;
          color: var(--muted);
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.08em;
        }

        .sq-sponsor-name {
          display: block;
          font-size: 12px;
          font-weight: 900;
        }

        .sq-featured-content h3 {
          margin: 0 0 9px;
          font-size: 24px;
          line-height: 1.05;
          letter-spacing: -0.025em;
        }

        .sq-featured-content > p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.65;
        }

        .sq-meta-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          margin-top: 20px;
        }

        .sq-meta-box {
          padding: 10px;
          border-radius: 11px;
          background: var(--primary-light);
        }

        .sq-meta-box span {
          display: block;
          color: var(--muted);
          font-size: 9px;
          font-weight: 800;
        }

        .sq-meta-box strong {
          display: block;
          margin-top: 2px;
          font-size: 12px;
        }

        .sq-featured-actions {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 18px;
        }

        .sq-featured-actions button,
        .sq-featured-actions a {
          flex: 1;
        }

        .sq-featured-primary,
        .sq-featured-secondary {
          min-height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 15px;
          border-radius: 11px;
          font-size: 11px;
          font-weight: 900;
          text-decoration: none;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .sq-featured-primary {
          border: 1px solid rgba(20, 184, 166, 0.2);
          color: #063033;
          background: linear-gradient(135deg, #7bead9, #4fd1c5);
          box-shadow: 0 9px 22px rgba(20, 184, 166, 0.18);
          cursor: pointer;
        }

        .sq-featured-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 13px 28px rgba(20, 184, 166, 0.24);
        }

        .sq-featured-primary:disabled {
          cursor: not-allowed;
        }

        .sq-featured-secondary {
          color: var(--primary);
          border: 1px solid rgba(20, 184, 166, 0.22);
          background: var(--primary-light);
        }

        .sq-featured-secondary:hover {
          transform: translateY(-2px);
          background: rgba(20, 184, 166, 0.14);
        }

        .sq-sponsor-line {
          padding: 10px 12px;
          border: 1px solid var(--border);
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            var(--card, #fff),
            var(--primary-light)
          );
        }

        .sq-meta-box {
          border: 1px solid rgba(20, 184, 166, 0.1);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }

        @media (max-width: 820px) {
          .sq-featured-card {
            grid-template-columns: 1fr;
          }

          .sq-featured-media {
            min-height: 220px;
          }
        }

        @media (max-width: 620px) {
          .sq-featured-content {
            padding: 22px;
          }

          .sq-featured-actions {
            flex-direction: column;
            align-items: stretch;
          }
        }
      `}</style>
    </article>
  );
}

function PastCompetitionCard({
  competition,
}: {
  competition: Competition;
}) {
  return (
    <article className="sq-history-card">
      <div className="sq-history-card-banner">
        {competition.sponsor_banner_url ? (
          <img src={competition.sponsor_banner_url} alt="" />
        ) : (
          <div className="sq-card-banner-placeholder">🏆</div>
        )}

        <span className="sq-history-status">
          <span aria-hidden="true" />
          COMPLETED
        </span>
      </div>

      <div className="sq-history-card-content">
        <div className="sq-history-sponsor">
          <div className="sq-history-sponsor-icon" aria-hidden="true">
            {competition.sponsor_logo_url ? (
              <img src={competition.sponsor_logo_url} alt="" />
            ) : (
              "🤝"
            )}
          </div>

          <div className="sq-history-sponsor-copy">
            <span>SPONSORED BY</span>
            <strong>{competition.sponsor_name}</strong>
          </div>
        </div>

        <h3>{competition.title}</h3>

        <p className="sq-history-card-description">
          {competition.description ||
            "A special Sahaba Quest sponsored competition."}
        </p>

        <div className="sq-history-details">
          <div className="sq-history-detail sq-history-detail-wide">
            <div className="sq-history-detail-icon" aria-hidden="true">📅</div>
            <div className="sq-history-detail-copy">
              <span>HELD</span>
              <strong>
                {formatHistoryDate(competition.starts_at)} — {formatHistoryDate(competition.ends_at)}
              </strong>
            </div>
          </div>

          <div className="sq-history-detail">
            <div className="sq-history-detail-icon" aria-hidden="true">🔄</div>
            <div className="sq-history-detail-copy">
              <span>FORMAT</span>
              <strong>
                {competition.competition_type === "weekly" ? "Weekly" : "Monthly"}
              </strong>
            </div>
          </div>

          <div className="sq-history-detail">
            <div className="sq-history-detail-icon" aria-hidden="true">🏆</div>
            <div className="sq-history-detail-copy">
              <span>RESULTS</span>
              <strong>Final leaderboard</strong>
            </div>
          </div>
        </div>

        <Link
          href={`/sponsored-competitions/${competition.id}/leaderboard`}
          className="sq-history-results"
        >
          <span className="sq-history-results-icon" aria-hidden="true">
            🏆
          </span>
          <span className="sq-history-results-label">
            View Results &amp; Leaderboard
          </span>
          <span className="sq-history-results-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <style jsx>{`
        .sq-history-card {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border: 1px solid rgba(18, 59, 56, 0.1);
          border-radius: 22px;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(7, 50, 52, 0.07);
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            border-color 160ms ease;
        }

        .sq-history-card:hover {
          transform: translateY(-3px);
          border-color: rgba(20, 184, 166, 0.28);
          box-shadow: 0 20px 42px rgba(7, 50, 52, 0.1);
        }

        .sq-history-card::before {
          content: "";
          position: absolute;
          inset: 0 0 auto;
          z-index: 5;
          height: 4px;
          background: linear-gradient(
            90deg,
            var(--primary),
            #6ee7d5,
            #93c5fd
          );
        }

        .sq-history-card-banner {
          position: relative;
          height: 126px;
          overflow: hidden;
          background:
            radial-gradient(
              circle at 25% 25%,
              rgba(255, 255, 255, 0.28),
              transparent 25%
            ),
            linear-gradient(
              135deg,
              #0c3f43,
              #167c72 55%,
              #2857a4
            );
        }

        .sq-history-card-banner img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          opacity: 0.68;
          filter: saturate(0.78) brightness(0.82);
        }

        .sq-history-card-banner::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            180deg,
            rgba(6, 28, 32, 0.04),
            rgba(6, 28, 32, 0.52)
          );
        }

        .sq-history-status {
          position: absolute;
          z-index: 3;
          left: 16px;
          top: 16px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-height: 32px;
          padding: 0 11px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 999px;
          background: rgba(5, 31, 34, 0.68);
          backdrop-filter: blur(9px);
          color: #ffffff;
          font-size: 9px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .sq-history-status span {
          width: 7px;
          height: 7px;
          flex: 0 0 auto;
          border-radius: 50%;
          background: #8de8d7;
          box-shadow: 0 0 0 4px rgba(141, 232, 215, 0.12);
        }

        .sq-history-card-content {
          padding: 22px;
        }

        .sq-history-sponsor {
          display: flex;
          align-items: center;
          gap: 11px;
          min-width: 0;
          padding: 10px 12px;
          border: 1px solid rgba(20, 184, 166, 0.12);
          border-radius: 14px;
          background: linear-gradient(
            135deg,
            #ffffff,
            rgba(20, 184, 166, 0.045)
          );
        }

        .sq-history-sponsor-icon {
          width: 40px;
          height: 40px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          overflow: hidden;
          border: 1px solid rgba(20, 184, 166, 0.16);
          border-radius: 11px;
          background: linear-gradient(
            135deg,
            var(--primary-light),
            rgba(20, 184, 166, 0.05)
          );
          color: var(--primary);
          font-size: 18px;
        }

        .sq-history-sponsor-icon img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: contain;
          background: #ffffff;
        }

        .sq-history-sponsor-copy {
          min-width: 0;
        }

        .sq-history-sponsor-copy span {
          display: block;
          margin-bottom: 3px;
          color: var(--muted);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.1em;
        }

        .sq-history-sponsor-copy strong {
          display: block;
          overflow: hidden;
          color: #173f3b;
          font-size: 13px;
          font-weight: 900;
          line-height: 1.25;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .sq-history-card h3 {
          margin: 17px 0 7px;
          color: #123b38;
          font-size: 21px;
          line-height: 1.12;
          letter-spacing: -0.025em;
        }

        .sq-history-card-description {
          margin: 0;
          color: var(--muted);
          font-size: 11.5px;
          line-height: 1.6;
        }

        .sq-history-details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 9px;
          margin-top: 18px;
        }

        .sq-history-detail {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px;
          border: 1px solid rgba(20, 184, 166, 0.11);
          border-radius: 13px;
          background: rgba(20, 184, 166, 0.045);
        }

        .sq-history-detail-wide {
          grid-column: 1 / -1;
        }

        .sq-history-detail-icon {
          width: 36px;
          height: 36px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          border: 1px solid rgba(20, 184, 166, 0.13);
          border-radius: 10px;
          background: #ffffff;
          font-size: 16px;
          box-shadow: 0 3px 9px rgba(7, 50, 52, 0.04);
        }

        .sq-history-detail-copy {
          min-width: 0;
          flex: 1;
        }

        .sq-history-detail-copy span {
          display: block;
          margin-bottom: 4px;
          color: var(--muted);
          font-size: 8px;
          font-weight: 950;
          letter-spacing: 0.09em;
          text-transform: uppercase;
        }

        .sq-history-detail-copy strong {
          display: block;
          color: #173f3b;
          font-size: 12px;
          font-weight: 900;
          line-height: 1.35;
        }

        .sq-history-results {
          width: 100%;
          min-height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          box-sizing: border-box;
          margin-top: 15px;
          padding: 0 17px;
          border: 1px solid rgba(20, 184, 166, 0.18);
          border-radius: 12px;
          color: #073c37;
          background: linear-gradient(135deg, #7bead9, #55d4c5);
          box-shadow: 0 9px 22px rgba(20, 184, 166, 0.16);
          font-size: 11.5px;
          font-weight: 950;
          text-decoration: none;
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            filter 160ms ease;
        }

        .sq-history-results:hover {
          transform: translateY(-2px);
          filter: brightness(1.02);
          box-shadow: 0 13px 28px rgba(20, 184, 166, 0.23);
        }

        .sq-history-results:focus-visible {
          outline: 3px solid rgba(20, 184, 166, 0.28);
          outline-offset: 3px;
        }

        .sq-history-results-icon {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.35);
          font-size: 14px;
        }

        .sq-history-results-label {
          text-align: center;
        }

        .sq-history-results-arrow {
          font-size: 16px;
          line-height: 1;
        }

        .sq-card-banner-placeholder {
          height: 100%;
          display: grid;
          place-items: center;
          color: rgba(255, 255, 255, 0.9);
          font-size: 44px;
        }

        @media (max-width: 760px) {
          .sq-history-card-content {
            padding: 19px;
          }

          .sq-history-card-banner {
            height: 122px;
          }
        }

        @media (max-width: 520px) {
          .sq-history-details {
            grid-template-columns: 1fr;
          }

          .sq-history-detail-wide {
            grid-column: auto;
          }

          .sq-history-detail-copy strong {
            font-size: 11.5px;
          }

          .sq-history-results {
            min-height: 46px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sq-history-card,
          .sq-history-results {
            transition: none;
          }
        }
      `}</style>
    </article>
  );
}

function Feature({
  icon,
  title,
  text,
  number,
}: {
  icon: string;
  title: string;
  text: string;
  number: string;
}) {
  return (
    <article className="sq-feature-item">
      <div className="sq-feature-top">
        <div className="sq-feature-icon">{icon}</div>
        <span className="sq-feature-number">{number}</span>
      </div>

      <div className="sq-feature-copy">
        <h3>{title}</h3>
        <p>{text}</p>
      </div>

      <span className="sq-feature-accent" aria-hidden="true" />

      <style jsx>{`
        .sq-feature-item {
          position: relative;
          min-width: 0;
          min-height: 188px;
          padding: 18px;
          overflow: hidden;
          border: 1px solid rgba(20, 184, 166, 0.14);
          border-radius: 18px;
          background:
            radial-gradient(
              circle at 100% 0%,
              rgba(20, 184, 166, 0.12),
              transparent 36%
            ),
            linear-gradient(
              145deg,
              var(--card, #ffffff),
              rgba(20, 184, 166, 0.035)
            );
          box-shadow:
            0 10px 28px rgba(0, 0, 0, 0.045),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
          transition:
            transform 160ms ease,
            box-shadow 160ms ease,
            border-color 160ms ease;
        }

        .sq-feature-item:hover {
          transform: translateY(-4px);
          border-color: rgba(20, 184, 166, 0.3);
          box-shadow: 0 18px 38px rgba(0, 0, 0, 0.08);
        }

        .sq-feature-item::before {
          content: "";
          position: absolute;
          left: 18px;
          right: 18px;
          top: 0;
          height: 3px;
          border-radius: 0 0 999px 999px;
          background: linear-gradient(
            90deg,
            var(--primary),
            rgba(20, 184, 166, 0.08)
          );
        }

        .sq-feature-item::after {
          content: "";
          position: absolute;
          width: 105px;
          height: 105px;
          right: -58px;
          bottom: -58px;
          border-radius: 50%;
          background: rgba(20, 184, 166, 0.07);
          pointer-events: none;
        }

        .sq-feature-top {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .sq-feature-icon {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          border: 1px solid rgba(20, 184, 166, 0.14);
          background: linear-gradient(
            135deg,
            var(--primary-light),
            rgba(20, 184, 166, 0.05)
          );
          font-size: 20px;
          box-shadow: 0 7px 18px rgba(20, 184, 166, 0.08);
        }

        .sq-feature-number {
          width: 30px;
          height: 30px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          border: 1px solid rgba(20, 184, 166, 0.16);
          background: rgba(20, 184, 166, 0.07);
          color: var(--primary);
          font-size: 10px;
          font-weight: 900;
        }

        .sq-feature-copy {
          position: relative;
          z-index: 1;
          margin-top: 17px;
          padding: 13px 13px 14px;
          border-radius: 13px;
          border: 1px solid rgba(20, 184, 166, 0.1);
          background: rgba(255, 255, 255, 0.58);
        }

        .sq-feature-copy h3 {
          margin: 0 0 7px;
          font-size: 14px;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }

        .sq-feature-copy p {
          margin: 0;
          color: var(--muted);
          font-size: 10.5px;
          line-height: 1.62;
        }

        .sq-feature-accent {
          position: absolute;
          left: 18px;
          bottom: 14px;
          width: 34px;
          height: 3px;
          border-radius: 999px;
          background: var(--primary);
          opacity: 0.35;
        }

        @media (max-width: 620px) {
          .sq-feature-item {
            min-height: 0;
            padding: 17px;
          }

          .sq-feature-copy {
            padding: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .sq-feature-item {
            transition: none;
          }
        }
      `}</style>
    </article>
  );
}

function SectionTitle({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="sq-section-heading">
      <div>
        <span className="sq-section-kicker">{kicker}</span>
        <h2>{title}</h2>
      </div>
      <p
        style={{
          maxWidth: 470,
          margin: 0,
          color: "var(--muted)",
          fontSize: 12,
          lineHeight: 1.6,
        }}
      >
        {subtitle}
      </p>
    </div>
  );
}

function CompetitionCard({
  competition,
  onJoin,
  premium,
}: {
  competition: Competition;
  onJoin: (competition: Competition) => void;
  premium: boolean;
}) {
  const status = statusOf(competition);

  return (
    <article className="sq-competition-card">
      <div className="sq-card-banner">
        {competition.sponsor_banner_url ? (
          <img src={competition.sponsor_banner_url} alt="" />
        ) : (
          <div className="sq-card-banner-placeholder">🏆</div>
        )}

        <span className="sq-card-status">
          {status === "live"
            ? "● LIVE"
            : status === "upcoming"
              ? `STARTS IN ${getCountdown(competition.starts_at).toUpperCase()}`
              : "ENDED"}
        </span>
      </div>

      <div className="sq-card-content">
        <div className="sq-card-sponsor">
          {competition.sponsor_logo_url ? (
            <img
              src={competition.sponsor_logo_url}
              alt=""
              className="sq-card-logo"
            />
          ) : (
            <div className="sq-card-logo" />
          )}

          <div>
            <small>SPONSORED BY</small>
            <strong>{competition.sponsor_name}</strong>
          </div>
        </div>

        <h3>{competition.title}</h3>

        <p className="sq-card-description">
          {competition.description ||
            "A special Sahaba Quest sponsored competition."}
        </p>

        <div className="sq-card-meta">
          <div>
            <span>TYPE</span>
            <strong>{competition.competition_type}</strong>
          </div>

          <div>
            <span>START</span>
            <strong>{formatDate(competition.starts_at)}</strong>
          </div>

          <div>
            <span>END</span>
            <strong>{formatDate(competition.ends_at)}</strong>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onJoin(competition)}
          disabled={status !== "live"}
          className="sq-card-button"
        >
          {status === "live"
            ? premium
              ? "Join Competition"
              : "View Access"
            : status === "upcoming"
              ? "Coming Soon"
              : "Competition Ended"}
        </button>

        {status === "live" && !premium && (
          <p className="sq-card-note">
            Individual Premium is required to participate.
          </p>
        )}
      </div>
    </article>
  );
}
