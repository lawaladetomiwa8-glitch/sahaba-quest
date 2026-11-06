"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

type Competition = {
  id: string;
  sponsor_name: string;
  sponsor_description: string | null;
  sponsor_banner_url: string | null;
  sponsor_logo_url: string | null;
  sponsor_image_url: string | null;
  sponsor_whatsapp: string | null;
  sponsor_instagram_url: string | null;
  sponsor_facebook_url: string | null;
  sponsor_tiktok_url: string | null;
  sponsor_website_url: string | null;
  title: string;
  description: string | null;
  rules: string | null;
  prizes: string | null;
  competition_type: "weekly" | "monthly";
  starts_at: string;
  ends_at: string;
  is_published: boolean;
  display_order: number;
  created_at: string;
};

function getStatus(c: Competition) {
  if (!c.is_published) return "Draft";

  const now = Date.now();
  const start = new Date(c.starts_at).getTime();
  const end = new Date(c.ends_at).getTime();

  if (now < start) return "Upcoming";
  if (now < end) return "Live";
  return "Ended";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}


function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}

async function uploadSponsorAsset(
  file: File,
  kind: "logo" | "banner" | "image",
  userId: string
) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${userId}/${kind}-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;

  const { error } = await supabase.storage
    .from("sponsored-assets")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw error;

  const { data } = supabase.storage
    .from("sponsored-assets")
    .getPublicUrl(path);

  return data.publicUrl;
}

