import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSahabahProfile,
  sahabahProfiles,
} from "@/data/sahabah-data";

const SITE_URL = "https://sahabaquest.com.ng";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return sahabahProfiles.map((profile) => ({
    slug: profile.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = getSahabahProfile(slug);

  if (!profile) {
    return {
      title: "Sahaba | Sahaba Quest",
    };
  }

  return {
    title: `${profile.name} | Sahaba Quest`,
    description: profile.summary,
    alternates: {
      canonical: `${SITE_URL}/sahaba/${profile.slug}`,
    },
  };
}

export default async function SahabaProfilePage({
  params,
}: PageProps) {
  const { slug } = await params;
  const profile = getSahabahProfile(slug);

  if (!profile) {
    notFound();
  }

  const profileUrl = `${SITE_URL}/sahaba/${profile.slug}`;

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${profileUrl}#webpage`,
        url: profileUrl,
        name: `${profile.name} | Sahaba Quest`,
        description: profile.summary,
        isPartOf: {
          "@id": `${SITE_URL}/#website`,
        },
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
            item: `${SITE_URL}/sahaba`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: profile.name,
            item: profileUrl,
          },
        ],
      },
    ],
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.75), transparent 30%), var(--background)",
      }}
    >
      {/* Navigation */}
      <header className="sq-nav">
        <Link href="/" className="sq-logo">
          Sahaba Quest
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
      </header>

      <section className="sq-page">
        <div
          className="sq-container"
          style={{ maxWidth: "900px" }}
        >
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            style={{
              fontSize: "13px",
              color: "var(--muted)",
              marginBottom: "24px",
            }}
          >
            <Link
              href="/"
              style={{
                color: "var(--primary)",
                fontWeight: 700,
              }}
            >
              Home
            </Link>

            <span aria-hidden="true"> / </span>

            <Link
              href="/sahaba"
              style={{
                color: "var(--primary)",
                fontWeight: 700,
              }}
            >
              Sahaba
            </Link>

            <span aria-hidden="true"> / </span>

            <span>{profile.name}</span>
          </nav>

          {/* Profile */}
          <article
            className="sq-card"
            style={{
              padding: "42px",
            }}
          >
            {/* Category */}
            <span className="sq-badge">
              {profile.category}
            </span>

            {/* Name */}
            <h1
              style={{
                margin: "18px 0 6px",
                fontSize: "clamp(34px, 6vw, 56px)",
                lineHeight: 1.05,
                letterSpacing: "-1.5px",
                fontWeight: 900,
              }}
            >
              {profile.name}
            </h1>

            {/* Arabic Name */}
            <div
              lang="ar"
              dir="rtl"
              style={{
                color: "var(--muted)",
                fontSize: "18px",
                fontWeight: 700,
              }}
            >
              {profile.arabicName}
            </div>

            {/* Overview */}
            <div
              style={{
                marginTop: "30px",
                padding: "24px",
                borderRadius: "18px",
                background: "var(--primary-light)",
                border: "1px solid var(--border)",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                Overview
              </h2>

              <p
                style={{
                  margin: "10px 0 0",
                  color: "var(--muted)",
                  fontSize: "15px",
                  lineHeight: 1.8,
                }}
              >
                {profile.summary}
              </p>
            </div>

            {/* Key Points */}
            <section style={{ marginTop: "32px" }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "22px",
                  fontWeight: 900,
                }}
              >
                Key points
              </h2>

              <ul
                style={{
                  margin: "16px 0 0",
                  paddingLeft: "22px",
                  color: "var(--muted)",
                  lineHeight: 1.8,
                }}
              >
                {profile.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    style={{
                      marginBottom: "10px",
                    }}
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            </section>

            {/* Source */}
            <section
              style={{
                marginTop: "32px",
                paddingTop: "24px",
                borderTop: "1px solid var(--border)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: "var(--muted-light)",
                  fontSize: "12px",
                  lineHeight: 1.6,
                }}
              >
                Starter profile source: {profile.sourceLabel}.
                These pages are intentionally concise and will be
                expanded as the Sahaba Quest knowledge library grows.
              </p>
            </section>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "28px",
              }}
            >
              <Link
                href="/sahaba"
                className="sq-button-secondary"
              >
                ← All Sahaba
              </Link>

              <Link
                href="/signup"
                className="sq-button-primary"
              >
                Test Your Knowledge →
              </Link>
            </div>
          </article>
        </div>
      </section>

      {/* Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(
            /</g,
            "\\u003c"
          ),
        }}
      />
    </main>
  );
}