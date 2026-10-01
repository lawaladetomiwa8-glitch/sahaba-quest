import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://sahabaquest.com.ng";
const SITE_NAME = "Sahaba Quest";
const SITE_LOGO =
  "https://cdn.phototourl.com/member/2026-09-30-957223ee-05a5-4299-9fc6-c4ca9f12695a.png";

const aboutStructuredData = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "@id": `${SITE_URL}/about#about`,
  url: `${SITE_URL}/about`,
  name: `About ${SITE_NAME}`,
  description:
    "Learn about Sahaba Quest, a gamified Islamic learning platform designed to help Muslims learn about the Sahabah and Sahabiyat through interactive learning and competition.",
  isPartOf: {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
  },
  about: {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    legalName: "Deen Skyline Limited",
    url: SITE_URL,
    logo: SITE_LOGO,
  },
};

export const metadata: Metadata = {
  title: "About Sahaba Quest",
  description:
    "Learn about Sahaba Quest, a gamified Islamic learning platform for learning about the Sahabah and Sahabiyat through quizzes, quests, challenges, competitions and leaderboards.",
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/about`,
    siteName: SITE_NAME,
    title: "About Sahaba Quest",
    description:
      "Discover the purpose behind Sahaba Quest and how the platform combines Islamic learning with interactive quizzes, quests, challenges and friendly competition.",
    images: [
      {
        url: SITE_LOGO,
        alt: "Sahaba Quest",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "About Sahaba Quest",
    description:
      "Discover the purpose behind Sahaba Quest and how the platform combines Islamic learning with interactive quizzes, quests, challenges and friendly competition.",
    images: [SITE_LOGO],
  },
};

export default function AboutPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.75), transparent 30%), var(--background)",
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(aboutStructuredData).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />

      <header className="sq-nav">
        <Link href="/" className="sq-logo">
          Sahaba Quest
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <Link
            href="/sahabah"
            className="sq-button-secondary"
            style={{
              minHeight: "42px",
              padding: "0 15px",
              fontSize: "13px",
            }}
          >
            Explore Sahabah
          </Link>

          <Link
            href="/signup"
            className="sq-button-primary"
            style={{
              minHeight: "42px",
              padding: "0 16px",
              fontSize: "13px",
            }}
          >
            Create Account
          </Link>
        </div>
      </header>

      <section className="sq-page">
        <div
          className="sq-container"
          style={{
            maxWidth: "1080px",
          }}
        >
          <div
            style={{
              maxWidth: "760px",
              margin: "0 auto 38px",
              textAlign: "center",
            }}
          >
            <span className="sq-badge">About Sahaba Quest</span>

            <h1
              style={{
                margin: "18px 0 14px",
                fontSize: "clamp(38px, 6vw, 58px)",
                lineHeight: 1.05,
                fontWeight: 900,
                letterSpacing: "-1.8px",
              }}
            >
              Learn. Remember. Compete.
            </h1>

            <p
              className="sq-subtitle"
              style={{
                maxWidth: "700px",
                margin: "0 auto",
                fontSize: "17px",
                lineHeight: 1.8,
              }}
            >
              Sahaba Quest is a gamified Islamic learning platform designed
              to help Muslims discover and learn about the Sahabah and
              Sahabiyat through interactive learning experiences.
            </p>
          </div>

          <section
            className="sq-card"
            style={{
              padding: "38px",
              marginBottom: "20px",
            }}
          >
            <span className="sq-badge">Our Purpose</span>

            <h2
              style={{
                margin: "16px 0 12px",
                fontSize: "30px",
                fontWeight: 900,
              }}
            >
              Making Islamic learning more engaging
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: "15px",
                lineHeight: 1.85,
              }}
            >
              Sahaba Quest was created to combine meaningful Islamic learning
              with modern game-inspired experiences. The platform uses quizzes,
              quests, challenges, progress tracking, XP, competitions and
              leaderboards to encourage consistent learning about the
              Companions of the Messenger of Allah ﷺ.
            </p>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "18px",
              marginTop: "20px",
            }}
            className="about-feature-grid"
          >
            <div className="sq-card" style={{ padding: "26px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "15px",
                  background: "var(--primary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                📚
              </div>

              <h2
                style={{
                  margin: "18px 0 8px",
                  fontSize: "19px",
                  fontWeight: 800,
                }}
              >
                Learn
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                Explore questions and public knowledge resources about the
                Sahabah and Sahabiyat.
              </p>
            </div>

            <div className="sq-card" style={{ padding: "26px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "15px",
                  background: "var(--secondary-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                🎮
              </div>

              <h2
                style={{
                  margin: "18px 0 8px",
                  fontSize: "19px",
                  fontWeight: 800,
                }}
              >
                Engage
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                Turn learning into an active experience through quizzes,
                quests, daily activities and challenges.
              </p>
            </div>

            <div className="sq-card" style={{ padding: "26px" }}>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "15px",
                  background: "var(--success-light)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "24px",
                }}
              >
                🏆
              </div>

              <h2
                style={{
                  margin: "18px 0 8px",
                  fontSize: "19px",
                  fontWeight: 800,
                }}
              >
                Grow
              </h2>

              <p
                style={{
                  margin: 0,
                  color: "var(--muted)",
                  fontSize: "14px",
                  lineHeight: 1.7,
                }}
              >
                Build XP, follow your progress and participate in friendly
                competitions and leaderboards.
              </p>
            </div>
          </section>

          <section
            className="sq-card"
            style={{
              marginTop: "20px",
              padding: "38px",
            }}
          >
            <span className="sq-badge">Who It Is For</span>

            <h2
              style={{
                margin: "16px 0 12px",
                fontSize: "30px",
                fontWeight: 900,
              }}
            >
              Built for individuals, families and learning communities
            </h2>

            <p
              style={{
                margin: 0,
                color: "var(--muted)",
                fontSize: "15px",
                lineHeight: 1.85,
              }}
            >
              Sahaba Quest is designed to support individual learning as well
              as family and school-oriented experiences. The goal is to create
              a place where learning about the lives, sacrifices, character and
              experiences of the Companions can become a consistent and
              engaging part of everyday learning.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "12px",
                marginTop: "26px",
              }}
              className="about-audience-grid"
            >
              <div
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
                }}
              >
                <strong>Individuals</strong>
                <p
                  style={{
                    margin: "7px 0 0",
                    color: "var(--muted)",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Learn at your own pace and track your personal progress.
                </p>
              </div>

              <div
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
                }}
              >
                <strong>Families</strong>
                <p
                  style={{
                    margin: "7px 0 0",
                    color: "var(--muted)",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Create a shared learning experience with family members.
                </p>
              </div>

              <div
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  background: "#f8faf9",
                  border: "1px solid var(--border)",
                }}
              >
                <strong>Schools</strong>
                <p
                  style={{
                    margin: "7px 0 0",
                    color: "var(--muted)",
                    fontSize: "13px",
                    lineHeight: 1.6,
                  }}
                >
                  Support structured Islamic learning experiences for
                  students.
                </p>
              </div>
            </div>
          </section>

          <section
            className="sq-card"
            style={{
              marginTop: "20px",
              padding: "38px",
            }}
          >
            <span className="sq-badge">Explore the Platform</span>

            <h2
              style={{
                margin: "16px 0 12px",
                fontSize: "30px",
                fontWeight: 900,
              }}
            >
              More ways to learn with Sahaba Quest
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
                marginTop: "24px",
              }}
              className="about-links-grid"
            >
              <Link
                href="/sahabah"
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  background: "#f8faf9",
                }}
              >
                <strong>Explore the Sahabah →</strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  Discover public profiles and learning resources.
                </span>
              </Link>

              <Link
                href="/pricing"
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  background: "#f8faf9",
                }}
              >
                <strong>View Plans →</strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  Explore the available Sahaba Quest account options.
                </span>
              </Link>

              <Link
                href="/sponsored-competitions"
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  background: "#f8faf9",
                }}
              >
                <strong>Sponsored Competitions →</strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  Explore sponsored quiz competitions available on the
                  platform.
                </span>
              </Link>

              <Link
                href="/signup"
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  border: "1px solid var(--border)",
                  background: "#f8faf9",
                }}
              >
                <strong>Start Learning →</strong>
                <span
                  style={{
                    display: "block",
                    marginTop: "6px",
                    color: "var(--muted)",
                    fontSize: "13px",
                  }}
                >
                  Create a free Sahaba Quest account.
                </span>
              </Link>
            </div>
          </section>

          <section
            style={{
              marginTop: "20px",
              padding: "34px",
              textAlign: "center",
              borderRadius: "20px",
              background:
                "linear-gradient(135deg, var(--primary-light), var(--white))",
              border: "1px solid var(--border)",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "27px",
                fontWeight: 900,
              }}
            >
              Begin your Sahaba Quest journey
            </h2>

            <p
              className="sq-subtitle"
              style={{
                maxWidth: "620px",
                margin: "10px auto 0",
              }}
            >
              Learn about the Companions, test your knowledge and make Islamic
              learning part of your journey.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <Link href="/signup" className="sq-button-primary">
                Create Your Free Account →
              </Link>

              <Link href="/" className="sq-button-secondary">
                Back to Home
              </Link>
            </div>
          </section>

          <div
            style={{
              padding: "34px 0 10px",
              textAlign: "center",
              color: "var(--muted-light)",
              fontSize: "12px",
            }}
          >
            Sahaba Quest — Learn • Remember • Compete
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 800px) {
          .about-feature-grid,
          .about-audience-grid {
            grid-template-columns: 1fr !important;
          }

          .about-links-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 560px) {
          .sq-nav {
            gap: 8px;
          }

          .sq-nav > div {
            gap: 6px !important;
          }

          .sq-nav > div a:first-child {
            display: none;
          }

          .sq-card {
            padding: 26px !important;
          }
        }
      `}</style>
    </main>
  );
}
