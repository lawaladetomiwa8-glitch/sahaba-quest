"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type LeaderboardRow = {
  rank: number;
  student_id: string;
  student_name: string;
  student_code: string;
  class_id: string;
  class_name: string;
  monthly_xp: number;
  questions_answered: number;
  correct_answers: number;
  accuracy: number;
  is_current_student: boolean;
};

type LeaderboardResponse = {
  success: boolean;
  month: string;
  class: {
    id: string;
    name: string;
  };
  student: {
    id: string;
    student_id: string;
    name: string;
  };
  leaderboard: LeaderboardRow[];
  current_student: LeaderboardRow | null;
  message?: string;
};

function Icon({
  name,
  size = 22,
  strokeWidth = 2,
}: {
  name:
    | "trophy"
    | "arrow"
    | "chevron"
    | "star"
    | "target"
    | "book"
    | "users"
    | "refresh";
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
    case "trophy":
      return (
        <svg {...common}>
          <path d="M8 21h8" />
          <path d="M12 17v4" />
          <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
          <path d="M7 6H4v2a4 4 0 0 0 4 4" />
          <path d="M17 6h3v2a4 4 0 0 1-4 4" />
        </svg>
      );

    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );

    case "star":
      return (
        <svg {...common}>
          <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
        </svg>
      );

    case "target":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <circle cx="12" cy="12" r="4" />
          <circle
            cx="12"
            cy="12"
            r="1"
            fill="currentColor"
          />
        </svg>
      );

    case "book":
      return (
        <svg {...common}>
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Z" />
          <path d="M4 5.5V21" />
          <path d="M8 7h8" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
          <path d="M16 3.1a4 4 0 0 1 0 7.8" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.7-4L3 10" />
          <path d="M3 4v6h6" />
          <path d="M4 13a8 8 0 0 0 14.7 4L21 14" />
          <path d="M21 20v-6h-6" />
        </svg>
      );
  }
}

function getMonthOptions() {
  const options: Array<{
    value: string;
    label: string;
  }> = [];

  const date = new Date();
  date.setDate(1);

  for (let index = 0; index < 12; index += 1) {
    const value = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    options.push({
      value,
      label: date.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    });

    date.setMonth(date.getMonth() - 1);
  }

  return options;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) => part[0]?.toUpperCase() ?? ""
    )
    .join("");
}

function ordinal(rank: number) {
  if (
    rank % 100 >= 11 &&
    rank % 100 <= 13
  ) {
    return `${rank}th`;
  }

  switch (rank % 10) {
    case 1:
      return `${rank}st`;

    case 2:
      return `${rank}nd`;

    case 3:
      return `${rank}rd`;

    default:
      return `${rank}th`;
  }
}

