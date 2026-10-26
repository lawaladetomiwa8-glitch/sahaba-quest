
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import SahabahArticlePreview from "@/components/SahabahArticlePreview";
import {
  getAdminSahabahArticle,
  updateSahabahArticle,
  createArticleSlug,
  uploadSahabahArticleImage,
  type SahabahArticle,
  type SahabahArticleReference,
  type SahabahArticleStatus,
} from "@/lib/sahabah-articles";

type ReferenceRow = {
  title: string;
  detail: string;
  url: string;
};

const fieldStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: 14,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  fontSize: 13,
  marginBottom: 7,
};

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && (
        <p
          className="sq-subtitle"
          style={{ fontSize: 12, margin: "6px 0 0" }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

function referenceRows(
  references: SahabahArticleReference[],
): ReferenceRow[] {
  if (!references.length) {
    return [{ title: "", detail: "", url: "" }];
  }

  return references.map((reference) => ({
    title: reference.title ?? "",
    detail: reference.detail ?? "",
    url: reference.url ?? "",
  }));
}

export default function EditSahabahArticlePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [article, setArticle] = useState<SahabahArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [companionName, setCompanionName] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Sahabah");
  const [tagsText, setTagsText] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");
  const [references, setReferences] = useState<ReferenceRow[]>([
    { title: "", detail: "", url: "" },
  ]);
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [status, setStatus] =
    useState<SahabahArticleStatus>("draft");

  const loadArticle = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const result = await getAdminSahabahArticle(id);

      if (!result) {
        setArticle(null);
        setError(
          "Article not found, or you do not have permission to access it.",
        );
        return;
      }

      setArticle(result);
      setTitle(result.title);
      setSubtitle(result.subtitle ?? "");
      setSlug(result.slug);
      setCompanionName(result.companion_name ?? "");
      setSummary(result.summary);
      setContent(result.content);
      setCategory(result.category);
      setTagsText((result.tags ?? []).join(", "));
      setCoverImageUrl(result.cover_image_url ?? "");
      setCoverImageAlt(result.cover_image_alt ?? "");
      setReferences(referenceRows(result.source_references ?? []));
      setSeoTitle(result.seo_title ?? "");
      setSeoDescription(result.seo_description ?? "");
      setStatus(result.status);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load the article.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadArticle();
  }, [loadArticle]);

  function updateReference(
    index: number,
    field: keyof ReferenceRow,
    value: string,
  ) {
    setReferences((current) =>
      current.map((reference, i) =>
        i === index
          ? { ...reference, [field]: value }
          : reference,
      ),
    );
  }

  async function handleImageUpload(file?: File) {
    if (!file) return;

    setUploading(true);
    setError("");
    setMessage("");

    try {
      const url = await uploadSahabahArticleImage(file);
      setCoverImageUrl(url);
      setMessage("Image uploaded successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload the image.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(
    nextStatus: SahabahArticleStatus,
  ) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const cleanedReferences: SahabahArticleReference[] =
        references
          .filter((reference) => reference.title.trim())
          .map((reference) => ({
            title: reference.title.trim(),
            detail: reference.detail.trim() || undefined,
            url: reference.url.trim() || null,
          }));

      await updateSahabahArticle(id, {
        title,
        subtitle,
        slug,
        companion_name: companionName,
        summary,
        content,
        category,
        tags: tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        cover_image_url: coverImageUrl,
        cover_image_alt: coverImageAlt,
        source_references: cleanedReferences,
        seo_title: seoTitle,
        seo_description: seoDescription,
        status: nextStatus,
      });

      router.push("/admin/sahabah-articles");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save changes.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main
        className="sq-card"
        style={{ padding: 40, textAlign: "center" }}
      >
        <div style={{ fontSize: 32 }}>⏳</div>
        <h2>Loading article...</h2>
      </main>
    );
  }

  if (!article) {
    return (
      <main className="sq-card" style={{ padding: 28 }}>
        <h1>Article unavailable</h1>
        <p className="sq-subtitle">
          {error || "This article could not be found."}
        </p>
        <Link
          href="/admin/sahabah-articles"
          className="sq-button-secondary"
        >
          ← All Articles
        </Link>
      </main>
    );
  }

  if (showPreview) {
    const previewReferences: SahabahArticleReference[] = references
      .filter((reference) => reference.title.trim())
      .map((reference) => ({
        title: reference.title.trim(),
        detail: reference.detail.trim() || undefined,
        url: reference.url.trim() || null,
      }));

    return (
      <SahabahArticlePreview
        title={title}
        subtitle={subtitle}
        companionName={companionName}
        summary={summary}
        category={category}
        tags={tagsText
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)}
        coverImageUrl={coverImageUrl}
        coverImageAlt={coverImageAlt}
        content={content}
        references={previewReferences}
        onBack={() => setShowPreview(false)}
      />
    );
  }

  return (
    <main>
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/admin/sahabah-articles"
          className="sq-button-secondary"
        >
          ← All Articles
        </Link>

        <h1
          className="sq-title"
          style={{ marginTop: 18, marginBottom: 8 }}
        >
          Edit Article
        </h1>

        <p className="sq-subtitle">{article.title}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 20,
            borderLeft: "4px solid #dc2626",
          }}
        >
          <strong>Unable to save</strong>
          <p className="sq-subtitle">{error}</p>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="sq-card"
          style={{ padding: 16, marginBottom: 20 }}
        >
          {message}
        </div>
      )}

      <form
        className="sq-card"
        style={{ padding: 26 }}
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave(status);
        }}
      >
        <div style={{ display: "grid", gap: 22 }}>
          <FormField label="Article title *">
            <input
              style={fieldStyle}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={200}
            />
          </FormField>

          <FormField label="Subtitle">
            <input
              style={fieldStyle}
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              maxLength={250}
            />
          </FormField>

          <FormField
            label="URL slug *"
            hint="Changing a published slug changes the article URL."
          >
            <input
              style={fieldStyle}
              value={slug}
              onChange={(event) =>
                setSlug(createArticleSlug(event.target.value))
              }
              required
              maxLength={200}
            />

            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
                overflowWrap: "anywhere",
              }}
            >
              https://sahabaquest.com.ng/sahaba/{slug}
            </p>
          </FormField>

          <FormField label="Companion's name">
            <input
              style={fieldStyle}
              value={companionName}
              onChange={(event) =>
                setCompanionName(event.target.value)
              }
              maxLength={200}
            />
          </FormField>

          <FormField label="Summary *">
            <textarea
              style={{ ...fieldStyle, minHeight: 100 }}
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              required
              maxLength={500}
            />
          </FormField>

          <div
            className="article-two-column"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
          >
            <FormField label="Category">
              <input
                style={fieldStyle}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                maxLength={100}
              />
            </FormField>

            <FormField label="Tags (comma-separated)">
              <input
                style={fieldStyle}
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </FormField>
          </div>

          <section>
            <h2 style={{ fontSize: 21 }}>Cover image</h2>

            <FormField label="Upload image">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploading || saving}
                style={{ ...fieldStyle, padding: 10 }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  void handleImageUpload(file);
                  event.currentTarget.value = "";
                }}
              />
              <p className="sq-subtitle">
                {uploading
                  ? "Uploading image..."
                  : "Accepted formats: JPEG, PNG, WebP, GIF. Maximum size: 5 MB."}
              </p>
            </FormField>

            <div style={{ marginTop: 14 }}>
              <FormField label="Or image URL">
                <input
                  type="url"
                  style={fieldStyle}
                  value={coverImageUrl}
                  onChange={(event) =>
                    setCoverImageUrl(event.target.value)
                  }
                  placeholder="https://example.com/image.jpg"
                />
              </FormField>
            </div>

            <div style={{ marginTop: 14 }}>
              <FormField label="Image alternative text">
                <input
                  style={fieldStyle}
                  value={coverImageAlt}
                  onChange={(event) =>
                    setCoverImageAlt(event.target.value)
                  }
                  maxLength={300}
                />
              </FormField>
            </div>

            {coverImageUrl && (
              <div style={{ marginTop: 16 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverImageUrl}
                  alt={coverImageAlt}
                  style={{
                    width: "100%",
                    maxWidth: 460,
                    maxHeight: 300,
                    objectFit: "contain",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                  }}
                />
              </div>
            )}
          </section>

          <section>
            <h2 style={{ fontSize: 21 }}>Article content *</h2>

            <p
              className="sq-subtitle"
              style={{ marginBottom: 14 }}
            >
              Select text and use the toolbar to format headings,
              bold text, lists, quotations, and links.
            </p>

            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Edit the article here..."
            />
          </section>

          <section>
            <h2 style={{ fontSize: 21 }}>References and sources</h2>

            <p className="sq-subtitle">
              Maintain the sources used to verify the article.
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              {references.map((reference, index) => (
                <div
                  key={index}
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 16,
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <strong>Reference {index + 1}</strong>

                  <input
                    style={fieldStyle}
                    value={reference.title}
                    onChange={(event) =>
                      updateReference(
                        index,
                        "title",
                        event.target.value,
                      )
                    }
                    placeholder="Source title or book name"
                  />

                  <input
                    style={fieldStyle}
                    value={reference.detail}
                    onChange={(event) =>
                      updateReference(
                        index,
                        "detail",
                        event.target.value,
                      )
                    }
                    placeholder="Author, volume, page, hadith number, or edition"
                  />

                  <input
                    type="url"
                    style={fieldStyle}
                    value={reference.url}
                    onChange={(event) =>
                      updateReference(
                        index,
                        "url",
                        event.target.value,
                      )
                    }
                    placeholder="https://example.com/source (optional)"
                  />

                  {references.length > 1 && (
                    <button
                      type="button"
                      className="sq-button-secondary"
                      style={{
                        justifySelf: "start",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setReferences((current) =>
                          current.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove reference
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                className="sq-button-secondary"
                style={{ justifySelf: "start", cursor: "pointer" }}
                onClick={() =>
                  setReferences((current) => [
                    ...current,
                    { title: "", detail: "", url: "" },
                  ])
                }
              >
                + Add another reference
              </button>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 21 }}>SEO settings</h2>

            <div style={{ display: "grid", gap: 16 }}>
              <FormField label="SEO title">
                <input
                  style={fieldStyle}
                  value={seoTitle}
                  onChange={(event) => setSeoTitle(event.target.value)}
                  maxLength={200}
                />
              </FormField>

              <FormField label="SEO description">
                <textarea
                  style={{ ...fieldStyle, minHeight: 80 }}
                  value={seoDescription}
                  onChange={(event) =>
                    setSeoDescription(event.target.value)
                  }
                  maxLength={300}
                />
              </FormField>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: 21 }}>Publication</h2>

            <FormField label="Status">
              <select
                style={fieldStyle}
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as SahabahArticleStatus,
                  )
                }
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </FormField>
          </section>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              paddingTop: 18,
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              className="sq-button-secondary"
              disabled={saving || uploading}
              onClick={() => setShowPreview(true)}
              style={{
                cursor: saving || uploading ? "wait" : "pointer",
                opacity: saving || uploading ? 0.65 : 1,
              }}
            >
              Preview Article
            </button>

            <button
              type="submit"
              className="sq-button-primary"
              disabled={saving || uploading}
              style={{
                border: 0,
                cursor: saving || uploading ? "wait" : "pointer",
                opacity: saving || uploading ? 0.65 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : status === "published"
                  ? "Save and Publish"
                  : "Save Draft"}
            </button>

            <button
              type="button"
              className="sq-button-secondary"
              disabled={saving || uploading}
              onClick={() => router.push("/admin/sahabah-articles")}
              style={{ cursor: "pointer" }}
            >
              Cancel
            </button>
          </div>
        </div>
      </form>

      <style jsx>{`
        @media (max-width: 650px) {
          .article-two-column {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}