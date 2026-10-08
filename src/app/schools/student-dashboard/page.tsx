"use client";



import { useCallback, useEffect, useMemo, useState } from "react";

import { useRouter } from "next/navigation";



type Student = {

  id: string;

  student_id: string;

  first_name: string;

  last_name: string;

  status: string;

};



type School = {

  id: string;

  school_name: string;

  school_code: string;

  school_type?: string;

  status: string;

};



type SchoolClass = {

  id: string;

  class_name: string;

};



type Progress = {

  current_level: number;

  total_xp: number;

  questions_answered: number;

  correct_answers: number;

  current_streak: number;

  best_streak: number;

};



type DashboardData = {

  student: Student;

  school: School;

  class: SchoolClass | null;

  progress: Progress;

  subscription: {

    billing_interval: string;

    current_period_end: string;

  } | null;

  session_expires_at: string;

};



function Icon({

  name,

  size = 22,

  strokeWidth = 2,

}: {

  name:

    | "sparkles"

    | "book"

    | "trophy"

    | "flame"

    | "target"

    | "arrow"

    | "chevron"

    | "school"

    | "user"

    | "logout"

    | "star"

    | "shield";

  size?: number;

  strokeWidth?: number;

}) {

  const common = {

    width: size,

    height: size,

    viewBox: "0 0 24 24",

    fill: "none",

    stroke: "currentColor",

    strokeWidth,

    strokeLinecap: "round" as const,

    strokeLinejoin: "round" as const,

    "aria-hidden": true,

  };



  switch (name) {

    case "sparkles":

      return (

        <svg {...common}>

          <path d="m12 3-1.2 3.7L7 8l3.8 1.3L12 13l1.2-3.7L17 8l-3.8-1.3L12 3Z" />

          <path d="m19 14-.7 2.3L16 17l2.3.7L19 20l.7-2.3L22 17l-2.3-.7L19 14Z" />

          <path d="m5 13-.6 1.9L2.5 16l1.9.6L5 18.5l.6-1.9 1.9-.6-1.9-.6L5 13Z" />

        </svg>

      );

    case "book":

      return (

        <svg {...common}>

          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22V5.5Z" />

          <path d="M4 5.5V22" />

          <path d="M8 7h8M8 11h7" />

        </svg>

      );

    case "trophy":

      return (

        <svg {...common}>

          <path d="M8 4h8v4a4 4 0 0 1-8 0V4Z" />

          <path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4" />

          <path d="M12 12v4M8 20h8M10 16h4" />

        </svg>

      );

    case "flame":

      return (

        <svg {...common}>

          <path d="M12.3 22c4.2-.2 7.2-3 7.2-7.1 0-3.2-1.8-5.8-4.8-8.5.1 2.2-.7 3.5-1.9 4.3.1-3.8-1.7-6.9-4.8-8.7.2 3.5-2.7 5.8-2.7 9.7 0 5.8 3.8 10.5 7 10.3Z" />

        </svg>

      );

    case "target":

      return (

        <svg {...common}>

          <circle cx="12" cy="12" r="8.5" />

          <circle cx="12" cy="12" r="4.5" />

          <circle cx="12" cy="12" r="1" />

        </svg>

      );

    case "arrow":

      return (

        <svg {...common}>

          <path d="M5 12h14M13 6l6 6-6 6" />

        </svg>

      );

    case "chevron":

      return (

        <svg {...common}>

          <path d="m9 18 6-6-6-6" />

        </svg>

      );

    case "school":

      return (

        <svg {...common}>

          <path d="m3 10 9-5 9 5-9 5-9-5Z" />

          <path d="M7 12.2V17c2.8 2 7.2 2 10 0v-4.8M21 10v6" />

        </svg>

      );

    case "user":

      return (

        <svg {...common}>

          <circle cx="12" cy="8" r="3.5" />

          <path d="M5 21a7 7 0 0 1 14 0" />

        </svg>

      );

    case "logout":

      return (

        <svg {...common}>

          <path d="M10 17l5-5-5-5M15 12H3" />

          <path d="M14 4h5v16h-5" />

        </svg>

      );

    case "star":

      return (

        <svg {...common}>

          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />

        </svg>

      );

    case "shield":

      return (

        <svg {...common}>

          <path d="M12 3 20 6v5.7c0 4.7-3.2 7.9-8 9.3-4.8-1.4-8-4.6-8-9.3V6l8-3Z" />

          <path d="m9 12 2 2 4-4" />

        </svg>

      );

  }

}



