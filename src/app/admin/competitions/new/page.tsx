"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type CompetitionType = "weekly" | "monthly";

export default function NewCompetitionPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    sponsorName: "",
    sponsorDescription: "",
    sponsorBannerUrl: "",
    title: "",
    description: "",
    rules: "",
    prizes: "",
    competitionType: "weekly" as CompetitionType,
    startsAt: "",
    endsAt: "",
    isPublished: false,
    displayOrder: "0",
  });

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(
    field: keyof typeof form,
    value: string | boolean
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (!form.sponsorName.trim()) {
      setErrorMessage("Sponsor name is required.");
      return;
    }

    if (!form.title.trim()) {
      setErrorMessage("Competition title is required.");
      return;
    }

    if (!form.startsAt || !form.endsAt) {
      setErrorMessage("Start date/time and end date/time are required.");
      return;
    }

    const start = new Date(form.startsAt);
    const end = new Date(form.endsAt);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime())
    ) {
      setErrorMessage("Please enter valid start and end dates.");
      return;
    }

    if (end <= start) {
      setErrorMessage("The end date/time must be after the start date/time.");
      return;
    }

    setSaving(true);

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
        setErrorMessage("Your admin access could not be verified.");
        return;
      }

      const { data, error } = await supabase
        .from("sponsored_competitions")
        .insert({
          sponsor_name: form.sponsorName.trim(),
          sponsor_description:
            form.sponsorDescription.trim() || null,
          sponsor_banner_url:
            form.sponsorBannerUrl.trim() || null,
          title: form.title.trim(),
          description: form.description.trim() || null,
          rules: form.rules.trim() || null,
          prizes: form.prizes.trim() || null,
          competition_type: form.competitionType,
          starts_at: start.toISOString(),
          ends_at: end.toISOString(),
          is_published: form.isPublished,
          display_order:
            Number.parseInt(form.displayOrder, 10) || 0,
          created_by: admin.user_id,
        })
        .select("id")
        .single();

      if (error) {
        console.error("Create competition error:", error);
        setErrorMessage(error.message);
        return;
      }

      router.push(`/admin/competitions/${data.id}`);
    } catch (error: any) {
      console.error("Unexpected create competition error:", error);
      setErrorMessage(
        error?.message || "Unable to create the competition."
      );
    } finally {
      setSaving(false);
    }
  }

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

        <h1
          className="sq-title"
          style={{ marginTop: 14, marginBottom: 8 }}
        >
          Create Competition
        </h1>

        <p className="sq-subtitle" style={{ margin: 0 }}>
          Set up the sponsor, competition details, rules, prizes and schedule.
        </p>
      </div>

      {errorMessage && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 20,
            border: "1px solid var(--border)",
          }}
        >
          <strong>Could not create competition</strong>
          <p className="sq-subtitle" style={{ marginBottom: 0 }}>
            {errorMessage}
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <section
          className="sq-card"
          style={{
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Sponsor Information</h2>
          <p className="sq-subtitle">
            Information about the organization sponsoring the competition.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 18,
            }}
            className="form-grid"
          >
            <div>
              <label style={labelStyle}>Sponsor Name *</label>
              <input
                style={inputStyle}
                value={form.sponsorName}
                onChange={(e) =>
                  updateField("sponsorName", e.target.value)
                }
                placeholder="e.g. Alhujaj Umrah & Tours"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Sponsor Banner URL</label>
              <input
                style={inputStyle}
                value={form.sponsorBannerUrl}
                onChange={(e) =>
                  updateField("sponsorBannerUrl", e.target.value)
                }
                placeholder="https://..."
                type="url"
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Sponsor Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: 100, resize: "vertical" }}
                value={form.sponsorDescription}
                onChange={(e) =>
                  updateField("sponsorDescription", e.target.value)
                }
                placeholder="Tell players about the sponsoring organization."
              />
            </div>
          </div>
        </section>

        <section
          className="sq-card"
          style={{
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Competition Details</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 18,
            }}
            className="form-grid"
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Competition Title *</label>
              <input
                style={inputStyle}
                value={form.title}
                onChange={(e) =>
                  updateField("title", e.target.value)
                }
                placeholder="e.g. The Umrah Knowledge Challenge"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Competition Type *</label>
              <select
                style={inputStyle}
                value={form.competitionType}
                onChange={(e) =>
                  updateField(
                    "competitionType",
                    e.target.value as CompetitionType
                  )
                }
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>Display Order</label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                value={form.displayOrder}
                onChange={(e) =>
                  updateField("displayOrder", e.target.value)
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={{ ...inputStyle, minHeight: 120, resize: "vertical" }}
                value={form.description}
                onChange={(e) =>
                  updateField("description", e.target.value)
                }
                placeholder="Describe the competition for players."
              />
            </div>

            <div>
              <label style={labelStyle}>Rules</label>
              <textarea
                style={{ ...inputStyle, minHeight: 160, resize: "vertical" }}
                value={form.rules}
                onChange={(e) =>
                  updateField("rules", e.target.value)
                }
                placeholder="Enter the competition rules."
              />
            </div>

            <div>
              <label style={labelStyle}>Prizes</label>
              <textarea
                style={{ ...inputStyle, minHeight: 160, resize: "vertical" }}
                value={form.prizes}
                onChange={(e) =>
                  updateField("prizes", e.target.value)
                }
                placeholder="Enter prize details for winners."
              />
            </div>
          </div>
        </section>

        <section
          className="sq-card"
          style={{
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Competition Schedule</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              gap: 18,
            }}
            className="form-grid"
          >
            <div>
              <label style={labelStyle}>Starts *</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  updateField("startsAt", e.target.value)
                }
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Ends *</label>
              <input
                style={inputStyle}
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) =>
                  updateField("endsAt", e.target.value)
                }
                required
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 18,
              padding: 14,
              borderRadius: 10,
              background: "var(--background)",
              border: "1px solid var(--border)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            The competition status will be determined automatically from
            these dates. It becomes <strong>Upcoming</strong>, then{" "}
            <strong>Live</strong>, then <strong>Ended</strong>.
          </div>
        </section>

        <section
          className="sq-card"
          style={{
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0 }}>Publishing</h2>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) =>
                updateField("isPublished", e.target.checked)
              }
              style={{
                marginTop: 3,
                width: 18,
                height: 18,
              }}
            />

            <span>
              <strong>Publish this competition</strong>
              <span
                style={{
                  display: "block",
                  marginTop: 4,
                  color: "var(--muted)",
                  fontSize: 12,
                }}
              >
                Published competitions can become visible to eligible
                players according to the competition dates.
              </span>
            </span>
          </label>

          <div
            style={{
              marginTop: 16,
              padding: 14,
              borderRadius: 10,
              background: "var(--background)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              fontSize: 12,
            }}
          >
            Recommended workflow: create the competition as a draft, add
            all questions and announcements, review the setup, then publish
            it.
          </div>
        </section>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/admin/competitions"
            className="sq-button-secondary"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="sq-button-primary"
            disabled={saving}
            style={{
              border: 0,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Creating..." : "Create Competition"}
          </button>
        </div>
      </form>

      <style jsx>{`
        @media (max-width: 700px) {
          .form-grid {
            grid-template-columns: 1fr !important;
          }

          .form-grid > div {
            grid-column: 1 / -1 !important;
          }
        }
      `}</style>
    </main>
  );
}
