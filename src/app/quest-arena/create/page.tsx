"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNavbar } from "../../../components/ui";
import { supabase } from "../../../lib/supabase";

type TeamSlot = 1 | 2;

type CreatedCompetition = {
  competitionId: string;
  inviteCode: string;
  teamOneId: string;
  teamTwoId: string;
};

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIsoTimestamp(value: string) {
  return new Date(value).toISOString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function CreateQuestArenaCompetitionPage() {
  const router = useRouter();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [accessError, setAccessError] = useState("");

  const [title, setTitle] = useState("");
  const [teamOneName, setTeamOneName] = useState("");
  const [teamTwoName, setTeamTwoName] = useState("");

  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [registrationClosesAt, setRegistrationClosesAt] = useState("");

  const [creatorParticipates, setCreatorParticipates] = useState<boolean | null>(null);
  const [creatorTeamSlot, setCreatorTeamSlot] = useState<TeamSlot | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<CreatedCompetition | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", user.id)
          .maybeSingle();

        if (error) throw error;
        if (!mounted) return;

        if (profile?.account_type === "family") {
          router.replace("/family-dashboard");
          return;
        }

        if (
          profile?.account_type !== "free" &&
          profile?.account_type !== "individual"
        ) {
          setAccessError(
            "Quest Arena competition creation is available to individual and free accounts only."
          );
          return;
        }
      } catch (error) {
        console.error("Quest Arena access check failed:", error);
        if (mounted) {
          setAccessError(
            error instanceof Error
              ? error.message
              : "We could not verify your account. Please try again."
          );
        }
      } finally {
        if (mounted) setCheckingAccess(false);
      }
    }

    void checkAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  function validateForm() {
    const cleanTitle = title.trim();
    const cleanTeamOne = teamOneName.trim();
    const cleanTeamTwo = teamTwoName.trim();

    if (cleanTitle.length < 3 || cleanTitle.length > 100) {
      return "The competition title must be between 3 and 100 characters.";
    }

    if (cleanTeamOne.length < 1 || cleanTeamOne.length > 50) {
      return "Team 1's name must be between 1 and 50 characters.";
    }

    if (cleanTeamTwo.length < 1 || cleanTeamTwo.length > 50) {
      return "Team 2's name must be between 1 and 50 characters.";
    }

    if (cleanTeamOne.toLowerCase() === cleanTeamTwo.toLowerCase()) {
      return "Please give the two teams different names.";
    }

    if (!startsAt || !endsAt || !registrationClosesAt) {
      return "Please set the registration closing time, competition start and competition end.";
    }

    const now = Date.now();
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    const registrationClose = new Date(registrationClosesAt).getTime();

    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      !Number.isFinite(registrationClose)
    ) {
      return "One or more of the dates you entered are invalid.";
    }

    if (start < now) {
      return "The competition start time cannot be in the past.";
    }

    if (end <= start) {
      return "The competition end time must be after its start time.";
    }

    if (registrationClose < now || registrationClose > end) {
      return "Registration must close between now and the competition end time.";
    }

    if (creatorParticipates === null) {
      return "Please choose whether you want to participate in this competition.";
    }

    if (creatorParticipates && creatorTeamSlot === null) {
      return "Please select the team you want to join.";
    }

    return "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);

    try {
      const { data, error } = await supabase.rpc(
        "quest_arena_create_competition",
        {
          p_title: title.trim(),
          p_team_1_name: teamOneName.trim(),
          p_team_2_name: teamTwoName.trim(),
          p_starts_at: toIsoTimestamp(startsAt),
          p_ends_at: toIsoTimestamp(endsAt),
          p_registration_closes_at: toIsoTimestamp(registrationClosesAt),
          p_creator_participates: creatorParticipates,
          p_creator_team_slot: creatorParticipates ? creatorTeamSlot : null,
        }
      );

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;

      if (
        !result?.out_competition_id ||
        !result?.out_invite_code ||
        !result?.out_team_1_id ||
        !result?.out_team_2_id
      ) {
        throw new Error(
          "The competition was created, but the server did not return all the details we expected. Please refresh Quest Arena and check your competitions."
        );
      }

      setCreated({
        competitionId: result.out_competition_id,
        inviteCode: result.out_invite_code,
        teamOneId: result.out_team_1_id,
        teamTwoId: result.out_team_2_id,
      });
    } catch (error) {
      console.error("Quest Arena competition creation failed:", error);
      setFormError(
        error instanceof Error
          ? error.message
          : "We could not create the competition. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInviteLink() {
    if (!created) return;

    const inviteUrl = `${window.location.origin}/quest-arena/join?code=${created.inviteCode}`;

    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch (error) {
      console.error("Could not copy invitation link:", error);
      setFormError(
        "Your competition is created. However, we could not copy the invitation link automatically. You can copy the invitation code shown above."
      );
    }
  }

  const minimumStart = toLocalDateTimeInput(new Date());

  if (checkingAccess) {
    return (
      <>
        <AppNavbar />
        <main className="sq-page create-arena-page">
          <div className="sq-container">
            <div className="create-loading">
              <span className="create-spinner" />
              <strong>Checking your account...</strong>
            </div>
          </div>
        </main>
        <CreateArenaStyles />
      </>
    );
  }

  if (accessError) {
    return (
      <>
        <AppNavbar />
        <main className="sq-page create-arena-page">
          <div className="sq-container create-narrow">
            <div className="create-alert" role="alert">
              <strong>Quest Arena access unavailable</strong>
              <p>{accessError}</p>
              <Link href="/dashboard" className="create-button create-button-primary">
                Return to dashboard
              </Link>
            </div>
          </div>
        </main>
        <CreateArenaStyles />
      </>
    );
  }

  if (created) {
    const inviteUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/quest-arena/join?code=${created.inviteCode}`;

    return (
      <>
        <AppNavbar />
        <main className="sq-page create-arena-page">
          <div className="sq-container create-narrow">
            <section className="create-success-card">
              <div className="create-success-icon">✓</div>
              <p className="create-eyebrow">COMPETITION CREATED</p>
              <h1>Your Arena is ready!</h1>
              <p className="create-success-copy">
                Your competition has been created successfully. Share the invitation
                code or link with participants so they can choose a team.
              </p>

              <div className="create-code-panel">
                <span>YOUR INVITATION CODE</span>
                <strong>{created.inviteCode}</strong>
                <button type="button" onClick={() => void copyInviteLink()}>
                  Copy invitation link
                </button>
              </div>

              <div className="create-success-actions">
                <Link
                  href={`/quest-arena/competition/${created.competitionId}`}
                  className="create-button create-button-primary"
                >
                  Open competition
                </Link>
                <Link
                  href="/quest-arena"
                  className="create-button create-button-secondary"
                >
                  Back to Quest Arena
                </Link>
              </div>

              <p className="create-success-footnote">
                Keep the invitation code safe. Participants will need it to join.
              </p>
              <span className="create-hidden-url" aria-hidden="true">{inviteUrl}</span>
            </section>
          </div>
        </main>
        <CreateArenaStyles />
      </>
    );
  }

  return (
    <>
      <AppNavbar />

      <main className="sq-page create-arena-page">
        <div className="sq-container create-arena-container">
          <div className="create-back-row">
            <Link href="/quest-arena" className="create-back-link">
              <span aria-hidden="true">←</span> Back to Quest Arena
            </Link>
          </div>

          <header className="create-page-heading">
            <div className="create-heading-icon">⚔</div>
            <div>
              <p className="create-eyebrow">SET UP YOUR TEAM BATTLE</p>
              <h1>Create a competition</h1>
              <p>
                Give your competition a name, create two teams and set the
                competition schedule. You can share the invitation once it is created.
              </p>
            </div>
          </header>

          <div className="create-layout">
            <form className="create-form-card" onSubmit={handleSubmit}>
              <section className="create-form-section">
                <div className="create-section-heading">
                  <span className="create-step-number">01</span>
                  <div>
                    <h2>Competition details</h2>
                    <p>Give your competition a clear title.</p>
                  </div>
                </div>

                <label className="create-field">
                  <span>Competition title</span>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="e.g. The Great Sahaba Knowledge Battle"
                    maxLength={100}
                    required
                  />
                  <small>{title.length}/100 characters</small>
                </label>
              </section>

              <section className="create-form-section">
                <div className="create-section-heading">
                  <span className="create-step-number">02</span>
                  <div>
                    <h2>Name your two teams</h2>
                    <p>Every Quest Arena competition has exactly two teams.</p>
                  </div>
                </div>

                <div className="create-team-fields">
                  <label className="create-field">
                    <span>
                      <b className="create-team-mark">Ⅰ</b> Team 1 name
                    </span>
                    <input
                      type="text"
                      value={teamOneName}
                      onChange={(event) => setTeamOneName(event.target.value)}
                      placeholder="Enter first team name"
                      maxLength={50}
                      required
                    />
                    <small>Maximum 50 characters</small>
                  </label>

                  <label className="create-field">
                    <span>
                      <b className="create-team-mark create-team-mark-two">Ⅱ</b> Team 2 name
                    </span>
                    <input
                      type="text"
                      value={teamTwoName}
                      onChange={(event) => setTeamTwoName(event.target.value)}
                      placeholder="Enter second team name"
                      maxLength={50}
                      required
                    />
                    <small>Maximum 50 characters</small>
                  </label>
                </div>
              </section>

              <section className="create-form-section">
                <div className="create-section-heading">
                  <span className="create-step-number">03</span>
                  <div>
                    <h2>Set the competition schedule</h2>
                    <p>Choose when people can register and when the battle starts and ends.</p>
                  </div>
                </div>

                <div className="create-date-fields">
                  <label className="create-field">
                    <span>Registration closes</span>
                    <input
                      type="datetime-local"
                      value={registrationClosesAt}
                      onChange={(event) => setRegistrationClosesAt(event.target.value)}
                      min={minimumStart}
                      required
                    />
                    <small>Participants must join before this time.</small>
                  </label>

                  <label className="create-field">
                    <span>Competition starts</span>
                    <input
                      type="datetime-local"
                      value={startsAt}
                      onChange={(event) => setStartsAt(event.target.value)}
                      min={minimumStart}
                      required
                    />
                    <small>Participants can begin their quiz from this time.</small>
                  </label>

                  <label className="create-field">
                    <span>Competition ends</span>
                    <input
                      type="datetime-local"
                      value={endsAt}
                      onChange={(event) => setEndsAt(event.target.value)}
                      min={startsAt || minimumStart}
                      required
                    />
                    <small>Attempts must be completed before this time.</small>
                  </label>
                </div>

                <div className="create-schedule-note">
                  <span>ⓘ</span>
                  <p>
                    Dates and times are selected in your device's local time and
                    saved securely as timestamps.
                  </p>
                </div>
              </section>

              <section className="create-form-section create-participation-section">
                <div className="create-section-heading">
                  <span className="create-step-number">04</span>
                  <div>
                    <h2>Will you participate?</h2>
                    <p>Your decision is final once the competition is created.</p>
                  </div>
                </div>

                <div className="create-choice-grid">
                  <button
                    type="button"
                    className={`create-choice-card ${creatorParticipates === true ? "selected" : ""}`}
                    onClick={() => {
                      setCreatorParticipates(true);
                      setCreatorTeamSlot(null);
                    }}
                    aria-pressed={creatorParticipates === true}
                  >
                    <span className="create-choice-icon">⚔</span>
                    <span className="create-choice-title">Yes, I want to play</span>
                    <span className="create-choice-description">
                      I will join one of the two teams and take the same 10-question
                      attempt as everyone else.
                    </span>
                    <span className="create-choice-radio">
                      {creatorParticipates === true ? "●" : "○"}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`create-choice-card ${creatorParticipates === false ? "selected" : ""}`}
                    onClick={() => {
                      setCreatorParticipates(false);
                      setCreatorTeamSlot(null);
                    }}
                    aria-pressed={creatorParticipates === false}
                  >
                    <span className="create-choice-icon">♙</span>
                    <span className="create-choice-title">No, I will organise</span>
                    <span className="create-choice-description">
                      I will manage the competition and watch the teams compete.
                    </span>
                    <span className="create-choice-radio">
                      {creatorParticipates === false ? "●" : "○"}
                    </span>
                  </button>
                </div>

                {creatorParticipates === true && (
                  <div className="create-team-selection">
                    <p>Choose the team you want to join</p>
                    <div className="create-team-select-grid">
                      <button
                        type="button"
                        className={`create-team-select ${creatorTeamSlot === 1 ? "selected" : ""}`}
                        onClick={() => setCreatorTeamSlot(1)}
                        aria-pressed={creatorTeamSlot === 1}
                        disabled={!teamOneName.trim()}
                      >
                        <span>Ⅰ</span>
                        <strong>{teamOneName.trim() || "Team 1 name"}</strong>
                        <small>{creatorTeamSlot === 1 ? "Selected" : "Select team"}</small>
                      </button>
                      <button
                        type="button"
                        className={`create-team-select ${creatorTeamSlot === 2 ? "selected" : ""}`}
                        onClick={() => setCreatorTeamSlot(2)}
                        aria-pressed={creatorTeamSlot === 2}
                        disabled={!teamTwoName.trim()}
                      >
                        <span>Ⅱ</span>
                        <strong>{teamTwoName.trim() || "Team 2 name"}</strong>
                        <small>{creatorTeamSlot === 2 ? "Selected" : "Select team"}</small>
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {formError && (
                <div className="create-form-error" role="alert">
                  <strong>Please review your details</strong>
                  <span>{formError}</span>
                </div>
              )}

              <div className="create-submit-row">
                <Link href="/quest-arena" className="create-button create-button-secondary">
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="create-button create-button-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <span className="create-button-spinner" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create competition <span aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <aside className="create-sidebar">
              <div className="create-preview-card">
                <p className="create-eyebrow">YOUR COMPETITION</p>
                <h3>{title.trim() || "Competition title"}</h3>
                <div className="create-preview-team">
                  <span>Ⅰ</span>
                  <strong>{teamOneName.trim() || "Team 1"}</strong>
                </div>
                <div className="create-preview-vs">VS</div>
                <div className="create-preview-team">
                  <span>Ⅱ</span>
                  <strong>{teamTwoName.trim() || "Team 2"}</strong>
                </div>
                <div className="create-preview-divider" />
                <div className="create-preview-stat">
                  <span>Questions per player</span>
                  <strong>10</strong>
                </div>
                <div className="create-preview-stat">
                  <span>Time per question</span>
                  <strong>30 seconds</strong>
                </div>
                <div className="create-preview-stat">
                  <span>Maximum Arena XP</span>
                  <strong>1,000 XP</strong>
                </div>
              </div>

              <div className="create-rules-card">
                <h3>Before you create</h3>
                <ul>
                  <li>There will be exactly two teams.</li>
                  <li>Each participant gets one attempt.</li>
                  <li>Every attempt contains 10 random questions.</li>
                  <li>Each question has a 30-second timer.</li>
                  <li>Correct answers earn 100 Arena XP.</li>
                  <li>The team with the higher average XP wins.</li>
                  <li>Only completed attempts count towards the team average.</li>
                </ul>
              </div>

              <div className="create-security-note">
                <span>✓</span>
                <p>
                  Arena scores are separate from your normal Sahaba Quest XP and
                  progress.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <CreateArenaStyles />
    </>
  );
}

function CreateArenaStyles() {
  return (
    <style jsx global>{`
      .create-arena-page {
        min-height: 100vh;
        padding-top: 28px;
        padding-bottom: 70px;
        background: var(--background, #f6f9f8);
      }

      .create-arena-container {
        max-width: 1120px;
      }

      .create-narrow {
        max-width: 700px;
        margin: 0 auto;
      }

      .create-back-row {
        margin: 0 0 22px;
      }

      .create-back-link {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        color: #08766d;
        font-size: 12px;
        font-weight: 850;
        text-decoration: none;
      }

      .create-page-heading {
        display: flex;
        align-items: flex-start;
        gap: 17px;
        margin-bottom: 27px;
      }

      .create-heading-icon {
        display: grid;
        flex: 0 0 58px;
        width: 58px;
        height: 58px;
        place-items: center;
        border-radius: 17px;
        color: #08766d;
        background: #e3f2ee;
        font-size: 28px;
      }

      .create-eyebrow {
        margin: 0 0 7px;
        color: #08766d;
        font-size: 10px;
        font-weight: 950;
        letter-spacing: 1.35px;
      }

      .create-page-heading h1,
      .create-success-card h1 {
        margin: 0;
        color: var(--foreground, #173b38);
        font-size: clamp(27px, 4vw, 36px);
        font-weight: 950;
        letter-spacing: -1px;
      }

      .create-page-heading p:last-child {
        max-width: 680px;
        margin: 9px 0 0;
        color: var(--muted, #647875);
        font-size: 13px;
        line-height: 1.7;
      }

      .create-layout {
        display: grid;
        grid-template-columns: minmax(0, 1.55fr) minmax(270px, .8fr);
        align-items: start;
        gap: 20px;
      }

      .create-form-card,
      .create-preview-card,
      .create-rules-card {
        border: 1px solid var(--border, #dce8e5);
        border-radius: 18px;
        background: #ffffff;
        box-shadow: 0 5px 20px rgba(10, 60, 55, .035);
      }

      .create-form-card {
        padding: 26px;
      }

      .create-form-section + .create-form-section {
        margin-top: 27px;
        padding-top: 25px;
        border-top: 1px solid #edf1f0;
      }

      .create-section-heading {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 19px;
      }

      .create-step-number {
        display: grid;
        flex: 0 0 32px;
        width: 32px;
        height: 32px;
        place-items: center;
        border-radius: 10px;
        color: #08766d;
        background: #e8f5f2;
        font-size: 11px;
        font-weight: 950;
      }

      .create-section-heading h2 {
        margin: 1px 0 5px;
        color: #244541;
        font-size: 16px;
        font-weight: 900;
      }

      .create-section-heading p {
        margin: 0;
        color: var(--muted, #71827f);
        font-size: 11px;
        line-height: 1.6;
      }

      .create-field {
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: 8px;
      }

      .create-field > span {
        display: flex;
        align-items: center;
        gap: 7px;
        color: #31534f;
        font-size: 12px;
        font-weight: 850;
      }

      .create-field input {
        width: 100%;
        min-width: 0;
        height: 46px;
        padding: 0 13px;
        border: 1px solid #d8e4e1;
        border-radius: 10px;
        outline: none;
        color: #244541;
        background: #ffffff;
        font-family: inherit;
        font-size: 12px;
      }

      .create-field input:focus {
        border-color: #08766d;
        box-shadow: 0 0 0 3px rgba(8,118,109,.09);
      }

      .create-field input::placeholder {
        color: #9aa9a6;
      }

      .create-field small {
        color: #82928f;
        font-size: 10px;
      }

      .create-team-fields,
      .create-date-fields {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 15px;
      }

      .create-date-fields .create-field:last-child {
        grid-column: 1 / -1;
      }

      .create-team-mark {
        display: inline-grid;
        width: 22px;
        height: 22px;
        place-items: center;
        border-radius: 7px;
        color: #08766d;
        background: #e5f3f0;
        font-size: 10px;
      }

      .create-team-mark-two {
        color: #9a6b16;
        background: #fbf2df;
      }

      .create-schedule-note {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        margin-top: 15px;
        padding: 11px 12px;
        border-radius: 10px;
        color: #55716c;
        background: #f1f7f5;
      }

      .create-schedule-note span {
        color: #08766d;
        font-size: 14px;
      }

      .create-schedule-note p {
        margin: 0;
        font-size: 10px;
        line-height: 1.6;
      }

      .create-choice-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 11px;
      }

      .create-choice-card {
        position: relative;
        display: flex;
        min-width: 0;
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
        padding: 15px;
        border: 1px solid #dce7e4;
        border-radius: 13px;
        color: inherit;
        background: #ffffff;
        text-align: left;
        cursor: pointer;
        transition: border .15s ease, background .15s ease;
      }

      .create-choice-card.selected {
        border: 2px solid #08766d;
        padding: 14px;
        background: #f0f8f5;
      }

      .create-choice-icon {
        display: grid;
        width: 34px;
        height: 34px;
        place-items: center;
        border-radius: 10px;
        color: #08766d;
        background: #e4f2ee;
        font-size: 17px;
      }

      .create-choice-title {
        color: #244541;
        font-size: 12px;
        font-weight: 900;
      }

      .create-choice-description {
        padding-right: 2px;
        color: #71827f;
        font-size: 10px;
        line-height: 1.6;
      }

      .create-choice-radio {
        position: absolute;
        top: 13px;
        right: 13px;
        color: #08766d;
        font-size: 17px;
      }

      .create-team-selection {
        margin-top: 17px;
        padding: 14px;
        border-radius: 12px;
        background: #f7faf9;
      }

      .create-team-selection > p {
        margin: 0 0 11px;
        color: #31534f;
        font-size: 11px;
        font-weight: 850;
      }

      .create-team-select-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px;
      }

      .create-team-select {
        display: flex;
        min-width: 0;
        flex-direction: column;
        align-items: flex-start;
        gap: 5px;
        padding: 12px;
        border: 1px solid #dce7e4;
        border-radius: 10px;
        color: #31534f;
        background: #ffffff;
        text-align: left;
        cursor: pointer;
      }

      .create-team-select:disabled {
        opacity: .5;
        cursor: not-allowed;
      }

      .create-team-select.selected {
        border: 2px solid #08766d;
        padding: 11px;
        background: #edf7f4;
      }

      .create-team-select > span {
        color: #08766d;
        font-size: 15px;
        font-weight: 950;
      }

      .create-team-select strong {
        max-width: 100%;
        color: #244541;
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .create-team-select small {
        color: #71827f;
        font-size: 9px;
      }

      .create-form-error,
      .create-alert {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 22px;
        padding: 13px 14px;
        border: 1px solid #f0d5d2;
        border-radius: 11px;
        color: #8d3028;
        background: #fff6f5;
        font-size: 11px;
        line-height: 1.6;
      }

      .create-submit-row {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid #edf1f0;
      }

      .create-button {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 17px;
        border: 1px solid transparent;
        border-radius: 10px;
        font-family: inherit;
        font-size: 11px;
        font-weight: 900;
        text-decoration: none;
        cursor: pointer;
      }

      .create-button-primary {
        color: #ffffff;
        background: #08766d;
      }

      .create-button-primary:hover {
        background: #06645d;
      }

      .create-button-secondary {
        border-color: #dce7e4;
        color: #49645f;
        background: #ffffff;
      }

      .create-button:disabled {
        opacity: .6;
        cursor: not-allowed;
      }

      .create-button-spinner,
      .create-spinner {
        width: 15px;
        height: 15px;
        border: 2px solid rgba(255,255,255,.45);
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: create-spin .8s linear infinite;
      }

      .create-spinner {
        width: 26px;
        height: 26px;
        border: 3px solid #dcebe7;
        border-top-color: #08766d;
      }

      @keyframes create-spin {
        to { transform: rotate(360deg); }
      }

      .create-sidebar {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .create-preview-card,
      .create-rules-card {
        padding: 19px;
      }

      .create-preview-card h3 {
        margin: 0 0 16px;
        color: #244541;
        font-size: 17px;
        font-weight: 950;
        overflow-wrap: anywhere;
      }

      .create-preview-team {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
        padding: 11px;
        border-radius: 10px;
        background: #f1f7f5;
      }

      .create-preview-team > span {
        display: grid;
        flex: 0 0 27px;
        width: 27px;
        height: 27px;
        place-items: center;
        border-radius: 8px;
        color: #08766d;
        background: #dcefeb;
        font-size: 11px;
        font-weight: 950;
      }

      .create-preview-team strong {
        color: #31534f;
        font-size: 11px;
        overflow-wrap: anywhere;
      }

      .create-preview-vs {
        margin: 7px 0;
        color: #9aaba7;
        font-size: 9px;
        font-weight: 950;
        text-align: center;
      }

      .create-preview-divider {
        height: 1px;
        margin: 17px 0 11px;
        background: #edf1f0;
      }

      .create-preview-stat {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        padding: 7px 0;
        color: #71827f;
        font-size: 10px;
      }

      .create-preview-stat strong {
        color: #31534f;
        font-size: 10px;
        font-weight: 900;
        white-space: nowrap;
      }

      .create-rules-card h3 {
        margin: 0 0 12px;
        color: #244541;
        font-size: 13px;
        font-weight: 900;
      }

      .create-rules-card ul {
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .create-rules-card li {
        position: relative;
        padding-left: 17px;
        color: #647875;
        font-size: 10px;
        line-height: 1.55;
      }

      .create-rules-card li::before {
        position: absolute;
        top: 0;
        left: 0;
        color: #08766d;
        content: "✓";
        font-weight: 950;
      }

      .create-security-note {
        display: flex;
        align-items: flex-start;
        gap: 9px;
        padding: 13px;
        border: 1px solid #dcebe6;
        border-radius: 12px;
        background: #eff8f4;
      }

      .create-security-note span {
        color: #08766d;
        font-weight: 950;
      }

      .create-security-note p {
        margin: 0;
        color: #55716c;
        font-size: 10px;
        line-height: 1.6;
      }

      .create-loading {
        display: flex;
        min-height: 240px;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 13px;
        color: #31534f;
        font-size: 12px;
      }

      .create-alert {
        margin-top: 45px;
        padding: 22px;
      }

      .create-alert p {
        margin: 0 0 9px;
      }

      .create-success-card {
        margin-top: 45px;
        padding: 36px;
        border: 1px solid var(--border, #dce8e5);
        border-radius: 20px;
        background: #ffffff;
        box-shadow: 0 10px 34px rgba(10,60,55,.06);
        text-align: center;
      }

      .create-success-icon {
        display: grid;
        width: 64px;
        height: 64px;
        margin: 0 auto 17px;
        place-items: center;
        border-radius: 50%;
        color: #087b52;
        background: #e6f7ef;
        font-size: 30px;
        font-weight: 950;
      }

      .create-success-card h1 {
        font-size: 30px;
      }

      .create-success-copy {
        max-width: 470px;
        margin: 12px auto 22px;
        color: #71827f;
        font-size: 12px;
        line-height: 1.7;
      }

      .create-code-panel {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
        padding: 20px;
        border: 1px dashed #b9d7ce;
        border-radius: 14px;
        background: #f2f9f6;
      }

      .create-code-panel > span {
        color: #64817a;
        font-size: 9px;
        font-weight: 950;
        letter-spacing: 1.3px;
      }

      .create-code-panel > strong {
        color: #075c53;
        font-size: clamp(25px, 5vw, 34px);
        font-weight: 950;
        letter-spacing: 4px;
        overflow-wrap: anywhere;
      }

      .create-code-panel button {
        min-height: 37px;
        padding: 0 13px;
        border: 1px solid #c8dfd7;
        border-radius: 9px;
        color: #08766d;
        background: #ffffff;
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
      }

      .create-success-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px;
        margin-top: 22px;
      }

      .create-success-footnote {
        margin: 18px 0 0;
        color: #82928f;
        font-size: 10px;
      }

      .create-hidden-url {
        display: none;
      }

      @media (max-width: 900px) {
        .create-layout {
          grid-template-columns: minmax(0, 1fr);
        }
        .create-sidebar {
          display: grid;
          grid-template-columns: 1fr 1fr;
          align-items: start;
        }
        .create-security-note {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 600px) {
        .create-arena-page {
          padding-top: 20px;
        }
        .create-page-heading {
          gap: 12px;
        }
        .create-heading-icon {
          flex-basis: 46px;
          width: 46px;
          height: 46px;
          border-radius: 13px;
          font-size: 23px;
        }
        .create-form-card {
          padding: 18px;
        }
        .create-team-fields,
        .create-date-fields,
        .create-choice-grid,
        .create-team-select-grid {
          grid-template-columns: 1fr;
        }
        .create-date-fields .create-field:last-child {
          grid-column: auto;
        }
        .create-sidebar {
          display: flex;
        }
        .create-submit-row {
          flex-direction: column-reverse;
        }
        .create-submit-row .create-button {
          width: 100%;
        }
        .create-success-card {
          margin-top: 25px;
          padding: 25px 18px;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .create-spinner,
        .create-button-spinner {
          animation: none;
        }
        .create-choice-card {
          transition: none;
        }
      }
    `}</style>
  );
}