export default function SchoolStudentLeaderboardPage() {
  const router = useRouter();

  const monthOptions = useMemo(
    () => getMonthOptions(),
    []
  );

  const [month, setMonth] = useState(
    monthOptions[0]?.value ?? ""
  );

  const [data, setData] =
    useState<LeaderboardResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadLeaderboard = useCallback(
    async (
      selectedMonth: string,
      isRefresh = false
    ) => {
      const token =
        typeof window !== "undefined"
          ? sessionStorage.getItem(
              "school_student_session_token"
            )
          : null;

      if (!token) {
        router.replace(
          "/schools/student-login"
        );
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      try {
        /*
         * IMPORTANT:
         *
         * The API route is located at:
         *
         * /api/schools/students/student-leaderboard
         *
         * Do not change this path to:
         *
         * /api/schools/student-leaderboard
         */

        const response = await fetch(
          `/api/schools/students/student-leaderboard?month=${encodeURIComponent(
            selectedMonth
          )}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const result =
          (await response
            .json()
            .catch(() => ({}))) as Partial<LeaderboardResponse>;

        if (response.status === 401) {
          sessionStorage.removeItem(
            "school_student_session_token"
          );

          sessionStorage.removeItem(
            "school_student_expires_at"
          );

          router.replace(
            "/schools/student-login"
          );

          return;
        }

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.message ||
              "We could not load your class leaderboard right now."
          );
        }

        setData(
          result as LeaderboardResponse
        );
      } catch (error) {
        console.error(
          "Student leaderboard loading error:",
          error
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "We could not load your class leaderboard right now."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    if (month) {
      void loadLeaderboard(month);
    }
  }, [loadLeaderboard, month]);

  const topThree =
    data?.leaderboard.slice(0, 3) ?? [];

  const remainingStudents =
    data?.leaderboard.slice(3) ?? [];

  const currentStudent =
    data?.current_student ?? null;

  if (loading) {
    return (
      <main className="sq-leaderboard-page">
        <div className="sq-leaderboard-loading">
          <div className="sq-spinner" />

          <p>
            Preparing your class leaderboard...
          </p>
        </div>

        <LeaderboardStyles />
      </main>
    );
  }

  if (message && !data) {
    return (
      <main className="sq-leaderboard-page">
        <div className="sq-leaderboard-shell">
          <button
            type="button"
            className="sq-back-button"
            onClick={() =>
              router.push(
                "/schools/student-dashboard"
              )
            }
          >
            <Icon
              name="chevron"
              size={17}
            />

            Dashboard
          </button>

          <section className="sq-error-card">
            <div className="sq-error-icon">
              !
            </div>

            <span className="sq-eyebrow">
              Class Leaderboard
            </span>

            <h1>
              We could not load the leaderboard
            </h1>

            <p>{message}</p>

            <button
              type="button"
              className="sq-primary-button"
              onClick={() =>
                void loadLeaderboard(
                  month,
                  true
                )
              }
            >
              <Icon
                name="refresh"
                size={17}
              />

              Try Again
            </button>
          </section>
        </div>

        <LeaderboardStyles />
      </main>
    );
  }

  return (
    <main className="sq-leaderboard-page">
      <div className="sq-leaderboard-glow sq-glow-one" />
      <div className="sq-leaderboard-glow sq-glow-two" />

      <div className="sq-leaderboard-shell">
        <header className="sq-leaderboard-header">
          <button
            type="button"
            className="sq-back-button"
            onClick={() =>
              router.push(
                "/schools/student-dashboard"
              )
            }
          >
            <Icon
              name="chevron"
              size={17}
            />

            Dashboard
          </button>

          <div className="sq-header-actions">
            <button
              type="button"
              className="sq-refresh-button"
              onClick={() =>
                void loadLeaderboard(
                  month,
                  true
                )
              }
              disabled={refreshing}
              aria-label="Refresh leaderboard"
            >
              <Icon
                name="refresh"
                size={17}
              />

              {refreshing
                ? "Refreshing"
                : "Refresh"}
            </button>
          </div>
        </header>

        <section className="sq-hero">
          <div className="sq-hero-icon">
            <Icon
              name="trophy"
              size={28}
            />
          </div>

          <div className="sq-hero-copy">
            <span className="sq-eyebrow">
              Class Leaderboard
            </span>

            <h1>
              Learn together. Grow together.
            </h1>

            <p>
              See how your learning progress
              compares with your classmates.
              Keep learning, earn XP, and aim
              for your personal best.
            </p>
          </div>

          <div className="sq-month-control">
            <label htmlFor="leaderboard-month">
              Month
            </label>

            <select
              id="leaderboard-month"
              value={month}
              onChange={(event) =>
                setMonth(event.target.value)
              }
            >
              {monthOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        <section className="sq-class-summary">
          <div>
            <span className="sq-eyebrow">
              Your class
            </span>

            <strong>
              {data?.class.name ?? "Class"}
            </strong>
          </div>

          <div className="sq-summary-item">
            <Icon
              name="users"
              size={18}
            />

            <span>
              {data?.leaderboard.length ?? 0}{" "}
              students
            </span>
          </div>

          <div className="sq-summary-item">
            <Icon
              name="star"
              size={18}
            />

            <span>Monthly XP</span>
          </div>
        </section>

        {currentStudent && (
          <section className="sq-your-position">
            <div className="sq-position-copy">
              <span className="sq-eyebrow">
                Your position
              </span>

              <strong>
                {ordinal(
                  currentStudent.rank
                )}{" "}
                in {data?.class.name}
              </strong>

              <small>
                {currentStudent.monthly_xp.toLocaleString()}{" "}
                XP this month
              </small>
            </div>

            <div className="sq-position-stats">
              <div>
                <strong>
                  {currentStudent.accuracy}%
                </strong>

                <span>Accuracy</span>
              </div>

              <div>
                <strong>
                  {
                    currentStudent.questions_answered
                  }
                </strong>

                <span>Answered</span>
              </div>
            </div>
          </section>
        )}

        {topThree.length > 0 ? (
          <section className="sq-podium-section">
            <div className="sq-section-heading">
              <div>
                <span className="sq-eyebrow">
                  Top learners
                </span>

                <h2>
                  This month&apos;s leaders
                </h2>
              </div>

              <Icon
                name="star"
                size={22}
              />
            </div>

            <div className="sq-podium">
              {topThree.map((row) => (
                <article
                  key={row.student_id}
                  className={`sq-podium-card sq-podium-${row.rank} ${
                    row.is_current_student
                      ? "sq-current"
                      : ""
                  }`}
                >
                  <div className="sq-rank-medal">
                    {row.rank === 1
                      ? "1"
                      : row.rank === 2
                        ? "2"
                        : "3"}
                  </div>

                  <div className="sq-avatar">
                    {initials(
                      row.student_name
                    )}
                  </div>

                  <span className="sq-podium-rank">
                    {ordinal(row.rank)}
                  </span>

                  <h3>
                    {row.student_name}
                  </h3>

                  {row.is_current_student && (
                    <span className="sq-you-badge">
                      You
                    </span>
                  )}

                  <strong className="sq-podium-xp">
                    {row.monthly_xp.toLocaleString()}{" "}
                    XP
                  </strong>

                  <span className="sq-podium-detail">
                    {row.accuracy}% accuracy
                  </span>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="sq-empty-card">
            <div className="sq-empty-icon">
              <Icon
                name="book"
                size={24}
              />
            </div>

            <h2>
              No leaderboard activity yet
            </h2>

            <p>
              Keep learning and completing
              Quest questions. Your class
              ranking will appear here as
              learning activity is recorded.
            </p>

            <button
              type="button"
              className="sq-primary-button"
              onClick={() =>
                router.push(
                  "/schools/student-quest"
                )
              }
            >
              Start Student Quest

              <Icon
                name="arrow"
                size={17}
              />
            </button>
          </section>
        )}

        {remainingStudents.length > 0 && (
          <section className="sq-ranking-section">
            <div className="sq-section-heading">
              <div>
                <span className="sq-eyebrow">
                  Class ranking
                </span>

                <h2>
                  Everyone in your class
                </h2>
              </div>
            </div>

            <div className="sq-ranking-list">
              {remainingStudents.map(
                (row) => (
                  <article
                    key={row.student_id}
                    className={`sq-ranking-row ${
                      row.is_current_student
                        ? "sq-current"
                        : ""
                    }`}
                  >
                    <span className="sq-ranking-number">
                      {row.rank}
                    </span>

                    <div className="sq-avatar sq-avatar-small">
                      {initials(
                        row.student_name
                      )}
                    </div>

                    <div className="sq-ranking-name">
                      <strong>
                        {row.student_name}
                      </strong>

                      {row.is_current_student && (
                        <span>You</span>
                      )}
                    </div>

                    <div className="sq-ranking-stat">
                      <strong>
                        {row.monthly_xp.toLocaleString()}
                      </strong>

                      <span>XP</span>
                    </div>

                    <div className="sq-ranking-stat sq-ranking-accuracy">
                      <strong>
                        {row.accuracy}%
                      </strong>

                      <span>Accuracy</span>
                    </div>

                    <div className="sq-ranking-stat sq-ranking-questions">
                      <strong>
                        {
                          row.questions_answered
                        }
                      </strong>

                      <span>Answered</span>
                    </div>
                  </article>
                )
              )}
            </div>
          </section>
        )}

        <section className="sq-footer-cta">
          <div>
            <span className="sq-eyebrow">
              Keep your journey moving
            </span>

            <h2>
              Ready for another Quest?
            </h2>

            <p>
              Earn more XP and keep building
              your knowledge.
            </p>
          </div>

          <button
            type="button"
            className="sq-primary-button"
            onClick={() =>
              router.push(
                "/schools/student-quest"
              )
            }
          >
            Continue Quest

            <Icon
              name="arrow"
              size={17}
            />
          </button>
        </section>

        <footer className="sq-footer">
          <strong>Sahaba Quest</strong>

          <span>
            May Allah bless your learning
            journey.
          </span>
        </footer>
      </div>

      <LeaderboardStyles />
    </main>
  );
}

function LeaderboardStyles() {
  return (
    <style jsx global>{`
      .sq-leaderboard-page {
        min-height: 100vh;
        background: var(--background, #f7f9f8);
        color: var(--foreground, #17221d);
        position: relative;
        overflow-x: hidden;
      }

      .sq-leaderboard-glow {
        position: fixed;
        pointer-events: none;
        border-radius: 999px;
        z-index: 0;
      }

      .sq-glow-one {
        width: 420px;
        height: 420px;
        top: -180px;
        right: -180px;
        background: rgba(15, 118, 110, 0.08);
      }

      .sq-glow-two {
        width: 320px;
        height: 320px;
        bottom: -150px;
        left: -150px;
        background: rgba(124, 58, 237, 0.05);
      }

      .sq-leaderboard-shell {
        width: min(1120px, calc(100% - 32px));
        margin: 0 auto;
        padding: 28px 0 44px;
        position: relative;
        z-index: 1;
      }

      .sq-leaderboard-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }

      .sq-back-button,
      .sq-refresh-button {
        appearance: none;
        border: 1px solid #dfe8e4;
        background: rgba(255, 255, 255, 0.88);
        color: #395149;
        min-height: 42px;
        border-radius: 12px;
        padding: 0 14px;
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font: inherit;
        font-size: 13px;
        font-weight: 750;
        cursor: pointer;
      }

      .sq-back-button svg {
        transform: rotate(180deg);
      }

      .sq-refresh-button:disabled {
        opacity: 0.65;
        cursor: wait;
      }

      .sq-hero {
        background: linear-gradient(135deg, #ffffff, #f2faf7);
        border: 1px solid #dce9e4;
        border-radius: 24px;
        padding: 28px;
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 18px;
        align-items: center;
        box-shadow: 0 14px 40px rgba(25, 60, 49, 0.06);
      }

      .sq-hero-icon {
        width: 58px;
        height: 58px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        color: #0f766e;
        background: #e5f6f2;
      }

      .sq-eyebrow {
        display: block;
        color: #0f766e;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 10px;
        font-weight: 850;
      }

      .sq-hero h1 {
        margin: 5px 0 6px;
        font-size: clamp(25px, 4vw, 36px);
        line-height: 1.1;
        letter-spacing: -0.035em;
      }

      .sq-hero p {
        margin: 0;
        color: #64756e;
        max-width: 650px;
        font-size: 14px;
        line-height: 1.65;
      }

      .sq-month-control {
        min-width: 175px;
      }

      .sq-month-control label {
        display: block;
        margin-bottom: 7px;
        color: #687971;
        font-size: 11px;
        font-weight: 750;
      }

      .sq-month-control select {
        width: 100%;
        height: 44px;
        border: 1px solid #d5e2dd;
        border-radius: 12px;
        background: #fff;
        color: #17221d;
        padding: 0 12px;
        font: inherit;
        font-size: 13px;
        font-weight: 700;
        outline: none;
      }

      .sq-month-control select:focus {
        border-color: #0f766e;
        box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.1);
      }

      .sq-class-summary {
        margin-top: 14px;
        padding: 17px 20px;
        border: 1px solid #e0e9e5;
        background: rgba(255, 255, 255, 0.78);
        border-radius: 16px;
        display: flex;
        align-items: center;
        gap: 28px;
      }

      .sq-class-summary strong {
        display: block;
        margin-top: 3px;
        font-size: 17px;
      }

      .sq-summary-item {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 7px;
        color: #64756e;
        font-size: 12px;
        font-weight: 700;
      }

      .sq-summary-item + .sq-summary-item {
        margin-left: 0;
      }

      .sq-your-position {
        margin-top: 14px;
        padding: 20px 22px;
        border-radius: 18px;
        background: #0f766e;
        color: white;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        box-shadow: 0 14px 34px rgba(15, 118, 110, 0.16);
      }

      .sq-your-position .sq-eyebrow {
        color: #b8ebe3;
      }

      .sq-position-copy strong {
        display: block;
        margin-top: 4px;
        font-size: 21px;
      }

      .sq-position-copy small {
        display: block;
        margin-top: 3px;
        color: #d6f3ef;
        font-size: 12px;
      }

      .sq-position-stats {
        display: flex;
        gap: 24px;
      }

      .sq-position-stats div {
        text-align: right;
      }

      .sq-position-stats strong,
      .sq-position-stats span {
        display: block;
      }

      .sq-position-stats strong {
        font-size: 19px;
      }

      .sq-position-stats span {
        margin-top: 2px;
        color: #c9eee9;
        font-size: 10px;
      }

      .sq-podium-section,
      .sq-ranking-section {
        margin-top: 30px;
      }

      .sq-section-heading {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 13px;
      }

      .sq-section-heading h2 {
        margin: 5px 0 0;
        font-size: 20px;
        letter-spacing: -0.02em;
      }

      .sq-section-heading > svg {
        color: #c28b24;
      }

      .sq-podium {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        align-items: end;
      }

      .sq-podium-card {
        min-height: 248px;
        border: 1px solid #e0e9e5;
        background: #fff;
        border-radius: 20px;
        padding: 22px 18px;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
        box-shadow: 0 10px 28px rgba(25, 60, 49, 0.045);
      }

      .sq-podium-1 {
        min-height: 278px;
        border-color: #cfe5df;
        background: linear-gradient(180deg, #f5fcfa, #fff);
      }

      .sq-rank-medal {
        width: 31px;
        height: 31px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: #edf4f1;
        color: #52675f;
        font-size: 12px;
        font-weight: 900;
      }

      .sq-podium-1 .sq-rank-medal {
        background: #e9d7a6;
        color: #684c0d;
      }

      .sq-podium-2 .sq-rank-medal {
        background: #e3e9ec;
        color: #47555b;
      }

      .sq-podium-3 .sq-rank-medal {
        background: #ead6c6;
        color: #754a2b;
      }

      .sq-avatar {
        width: 54px;
        height: 54px;
        margin-top: 13px;
        border-radius: 17px;
        display: grid;
        place-items: center;
        background: #e8f5f2;
        color: #0f766e;
        font-size: 15px;
        font-weight: 900;
      }

      .sq-podium-rank {
        margin-top: 11px;
        color: #7b8a84;
        font-size: 10px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.07em;
      }

      .sq-podium-card h3 {
        margin: 4px 0 0;
        font-size: 15px;
        line-height: 1.3;
      }

      .sq-you-badge {
        margin-top: 5px;
        border-radius: 999px;
        background: #e5f6f2;
        color: #0f766e;
        padding: 3px 8px;
        font-size: 9px;
        font-weight: 850;
      }

      .sq-podium-xp {
        margin-top: auto;
        font-size: 19px;
        color: #17221d;
      }

      .sq-podium-detail {
        margin-top: 3px;
        color: #77867f;
        font-size: 10px;
      }

      .sq-podium-card.sq-current,
      .sq-ranking-row.sq-current {
        box-shadow: 0 0 0 2px rgba(15, 118, 110, 0.12);
      }

      .sq-ranking-list {
        border: 1px solid #e0e9e5;
        background: #fff;
        border-radius: 18px;
        overflow: hidden;
      }

      .sq-ranking-row {
        min-height: 70px;
        padding: 10px 16px;
        display: grid;
        grid-template-columns: 38px 42px minmax(180px, 1fr) 90px 105px 85px;
        align-items: center;
        gap: 10px;
        border-bottom: 1px solid #edf2ef;
      }

      .sq-ranking-row:last-child {
        border-bottom: 0;
      }

      .sq-ranking-number {
        color: #7d8b85;
        font-size: 13px;
        font-weight: 850;
        text-align: center;
      }

      .sq-avatar-small {
        width: 38px;
        height: 38px;
        margin: 0;
        border-radius: 12px;
        font-size: 11px;
      }

      .sq-ranking-name strong,
      .sq-ranking-name span {
        display: block;
      }

      .sq-ranking-name strong {
        font-size: 13px;
      }

      .sq-ranking-name span {
        margin-top: 2px;
        color: #0f766e;
        font-size: 9px;
        font-weight: 850;
      }

      .sq-ranking-stat {
        text-align: right;
      }

      .sq-ranking-stat strong,
      .sq-ranking-stat span {
        display: block;
      }

      .sq-ranking-stat strong {
        font-size: 13px;
      }

      .sq-ranking-stat span {
        margin-top: 2px;
        color: #84918c;
        font-size: 9px;
      }

      .sq-empty-card,
      .sq-error-card {
        margin-top: 30px;
        border: 1px solid #e0e9e5;
        background: #fff;
        border-radius: 20px;
        padding: 42px 24px;
        text-align: center;
      }

      .sq-empty-icon,
      .sq-error-icon {
        width: 52px;
        height: 52px;
        margin: 0 auto;
        border-radius: 16px;
        display: grid;
        place-items: center;
        background: #e8f5f2;
        color: #0f766e;
      }

      .sq-error-icon {
        background: #fff0f0;
        color: #b42318;
        font-weight: 900;
      }

      .sq-empty-card h2,
      .sq-error-card h1 {
        margin: 15px 0 7px;
        font-size: 20px;
      }

      .sq-empty-card p,
      .sq-error-card p {
        max-width: 560px;
        margin: 0 auto;
        color: #6d7b75;
        font-size: 13px;
        line-height: 1.65;
      }

      .sq-primary-button {
        margin-top: 18px;
        min-height: 44px;
        border: 0;
        border-radius: 12px;
        padding: 0 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        background: #0f766e;
        color: white;
        font: inherit;
        font-size: 13px;
        font-weight: 800;
        cursor: pointer;
      }

      .sq-footer-cta {
        margin-top: 30px;
        padding: 22px;
        border: 1px solid #dce9e4;
        border-radius: 18px;
        background: #f3faf7;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
      }

      .sq-footer-cta h2 {
        margin: 4px 0 2px;
        font-size: 18px;
      }

      .sq-footer-cta p {
        margin: 0;
        color: #6c7c74;
        font-size: 12px;
      }

      .sq-footer-cta .sq-primary-button {
        margin: 0;
        flex-shrink: 0;
      }

      .sq-footer {
        margin-top: 34px;
        padding: 0 2px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: #7a8982;
        font-size: 11px;
      }

      .sq-footer strong {
        color: #455a52;
      }

      .sq-leaderboard-loading {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
        gap: 12px;
        color: #6e7c76;
        font-size: 13px;
      }

      .sq-spinner {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: 4px solid #dce9e4;
        border-top-color: #0f766e;
        animation: sq-spin 0.8s linear infinite;
      }

      @keyframes sq-spin {
        to {
          transform: rotate(360deg);
        }
      }

      @media (max-width: 760px) {
        .sq-leaderboard-shell {
          width: min(100% - 20px, 1120px);
          padding-top: 18px;
        }

        .sq-hero {
          grid-template-columns: 1fr;
          padding: 21px;
        }

        .sq-hero-icon {
          width: 50px;
          height: 50px;
        }

        .sq-month-control {
          width: 100%;
        }

        .sq-class-summary {
          flex-wrap: wrap;
          gap: 14px;
        }

        .sq-summary-item,
        .sq-summary-item + .sq-summary-item {
          margin-left: 0;
        }

        .sq-your-position {
          align-items: flex-start;
          flex-direction: column;
        }

        .sq-position-stats {
          width: 100%;
          justify-content: flex-start;
        }

        .sq-position-stats div {
          text-align: left;
        }

        .sq-podium {
          grid-template-columns: 1fr;
        }

        .sq-podium-card,
        .sq-podium-1 {
          min-height: 0;
        }

        .sq-podium-xp {
          margin-top: 13px;
        }

        .sq-ranking-row {
          grid-template-columns: 30px 38px minmax(0, 1fr) 70px;
          padding: 11px;
        }

        .sq-ranking-accuracy,
        .sq-ranking-questions {
          display: none;
        }

        .sq-footer-cta {
          align-items: flex-start;
          flex-direction: column;
        }

        .sq-footer-cta .sq-primary-button {
          width: 100%;
        }

        .sq-footer {
          align-items: flex-start;
          flex-direction: column;
        }
      }
    `}</style>
  );
}