export default function SchoolStudentDashboardPage() {

  const router = useRouter();

  const [data, setData] = useState<DashboardData | null>(null);

  const [loading, setLoading] = useState(true);

  const [signingOut, setSigningOut] = useState(false);

  const [message, setMessage] = useState("");



  const token =

    typeof window !== "undefined"

      ? sessionStorage.getItem("school_student_session_token")

      : null;



  const logout = useCallback(async () => {

    const currentToken =

      typeof window !== "undefined"

        ? sessionStorage.getItem("school_student_session_token")

        : null;



    if (!currentToken) {

      router.replace("/schools/student-login");

      return;

    }



    setSigningOut(true);



    try {

      await fetch("/api/schools/student-auth/logout", {

        method: "POST",

        headers: {

          Authorization: `Bearer ${currentToken}`,

        },

      });

    } catch {

      // The local session is still cleared below.

    } finally {

      sessionStorage.removeItem("school_student_session_token");

      sessionStorage.removeItem("school_student_expires_at");

      router.replace("/schools/student-login");

    }

  }, [router]);



  const loadDashboard = useCallback(async () => {

    const currentToken =

      typeof window !== "undefined"

        ? sessionStorage.getItem("school_student_session_token")

        : null;



    if (!currentToken) {

      router.replace("/schools/student-login");

      return;

    }



    try {

      /*

       * The dashboard API is now the single source of truth for the

       * student session. It validates:

       *   - session token

       *   - student status

       *   - school status

       *   - active school subscription

       *   - class

       *   - student progress

       *

       * We intentionally do not call /student-auth/session first.

       * Doing so was causing a valid student session to be treated

       * as invalid during dashboard loading.

       */

      const dashboardResponse = await fetch(

        "/api/schools/student-dashboard",

        {

          headers: {

            Authorization: `Bearer ${currentToken}`,

          },

          cache: "no-store",

        }

      );



      const result = await dashboardResponse.json().catch(() => ({}));



      /*

       * Support both response styles while the school APIs are being

       * finalized:

       *

       *   { student, school, class, progress, subscription }

       *

       * and:

       *

       *   { success: true, data: { student, school, ... } }

       *

       * This prevents the UI from crashing simply because the API

       * wrapper changed.

       */

      const payload =

        result?.data &&

        typeof result.data === "object" &&

        !Array.isArray(result.data)

          ? result.data

          : result;



      if (dashboardResponse.status === 401) {

        sessionStorage.removeItem("school_student_session_token");

        sessionStorage.removeItem("school_student_expires_at");

        router.replace("/schools/student-login");

        return;

      }



      if (!dashboardResponse.ok) {

        throw new Error(

          payload?.message ||

            result?.message ||

            "We could not load your learning dashboard."

        );

      }



      const normalizedData: DashboardData = {

        student: payload.student,

        school: payload.school ?? payload.schoolData,

        class: payload.class ?? payload.schoolClass ?? null,

        progress: payload.progress ?? {

          current_level: 1,

          total_xp: 0,

          questions_answered: 0,

          correct_answers: 0,

          current_streak: 0,

          best_streak: 0,

        },

        subscription: payload.subscription ?? null,

        session_expires_at:

          payload.session_expires_at ??

          payload.session?.expires_at ??

          currentToken,

      };



      /*

       * Never allow a missing school/student object to reach JSX.

       * That was the exact cause of:

       *

       * Cannot read properties of undefined

       * (reading 'school_name')

       */

      if (!normalizedData.student || !normalizedData.school) {

        console.error(

          "Unexpected student dashboard response:",

          result

        );



        throw new Error(

          "Your student dashboard was reached, but the school information could not be loaded. Please refresh and try again."

        );

      }



      setData(normalizedData);

      setMessage("");

    } catch (error) {

      console.error("Student dashboard error:", error);



      setMessage(

        error instanceof Error

          ? error.message

          : "We could not load your dashboard."

      );

    } finally {

      setLoading(false);

    }

  }, [router]);



  useEffect(() => {

    loadDashboard();

  }, [loadDashboard]);



  const accuracy = useMemo(() => {

    if (!data?.progress.questions_answered) return 0;

    return Math.round(

      (data.progress.correct_answers / data.progress.questions_answered) * 100

    );

  }, [data]);



  const levelProgress = useMemo(() => {

    if (!data) return 0;

    // Keep this visual progress intentionally modest until the learning engine

    // supplies the exact XP threshold for each level.

    const remainder = data.progress.total_xp % 100;

    return remainder === 0 && data.progress.total_xp > 0 ? 100 : remainder;

  }, [data]);



  if (loading) {

    return (

      <main className="sq-student-page">

        <div className="sq-loading-shell">

          <div className="sq-loading-mark">

            <Icon name="sparkles" size={28} />

          </div>

          <div className="sq-loading-line sq-loading-line-lg" />

          <div className="sq-loading-line" />

          <div className="sq-loading-cards">

            <div />

            <div />

            <div />

          </div>

          <p>Preparing your learning space...</p>

        </div>

        <StudentDashboardStyles />

      </main>

    );

  }



  if (!data) {

    return (

      <main className="sq-student-page">

        <div className="sq-error-shell">

          <div className="sq-error-icon">

            <Icon name="shield" size={30} />

          </div>

          <h1>Assalamu Alaikum</h1>

          <p>{message || "We could not load your dashboard."}</p>

          <div className="sq-error-actions">

            <button

              className="sq-primary-button"

              onClick={() => {

                setLoading(true);

                setMessage("");

                loadDashboard();

              }}

            >

              Try Again

            </button>

            <button

              className="sq-secondary-button"

              onClick={() => router.replace("/schools/student-login")}

            >

              Back to Sign In

            </button>

          </div>

        </div>

        <StudentDashboardStyles />

      </main>

    );

  }



  const firstName = data.student.first_name || "Student";

  const fullName = `${data.student.first_name} ${data.student.last_name}`.trim();



  return (

    <main className="sq-student-page">

      <div className="sq-page-glow sq-page-glow-one" />

      <div className="sq-page-glow sq-page-glow-two" />



      <header className="sq-topbar">

        <div className="sq-topbar-inner">

          <div className="sq-brand">

            <div className="sq-brand-mark">

              <span>SQ</span>

            </div>

            <div className="sq-brand-copy">

              <strong>Sahaba Quest</strong>

              <span>Schools & Madrasas</span>

            </div>

          </div>



          <div className="sq-topbar-actions">

            <div className="sq-student-mini">

              <div className="sq-mini-avatar">

                {firstName.charAt(0).toUpperCase()}

              </div>

              <div className="sq-mini-copy">

                <strong>{fullName}</strong>

                <span>{data.student.student_id}</span>

              </div>

            </div>



            <button

              className="sq-logout-button"

              onClick={logout}

              disabled={signingOut}

              aria-label="Sign out"

              title="Sign out"

            >

              <Icon name="logout" size={18} />

              <span>{signingOut ? "Signing out..." : "Sign out"}</span>

            </button>

          </div>

        </div>

      </header>



      <div className="sq-content">

        <section className="sq-hero">

          <div className="sq-hero-pattern" />

          <div className="sq-hero-content">

            <div className="sq-hero-kicker">

              <span className="sq-kicker-icon">

                <Icon name="sparkles" size={15} />

              </span>

              Your learning journey

            </div>



            <h1>

              Assalamu Alaikum, <span>{firstName}</span>

            </h1>



            <p>

              May Allah increase you in beneficial knowledge. Keep learning,

              keep growing, and keep your quest moving forward.

            </p>



            <div className="sq-hero-meta">

              <div className="sq-hero-meta-item">

                <Icon name="school" size={17} />

                <span>{data.school?.school_name || "Your School"}</span>

              </div>

              {data.class && (

                <div className="sq-hero-meta-item">

                  <Icon name="book" size={17} />

                  <span>{data.class.class_name}</span>

                </div>

              )}

              <div className="sq-hero-meta-item">

                <Icon name="star" size={17} />

                <span>Level {data.progress.current_level}</span>

              </div>

            </div>

          </div>



          <div className="sq-hero-badge">

            <div className="sq-hero-badge-icon">

              <Icon name="star" size={25} />

            </div>

            <span>Keep Questing</span>

          </div>

        </section>



        <section className="sq-stat-grid" aria-label="Your progress">

          <article className="sq-stat-card">

            <div className="sq-stat-icon sq-icon-teal">

              <Icon name="star" size={21} />

            </div>

            <div>

              <span className="sq-stat-label">Total XP</span>

              <strong>{data.progress.total_xp.toLocaleString()}</strong>

              <small>Your knowledge points</small>

            </div>

          </article>



          <article className="sq-stat-card">

            <div className="sq-stat-icon sq-icon-gold">

              <Icon name="flame" size={21} />

            </div>

            <div>

              <span className="sq-stat-label">Current Streak</span>

              <strong>{data.progress.current_streak}</strong>

              <small>

                {data.progress.current_streak === 1

                  ? "day of learning"

                  : "days of learning"}

              </small>

            </div>

          </article>



          <article className="sq-stat-card">

            <div className="sq-stat-icon sq-icon-green">

              <Icon name="target" size={21} />

            </div>

            <div>

              <span className="sq-stat-label">Accuracy</span>

              <strong>{accuracy}%</strong>

              <small>

                {data.progress.questions_answered.toLocaleString()} answered

              </small>

            </div>

          </article>



          <article className="sq-stat-card">

            <div className="sq-stat-icon sq-icon-purple">

              <Icon name="trophy" size={21} />

            </div>

            <div>

              <span className="sq-stat-label">Best Streak</span>

              <strong>{data.progress.best_streak}</strong>

              <small>Your personal best</small>

            </div>

          </article>

        </section>



        <section className="sq-main-grid">

          <div className="sq-primary-column">

            <article className="sq-quest-card">

              <div className="sq-card-heading">

                <div>

                  <span className="sq-section-eyebrow">Your Quest</span>

                  <h2>Continue your journey</h2>

                  <p>

                    Your next learning experience will appear here. Complete

                    quests to earn XP and progress through the levels.

                  </p>

                </div>

                <div className="sq-quest-symbol">

                  <Icon name="sparkles" size={26} />

                </div>

              </div>



              <div className="sq-level-panel">

                <div className="sq-level-top">

                  <div>

                    <span>Current level</span>

                    <strong>Level {data.progress.current_level}</strong>

                  </div>

                  <div className="sq-xp-pill">

                    <Icon name="star" size={14} />

                    {data.progress.total_xp.toLocaleString()} XP

                  </div>

                </div>



                <div className="sq-progress-track">

                  <div

                    className="sq-progress-fill"

                    style={{ width: `${levelProgress}%` }}

                  />

                </div>



                <div className="sq-progress-caption">

                  <span>Keep learning to advance your quest.</span>

                  <span>{levelProgress}%</span>

                </div>

              </div>



              <button
                type="button"
                className="sq-quest-cta sq-quest-cta-button"
                onClick={() => router.push("/schools/student-quest")}
                aria-label="Start Student Quest"
              >
                <div className="sq-cta-icon">
                  <Icon name="book" size={22} />
                </div>
                <div className="sq-cta-copy">
                  <strong>Start your Student Quest</strong>
                  <span>
                    Enter your Sahaba Quest learning test and earn XP as you
                    progress through your current level.
                  </span>
                </div>
                <span className="sq-coming-badge sq-play-badge">
                  Start Quest
                  <Icon name="arrow" size={13} strokeWidth={2.4} />
                </span>
              </button>

            </article>



            <article className="sq-learning-card">

              <div className="sq-card-heading compact">

                <div>

                  <span className="sq-section-eyebrow">Learning at a glance</span>

                  <h2>Your knowledge journey</h2>

                </div>

              </div>



              <div className="sq-learning-grid">

                <div className="sq-learning-item">

                  <div className="sq-learning-item-icon">

                    <Icon name="book" size={20} />

                  </div>

                  <div>

                    <strong>Questions answered</strong>

                    <span>

                      {data.progress.questions_answered.toLocaleString()}{" "}

                      questions

                    </span>

                  </div>

                </div>



                <div className="sq-learning-item">

                  <div className="sq-learning-item-icon gold">

                    <Icon name="target" size={20} />

                  </div>

                  <div>

                    <strong>Correct answers</strong>

                    <span>

                      {data.progress.correct_answers.toLocaleString()} correct

                    </span>

                  </div>

                </div>



                <div className="sq-learning-item">

                  <div className="sq-learning-item-icon green">

                    <Icon name="trophy" size={20} />

                  </div>

                  <div>

                    <strong>Accuracy</strong>

                    <span>{accuracy}% overall accuracy</span>

                  </div>

                </div>



                <div className="sq-learning-item">

                  <div className="sq-learning-item-icon purple">

                    <Icon name="flame" size={20} />

                  </div>

                  <div>

                    <strong>Best streak</strong>

                    <span>{data.progress.best_streak} days</span>

                  </div>

                </div>

              </div>

            </article>

          </div>



          <aside className="sq-sidebar">

            <article className="sq-school-card">

              <div className="sq-sidebar-card-top">

                <div className="sq-school-icon">

                  <Icon name="school" size={22} />

                </div>

                <span className="sq-active-badge">

                  <span />

                  Active

                </span>

              </div>



              <span className="sq-section-eyebrow">Your school</span>

              <h3>{data.school?.school_name || "Your School"}</h3>



              <div className="sq-school-details">

                <div>

                  <span>Student ID</span>

                  <strong>{data.student.student_id}</strong>

                </div>

                <div>

                  <span>Class</span>

                  <strong>{data.class?.class_name || "Not assigned"}</strong>

                </div>

              </div>

            </article>



            <button
              type="button"
              className="sq-side-card sq-side-card-button"
              onClick={() => router.push("/schools/student-leaderboard")}
              aria-label="Open class leaderboard"
            >
              <div className="sq-side-card-heading">
                <div className="sq-side-icon">
                  <Icon name="trophy" size={19} />
                </div>
                <div>
                  <span className="sq-section-eyebrow">Your class</span>
                  <h3>Class Leaderboard</h3>
                </div>
              </div>
              <p>
                See how your learning progress compares with classmates and
                celebrate your growth together.
              </p>
              <div className="sq-side-link">
                View leaderboard
                <Icon name="chevron" size={16} />
              </div>
            </button>



            <article className="sq-side-card sq-side-card-soft">

              <div className="sq-side-card-heading">

                <div className="sq-side-icon soft">

                  <Icon name="shield" size={19} />

                </div>

                <div>

                  <span className="sq-section-eyebrow">Your account</span>

                  <h3>Learning safely</h3>

                </div>

              </div>

              <p>

                Your student account is managed by your school. Your learning

                progress is kept separate from personal Sahaba Quest accounts.

              </p>

            </article>

          </aside>

        </section>



        <footer className="sq-footer">

          <div>

            <strong>Sahaba Quest</strong>

            <span>Learn. Quest. Grow.</span>

          </div>

          <span>May Allah bless your learning journey.</span>

        </footer>

      </div>



      <StudentDashboardStyles />

    </main>

  );

}



