"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type CompetitionType = "weekly" | "monthly";

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

async function uploadSponsorAsset(
  file: File,
  kind: "logo" | "banner" | "image",
  userId: string
) {
  const extension =
    file.name.split(".").pop()?.toLowerCase() || "jpg";

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

export default function NewCompetitionPage() {
  const router = useRouter();

  const [form, setForm] = useState({
    sponsorName: "",
    sponsorDescription: "",
    sponsorBannerUrl: "",
    sponsorLogoUrl: "",
    sponsorImageUrl: "",
    sponsorWhatsapp: "",
    sponsorInstagramUrl: "",
    sponsorFacebookUrl: "",
    sponsorTiktokUrl: "",
    sponsorWebsiteUrl: "",
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

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [sponsorImageFile, setSponsorImageFile] = useState<File | null>(null);
  const [sponsorImagePreview, setSponsorImagePreview] = useState("");
  const [bannerPreview, setBannerPreview] = useState("");
  const [logoPreview, setLogoPreview] = useState("");

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

  function selectBanner(file: File | null) {
    setBannerFile(file);
    setBannerPreview(file ? URL.createObjectURL(file) : "");
  }

  function selectLogo(file: File | null) {
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : "");
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
      setErrorMessage(
        "Start date/time and end date/time are required."
      );
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
      setErrorMessage(
        "The end date/time must be after the start date/time."
      );
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
        setErrorMessage(
          "Your admin access could not be verified."
        );
        return;
      }

      let sponsorBannerUrl = form.sponsorBannerUrl.trim() || null;
      let sponsorLogoUrl = form.sponsorLogoUrl.trim() || null;
      let sponsorImageUrl = form.sponsorImageUrl.trim() || null;

      if (bannerFile) {
        sponsorBannerUrl = await uploadSponsorAsset(
          bannerFile,
          "banner",
          user.id
        );
      }

      if (logoFile) {
        sponsorLogoUrl = await uploadSponsorAsset(logoFile, "logo", user.id);
      }

      if (sponsorImageFile) {
        sponsorImageUrl = await uploadSponsorAsset(sponsorImageFile, "image", user.id);
      }

      const { data, error } = await supabase
        .from("sponsored_competitions")
        .insert({
          sponsor_name: form.sponsorName.trim(),
          sponsor_description:
            form.sponsorDescription.trim() || null,
          sponsor_banner_url: sponsorBannerUrl,
          sponsor_logo_url: sponsorLogoUrl,
          sponsor_image_url: sponsorImageUrl,
          sponsor_whatsapp: form.sponsorWhatsapp.trim() || null,
          sponsor_instagram_url: form.sponsorInstagramUrl.trim() || null,
          sponsor_facebook_url: form.sponsorFacebookUrl.trim() || null,
          sponsor_tiktok_url: form.sponsorTiktokUrl.trim() || null,
          sponsor_website_url: form.sponsorWebsiteUrl.trim() || null,
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
        error?.message ||
          "Unable to create the competition. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

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
          Set up the sponsor, branding, competition details, rules,
          prizes and schedule.
        </p>
      </div>

      {errorMessage && (
        <div
          className="sq-card"
          style={{ padding: 16, marginBottom: 20 }}
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
          style={{ padding: 24, marginBottom: 20 }}
        >
          <h2 style={{ marginTop: 0 }}>Sponsor Information</h2>
          <p className="sq-subtitle">
            Information about the organization sponsoring the competition.
          </p>

          <div
            className="form-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 18,
            }}
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
              <label style={labelStyle}>
                Sponsor / Company Logo
              </label>

              <input
                style={inputStyle}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) =>
                  selectLogo(e.target.files?.[0] || null)
                }
              />

              {logoPreview && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    display: "inline-flex",
                    background: "var(--background)",
                  }}
                >
                  <img
                    src={logoPreview}
                    alt="Sponsor logo preview"
                    style={{
                      width: 90,
                      height: 90,
                      objectFit: "contain",
                      borderRadius: 8,
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                PNG, JPG, WebP or SVG.
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Sponsor Banner
              </label>

              <input
                style={inputStyle}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) =>
                  selectBanner(e.target.files?.[0] || null)
                }
              />

              {bannerPreview && (
                <div
                  style={{
                    marginTop: 10,
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "var(--background)",
                  }}
                >
                  <img
                    src={bannerPreview}
                    alt="Sponsor banner preview"
                    style={{
                      width: "100%",
                      maxHeight: 240,
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--muted)",
                }}
              >
                Recommended: wide landscape banner. PNG, JPG or WebP.
              </div>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <details>
                <summary
                  style={{
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 800,
                    color: "var(--muted)",
                  }}
                >
                  Or use hosted image URLs instead
                </summary>

                <div style={{ marginTop: 12 }}>
                  <label style={labelStyle}>
                    Banner URL
                  </label>
                  <input
                    style={inputStyle}
                    value={form.sponsorBannerUrl}
                    onChange={(e) =>
                      updateField(
                        "sponsorBannerUrl",
                        e.target.value
                      )
                    }
                    placeholder="https://..."
                    type="url"
                  />

                  <label
                    style={{
                      ...labelStyle,
                      marginTop: 14,
                    }}
                  >
                    Logo URL
                  </label>
                  <input
                    style={inputStyle}
                    value={form.sponsorLogoUrl}
                    onChange={(e) =>
                      updateField(
                        "sponsorLogoUrl",
                        e.target.value
                      )
                    }
                    placeholder="https://..."
                    type="url"
                  />
                </div>
              </details>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Sponsor Profile Image</label>
              <input
                style={inputStyle}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSponsorImageFile(file);
                  setSponsorImagePreview(file ? URL.createObjectURL(file) : "");
                }}
              />
              {sponsorImagePreview && (
                <img src={sponsorImagePreview} alt="Sponsor profile preview" style={{ marginTop: 10, width: "100%", maxWidth: 320, maxHeight: 180, objectFit: "cover", borderRadius: 10 }} />
              )}
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 11 }}>Optional photo of the sponsor, store, products or business.</p>
            </div>

            <div>
              <label style={labelStyle}>WhatsApp Number</label>
              <input style={inputStyle} value={form.sponsorWhatsapp} onChange={(e) => updateField("sponsorWhatsapp", e.target.value)} placeholder="e.g. 2347070000000" />
            </div>
            <div>
              <label style={labelStyle}>Instagram URL</label>
              <input style={inputStyle} type="url" value={form.sponsorInstagramUrl} onChange={(e) => updateField("sponsorInstagramUrl", e.target.value)} placeholder="https://instagram.com/..." />
            </div>
            <div>
              <label style={labelStyle}>Facebook URL</label>
              <input style={inputStyle} type="url" value={form.sponsorFacebookUrl} onChange={(e) => updateField("sponsorFacebookUrl", e.target.value)} placeholder="https://facebook.com/..." />
            </div>
            <div>
              <label style={labelStyle}>TikTok URL</label>
              <input style={inputStyle} type="url" value={form.sponsorTiktokUrl} onChange={(e) => updateField("sponsorTiktokUrl", e.target.value)} placeholder="https://tiktok.com/@..." />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Website URL</label>
              <input style={inputStyle} type="url" value={form.sponsorWebsiteUrl} onChange={(e) => updateField("sponsorWebsiteUrl", e.target.value)} placeholder="https://..." />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Sponsor Description
              </label>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 100,
                  resize: "vertical",
                }}
                value={form.sponsorDescription}
                onChange={(e) =>
                  updateField(
                    "sponsorDescription",
                    e.target.value
                  )
                }
                placeholder="Tell players about the sponsoring organization."
              />
            </div>
          </div>
        </section>

        <section
          className="sq-card"
          style={{ padding: 24, marginBottom: 20 }}
        >
          <h2 style={{ marginTop: 0 }}>
            Competition Details
          </h2>

          <div
            className="form-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 18,
            }}
          >
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Competition Title *
              </label>
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
              <label style={labelStyle}>
                Competition Type *
              </label>
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
              <label style={labelStyle}>
                Display Order
              </label>
              <input
                style={inputStyle}
                type="number"
                min="0"
                value={form.displayOrder}
                onChange={(e) =>
                  updateField(
                    "displayOrder",
                    e.target.value
                  )
                }
              />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>
                Description
              </label>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 120,
                  resize: "vertical",
                }}
                value={form.description}
                onChange={(e) =>
                  updateField(
                    "description",
                    e.target.value
                  )
                }
                placeholder="Describe the competition for players."
              />
            </div>

            <div>
              <label style={labelStyle}>Rules</label>
              <textarea
                style={{
                  ...inputStyle,
                  minHeight: 160,
                  resize: "vertical",
                }}
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
                style={{
                  ...inputStyle,
                  minHeight: 160,
                  resize: "vertical",
                }}
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
          style={{ padding: 24, marginBottom: 20 }}
        >
          <h2 style={{ marginTop: 0 }}>
            Competition Schedule
          </h2>

          <div
            className="form-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 18,
            }}
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
        </section>

        <section
          className="sq-card"
          style={{ padding: 24, marginBottom: 24 }}
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
                updateField(
                  "isPublished",
                  e.target.checked
                )
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
                We recommend leaving this unchecked until
                questions and announcements are ready.
              </span>
            </span>
          </label>
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
            {saving
              ? "Creating..."
              : "Create Competition"}
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