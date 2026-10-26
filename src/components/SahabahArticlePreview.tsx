
import React from "react";
import ArticleMarkdown from "@/components/ArticleMarkdown";
import type { SahabahArticleReference } from "@/lib/sahabah-articles";

type SahabahArticlePreviewProps = {
  title: string;
  subtitle: string;
  companionName: string;
  summary: string;
  category: string;
  tags: string[];
  coverImageUrl: string;
  coverImageAlt: string;
  content: string;
  references: SahabahArticleReference[];
  onBack: () => void;
};

export default function SahabahArticlePreview({
  title,
  subtitle,
  companionName,
  summary,
  category,
  tags,
  coverImageUrl,
  coverImageAlt,
  content,
  references,
  onBack,
}: SahabahArticlePreviewProps) {
  const visibleReferences = references.filter(
    (reference) => reference.title.trim(),
  );

  return (
    <main style={{ maxWidth: 900, margin: "0 auto" }}>
      <div
        className="sq-card"
        style={{
          padding: 18,
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="sq-badge">Preview Mode</span>
          <p className="sq-subtitle" style={{ marginBottom: 0 }}>
            This is a preview. Your article has not been published.
          </p>
        </div>

        <button
          type="button"
          className="sq-button-primary"
          onClick={onBack}
          style={{ border: 0, cursor: "pointer" }}
        >
          ← Back to Editing
        </button>
      </div>

      <article
        className="sq-card"
        style={{ padding: "clamp(20px, 5vw, 48px)" }}
      >
        <header style={{ marginBottom: 30 }}>
          {category && (
            <p
              style={{
                color: "var(--primary)",
                fontWeight: 800,
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: 1,
              }}
            >
              {category}
            </p>
          )}

          <h1
            style={{
              fontSize: "clamp(30px, 5vw, 44px)",
              lineHeight: 1.2,
              fontWeight: 900,
              margin: "12px 0",
              overflowWrap: "anywhere",
            }}
          >
            {title || "Article title"}
          </h1>

          {subtitle && (
            <p
              style={{
                fontSize: 20,
                lineHeight: 1.6,
                color: "var(--muted)",
                margin: "0 0 18px",
              }}
            >
              {subtitle}
            </p>
          )}

          {companionName && (
            <p className="sq-subtitle">
              Companion: <strong>{companionName}</strong>
            </p>
          )}

          {tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 16,
              }}
            >
              {tags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="sq-badge"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {coverImageUrl && (
          <figure style={{ margin: "0 0 28px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverImageUrl}
              alt={coverImageAlt}
              style={{
                display: "block",
                width: "100%",
                maxHeight: 520,
                objectFit: "contain",
                borderRadius: 14,
              }}
            />
            {coverImageAlt && (
              <figcaption
                style={{
                  marginTop: 8,
                  color: "var(--muted)",
                  fontSize: 13,
                }}
              >
                {coverImageAlt}
              </figcaption>
            )}
          </figure>
        )}

        {summary && (
          <div
            style={{
              padding: 20,
              marginBottom: 30,
              borderLeft: "4px solid var(--primary)",
              background: "var(--primary-light)",
              borderRadius: "0 12px 12px 0",
              fontSize: 16,
              lineHeight: 1.8,
              overflowWrap: "anywhere",
            }}
          >
            {summary}
          </div>
        )}

        <ArticleMarkdown content={content} />

        {visibleReferences.length > 0 && (
          <section
            style={{
              marginTop: 40,
              paddingTop: 24,
              borderTop: "1px solid var(--border)",
            }}
          >
            <h2 style={{ fontSize: 22, marginBottom: 16 }}>
              References and Sources
            </h2>

            <ol style={{ paddingLeft: 24, lineHeight: 1.8 }}>
              {visibleReferences.map((reference, index) => (
                <li
                  key={`${reference.title}-${index}`}
                  style={{ marginBottom: 14 }}
                >
                  <strong>{reference.title}</strong>

                  {reference.detail && (
                    <div>{reference.detail}</div>
                  )}

                  {reference.url && (
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "var(--primary)",
                        overflowWrap: "anywhere",
                      }}
                    >
                      View source
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>

      <div style={{ marginTop: 24, marginBottom: 32 }}>
        <button
          type="button"
          className="sq-button-primary"
          onClick={onBack}
          style={{ border: 0, cursor: "pointer" }}
        >
          ← Back to Editing
        </button>
      </div>
    </main>
  );
}