function StudentDashboardStyles() {

  return (

    <style jsx global>{`

      .sq-student-page {

        min-height: 100vh;

        background: var(--background, #f7f9f8);

        color: var(--foreground, #17221d);

        position: relative;

        overflow-x: hidden;

      }



      .sq-page-glow {

        position: fixed;

        pointer-events: none;

        border-radius: 999px;

        filter: blur(1px);

        opacity: 0.55;

        z-index: 0;

      }



      .sq-page-glow-one {

        width: 380px;

        height: 380px;

        top: 80px;

        right: -180px;

        background: rgba(15, 118, 110, 0.08);

      }



      .sq-page-glow-two {

        width: 300px;

        height: 300px;

        left: -160px;

        bottom: 100px;

        background: rgba(212, 167, 44, 0.06);

      }



      .sq-topbar {

        position: relative;

        z-index: 5;

        background: rgba(255, 255, 255, 0.92);

        border-bottom: 1px solid var(--border, #e2e8e5);

        backdrop-filter: blur(16px);

      }



      .sq-topbar-inner {

        width: min(1240px, calc(100% - 40px));

        margin: 0 auto;

        min-height: 72px;

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 24px;

      }



      .sq-brand {

        display: flex;

        align-items: center;

        gap: 11px;

        min-width: 0;

      }



      .sq-brand-mark {

        width: 42px;

        height: 42px;

        border-radius: 13px;

        background: linear-gradient(145deg, #0f766e, #115e59);

        color: white;

        display: grid;

        place-items: center;

        font-size: 11px;

        font-weight: 900;

        letter-spacing: 0.06em;

        box-shadow: 0 8px 20px rgba(15, 118, 110, 0.2);

        flex: 0 0 auto;

      }



      .sq-brand-copy {

        display: flex;

        flex-direction: column;

        gap: 2px;

      }



      .sq-brand-copy strong {

        font-size: 15px;

        letter-spacing: -0.02em;

      }



      .sq-brand-copy span {

        font-size: 11px;

        color: var(--muted, #64746d);

        font-weight: 600;

      }



      .sq-topbar-actions {

        display: flex;

        align-items: center;

        gap: 18px;

      }



      .sq-student-mini {

        display: flex;

        align-items: center;

        gap: 9px;

      }



      .sq-mini-avatar {

        width: 36px;

        height: 36px;

        border-radius: 50%;

        background: var(--primary-light, #ccfbf1);

        color: var(--primary-dark, #115e59);

        display: grid;

        place-items: center;

        font-weight: 800;

        font-size: 13px;

      }



      .sq-mini-copy {

        display: flex;

        flex-direction: column;

        gap: 2px;

      }



      .sq-mini-copy strong {

        font-size: 12px;

        max-width: 160px;

        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;

      }



      .sq-mini-copy span {

        font-size: 10px;

        color: var(--muted, #64746d);

        font-weight: 600;

      }



      .sq-logout-button {

        height: 38px;

        padding: 0 13px;

        border: 1px solid var(--border, #e2e8e5);

        border-radius: 10px;

        background: white;

        color: var(--muted, #64746d);

        display: inline-flex;

        align-items: center;

        gap: 7px;

        font-size: 12px;

        font-weight: 700;

        cursor: pointer;

        transition: 0.2s ease;

      }



      .sq-logout-button:hover:not(:disabled) {

        border-color: rgba(15, 118, 110, 0.28);

        color: var(--primary, #0f766e);

        background: #f8fffd;

      }



      .sq-logout-button:disabled {

        opacity: 0.6;

        cursor: not-allowed;

      }



      .sq-content {

        position: relative;

        z-index: 1;

        width: min(1240px, calc(100% - 40px));

        margin: 0 auto;

        padding: 28px 0 42px;

      }



      .sq-hero {

        min-height: 238px;

        border-radius: 24px;

        position: relative;

        overflow: hidden;

        color: white;

        background:

          radial-gradient(circle at 90% 15%, rgba(255,255,255,0.13), transparent 25%),

          radial-gradient(circle at 10% 100%, rgba(212,167,44,0.14), transparent 30%),

          linear-gradient(135deg, #115e59 0%, #0f766e 56%, #0b665f 100%);

        box-shadow: 0 18px 45px rgba(15, 118, 110, 0.16);

        display: flex;

        align-items: stretch;

        justify-content: space-between;

      }



      .sq-hero-pattern {

        position: absolute;

        inset: 0;

        opacity: 0.12;

        background-image:

          linear-gradient(30deg, transparent 48%, white 49%, white 51%, transparent 52%),

          linear-gradient(150deg, transparent 48%, white 49%, white 51%, transparent 52%);

        background-size: 42px 42px;

        mask-image: linear-gradient(to right, transparent, black 25%, black 75%, transparent);

      }



      .sq-hero-content {

        position: relative;

        z-index: 1;

        padding: 35px 38px;

        max-width: 790px;

      }



      .sq-hero-kicker {

        display: inline-flex;

        align-items: center;

        gap: 7px;

        color: rgba(255,255,255,0.82);

        font-size: 11px;

        font-weight: 800;

        letter-spacing: 0.09em;

        text-transform: uppercase;

        margin-bottom: 15px;

      }



      .sq-kicker-icon {

        width: 26px;

        height: 26px;

        border-radius: 8px;

        display: grid;

        place-items: center;

        background: rgba(255,255,255,0.12);

        color: #fde68a;

      }



      .sq-hero h1 {

        margin: 0;

        font-size: clamp(30px, 4vw, 45px);

        line-height: 1.08;

        letter-spacing: -0.04em;

        font-weight: 850;

      }



      .sq-hero h1 span {

        color: #f8df8b;

      }



      .sq-hero p {

        margin: 13px 0 0;

        max-width: 660px;

        color: rgba(255,255,255,0.78);

        font-size: 14px;

        line-height: 1.7;

      }



      .sq-hero-meta {

        display: flex;

        flex-wrap: wrap;

        gap: 8px;

        margin-top: 22px;

      }



      .sq-hero-meta-item {

        display: inline-flex;

        align-items: center;

        gap: 7px;

        padding: 8px 11px;

        border-radius: 9px;

        background: rgba(255,255,255,0.1);

        border: 1px solid rgba(255,255,255,0.11);

        color: rgba(255,255,255,0.88);

        font-size: 11px;

        font-weight: 700;

      }



      .sq-hero-meta-item svg {

        color: #f8df8b;

      }



      .sq-hero-badge {

        position: relative;

        z-index: 1;

        align-self: center;

        margin-right: 42px;

        width: 128px;

        height: 128px;

        border-radius: 50%;

        border: 1px solid rgba(255,255,255,0.15);

        background: rgba(255,255,255,0.08);

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

        gap: 8px;

        color: rgba(255,255,255,0.9);

        font-size: 10px;

        font-weight: 800;

        text-transform: uppercase;

        letter-spacing: 0.07em;

      }



      .sq-hero-badge::before {

        content: "";

        position: absolute;

        inset: 9px;

        border-radius: 50%;

        border: 1px dashed rgba(255,255,255,0.2);

      }



      .sq-hero-badge-icon {

        color: #f8df8b;

      }



      .sq-stat-grid {

        display: grid;

        grid-template-columns: repeat(4, 1fr);

        gap: 14px;

        margin-top: 16px;

      }



      .sq-stat-card {

        background: white;

        border: 1px solid var(--border, #e2e8e5);

        border-radius: 17px;

        padding: 17px;

        display: flex;

        align-items: center;

        gap: 13px;

        min-width: 0;

        box-shadow: 0 7px 25px rgba(23, 34, 29, 0.035);

      }



      .sq-stat-icon {

        width: 43px;

        height: 43px;

        border-radius: 13px;

        display: grid;

        place-items: center;

        flex: 0 0 auto;

      }



      .sq-icon-teal {

        background: #ccfbf1;

        color: #0f766e;

      }



      .sq-icon-gold {

        background: #fef3c7;

        color: #a16207;

      }



      .sq-icon-green {

        background: #dcfce7;

        color: #15803d;

      }



      .sq-icon-purple {

        background: #f3e8ff;

        color: #7e22ce;

      }



      .sq-stat-card > div:last-child {

        min-width: 0;

      }



      .sq-stat-label {

        display: block;

        color: var(--muted, #64746d);

        font-size: 10px;

        font-weight: 800;

        text-transform: uppercase;

        letter-spacing: 0.07em;

      }



      .sq-stat-card strong {

        display: block;

        margin-top: 3px;

        font-size: 23px;

        line-height: 1;

        letter-spacing: -0.04em;

      }



      .sq-stat-card small {

        display: block;

        margin-top: 5px;

        color: var(--muted-light, #8a9791);

        font-size: 10px;

        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;

      }



      .sq-main-grid {

        display: grid;

        grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.75fr);

        gap: 16px;

        margin-top: 16px;

        align-items: start;

      }



      .sq-primary-column,

      .sq-sidebar {

        display: grid;

        gap: 16px;

      }




      .sq-side-card-button {
        width: 100%;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
        appearance: none;
        transition: transform 0.2s ease, border-color 0.2s ease,
          background 0.2s ease, box-shadow 0.2s ease;
      }

      .sq-side-card-button:hover {
        transform: translateY(-1px);
        border-color: rgba(15, 118, 110, 0.3);
        background: #fbfefd;
        box-shadow: 0 10px 24px rgba(15, 118, 110, 0.07);
      }

      .sq-side-card-button:focus-visible {
        outline: 3px solid rgba(15, 118, 110, 0.2);
        outline-offset: 3px;
      }

      .sq-quest-card,

      .sq-learning-card,

      .sq-school-card,

      .sq-side-card {

        background: white;

        border: 1px solid var(--border, #e2e8e5);

        border-radius: 19px;

        box-shadow: 0 7px 25px rgba(23, 34, 29, 0.035);

      }



      .sq-quest-card {

        padding: 23px;

      }



      .sq-card-heading {

        display: flex;

        align-items: flex-start;

        justify-content: space-between;

        gap: 20px;

      }



      .sq-card-heading.compact {

        align-items: center;

      }



      .sq-section-eyebrow {

        color: var(--primary, #0f766e);

        font-size: 10px;

        font-weight: 850;

        text-transform: uppercase;

        letter-spacing: 0.09em;

      }



      .sq-card-heading h2 {

        margin: 5px 0 0;

        font-size: 20px;

        letter-spacing: -0.035em;

      }



      .sq-card-heading p {

        max-width: 620px;

        margin: 7px 0 0;

        color: var(--muted, #64746d);

        font-size: 12px;

        line-height: 1.65;

      }



      .sq-quest-symbol {

        width: 48px;

        height: 48px;

        border-radius: 14px;

        display: grid;

        place-items: center;

        background: var(--primary-light, #ccfbf1);

        color: var(--primary, #0f766e);

        flex: 0 0 auto;

      }



      .sq-level-panel {

        margin-top: 20px;

        padding: 17px;

        border-radius: 15px;

        background: #f8fbfa;

        border: 1px solid #e7efeb;

      }



      .sq-level-top {

        display: flex;

        justify-content: space-between;

        align-items: center;

        gap: 12px;

      }



      .sq-level-top > div:first-child {

        display: flex;

        flex-direction: column;

        gap: 4px;

      }



      .sq-level-top span {

        font-size: 10px;

        color: var(--muted, #64746d);

        font-weight: 700;

      }



      .sq-level-top strong {

        font-size: 16px;

      }



      .sq-xp-pill {

        display: inline-flex;

        align-items: center;

        gap: 5px;

        color: #9a6f00;

        background: #fff8dc;

        border: 1px solid #f5e8ae;

        padding: 7px 9px;

        border-radius: 9px;

        font-size: 10px;

        font-weight: 850;

      }



      .sq-progress-track {

        height: 8px;

        margin-top: 15px;

        background: #e3ece8;

        border-radius: 999px;

        overflow: hidden;

      }



      .sq-progress-fill {

        height: 100%;

        min-width: 0;

        background: linear-gradient(90deg, #0f766e, #1b9a8e);

        border-radius: inherit;

        transition: width 0.5s ease;

      }



      .sq-progress-caption {

        display: flex;

        justify-content: space-between;

        gap: 10px;

        margin-top: 8px;

        color: var(--muted-light, #8a9791);

        font-size: 10px;

      }



      .sq-quest-cta {

        margin-top: 14px;

        border: 1px dashed #b9d8d1;

        border-radius: 14px;

        padding: 13px;

        display: flex;

        align-items: center;

        gap: 11px;

        background: #fbfefd;

      }

      .sq-quest-cta-button {

        width: 100%;

        color: inherit;

        font: inherit;

        text-align: left;

        cursor: pointer;

        appearance: none;

        transition: transform 0.2s ease, border-color 0.2s ease,

          background 0.2s ease, box-shadow 0.2s ease;

      }

      .sq-quest-cta-button:hover {

        transform: translateY(-1px);

        border-color: rgba(15, 118, 110, 0.38);

        background: #f7fdfb;

        box-shadow: 0 8px 22px rgba(15, 118, 110, 0.08);

      }

      .sq-quest-cta-button:focus-visible {

        outline: 3px solid rgba(15, 118, 110, 0.22);

        outline-offset: 3px;

      }



      .sq-cta-icon {

        width: 39px;

        height: 39px;

        border-radius: 11px;

        display: grid;

        place-items: center;

        background: #e9f8f5;

        color: var(--primary, #0f766e);

        flex: 0 0 auto;

      }



      .sq-cta-copy {

        min-width: 0;

        flex: 1;

      }



      .sq-cta-copy strong {

        display: block;

        font-size: 12px;

      }



      .sq-cta-copy span {

        display: block;

        color: var(--muted, #64746d);

        font-size: 10px;

        line-height: 1.5;

        margin-top: 3px;

      }



      .sq-coming-badge {

        flex: 0 0 auto;

        border-radius: 999px;

        padding: 6px 8px;

        background: #eef3f1;

        color: #718079;

        font-size: 9px;

        font-weight: 800;

      }

      .sq-play-badge {

        display: inline-flex;

        align-items: center;

        gap: 5px;

        background: #e8f7f4;

        color: var(--primary, #0f766e);

        border: 1px solid #cce8e2;

      }



      .sq-learning-card {

        padding: 21px;

      }



      .sq-learning-grid {

        display: grid;

        grid-template-columns: repeat(2, 1fr);

        gap: 9px;

        margin-top: 15px;

      }



      .sq-learning-item {

        display: flex;

        align-items: center;

        gap: 10px;

        padding: 11px;

        border-radius: 13px;

        background: #fafcfb;

        border: 1px solid #edf2ef;

      }



      .sq-learning-item-icon {

        width: 35px;

        height: 35px;

        border-radius: 10px;

        background: #e9f8f5;

        color: #0f766e;

        display: grid;

        place-items: center;

        flex: 0 0 auto;

      }



      .sq-learning-item-icon.gold {

        background: #fff7da;

        color: #a16207;

      }



      .sq-learning-item-icon.green {

        background: #e9f9ed;

        color: #15803d;

      }



      .sq-learning-item-icon.purple {

        background: #f5edff;

        color: #7e22ce;

      }



      .sq-learning-item strong,

      .sq-learning-item span {

        display: block;

      }



      .sq-learning-item strong {

        font-size: 10px;

      }



      .sq-learning-item span {

        color: var(--muted, #64746d);

        font-size: 9px;

        margin-top: 3px;

      }



      .sq-school-card,

      .sq-side-card {

        padding: 20px;

      }



      .sq-sidebar-card-top {

        display: flex;

        justify-content: space-between;

        align-items: center;

        margin-bottom: 17px;

      }



      .sq-school-icon,

      .sq-side-icon {

        width: 43px;

        height: 43px;

        border-radius: 13px;

        display: grid;

        place-items: center;

        background: var(--primary-light, #ccfbf1);

        color: var(--primary, #0f766e);

      }



      .sq-active-badge {

        display: inline-flex;

        align-items: center;

        gap: 6px;

        padding: 6px 8px;

        border-radius: 999px;

        background: #ecfdf3;

        color: #15803d;

        font-size: 9px;

        font-weight: 800;

      }



      .sq-active-badge span {

        width: 6px;

        height: 6px;

        border-radius: 50%;

        background: #16a34a;

      }



      .sq-school-card h3 {

        margin: 5px 0 0;

        font-size: 20px;

        letter-spacing: -0.035em;

      }



      .sq-school-details {

        margin-top: 18px;

        display: grid;

        gap: 10px;

      }



      .sq-school-details div {

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 12px;

        padding-bottom: 10px;

        border-bottom: 1px solid #edf1ef;

      }



      .sq-school-details div:last-child {

        border-bottom: 0;

        padding-bottom: 0;

      }



      .sq-school-details span {

        color: var(--muted, #64746d);

        font-size: 10px;

      }



      .sq-school-details strong {

        font-size: 10px;

        text-align: right;

      }



      .sq-side-card-heading {

        display: flex;

        align-items: center;

        gap: 10px;

      }



      .sq-side-icon {

        width: 38px;

        height: 38px;

        border-radius: 11px;

      }



      .sq-side-icon.soft {

        background: #f0f7f5;

        color: #47736b;

      }



      .sq-side-card h3 {

        margin: 3px 0 0;

        font-size: 14px;

        letter-spacing: -0.02em;

      }



      .sq-side-card p {

        margin: 13px 0 0;

        color: var(--muted, #64746d);

        font-size: 11px;

        line-height: 1.7;

      }



      .sq-side-link {

        display: flex;

        align-items: center;

        justify-content: space-between;

        gap: 8px;

        margin-top: 15px;

        padding-top: 12px;

        border-top: 1px solid #edf1ef;

        color: #8a9791;

        font-size: 9px;

        font-weight: 750;

      }



      .sq-footer {

        margin-top: 24px;

        padding: 17px 2px 0;

        border-top: 1px solid var(--border, #e2e8e5);

        display: flex;

        justify-content: space-between;

        gap: 15px;

        color: var(--muted-light, #8a9791);

        font-size: 10px;

      }



      .sq-footer div {

        display: flex;

        align-items: center;

        gap: 9px;

      }



      .sq-footer strong {

        color: var(--muted, #64746d);

      }



      .sq-loading-shell,

      .sq-error-shell {

        min-height: 100vh;

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

        padding: 30px;

        text-align: center;

      }



      .sq-loading-mark,

      .sq-error-icon {

        width: 58px;

        height: 58px;

        border-radius: 18px;

        display: grid;

        place-items: center;

        background: #ccfbf1;

        color: #0f766e;

      }



      .sq-loading-line {

        width: 190px;

        height: 10px;

        border-radius: 999px;

        margin-top: 15px;

        background: #e5eeeb;

        animation: sq-pulse 1.5s ease-in-out infinite;

      }



      .sq-loading-line-lg {

        width: 250px;

        height: 15px;

        margin-top: 22px;

      }



      .sq-loading-cards {

        width: min(620px, 100%);

        display: grid;

        grid-template-columns: repeat(3, 1fr);

        gap: 10px;

        margin-top: 28px;

      }



      .sq-loading-cards div {

        height: 105px;

        border-radius: 16px;

        background: white;

        border: 1px solid #e2e8e5;

        animation: sq-pulse 1.5s ease-in-out infinite;

      }



      .sq-loading-shell p {

        color: #718079;

        font-size: 11px;

        margin-top: 18px;

      }



      .sq-error-shell {

        max-width: 520px;

        margin: auto;

      }



      .sq-error-shell h1 {

        margin: 19px 0 7px;

        font-size: 28px;

        letter-spacing: -0.035em;

      }



      .sq-error-shell p {

        margin: 0;

        color: #64746d;

        font-size: 12px;

        line-height: 1.7;

      }



      .sq-error-actions {

        display: flex;

        gap: 9px;

        margin-top: 22px;

      }



      .sq-primary-button,

      .sq-secondary-button {

        min-height: 42px;

        padding: 0 16px;

        border-radius: 11px;

        font-size: 11px;

        font-weight: 800;

        cursor: pointer;

      }



      .sq-primary-button {

        border: 1px solid #0f766e;

        background: #0f766e;

        color: white;

      }



      .sq-secondary-button {

        border: 1px solid #dce5e1;

        background: white;

        color: #52635c;

      }



      @keyframes sq-pulse {

        0%, 100% { opacity: 0.55; }

        50% { opacity: 1; }

      }



      @media (max-width: 980px) {

        .sq-stat-grid {

          grid-template-columns: repeat(2, 1fr);

        }



        .sq-main-grid {

          grid-template-columns: 1fr;

        }



        .sq-sidebar {

          grid-template-columns: repeat(2, 1fr);

        }



        .sq-school-card {

          grid-row: span 2;

        }

      }



      @media (max-width: 720px) {

        .sq-topbar-inner,

        .sq-content {

          width: min(100% - 24px, 620px);

        }



        .sq-topbar-inner {

          min-height: 64px;

        }



        .sq-brand-copy span {

          display: none;

        }



        .sq-student-mini {

          display: none;

        }



        .sq-logout-button {

          width: 38px;

          padding: 0;

          justify-content: center;

        }



        .sq-logout-button span {

          display: none;

        }



        .sq-content {

          padding-top: 14px;

          padding-bottom: 26px;

        }



        .sq-hero {

          min-height: auto;

          border-radius: 19px;

        }



        .sq-hero-content {

          padding: 25px 21px 23px;

        }



        .sq-hero h1 {

          font-size: 31px;

        }



        .sq-hero p {

          font-size: 12px;

          line-height: 1.65;

        }



        .sq-hero-badge {

          display: none;

        }



        .sq-hero-meta {

          gap: 6px;

          margin-top: 17px;

        }



        .sq-hero-meta-item {

          font-size: 9px;

          padding: 7px 8px;

        }



        .sq-stat-grid {

          grid-template-columns: repeat(2, 1fr);

          gap: 9px;

          margin-top: 9px;

        }



        .sq-stat-card {

          padding: 13px;

          border-radius: 14px;

          gap: 9px;

        }



        .sq-stat-icon {

          width: 36px;

          height: 36px;

          border-radius: 10px;

        }



        .sq-stat-card strong {

          font-size: 19px;

        }



        .sq-stat-card small {

          font-size: 8px;

        }



        .sq-main-grid {

          margin-top: 9px;

          gap: 9px;

        }



        .sq-primary-column,

        .sq-sidebar {

          gap: 9px;

        }



        .sq-quest-card,

        .sq-learning-card,

        .sq-school-card,

        .sq-side-card {

          border-radius: 16px;

        }



        .sq-quest-card,

        .sq-learning-card,

        .sq-school-card,

        .sq-side-card {

          padding: 17px;

        }



        .sq-card-heading h2 {

          font-size: 17px;

        }



        .sq-card-heading p {

          font-size: 10px;

        }



        .sq-quest-symbol {

          width: 41px;

          height: 41px;

          border-radius: 11px;

        }



        .sq-level-panel {

          padding: 13px;

          margin-top: 15px;

        }



        .sq-level-top strong {

          font-size: 14px;

        }



        .sq-xp-pill {

          font-size: 9px;

          padding: 6px 7px;

        }



        .sq-quest-cta {

          align-items: flex-start;

          flex-wrap: wrap;

        }



        .sq-coming-badge {

          margin-left: 50px;

          margin-top: -4px;

        }



        .sq-learning-grid {

          grid-template-columns: 1fr;

        }



        .sq-sidebar {

          grid-template-columns: 1fr;

        }



        .sq-school-card {

          grid-row: auto;

        }



        .sq-footer {

          flex-direction: column;

          align-items: flex-start;

        }

      }



      @media (max-width: 390px) {

        .sq-brand-mark {

          width: 38px;

          height: 38px;

          border-radius: 11px;

        }



        .sq-brand-copy strong {

          font-size: 13px;

        }



        .sq-hero h1 {

          font-size: 28px;

        }



        .sq-hero-meta-item:nth-child(3) {

          display: none;

        }



        .sq-stat-card {

          padding: 11px;

        }



        .sq-stat-icon {

          width: 33px;

          height: 33px;

        }



        .sq-stat-card strong {

          font-size: 17px;

        }



        .sq-stat-card small {

          display: none;

        }

      }

    `}</style>

  );

}
