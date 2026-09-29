"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Announcement = {
  id: string;
  competition_id: string;
  title: string;
  content: string;
  publish_at: string;
  is_published: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
};

type AnnouncementForm = {
  title: string;
  content: string;
  publishAt: string;
  isPublished: boolean;
  displayOrder: string;
};

const emptyForm: AnnouncementForm = {
  title: "",
  content: "",
  publishAt: "",
  isPublished: false,
  displayOrder: "0",
};

const inputStyle = {
  width: "100%",
  padding: "12px 13px",
  border: "1px solid var(--border)",
  borderRadius: 10,
  background: "var(--background)",
  color: "inherit",
  outline: "none",
  boxSizing: "border-box" as const,
};

const labelStyle = {
  display: "block",
  marginBottom: 7,
  fontSize: 12,
  fontWeight: 800,
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

export default function SponsoredAnnouncementsPage() {
  const params = useParams<{ id: string }>();
  const competitionId = params.id;

  const [competitionTitle, setCompetitionTitle] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState<AnnouncementForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadAnnouncements() {
    setLoading(true);
    setErrorMessage("");

    const [competitionResult, announcementsResult] =
      await Promise.all([
        supabase
          .from("sponsored_competitions")
          .select("id,title")
          .eq("id", competitionId)
          .maybeSingle(),

        supabase
          .from("sponsored_announcements")
          .select(
            "id,competition_id,title,content,publish_at,is_published,display_order,created_at,updated_at"
          )
          .eq("competition_id", competitionId)
          .order("display_order", { ascending: true })
          .order("publish_at", { ascending: true }),
      ]);

    if (competitionResult.error) {
      setErrorMessage(competitionResult.error.message);
      setLoading(false);
      return;
    }

    if (!competitionResult.data) {
      setErrorMessage("Competition not found.");
      setLoading(false);
      return;
    }

    if (announcementsResult.error) {
      setErrorMessage(announcementsResult.error.message);
      setLoading(false);
      return;
    }

    setCompetitionTitle(competitionResult.data.title);
    setAnnouncements(
      (announcementsResult.data ?? []) as Announcement[]
    );
    setLoading(false);
  }

  useEffect(() => {
    loadAnnouncements();
  }, [competitionId]);

  function updateForm(
    field: keyof AnnouncementForm,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setErrorMessage("");
  }

  function startEditing(announcement: Announcement) {
    setEditingId(announcement.id);
    setForm({
      title: announcement.title,
      content: announcement.content,
      publishAt: toDateTimeLocal(announcement.publish_at),
      isPublished: announcement.is_published,
      displayOrder: String(announcement.display_order),
    });

    setSuccessMessage("");
    setErrorMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const title = form.title.trim();
    const content = form.content.trim();

    if (!title) {
      setErrorMessage("Announcement title is required.");
      return;
    }

    if (!content) {
      setErrorMessage("Announcement content is required.");
      return;
    }

    if (!form.publishAt) {
      setErrorMessage("Publish date/time is required.");
      return;
    }

    const publishAt = new Date(form.publishAt);

    if (Number.isNaN(publishAt.getTime())) {
      setErrorMessage("Please enter a valid publish date/time.");
      return;
    }

    const displayOrder =
      Number.parseInt(form.displayOrder, 10) || 0;

    setSaving(true);

    try {
      const payload = {
        title,
        content,
        publish_at: publishAt.toISOString(),
        is_published: form.isPublished,
        display_order: displayOrder,
      };

      if (editingId) {
        const { error } = await supabase
          .from("sponsored_announcements")
          .update(payload)
          .eq("id", editingId)
          .eq("competition_id", competitionId);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setSuccessMessage(
          "Announcement updated successfully."
        );
      } else {
        const { data: authData } =
          await supabase.auth.getUser();

        if (!authData.user) {
          setErrorMessage("Your session has expired. Please log in again.");
          return;
        }

        const { data: admin, error: adminError } =
          await supabase
            .from("admin_users")
            .select("user_id")
            .eq("user_id", authData.user.id)
            .eq("is_active", true)
            .maybeSingle();

        if (adminError || !admin) {
          setErrorMessage(
            "Your admin access could not be verified."
          );
          return;
        }

        const { error } = await supabase
          .from("sponsored_announcements")
          .insert({
            competition_id: competitionId,
            ...payload,
            created_by: admin.user_id,
          });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setSuccessMessage(
          "Announcement created successfully."
        );
      }

      resetForm();
      await loadAnnouncements();
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "Unable to save the announcement. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAnnouncement(
    announcement: Announcement
  ) {
    const confirmed = window.confirm(
      `Delete "${announcement.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(announcement.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("sponsored_announcements")
        .delete()
        .eq("id", announcement.id)
        .eq("competition_id", competitionId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (editingId === announcement.id) {
        resetForm();
      }

      setSuccessMessage("Announcement deleted.");
      await loadAnnouncements();
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleAnnouncement(
    announcement: Announcement
  ) {
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("sponsored_announcements")
      .update({
        is_published: !announcement.is_published,
      })
      .eq("id", announcement.id)
      .eq("competition_id", competitionId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    setSuccessMessage(
      announcement.is_published
        ? "Announcement unpublished."
        : "Announcement published."
    );

    await loadAnnouncements();
  }

  if (loading) {
    return (
      <main style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 38 }}>⏳</div>
        <h3>Loading announcements...</h3>
      </main>
    );
  }

  return (
    <main>
      <div style={{ marginBottom: 22 }}>
        <Link
          href={`/admin/competitions/${competitionId}`}
          style={{
            textDecoration: "none",
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ← Back to Competition
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <div>
            <span className="sq-badge">Announcements</span>

            <h1
              className="sq-title"
              style={{ marginTop: 10, marginBottom: 6 }}
            >
              {competitionTitle}
            </h1>

            <p className="sq-subtitle" style={{ margin: 0 }}>
              Prepare announcements for this sponsored competition.
            </p>
          </div>

          <div
            style={{
              padding: "10px 13px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {announcements.length}{" "}
            {announcements.length === 1
              ? "Announcement"
              : "Announcements"}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 18,
          }}
        >
          <strong>Notice</strong>
          <p
            className="sq-subtitle"
            style={{ marginBottom: 0 }}
          >
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 18,
          }}
        >
          <strong>✓ {successMessage}</strong>
        </div>
      )}

      <section
        className="sq-card"
        style={{
          padding: 24,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              {editingId
                ? "Edit Announcement"
                : "Add Announcement"}
            </h2>

            <p className="sq-subtitle" style={{ marginBottom: 0 }}>
              Publish announcements immediately or schedule them for
              a future time.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              className="sq-button-secondary"
              onClick={resetForm}
              style={{
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>
              Announcement Title *
            </label>

            <input
              style={inputStyle}
              value={form.title}
              onChange={(e) =>
                updateForm("title", e.target.value)
              }
              placeholder="e.g. Competition starts tomorrow!"
              required
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>
              Announcement Content *
            </label>

            <textarea
              style={{
                ...inputStyle,
                minHeight: 150,
                resize: "vertical",
              }}
              value={form.content}
              onChange={(e) =>
                updateForm("content", e.target.value)
              }
              placeholder="Write the announcement players should see."
              required
            />
          </div>

          <div
            className="settings-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3,minmax(0,1fr))",
              gap: 16,
            }}
          >
            <div>
              <label style={labelStyle}>
                Publish Date & Time *
              </label>

              <input
                style={inputStyle}
                type="datetime-local"
                value={form.publishAt}
                onChange={(e) =>
                  updateForm(
                    "publishAt",
                    e.target.value
                  )
                }
                required
              />
            </div>

            <div>
              <label style={labelStyle}>
                Display Order
              </label>

              <input
                style={inputStyle}
                type="number"
                min="0"
                value={form.displayOrder}
                onChange={(e) =>
                  updateForm(
                    "displayOrder",
                    e.target.value
                  )
                }
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    updateForm(
                      "isPublished",
                      e.target.checked
                    )
                  }
                  style={{
                    marginTop: 2,
                    width: 18,
                    height: 18,
                  }}
                />

                <span>
                  <strong>Published</strong>
                  <span
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 11,
                      color: "var(--muted)",
                    }}
                  >
                    Players can see it when the publish time has arrived.
                  </span>
                </span>
              </label>
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 10,
              border: "1px solid var(--border)",
              background: "var(--background)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            An announcement is only player-visible when it is
            published, its publish time has arrived, and its
            competition is published.
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 20,
            }}
          >
            <button
              type="submit"
              className="sq-button-primary"
              disabled={saving}
              style={{
                border: 0,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Announcement"
                : "Add Announcement"}
            </button>
          </div>
        </form>
      </section>

      <section
        className="sq-card"
        style={{ overflow: "hidden" }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2 style={{ margin: 0 }}>
            Competition Announcements
          </h2>

          <p className="sq-subtitle" style={{ marginBottom: 0 }}>
            Manage the announcements that will appear to eligible players.
          </p>
        </div>

        {announcements.length === 0 ? (
          <div
            style={{
              padding: 55,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 44 }}>📢</div>
            <h3>No announcements yet</h3>
            <p className="sq-subtitle">
              Add the first announcement above.
            </p>
          </div>
        ) : (
          <div>
            {announcements.map((announcement) => {
              const isFuture =
                new Date(announcement.publish_at).getTime() >
                Date.now();

              return (
                <article
                  key={announcement.id}
                  style={{
                    padding: "22px 24px",
                    borderBottom:
                      "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        flex: "1 1 500px",
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <h3 style={{ margin: 0 }}>
                          {announcement.title}
                        </h3>

                        <span
                          style={{
                            padding: "5px 9px",
                            borderRadius: 999,
                            border:
                              "1px solid var(--border)",
                            fontSize: 10,
                            fontWeight: 900,
                            textTransform: "uppercase",
                          }}
                        >
                          {announcement.is_published
                            ? isFuture
                              ? "Scheduled"
                              : "Published"
                            : "Draft"}
                        </span>
                      </div>

                      <p
                        style={{
                          marginTop: 10,
                          marginBottom: 0,
                          whiteSpace: "pre-wrap",
                          lineHeight: 1.6,
                          fontSize: 13,
                        }}
                      >
                        {announcement.content}
                      </p>

                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          flexWrap: "wrap",
                          marginTop: 12,
                          color: "var(--muted)",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        <span>
                          📅{" "}
                          {formatDate(
                            announcement.publish_at
                          )}
                        </span>

                        <span>
                          ↕ Order{" "}
                          {announcement.display_order}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="sq-button-secondary"
                        onClick={() =>
                          startEditing(announcement)
                        }
                        style={{
                          border:
                            "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>

                      <button
                        type="button"
                        className="sq-button-secondary"
                        onClick={() =>
                          toggleAnnouncement(
                            announcement
                          )
                        }
                        style={{
                          border:
                            "1px solid var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        {announcement.is_published
                          ? "Unpublish"
                          : "Publish"}
                      </button>

                      <button
                        type="button"
                        className="sq-button-secondary"
                        onClick={() =>
                          deleteAnnouncement(
                            announcement
                          )
                        }
                        disabled={
                          deletingId === announcement.id
                        }
                        style={{
                          border:
                            "1px solid var(--border)",
                          cursor:
                            deletingId ===
                            announcement.id
                              ? "not-allowed"
                              : "pointer",
                          opacity:
                            deletingId ===
                            announcement.id
                              ? 0.6
                              : 1,
                        }}
                      >
                        {deletingId === announcement.id
                          ? "Deleting..."
                          : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <style jsx>{`
        @media (max-width: 760px) {
          .settings-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
