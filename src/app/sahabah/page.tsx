import type { Metadata } from "next";
import Link from "next/link";
import { sahabahProfiles } from "@/data/sahabah-data";

const SITE_URL = "https://sahabaquest.com.ng";

export const metadata: Metadata = {
  title: "Sahaba | Learn About the Companions | Sahaba Quest",
  description:
    "Explore concise, public knowledge profiles about the Sahaba and discover the people, history and lessons behind Sahaba Quest.",
  alternates: {
    canonical: `${SITE_URL}/sahabah`,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/sahabah#collection`,
      url: `${SITE_URL}/sahabah`,
      name: "Sahabah | Sahaba Quest",
      description:
        "Explore public knowledge profiles about the Companions of the Prophet Muhammad ﷺ.",
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Home",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Sahaba",
          item: `${SITE_URL}/sahabah`,
        },
      ],
    },
  ],
};

export default function SahabahDirectoryPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.75), transparent 30%), var(--background)",
      }}
    >
      <header className="sq-nav">
        <Link href="/" className="sq-logo">
          Sahaba Quest
        </Link>
        <Link
          href="/signup"
          className="sq-button-primary"
          style={{ minHeight: "42px", padding: "0 16px", fontSize: "13px" }}
        >
          Create Account
        </Link>
      </header>

      <section className="sq-page">
        <div className="sq-container" style={{ maxWidth: "1120px" }}>
          <nav
            aria-label="Breadcrumb"
            style={{
              fontSize: "13px",
              color: "var(--muted)",
              marginBottom: "24px",
            }}
          >
            <Link href="/" style={{ color: "var(--primary)", fontWeight: 700 }}>
              Home
            </Link>
            <span aria-hidden="true"> / </span>
            <span>Sahabah</span>
          </nav>

          <section
            className="sq-card"
            style={{
              padding: "44px",
              background:
                "linear-gradient(145deg, #115e59 0%, #0f766e 62%, #149e93 100%)",
              color: "white",
              border: "none",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                width: "300px",
                height: "300px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.06)",
                right: "-100px",
                top: "-130px",
              }}
            />

            <div style={{ position: "relative", zIndex: 1 }}>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.72)",
                }}
              >
                Sahaba Quest Knowledge
              </div>

              <h1
                style={{
                  margin: "14px 0 14px",
                  fontSize: "clamp(34px, 5vw, 54px)",
                  lineHeight: 1.05,
                  letterSpacing: "-1.5px",
                  fontWeight: 900,
                }}
              >
                Explore the Sahaba.
              </h1>

              <p
                style={{
                  maxWidth: "700px",
                  margin: 0,
                  fontSize: "16px",
                  lineHeight: 1.8,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                Start with these public knowledge profiles and discover the
                people whose lives and history form part of the learning
                experience behind Sahaba Quest.
              </p>
            </div>
          </section>

          <section style={{ marginTop: "42px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "18px",
              }}
            >
              {sahabahProfiles.map((profile) => (
                <article
                  key={profile.slug}
                  className="sq-card"
                  style={{ padding: "28px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: "16px",
                    }}
                  >
                    <div>
                      <span className="sq-badge">{profile.title}</span>
                      <h2
                        style={{
                          margin: "16px 0 5px",
                          fontSize: "24px",
                          lineHeight: 1.2,
                          fontWeight: 900,
                        }}
                      >
                        {profile.name}
                      </h2>
                      <div
                        lang="ar"
                        dir="rtl"
                        style={{
                          color: "var(--muted)",
                          fontSize: "15px",
                          fontWeight: 700,
                        }}
                      >
                        {profile.arabicName}
                      </div>
                    </div>
                  </div>

                  <p
                    style={{
                      margin: "18px 0 0",
                      color: "var(--muted)",
                      fontSize: "14px",
                      lineHeight: 1.75,
                    }}
                  >
                    {profile.summary}
                  </p>

                  <Link
                    href={`/sahabah/${profile.slug}`}
                    className="sq-button-secondary"
                    style={{
                      display: "inline-flex",
                      marginTop: "22px",
                      minHeight: "44px",
                      alignItems: "center",
                    }}
                  >
                    Explore Profile →
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section
            className="sq-card"
            style={{
              marginTop: "28px",
              padding: "30px",
              textAlign: "center",
              background:
                "linear-gradient(135deg, var(--primary-light), var(--white))",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: 900 }}>
              Learn through play.
            </h2>
            <p
              className="sq-subtitle"
              style={{ maxWidth: "650px", margin: "10px auto 0" }}
            >
              These public pages are the beginning of a growing Sahaba Quest
              knowledge library. Create an account to continue into quizzes,
              quests, challenges and progress tracking.
            </p>
            <Link
              href="/signup"
              className="sq-button-primary"
              style={{ display: "inline-flex", marginTop: "18px" }}
            >
              Start Your Journey →
            </Link>
          </section>
        </div>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <style>{`
        @media (max-width: 700px) {
          .sq-container > section:nth-of-type(2) > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
