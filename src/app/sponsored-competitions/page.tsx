"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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
            .select("id,current_period_end,status,subscription_plans!inner(plan_type)")
            .eq("user_id", auth.user.id)
            .eq("status", "active")
            .eq("subscription_plans.plan_type", "plus")
            .gt("current_period_end", new Date().toISOString())
            .limit(1)
            .maybeSingle(),

          supabase
            .from("sponsored_competitions")
            .select("id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published")
            .eq("is_published", true)
            .order("starts_at", { ascending: false }),
        ]);

      if (!mounted) return;

      if (profileResult.error) {
        setMessage(profileResult.error.message);
        setLoading(false);
        return;
      }

      const type = profileResult.data?.account_type as AccountType | undefined;

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

  function join(c: Competition) {
    if (statusOf(c) !== "live") return;

    if (accountType !== "individual" || !hasPremium) {
      router.push("/pricing");
      return;
    }

    router.push(`/sponsored-competitions/${c.id}`);
  }

  if (loading) {
    return <main style={{ padding: 60, textAlign: "center" }}>⏳<h3>Loading sponsored competitions...</h3></main>;
  }

  return (
    <main>
      <section style={{ marginBottom: 26 }}>
        <span className="sq-badge">Sponsored Competitions</span>
        <h1 className="sq-title" style={{ marginTop: 12, marginBottom: 8 }}>
          Compete. Learn. Win.
        </h1>
        <p className="sq-subtitle" style={{ margin: 0, maxWidth: 700 }}>
          Take part in special competitions sponsored by Muslim organizations and brands.
          Sponsored XP is separate from your normal Sahaba Quest XP and leaderboard.
        </p>
      </section>

      {accountType === "free" && (
        <section className="sq-card" style={{ padding: 18, marginBottom: 22 }}>
          <strong>Sponsored competitions are available to view.</strong>
          <p className="sq-subtitle" style={{ marginBottom: 12 }}>
            You can see the competitions, sponsors, rules and prizes. Participation requires an active Individual Premium subscription.
          </p>
          <Link href="/pricing" className="sq-button-primary">View Pricing</Link>
        </section>
      )}

      {message && (
        <section className="sq-card" style={{ padding: 16, marginBottom: 20 }}>
          <strong>Notice</strong>
          <p className="sq-subtitle" style={{ marginBottom: 0 }}>{message}</p>
        </section>
      )}

      {competitions.length === 0 ? (
        <section className="sq-card" style={{ padding: 55, textAlign: "center" }}>
          <div style={{ fontSize: 46 }}>🏆</div>
          <h2>No sponsored competitions yet</h2>
          <p className="sq-subtitle">New competitions will appear here when they are published.</p>
        </section>
      ) : (
        <>
          {active.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ marginBottom: 14 }}>Live Now</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
                {active.map((c) => (
                  <CompetitionCard key={c.id} competition={c} onJoin={join} premium={accountType === "individual" && hasPremium} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ marginBottom: 14 }}>Coming Soon</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
                {upcoming.map((c) => (
                  <CompetitionCard key={c.id} competition={c} onJoin={join} premium={accountType === "individual" && hasPremium} />
                ))}
              </div>
            </section>
          )}

          {ended.length > 0 && (
            <section>
              <h2 style={{ marginBottom: 14 }}>Past Competitions</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
                {ended.map((c) => (
                  <CompetitionCard key={c.id} competition={c} onJoin={join} premium={accountType === "individual" && hasPremium} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
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
    <article className="sq-card" style={{ overflow: "hidden" }}>
      {competition.sponsor_banner_url ? (
        <img src={competition.sponsor_banner_url} alt="" style={{ width: "100%", height: 150, objectFit: "cover", display: "block" }} />
      ) : (
        <div style={{ height: 100, background: "var(--primary-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36 }}>🏆</div>
      )}

      <div style={{ padding: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {competition.sponsor_logo_url && (
            <img src={competition.sponsor_logo_url} alt="" style={{ width: 38, height: 38, objectFit: "contain", border: "1px solid var(--border)", borderRadius: 8 }} />
          )}
          <div>
            <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 800 }}>SPONSORED BY</div>
            <strong style={{ fontSize: 13 }}>{competition.sponsor_name}</strong>
          </div>
        </div>

        <h3 style={{ marginTop: 16, marginBottom: 7 }}>{competition.title}</h3>

        <p className="sq-subtitle" style={{ fontSize: 12, minHeight: 40 }}>
          {competition.description || "A special Sahaba Quest sponsored competition."}
        </p>

        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.7 }}>
          <div>{competition.competition_type} • {status}</div>
          <div>Starts: {formatDate(competition.starts_at)}</div>
          <div>Ends: {formatDate(competition.ends_at)}</div>
        </div>

        <button
          type="button"
          onClick={() => onJoin(competition)}
          disabled={status !== "live"}
          className="sq-button-primary"
          style={{ border: 0, cursor: status === "live" ? "pointer" : "not-allowed", marginTop: 16, width: "100%", opacity: status === "live" ? 1 : .6 }}
        >
          {status === "live"
            ? premium ? "Join Competition" : "Join / View Access"
            : status === "upcoming" ? "Coming Soon" : "Competition Ended"}
        </button>
      </div>
    </article>
  );
}
