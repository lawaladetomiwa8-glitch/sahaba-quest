
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/components/RichTextEditor";
import {
  createSahabahArticle,
  createArticleSlug,
  uploadSahabahArticleImage,
  type SahabahArticleReference,
  type SahabahArticleStatus,
} from "@/lib/sahabah-articles";

type ReferenceRow = {
  title: string;
  detail: string;
  url: string;
};

const initialReference: ReferenceRow = {
  title: "",
  detail: "",
  url: "",
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
          style={{
            color: "var(--muted)",
            fontSize: 12,
            lineHeight: 1.6,
            margin: "6px 0 0",
          }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

export default function NewSahabahArticlePage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [companionName, setCompanionName] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("Sahabah");
  const [tagsText, setTagsText] = useState("");

  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImageAlt, setCoverImageAlt] = useState("");

  const [references, setReferences] = useState<ReferenceRow[]>([
    { ...initialReference },
  ]);

  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");

  const [status, setStatus] =
    useState<SahabahArticleStatus>("draft");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function handleTitleChange(value: string) {
    setTitle(value);

    if (!slugEdited) {
      setSlug(createArticleSlug(value));
    }
  }

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
          : "Unable to upload image.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(
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

      await createSahabahArticle({
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
          : "Unable to save the article.",
      );
    } finally {
      setSaving(false);
    }
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

        <span
          className="sq-badge"
          style={{ marginLeft: 10 }}
        >
          New Article
        </span>

        <h1
          className="sq-title"
          style={{ marginTop: 18, marginBottom: 8 }}
        >
          Create Sahabah Article
        </h1>

        <p className="sq-subtitle">
          Write a well-sourced article for the Sahaba Quest
          knowledge library.
        </p>
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
        onSubmit={(event) => {
          event.preventDefault();
          void handleSubmit(status);
        }}
        className="sq-card"
        style={{ padding: 26 }}
      >
        <div style={{ display: "grid", gap: 22 }}>
          <FormField label="Article title *">
            <input
              style={fieldStyle}
              value={title}
              onChange={(event) =>
                handleTitleChange(event.target.value)
              }
              placeholder="e.g. The Life of Abu Bakr as-Siddiq"
              required
              maxLength={200}
            />
          </FormField>

          <FormField label="Subtitle">
            <input
              style={fieldStyle}
              value={subtitle}
              onChange={(event) =>
                setSubtitle(event.target.value)
              }
              placeholder="A short supporting heading"
              maxLength={250}
            />
          </FormField>

          <FormField
            label="URL slug *"
            hint="Used in the article address. Use lowercase letters, numbers, and hyphens. Make sure the slug is unique."
          >
            <input
              style={fieldStyle}
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setSlug(createArticleSlug(event.target.value));
              }}
              placeholder="abu-bakr-as-siddiq"
              required
              maxLength={200}
            />

            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
                marginBottom: 0,
                overflowWrap: "anywhere",
              }}
            >
              Public URL: https://sahabaquest.com.ng/sahaba/{slug}
            </p>
          </FormField>

          <FormField label="Companion's name">
            <input
              style={fieldStyle}
              value={companionName}
              onChange={(event) =>
                setCompanionName(event.target.value)
              }
              placeholder="e.g. Abu Bakr as-Siddiq"
              maxLength={200}
            />
          </FormField>

          <FormField label="Summary *">
            <textarea
              style={{ ...fieldStyle, minHeight: 100 }}
              value={summary}
              onChange={(event) =>
                setSummary(event.target.value)
              }
              placeholder="A concise summary for the public directory and search engines."
              required
              maxLength={500}
            />
          </FormField>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 16,
            }}
            className="article-two-column"
          >
            <FormField label="Category">
              <input
                style={fieldStyle}
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value)
                }
                placeholder="Sahabah"
                maxLength={100}
              />
            </FormField>

            <FormField
              label="Tags"
              hint="Separate tags with commas."
            >
              <input
                style={fieldStyle}
                value={tagsText}
                onChange={(event) =>
                  setTagsText(event.target.value)
                }
                placeholder="Caliphs, Hijrah, Madinah"
              />
            </FormField>
          </div>

          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 21 }}>
              Cover image
            </h2>

            <p
              className="sq-subtitle"
              style={{ marginBottom: 16 }}
            >
              Upload an image or paste a public image URL.
            </p>

            <div style={{ display: "grid", gap: 16 }}>
              <FormField label="Upload image">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploading || saving}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    void handleImageUpload(file);
                    event.currentTarget.value = "";
                  }}
                  style={{ ...fieldStyle, padding: 10 }}
                />

                <p className="sq-subtitle">
                  {uploading
                    ? "Uploading image..."
                    : "Accepted formats: JPEG, PNG, WebP, GIF. Maximum size: 5 MB."}
                </p>
              </FormField>

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

              <FormField label="Image alternative text">
                <input
                  style={fieldStyle}
                  value={coverImageAlt}
                  onChange={(event) =>
                    setCoverImageAlt(event.target.value)
                  }
                  placeholder="Describe the image for accessibility"
                  maxLength={300}
                />
              </FormField>

              {coverImageUrl && (
                <div>
                  <p style={labelStyle}>Image preview</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverImageUrl}
                    alt={coverImageAlt}
                    style={{
                      display: "block",
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
            </div>
          </div>

          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 21 }}>
              Article content *
            </h2>

            <p
              className="sq-subtitle"
              style={{ marginBottom: 14 }}
            >
              Use the formatting toolbar to style your article
              without typing Markdown.
            </p>

            <RichTextEditor
              value={content}
              onChange={setContent}
              placeholder="Begin writing the article. Use headings to organise the Companion's life, important events, and legacy."
            />

            <p className="sq-subtitle">
              Verify historical claims and include reliable
              references before publishing.
            </p>
          </div>

          <div>
            <h2 style={{ margin: "0 0 8px", fontSize: 21 }}>
              References and sources
            </h2>

            <p
              className="sq-subtitle"
              style={{ marginBottom: 16 }}
            >
              Add the books, hadith collections, scholarly works,
              or reputable reference pages used for the article.
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
                style={{
                  justifySelf: "start",
                  cursor: "pointer",
                }}
                onClick={() =>
                  setReferences((current) => [
                    ...current,
                    { ...initialReference },
                  ])
                }
              >
                + Add another reference
              </button>
            </div>
          </div>

          <div>
            <h2 style={{ margin: "0 0 14px", fontSize: 21 }}>
              Search engine settings
            </h2>

            <div style={{ display: "grid", gap: 16 }}>
              <FormField
                label="SEO title"
                hint="Optional. If blank, the article title will be used."
              >
                <input
                  style={fieldStyle}
                  value={seoTitle}
                  onChange={(event) =>
                    setSeoTitle(event.target.value)
                  }
                  maxLength={200}
                />
              </FormField>

              <FormField
                label="SEO description"
                hint="Optional. If blank, the article summary will be used."
              >
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
          </div>

          <div>
            <h2 style={{ margin: "0 0 12px", fontSize: 21 }}>
              Publication
            </h2>

            <FormField label="Initial status">
              <select
                style={fieldStyle}
                value={status}
                onChange={(event) =>
                  setStatus(
                    event.target.value as SahabahArticleStatus,
                  )
                }
              >
                <option value="draft">Save as draft</option>
                <option value="published">
                  Publish immediately
                </option>
              </select>
            </FormField>

            <p className="sq-subtitle">
              Published articles are eligible to appear in the
              public Sahabah directory.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              paddingTop: 10,
              borderTop: "1px solid var(--border)",
            }}
          >
            <button
              type="submit"
              className="sq-button-primary"
              disabled={saving || uploading}
              style={{
                border: 0,
                cursor:
                  saving || uploading ? "wait" : "pointer",
                opacity: saving || uploading ? 0.65 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : status === "published"
                  ? "Publish Article"
                  : "Save Draft"}
            </button>

            <button
              type="button"
              className="sq-button-secondary"
              disabled={saving || uploading}
              onClick={() =>
                router.push("/admin/sahabah-articles")
              }
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