export default function CompetitionManagementPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [competition, setCompetition] =
    useState<Competition | null>(null);
  const [questionCount, setQuestionCount] = useState(0);
  const [announcementCount, setAnnouncementCount] =
    useState(0);
  const [participantCount, setParticipantCount] =
    useState(0);
  const [completedCount, setCompletedCount] =
    useState(0);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [sponsorImageFile, setSponsorImageFile] = useState<File | null>(null);
  const [editForm, setEditForm] = useState({
    sponsor_name: "",
    sponsor_description: "",
    sponsor_banner_url: "",
    sponsor_logo_url: "",
    sponsor_image_url: "",
    sponsor_whatsapp: "",
    sponsor_instagram_url: "",
    sponsor_facebook_url: "",
    sponsor_tiktok_url: "",
    sponsor_website_url: "",
    title: "",
    description: "",
    rules: "",
    prizes: "",
    competition_type: "weekly" as "weekly" | "monthly",
    starts_at: "",
    ends_at: "",
    display_order: "0",
    is_published: false,
  });

  async function loadCompetition() {
    setLoading(true);
    setMessage("");

    const id = params.id;

    const [
      competitionResult,
      questionsResult,
      announcementsResult,
      attemptsResult,
    ] = await Promise.all([
      supabase
        .from("sponsored_competitions")
        .select(
          "id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,sponsor_image_url,sponsor_whatsapp,sponsor_instagram_url,sponsor_facebook_url,sponsor_tiktok_url,sponsor_website_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published,display_order,created_at"
        )
        .eq("id", id)
        .maybeSingle(),

      supabase
        .from("sponsored_questions")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", id),

      supabase
        .from("sponsored_announcements")
        .select("id", { count: "exact", head: true })
        .eq("competition_id", id),

      supabase
        .from("sponsored_attempts")
        .select("id,user_id,status")
        .eq("competition_id", id),
    ]);

    if (competitionResult.error) {
      setMessage(competitionResult.error.message);
      setLoading(false);
      return;
    }

    if (!competitionResult.data) {
      setMessage("Competition not found.");
      setLoading(false);
      return;
    }

    setCompetition(
      competitionResult.data as Competition
    );
    setQuestionCount(questionsResult.count ?? 0);
    setAnnouncementCount(
      announcementsResult.count ?? 0
    );

    const attempts = attemptsResult.data ?? [];
    setParticipantCount(
      new Set(attempts.map((row) => row.user_id)).size
    );
    setCompletedCount(
      attempts.filter(
        (row) => row.status === "completed"
      ).length
    );

    setLoading(false);
  }

  useEffect(() => {
    loadCompetition();
  }, [params.id]);

  function beginEditing() {
    if (!competition) return;

    setEditForm({
      sponsor_name: competition.sponsor_name || "",
      sponsor_description: competition.sponsor_description || "",
      sponsor_banner_url: competition.sponsor_banner_url || "",
      sponsor_logo_url: competition.sponsor_logo_url || "",
      sponsor_image_url: competition.sponsor_image_url || "",
      sponsor_whatsapp: competition.sponsor_whatsapp || "",
      sponsor_instagram_url: competition.sponsor_instagram_url || "",
      sponsor_facebook_url: competition.sponsor_facebook_url || "",
      sponsor_tiktok_url: competition.sponsor_tiktok_url || "",
      sponsor_website_url: competition.sponsor_website_url || "",
      title: competition.title || "",
      description: competition.description || "",
      rules: competition.rules || "",
      prizes: competition.prizes || "",
      competition_type: competition.competition_type,
      starts_at: toDateTimeLocal(competition.starts_at),
      ends_at: toDateTimeLocal(competition.ends_at),
      display_order: String(competition.display_order ?? 0),
      is_published: competition.is_published,
    });
    setBannerFile(null);
    setLogoFile(null);
    setSponsorImageFile(null);
    setEditError("");
    setEditing(true);
  }

  function updateEditField(
    field: keyof typeof editForm,
    value: string | boolean
  ) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function saveCompetition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!competition) return;
    setEditError("");

    if (!editForm.sponsor_name.trim() || !editForm.title.trim()) {
      setEditError("Please enter both the sponsor name and competition title.");
      return;
    }

    if (!editForm.starts_at || !editForm.ends_at) {
      setEditError("Please provide both the competition start and end dates.");
      return;
    }

    const start = new Date(editForm.starts_at);
    const end = new Date(editForm.ends_at);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      setEditError("Please check the competition dates. The end must be after the start.");
      return;
    }

    setEditSaving(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: admin, error: adminError } = await supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (adminError || !admin) {
        setEditError("Your admin access could not be verified. Please sign in again or contact support.");
        return;
      }

      let sponsorBannerUrl = editForm.sponsor_banner_url.trim() || null;
      let sponsorLogoUrl = editForm.sponsor_logo_url.trim() || null;
      let sponsorImageUrl = editForm.sponsor_image_url.trim() || null;

      if (bannerFile) {
        sponsorBannerUrl = await uploadSponsorAsset(bannerFile, "banner", user.id);
      }

      if (logoFile) {
        sponsorLogoUrl = await uploadSponsorAsset(logoFile, "logo", user.id);
      }
      if (sponsorImageFile) {
        sponsorImageUrl = await uploadSponsorAsset(sponsorImageFile, "image", user.id);
      }

      const { data, error } = await supabase
        .from("sponsored_competitions")
        .update({
          sponsor_name: editForm.sponsor_name.trim(),
          sponsor_description: editForm.sponsor_description.trim() || null,
          sponsor_banner_url: sponsorBannerUrl,
          sponsor_logo_url: sponsorLogoUrl,
          sponsor_image_url: sponsorImageUrl,
          sponsor_whatsapp: editForm.sponsor_whatsapp.trim() || null,
          sponsor_instagram_url: editForm.sponsor_instagram_url.trim() || null,
          sponsor_facebook_url: editForm.sponsor_facebook_url.trim() || null,
          sponsor_tiktok_url: editForm.sponsor_tiktok_url.trim() || null,
          sponsor_website_url: editForm.sponsor_website_url.trim() || null,
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          rules: editForm.rules.trim() || null,
          prizes: editForm.prizes.trim() || null,
          competition_type: editForm.competition_type,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          is_published: editForm.is_published,
          display_order: Number.parseInt(editForm.display_order, 10) || 0,
        })
        .eq("id", competition.id)
        .select(
          "id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,sponsor_image_url,sponsor_whatsapp,sponsor_instagram_url,sponsor_facebook_url,sponsor_tiktok_url,sponsor_website_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published,display_order,created_at"
        )
        .single();

      if (error) {
        console.error("Update competition error:", error);
        setEditError("We couldn't save your changes. Please try again. If the problem continues, contact support.");
        return;
      }

      setCompetition(data as Competition);
      setEditing(false);
      setMessage("Competition details updated successfully.");
    } catch (error) {
      console.error("Unexpected update competition error:", error);
      setEditError("Something went wrong while saving the competition. Please try again.");
    } finally {
      setEditSaving(false);
    }
  }

  async function togglePublished() {
    if (!competition) return;

    setBusy(true);
    setMessage("");

    const { data, error } = await supabase
      .from("sponsored_competitions")
      .update({
        is_published: !competition.is_published,
      })
      .eq("id", competition.id)
      .select(
        "id,sponsor_name,sponsor_description,sponsor_banner_url,sponsor_logo_url,sponsor_image_url,sponsor_whatsapp,sponsor_instagram_url,sponsor_facebook_url,sponsor_tiktok_url,sponsor_website_url,title,description,rules,prizes,competition_type,starts_at,ends_at,is_published,display_order,created_at"
      )
      .single();

    if (error) {
      setMessage(error.message);
    } else {
      setCompetition(data as Competition);
    }

    setBusy(false);
  }

  async function deleteCompetition() {
    if (!competition) return;

    const confirmed = window.confirm(
      "Delete this competition? This will also remove its related questions, announcements and competition records according to the database relationships. This action cannot be undone."
    );

    if (!confirmed) return;

    setBusy(true);
    setMessage("");

    const { error } = await supabase
      .from("sponsored_competitions")
      .delete()
      .eq("id", competition.id);

    if (error) {
      setMessage(error.message);
      setBusy(false);
      return;
    }

    router.replace("/admin/competitions");
  }

  if (loading) {
    return (
      <main style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 38 }}>⏳</div>
        <h3>Loading competition...</h3>
      </main>
    );
  }

  if (!competition) {
    return (
      <main>
        <Link
          href="/admin/competitions"
          style={{
            textDecoration: "none",
            color: "var(--muted)",
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          ← Back to Competitions
        </Link>

        <div
          className="sq-card"
          style={{
            padding: 30,
            marginTop: 20,
          }}
        >
          <h2>Competition not found</h2>
          <p className="sq-subtitle">{message}</p>
        </div>
      </main>
    );
  }

  const status = getStatus(competition);

  return (
    <main>
      <div style={{ marginBottom: 22 }}>
        <Link
          href="/admin/competitions"
          style={{
            textDecoration: "none",
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ← Back to Competitions
        </Link>
      </div>

      {message && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 20,
          }}
        >
          <strong>Notice</strong>
          <p className="sq-subtitle">{message}</p>
        </div>
      )}

      <section
        className="sq-card"
        style={{
          padding: 24,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 500px" }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span className="sq-badge">
                {competition.competition_type}
              </span>

              <span
                style={{
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 900,
                }}
              >
                {status}
              </span>
            </div>

            <h1
              className="sq-title"
              style={{ marginTop: 14, marginBottom: 8 }}
            >
              {competition.title}
            </h1>

            <p className="sq-subtitle" style={{ margin: 0 }}>
              Sponsored by{" "}
              <strong>{competition.sponsor_name}</strong>
            </p>

            <p
              style={{
                marginTop: 8,
                color: "var(--muted)",
                fontSize: 12,
              }}
            >
              {formatDate(competition.starts_at)} →{" "}
              {formatDate(competition.ends_at)}
            </p>
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
              className="sq-button-primary"
              onClick={beginEditing}
              disabled={busy || editSaving}
              style={{ border: 0, cursor: "pointer" }}
            >
              Edit Competition
            </button>

            <button
              type="button"
              className="sq-button-secondary"
              onClick={togglePublished}
              disabled={busy}
              style={{
                border: "1px solid var(--border)",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              {competition.is_published
                ? "Unpublish"
                : "Publish"}
            </button>

            <button
              type="button"
              className="sq-button-secondary"
              onClick={deleteCompetition}
              disabled={busy}
              style={{
                border: "1px solid var(--border)",
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </section>

      {editing && (
        <form onSubmit={saveCompetition} className="sq-card" style={{ padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Edit Competition</h2>
              <p className="sq-subtitle" style={{ marginBottom: 0 }}>
                Update the competition details. Existing questions, announcements and participant records will not be changed.
              </p>
            </div>
            <button type="button" className="sq-button-secondary" onClick={() => setEditing(false)} disabled={editSaving}>
              Cancel
            </button>
          </div>

          {editError && (
            <div role="alert" style={{ marginTop: 18, padding: 13, borderRadius: 10, background: "rgba(220, 38, 38, 0.07)", color: "#b42318", fontSize: 13 }}>
              {editError}
            </div>
          )}

          <div className="edit-form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 16, marginTop: 22 }}>
            <label className="edit-field">
              <span>Sponsor name *</span>
              <input required value={editForm.sponsor_name} onChange={(e) => updateEditField("sponsor_name", e.target.value)} />
            </label>
            <label className="edit-field">
              <span>Competition title *</span>
              <input required value={editForm.title} onChange={(e) => updateEditField("title", e.target.value)} />
            </label>
            <label className="edit-field">
              <span>Competition type</span>
              <select value={editForm.competition_type} onChange={(e) => updateEditField("competition_type", e.target.value as "weekly" | "monthly")}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="edit-field">
              <span>Display order</span>
              <input type="number" min="0" value={editForm.display_order} onChange={(e) => updateEditField("display_order", e.target.value)} />
            </label>

            <label className="edit-field edit-full">
              <span>Sponsor description</span>
              <textarea rows={3} value={editForm.sponsor_description} onChange={(e) => updateEditField("sponsor_description", e.target.value)} placeholder="Tell participants about the sponsor." />
            </label>
            <label className="edit-field edit-full">
              <span>Sponsor profile image URL</span>
              <input type="url" value={editForm.sponsor_image_url} onChange={(e) => updateEditField("sponsor_image_url", e.target.value)} placeholder="https://..." />
            </label>
            <label className="edit-field edit-full">
              <span>Upload / replace sponsor profile image</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setSponsorImageFile(e.target.files?.[0] || null)} />
            </label>
            <label className="edit-field">
              <span>WhatsApp number</span>
              <input value={editForm.sponsor_whatsapp} onChange={(e) => updateEditField("sponsor_whatsapp", e.target.value)} placeholder="e.g. 2347070000000" />
            </label>
            <label className="edit-field">
              <span>Instagram URL</span>
              <input type="url" value={editForm.sponsor_instagram_url} onChange={(e) => updateEditField("sponsor_instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
            </label>
            <label className="edit-field">
              <span>Facebook URL</span>
              <input type="url" value={editForm.sponsor_facebook_url} onChange={(e) => updateEditField("sponsor_facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
            </label>
            <label className="edit-field">
              <span>TikTok URL</span>
              <input type="url" value={editForm.sponsor_tiktok_url} onChange={(e) => updateEditField("sponsor_tiktok_url", e.target.value)} placeholder="https://tiktok.com/@..." />
            </label>
            <label className="edit-field edit-full">
              <span>Website URL</span>
              <input type="url" value={editForm.sponsor_website_url} onChange={(e) => updateEditField("sponsor_website_url", e.target.value)} placeholder="https://..." />
            </label>

            <label className="edit-field edit-full">
              <span>Competition description</span>
              <textarea rows={4} value={editForm.description} onChange={(e) => updateEditField("description", e.target.value)} placeholder="Describe the competition for participants." />
            </label>
            <label className="edit-field">
              <span>Competition rules</span>
              <textarea rows={7} value={editForm.rules} onChange={(e) => updateEditField("rules", e.target.value)} placeholder="Enter each rule on a new line." />
            </label>
            <label className="edit-field">
              <span>Prizes</span>
              <textarea rows={7} value={editForm.prizes} onChange={(e) => updateEditField("prizes", e.target.value)} placeholder="Enter prize details." />
            </label>

            <label className="edit-field">
              <span>Start date and time</span>
              <input required type="datetime-local" value={editForm.starts_at} onChange={(e) => updateEditField("starts_at", e.target.value)} />
            </label>
            <label className="edit-field">
              <span>End date and time</span>
              <input required type="datetime-local" value={editForm.ends_at} onChange={(e) => updateEditField("ends_at", e.target.value)} />
            </label>

            <label className="edit-field">
              <span>Sponsor logo URL</span>
              <input type="url" value={editForm.sponsor_logo_url} onChange={(e) => updateEditField("sponsor_logo_url", e.target.value)} placeholder="https://..." />
            </label>
            <label className="edit-field">
              <span>Replace sponsor logo</span>
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
            </label>
            <label className="edit-field edit-full">
              <span>Sponsor banner URL</span>
              <input type="url" value={editForm.sponsor_banner_url} onChange={(e) => updateEditField("sponsor_banner_url", e.target.value)} placeholder="https://..." />
            </label>
            <label className="edit-field edit-full">
              <span>Replace sponsor banner</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setBannerFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          <label style={{ display: "flex", alignItems: "flex-start", gap: 11, marginTop: 20, cursor: "pointer" }}>
            <input type="checkbox" checked={editForm.is_published} onChange={(e) => updateEditField("is_published", e.target.checked)} style={{ width: 18, height: 18, marginTop: 2 }} />
            <span>
              <strong>Publish this competition</strong>
              <span style={{ display: "block", color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                Published competitions are visible on the public sponsored competitions page.
              </span>
            </span>
          </label>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
            <button type="submit" className="sq-button-primary" disabled={editSaving} style={{ border: 0, cursor: editSaving ? "wait" : "pointer" }}>
              {editSaving ? "Saving changes..." : "Save Changes"}
            </button>
            <button type="button" className="sq-button-secondary" onClick={() => setEditing(false)} disabled={editSaving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(4,minmax(0,1fr))",
          gap: 14,
          marginBottom: 20,
        }}
        className="stats-grid"
      >
        {[
          ["Questions", questionCount, "❓"],
          ["Announcements", announcementCount, "📢"],
          ["Participants", participantCount, "👥"],
          ["Completed", completedCount, "🏁"],
        ].map(([label, value, icon]) => (
          <div
            className="sq-card"
            key={String(label)}
            style={{ padding: 20 }}
          >
            <div style={{ fontSize: 23 }}>{icon}</div>
            <div
              style={{
                marginTop: 9,
                fontSize: 27,
                fontWeight: 900,
              }}
            >
              {value}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                color: "var(--muted)",
                fontWeight: 800,
                textTransform: "uppercase",
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(2,minmax(0,1fr))",
          gap: 16,
          marginBottom: 20,
        }}
        className="management-grid"
      >
        <Link
          href={`/admin/competitions/${competition.id}/questions`}
          className="sq-card"
          style={{
            padding: 24,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 32 }}>❓</div>
          <h2 style={{ marginBottom: 6 }}>
            Questions
          </h2>
          <p className="sq-subtitle">
            Add and manage the manually authored competition
            questions, correct answers, time limits and XP.
          </p>
          <strong>
            Manage Questions →
          </strong>
        </Link>

        <Link
          href={`/admin/competitions/${competition.id}/announcements`}
          className="sq-card"
          style={{
            padding: 24,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 32 }}>📢</div>
          <h2 style={{ marginBottom: 6 }}>
            Announcements
          </h2>
          <p className="sq-subtitle">
            Prepare announcements and publish them at the
            appropriate time.
          </p>
          <strong>
            Manage Announcements →
          </strong>
        </Link>

        <Link
          href={`/admin/competitions/${competition.id}/results`}
          className="sq-card"
          style={{
            padding: 24,
            textDecoration: "none",
            color: "inherit",
          }}
        >
          <div style={{ fontSize: 32 }}>🏆</div>
          <h2 style={{ marginBottom: 6 }}>
            Results & Winners
          </h2>
          <p className="sq-subtitle">
            Review completed attempts, leaderboard results and
            generate the top three winners.
          </p>
          <strong>
            View Results →
          </strong>
        </Link>

        <div
          className="sq-card"
          style={{
            padding: 24,
          }}
        >
          <div style={{ fontSize: 32 }}>🎨</div>
          <h2 style={{ marginBottom: 6 }}>
            Sponsor Branding
          </h2>

          <p className="sq-subtitle">
            Preview the sponsor branding currently attached to
            this competition.
          </p>

          {competition.sponsor_logo_url && (
            <img
              src={competition.sponsor_logo_url}
              alt="Sponsor logo"
              style={{
                width: 70,
                height: 70,
                objectFit: "contain",
                borderRadius: 8,
                border: "1px solid var(--border)",
                marginBottom: 10,
              }}
            />
          )}

          {competition.sponsor_banner_url && (
            <img
              src={competition.sponsor_banner_url}
              alt="Sponsor banner"
              style={{
                width: "100%",
                maxHeight: 150,
                objectFit: "cover",
                borderRadius: 10,
                border: "1px solid var(--border)",
              }}
            />
          )}
        </div>
      </section>

      <section
        className="sq-card"
        style={{ padding: 24 }}
      >
        <h2 style={{ marginTop: 0 }}>
          Competition Information
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(2,minmax(0,1fr))",
            gap: 20,
          }}
          className="info-grid"
        >
          <div>
            <strong>Sponsor</strong>
            <p className="sq-subtitle">
              {competition.sponsor_name}
            </p>
          </div>

          <div>
            <strong>Type</strong>
            <p className="sq-subtitle">
              {competition.competition_type}
            </p>
          </div>

          <div>
            <strong>Description</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.description || "No description added."}
            </p>
          </div>

          <div>
            <strong>Sponsor Description</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.sponsor_description ||
                "No sponsor description added."}
            </p>
          </div>

          <div>
            <strong>Rules</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.rules || "No rules added."}
            </p>
          </div>

          <div>
            <strong>Prizes</strong>
            <p
              className="sq-subtitle"
              style={{ whiteSpace: "pre-wrap" }}
            >
              {competition.prizes || "No prizes added."}
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        .edit-field {
          display: flex;
          flex-direction: column;
          gap: 7px;
          min-width: 0;
          font-size: 12px;
          font-weight: 800;
        }

        .edit-field input,
        .edit-field select,
        .edit-field textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 11px 12px;
          background: var(--background);
          color: inherit;
          font: inherit;
          font-weight: 500;
          outline: none;
        }

        .edit-field textarea {
          resize: vertical;
          line-height: 1.55;
        }

        .edit-field input:focus,
        .edit-field select:focus,
        .edit-field textarea:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.1);
        }

        .edit-full {
          grid-column: 1 / -1;
        }

        @media (max-width: 800px) {
          .edit-form-grid {
            grid-template-columns: 1fr !important;
          }

          .edit-full {
            grid-column: auto;
          }
          .stats-grid {
            grid-template-columns: repeat(2,minmax(0,1fr)) !important;
          }

          .management-grid {
            grid-template-columns: 1fr !important;
          }

          .info-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 480px) {
          .stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}