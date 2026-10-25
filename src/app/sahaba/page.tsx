
import type { Metadata } from "next";
import Link from "next/link";
import { sahabahProfiles } from "@/data/sahabah-data";
import { getPublishedSahabahArticles } from "@/lib/sahabah-articles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sahabah | Sahaba Quest",
  description:
    "Explore the lives, stories, sacrifices, and legacies of the noble Companions of Prophet Muhammad ﷺ through Sahaba Quest.",
  alternates: {
    canonical: "https://sahabaquest.com.ng/sahaba",
  },
  openGraph: {
    title: "Sahabah | Sahaba Quest",
    description:
      "Discover the lives and legacies of the noble Companions of Prophet Muhammad ﷺ.",
    url: "https://sahabaquest.com.ng/sahaba",
    siteName: "Sahaba Quest",
    type: "website",
  },
};

export default async function SahabahPage() {
  let articles: Awaited<
    ReturnType<typeof getPublishedSahabahArticles>
  > = [];

  try {
    articles = await getPublishedSahabahArticles();
  } catch (error) {
    // Keep the existing static profiles available if the article
    // database is temporarily unavailable.
    console.error("Failed to load published Sahabah articles:", error);
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Sahabah | Sahaba Quest",
    description:
      "Explore the lives and legacies of the noble Companions of Prophet Muhammad ﷺ.",
    url: "https://sahabaquest.com.ng/sahaba",
    isPartOf: {
      "@type": "WebSite",
      name: "Sahaba Quest",
      url: "https://sahabaquest.com.ng",
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: [
        ...sahabahProfiles.map((profile, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: profile.name,
          url: `https://sahabaquest.com.ng/sahaba/${profile.slug}`,
        })),
        ...articles.map((article, index) => ({
          "@type": "ListItem",
          position: sahabahProfiles.length + index + 1,
          name: article.title,
          url: `https://sahabaquest.com.ng/sahaba/${article.slug}`,
        })),
      ],
    },
  };

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />

      <section className="bg-teal-800 px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-teal-200">
            Learn from their lives
          </p>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            The Noble Sahabah
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-7 text-teal-50 sm:text-lg">
            Discover the stories, character, sacrifices, and contributions
            of the companions of Prophet Muhammad ﷺ. Explore their lives
            and learn lessons that continue to guide the Ummah.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Explore the Companions
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-gray-600">
            Read about the lives and legacies of the Sahabah through
            our profiles and published articles.
          </p>
        </div>

        {sahabahProfiles.length === 0 && articles.length === 0 ? (
          <div className="rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-600">
              No Sahabah profiles or articles are available at the moment.
              Please check back later.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sahabahProfiles.map((profile) => (
              <article
                key={`profile-${profile.slug}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                    Sahabah Profile
                  </p>

                  <h3 className="mt-3 text-xl font-bold leading-snug">
                    {profile.name}
                  </h3>

                  {profile.title && (
                    <p className="mt-2 text-sm font-medium text-gray-500">
                      {profile.title}
                    </p>
                  )}

                  <p className="mt-4 flex-1 text-sm leading-6 text-gray-600">
                    {profile.summary}
                  </p>

                  <Link
                    href={`/sahaba/${profile.slug}`}
                    className="mt-6 inline-flex items-center font-semibold text-teal-700 hover:text-teal-900"
                  >
                    Read profile
                    <span className="ml-2" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </div>
              </article>
            ))}

            {articles.map((article) => (
              <article
                key={`article-${article.id}`}
                className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {article.cover_image_url && (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.cover_image_url}
                      alt={article.cover_image_alt || article.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className="flex flex-1 flex-col p-6">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                    {article.category || "Sahabah Article"}
                  </p>

                  <h3 className="mt-3 text-xl font-bold leading-snug">
                    {article.title}
                  </h3>

                  {article.subtitle && (
                    <p className="mt-2 text-sm font-medium text-gray-500">
                      {article.subtitle}
                    </p>
                  )}

                  {article.companion_name && (
                    <p className="mt-3 text-sm text-gray-600">
                      <span className="font-semibold">Companion:</span>{" "}
                      {article.companion_name}
                    </p>
                  )}

                  <p className="mt-4 flex-1 text-sm leading-6 text-gray-600">
                    {article.summary}
                  </p>

                  {article.tags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {article.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <Link
                    href={`/sahaba/${article.slug}`}
                    className="mt-6 inline-flex items-center font-semibold text-teal-700 hover:text-teal-900"
                  >
                    Read article
                    <span className="ml-2" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
