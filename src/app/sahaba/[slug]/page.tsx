
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getSahabahProfile,
  sahabahProfiles,
} from "@/data/sahabah-data";
import {
  getPublishedSahabahArticle,
} from "@/lib/sahabah-articles";
import ArticleMarkdown from "@/components/ArticleMarkdown";
import SahabahArticleEngagement from "@/components/SahabahArticleEngagement";

const SITE_URL = "https://www.sahabaquest.com.ng";
const SITE_LOGO =
  "https://cdn.phototourl.com/member/2026-09-30-957223ee-05a5-4299-9fc6-c4ca9f12695a.png";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

type PublishedArticle = NonNullable<
  Awaited<ReturnType<typeof getPublishedSahabahArticle>>
>;

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

  if (profile) {
    const profileUrl = `${SITE_URL}/sahaba/${profile.slug}`;

    return {
      title: `${profile.name} | Sahaba Quest`,
      description: profile.summary,
      alternates: {
        canonical: profileUrl,
      },
      openGraph: {
        title: `${profile.name} | Sahaba Quest`,
        description: profile.summary,
        url: profileUrl,
        siteName: "Sahaba Quest",
        type: "article",
        images: [
          {
            url: SITE_LOGO,
            alt: "Sahaba Quest Official Logo",
            type: "image/png",
          },
        ],
      },
    };
  }

  let article: PublishedArticle | null = null;

  try {
    article = await getPublishedSahabahArticle(slug);
  } catch (error) {
    console.error("Failed to load Sahabah article metadata:", error);
  }

  if (!article) {
    return {
      title: "Sahabah Article | Sahaba Quest",
      robots: {
        index: false,
        follow: true,
      },
    };
  }

  const title = article.seo_title?.trim() || article.title;
  const description =
    article.seo_description?.trim() || article.summary;
  const articleUrl = `${SITE_URL}/sahaba/${article.slug}`;

  return {
    title: `${title} | Sahaba Quest`,
    description,
    alternates: {
      canonical: articleUrl,
    },
    openGraph: {
      title,
      description,
      url: articleUrl,
      siteName: "Sahaba Quest",
      type: "article",
      images: [
        {
          url: SITE_LOGO,
          alt: "Sahaba Quest Official Logo",
          type: "image/png",
        },
      ],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function SahabaProfilePage({
  params,
}: PageProps) {
  const { slug } = await params;
  const profile = getSahabahProfile(slug);

  // Keep all four original static profiles and their existing design.
  if (profile) {
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

            <article
              className="sq-card"
              style={{
                padding: "42px",
              }}
            >
              <span className="sq-badge">
                {profile.category}
              </span>

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

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
      </main>
    );
  }

  // For any other slug, load the matching published database article.
  let article: PublishedArticle | null = null;

  try {
    article = await getPublishedSahabahArticle(slug);
  } catch (error) {
    console.error("Failed to load Sahabah article:", error);
  }

  if (!article) {
    notFound();
  }

  const articleUrl = `${SITE_URL}/sahaba/${article.slug}`;

  const articleStructuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: article.title,
        description: article.summary,
        url: articleUrl,
        mainEntityOfPage: articleUrl,
        datePublished: article.published_at || undefined,
        dateModified: article.updated_at || undefined,
        author: {
          "@type": "Organization",
          name: "Sahaba Quest",
        },
        publisher: {
          "@type": "Organization",
          name: "Sahaba Quest",
          url: SITE_URL,
        },
        ...(article.cover_image_url
          ? {
              image: [article.cover_image_url],
            }
          : {}),
        ...(article.tags.length
          ? {
              keywords: article.tags.join(", "),
            }
          : {}),
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
            name: article.title,
            item: articleUrl,
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

            <span>{article.title}</span>
          </nav>

          <article
            className="sq-card"
            style={{
              padding: "clamp(22px, 5vw, 42px)",
            }}
          >
            <span className="sq-badge">
              {article.category || "Sahabah"}
            </span>

            <h1
              style={{
                margin: "18px 0 0",
                fontSize: "clamp(32px, 6vw, 52px)",
                lineHeight: 1.1,
                letterSpacing: "-1px",
                fontWeight: 900,
              }}
            >
              {article.title}
            </h1>

            {article.subtitle && (
              <p
                style={{
                  margin: "14px 0 0",
                  color: "var(--muted)",
                  fontSize: "18px",
                  lineHeight: 1.7,
                }}
              >
                {article.subtitle}
              </p>
            )}

            {article.companion_name && (
              <p
                style={{
                  marginTop: "16px",
                  color: "var(--muted)",
                  fontSize: "14px",
                }}
              >
                <strong>Companion:</strong>{" "}
                {article.companion_name}
              </p>
            )}

            <div
              style={{
                marginTop: "26px",
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
                {article.summary}
              </p>
            </div>

            {article.cover_image_url && (
              <figure style={{ margin: "28px 0 0" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.cover_image_url}
                  alt={article.cover_image_alt || article.title}
                  style={{
                    display: "block",
                    width: "100%",
                    maxHeight: "520px",
                    objectFit: "cover",
                    borderRadius: "18px",
                  }}
                />
              </figure>
            )}

            {article.tags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  marginTop: "24px",
                }}
              >
                {article.tags.map((tag) => (
                  <span key={tag} className="sq-badge">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <section
              className="article-content"
              style={{
                marginTop: "36px",
                lineHeight: 1.9,
                overflowWrap: "anywhere",
              }}
            >
              <ArticleMarkdown content={article.content} />
            </section>

            {article.source_references.length > 0 && (
              <section
                style={{
                  marginTop: "36px",
                  paddingTop: "28px",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: "22px",
                    fontWeight: 900,
                  }}
                >
                  Sources and references
                </h2>

                <ol
                  style={{
                    marginTop: "18px",
                    paddingLeft: "24px",
                    lineHeight: 1.8,
                  }}
                >
                  {article.source_references.map(
                    (reference, index) => (
                      <li
                        key={`${reference.title}-${index}`}
                        style={{
                          marginBottom: "18px",
                          paddingLeft: "4px",
                        }}
                      >
                        <p style={{ margin: 0, fontWeight: 700 }}>
                          {reference.title}
                        </p>

                        {reference.detail && (
                          <p
                            style={{
                              margin: "4px 0 0",
                              color: "var(--muted)",
                              fontSize: "14px",
                            }}
                          >
                            {reference.detail}
                          </p>
                        )}

                        {reference.url && (
                          <a
                            href={reference.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: "inline-block",
                              marginTop: "5px",
                              color: "var(--primary)",
                              textDecoration: "underline",
                              overflowWrap: "anywhere",
                            }}
                          >
                            View source
                          </a>
                        )}
                      </li>
                    ),
                  )}
                </ol>
              </section>
            )}

            <SahabahArticleEngagement
              articleId={article.id}
              articleTitle={article.title}
              articleUrl={articleUrl}
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                marginTop: "32px",
                paddingTop: "24px",
                borderTop: "1px solid var(--border)",
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

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleStructuredData).replace(
            /</g,
            "\\u003c",
          ),
        }}
      />
    </main>
  );
}
