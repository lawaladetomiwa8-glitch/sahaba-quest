
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  deleteSahabahArticle,
  getAdminSahabahArticles,
  type SahabahArticle,
} from "@/lib/sahabah-articles";

type StatusFilter = "all" | "draft" | "published";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function SahabahArticlesAdminPage() {
  const [articles, setArticles] = useState<SahabahArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getAdminSahabahArticles();
      setArticles(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load articles."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const filteredArticles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return articles.filter((article) => {
      const matchesStatus =
        statusFilter === "all" ||
        article.status === statusFilter;

      const searchableText = [
        article.title,
        article.subtitle ?? "",
        article.companion_name ?? "",
        article.slug,
        article.category,
        article.summary,
        ...(article.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();

      return (
        matchesStatus &&
        (!query || searchableText.includes(query))
      );
    });
  }, [articles, search, statusFilter]);

  const counts = useMemo(
    () => ({
      total: articles.length,
      published: articles.filter(
        (article) => article.status === "published"
      ).length,
      drafts: articles.filter(
        (article) => article.status === "draft"
      ).length,
    }),
    [articles]
  );

  async function handleDelete(article: SahabahArticle) {
    const confirmed = window.confirm(
      `Delete "${article.title}" permanently?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(article.id);
    setError("");
    setMessage("");

    try {
      await deleteSahabahArticle(article.id);

      setArticles((current) =>
        current.filter((item) => item.id !== article.id)
      );

      setMessage(`"${article.title}" was deleted.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete this article."
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main>
      <section
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 20,
          flexWrap: "wrap",
          marginBottom: 28,
        }}
      >
        <div>
          <span className="sq-badge">Knowledge Library</span>

          <h1
            className="sq-title"
            style={{ marginTop: 14, marginBottom: 8 }}
          >
            Sahabah Articles
          </h1>

          <p className="sq-subtitle" style={{ margin: 0 }}>
            Create, edit, and publish articles about the
            Companions of the Prophet Muhammad ﷺ.
          </p>
        </div>

        <Link
          href="/admin/sahabah-articles/new"
          className="sq-button-primary"
        >
          + Create Article
        </Link>
      </section>

      {message && (
        <div
          role="status"
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 20,
            borderLeft: "4px solid var(--primary)",
          }}
        >
          {message}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="sq-card"
          style={{
            padding: 18,
            marginBottom: 20,
            borderLeft: "4px solid #dc2626",
          }}
        >
          <strong>Something went wrong</strong>
          <p className="sq-subtitle">{error}</p>

          <button
            type="button"
            className="sq-button-primary"
            style={{ border: 0, cursor: "pointer" }}
            onClick={() => void loadArticles()}
          >
            Try Again
          </button>
        </div>
      )}

      <section
        className="article-admin-stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 14,
          marginBottom: 26,
        }}
      >
        {[
          {
            label: "Total Articles",
            value: counts.total,
            icon: "📚",
          },
          {
            label: "Published",
            value: counts.published,
            icon: "🌐",
          },
          {
            label: "Drafts",
            value: counts.drafts,
            icon: "📝",
          },
        ].map((item) => (
          <div
            className="sq-card"
            key={item.label}
            style={{ padding: 20 }}
          >
            <div style={{ fontSize: 24 }}>{item.icon}</div>

            <div
              style={{
                marginTop: 10,
                fontSize: 30,
                fontWeight: 900,
              }}
            >
              {item.value}
            </div>

            <div
              style={{
                marginTop: 4,
                color: "var(--muted)",
                fontSize: 12,
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              {item.label}
            </div>
          </div>
        ))}
      </section>

      <section className="sq-card" style={{ overflow: "hidden" }}>
        <div
          style={{
            padding: 22,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2 style={{ margin: 0 }}>Manage Articles</h2>

          <p className="sq-subtitle" style={{ marginBottom: 16 }}>
            Drafts are not publicly listed. Publish an article
            when it is ready for readers.
          </p>

          <div
            className="article-admin-filters"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) 180px",
              gap: 12,
            }}
          >
            <input
              type="search"
              aria-label="Search articles"
              placeholder="Search title, Companion, category, or tags..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              style={{
                width: "100%",
                minWidth: 0,
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: 14,
              }}
            />

            <select
              aria-label="Filter articles by status"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "var(--foreground)",
                fontSize: 14,
              }}
            >
              <option value="all">All statuses</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 30 }}>⏳</div>
            <h3>Loading articles...</h3>
          </div>
        ) : filteredArticles.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 42 }}>📖</div>

            <h3>
              {articles.length === 0
                ? "No articles yet"
                : "No matching articles"}
            </h3>

            <p className="sq-subtitle">
              {articles.length === 0
                ? "Create your first article to start building the knowledge library."
                : "Try another search term or status filter."}
            </p>

            {articles.length === 0 && (
              <Link
                href="/admin/sahabah-articles/new"
                className="sq-button-primary"
                style={{
                  display: "inline-flex",
                  marginTop: 12,
                }}
              >
                Create First Article
              </Link>
            )}
          </div>
        ) : (
          filteredArticles.map((article) => (
            <article
              key={article.id}
              style={{
                padding: 22,
                borderBottom: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 18,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 16,
                  flex: "1 1 320px",
                  minWidth: 0,
                }}
              >
                {article.cover_image_url && (
                  <img
                    src={article.cover_image_url}
                    alt={article.cover_image_alt || ""}
                    loading="lazy"
                    style={{
                      width: 88,
                      height: 88,
                      objectFit: "cover",
                      borderRadius: 10,
                      flexShrink: 0,
                    }}
                  />
                )}

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <h3
                      style={{
                        margin: 0,
                        fontSize: 18,
                        overflowWrap: "anywhere",
                      }}
                    >
                      {article.title}
                    </h3>

                    <span
                      style={{
                        padding: "5px 9px",
                        borderRadius: 999,
                        fontSize: 10,
                        fontWeight: 900,
                        textTransform: "uppercase",
                        border: "1px solid var(--border)",
                        color:
                          article.status === "published"
                            ? "var(--primary)"
                            : "var(--muted)",
                      }}
                    >
                      {article.status}
                    </span>
                  </div>

                  {article.companion_name && (
                    <p
                      style={{
                        margin: "7px 0 0",
                        fontSize: 13,
                        color: "var(--muted)",
                      }}
                    >
                      Companion: {article.companion_name}
                    </p>
                  )}

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 14,
                      lineHeight: 1.7,
                      color: "var(--muted)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {article.summary}
                  </p>

                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 12,
                      color: "var(--muted)",
                      overflowWrap: "anywhere",
                    }}
                  >
                    /sahaba/{article.slug}
                    {" · "}
                    Updated {formatDate(article.updated_at)}
                  </p>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {article.status === "published" && (
                  <Link
                    href={`/sahaba/${article.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sq-button-secondary"
                  >
                    View
                  </Link>
                )}

                <Link
                  href={`/admin/sahabah-articles/${article.id}/edit`}
                  className="sq-button-secondary"
                >
                  Edit
                </Link>

                <button
                  type="button"
                  className="sq-button-secondary"
                  disabled={deletingId === article.id}
                  onClick={() => void handleDelete(article)}
                  style={{
                    cursor:
                      deletingId === article.id
                        ? "wait"
                        : "pointer",
                    opacity: deletingId === article.id ? 0.6 : 1,
                    border: "1px solid var(--border)",
                  }}
                >
                  {deletingId === article.id
                    ? "Deleting..."
                    : "Delete"}
                </button>
              </div>
            </article>
          ))
        )}

        {!loading && filteredArticles.length > 0 && (
          <div
            style={{
              padding: 16,
              color: "var(--muted)",
              fontSize: 12,
              textAlign: "center",
            }}
          >
            Showing {filteredArticles.length} of {articles.length} articles
          </div>
        )}
      </section>

      <style jsx>{`
        @media (max-width: 650px) {
          .article-admin-stats {
            grid-template-columns: 1fr !important;
          }

          .article-admin-filters {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
