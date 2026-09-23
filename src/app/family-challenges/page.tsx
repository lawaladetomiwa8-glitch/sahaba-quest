"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { AppNavbar } from "../../components/ui";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  icon: string | null;
  challenge_type: string | null;
  question_count: number;
  time_per_question: number;
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
};

type User = {
  id: string;
};

type FamilyChallengeAttempt = {
  id: string;
  challenge_id: string;
  questions_answered: number;
  correct_answers: number;
  score: number;
  status: "in_progress" | "completed";
  passed: boolean | null;
};

/*
 * ---------------------------------------------------------
 * CHALLENGES THAT ARE NOT PLAYABLE YET
 * ---------------------------------------------------------
 *
 * These challenges are visible in the Family Challenge Arena,
 * but their question banks are still being prepared.
 */

const COMING_SOON_CHALLENGE_TITLES = new Set([
  "Women of the Sahaba",
  "The Ten Promised Paradise",
  "Companions of Badr",
  "Ansar vs Muhajirun",
  "Leaders Among the Sahaba",
  "The Young Sahaba",
]);

export default function FamilyChallengesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [attempts, setAttempts] = useState<
    Record<string, FamilyChallengeAttempt>
  >({});
  const [isFamily, setIsFamily] = useState(false);

  const [loading, setLoading] = useState(true);
  const [startingChallenge, setStartingChallenge] = useState<string | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadChallenges();
  }, []);

  async function loadChallenges() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user: currentUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        window.location.href = "/login";
        return;
      }

      setUser({
        id: currentUser.id,
      });

      /*
       * ---------------------------------------------------------
       * VERIFY FAMILY ACCOUNT + ACTIVE FAMILY SUBSCRIPTION
       * ---------------------------------------------------------
       */

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (profileError) {
        throw profileError;
      }

      if (profileData?.account_type !== "family") {
        window.location.href = "/dashboard";
        return;
      }

      const { data: subscriptionData, error: subscriptionError } =
        await supabase
          .from("subscriptions")
          .select(`
            id,
            status,
            current_period_end,
            subscription_plans (
              plan_type
            )
          `)
          .eq("user_id", currentUser.id)
          .eq("status", "active")
          .order("current_period_end", { ascending: false })
          .limit(1)
          .maybeSingle();

      if (subscriptionError) {
        throw subscriptionError;
      }

      const planData = Array.isArray(subscriptionData?.subscription_plans)
        ? subscriptionData?.subscription_plans[0]
        : subscriptionData?.subscription_plans;

      const hasActiveFamilySubscription =
        planData?.plan_type === "family" &&
        !!subscriptionData?.current_period_end &&
        new Date(subscriptionData.current_period_end).getTime() > Date.now();

      if (!hasActiveFamilySubscription) {
        window.location.href = "/pricing";
        return;
      }

      setIsFamily(true);

      /*
       * ---------------------------------------------------------
       * LOAD USER CHALLENGE ATTEMPTS
       * ---------------------------------------------------------
       *
       * challenge_attempts DOES NOT have created_at.
       */

      const { data: attemptData, error: attemptError } = await supabase
        .from("family_challenge_attempts")
        .select(
          `
            id,
            challenge_id,
            questions_answered,
            correct_answers,
            score,
            status,
            passed
          `
        )
        .eq("user_id", currentUser.id);

      if (attemptError) {
        console.error("Failed to load attempts:", attemptError);
      }

      const attemptMap: Record<string, FamilyChallengeAttempt> = {};

      (attemptData || []).forEach((attempt) => {
        if (!attemptMap[attempt.challenge_id]) {
          attemptMap[attempt.challenge_id] = attempt;
        }
      });

      setAttempts(attemptMap);

      /*
       * ---------------------------------------------------------
       * LOAD ACTIVE CHALLENGES
       * ---------------------------------------------------------
       */

      const { data: challengeData, error: challengeError } =
        await supabase
          .from("challenges")
          .select(
            `
              id,
              title,
              description,
              icon,
              challenge_type,
              question_count,
              time_per_question,
              is_premium,
              is_active,
              sort_order
            `
          )
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

      if (challengeError) {
        throw challengeError;
      }

      setChallenges(challengeData || []);
    } catch (error) {
      console.error("Error loading challenges:", error);

      setErrorMessage(
        "We couldn't load the challenges right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * SCROLL TO CHALLENGES
   * ---------------------------------------------------------
   */

  function scrollToChallenges() {
    const section = document.getElementById(
      "available-challenges"
    );

    if (section) {
      section.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  /*
   * ---------------------------------------------------------
   * HELPER FUNCTIONS
   * ---------------------------------------------------------
   */

  function isComingSoonChallenge(challenge: Challenge) {
    return COMING_SOON_CHALLENGE_TITLES.has(challenge.title);
  }

  function getFamilyChallengeAttempt(challengeId: string) {
    return attempts[challengeId];
  }

  function getProgressPercentage(attempt: FamilyChallengeAttempt) {
    const challenge = challenges.find(
      (item) => item.id === attempt.challenge_id
    );

    if (!challenge || challenge.question_count === 0) {
      return 0;
    }

    return Math.min(
      100,
      Math.round(
        (attempt.questions_answered / challenge.question_count) * 100
      )
    );
  }

  /*
   * Determine whether a completed challenge was passed.
   *
   * Passing requirement:
   * 50% or higher.
   *
   * We use the saved `passed` value when available.
   * For older records where passed is null, we calculate it.
   */

  function getPassedStatus(
    attempt: FamilyChallengeAttempt,
    challenge: Challenge
  ) {
    if (typeof attempt.passed === "boolean") {
      return attempt.passed;
    }

    if (challenge.question_count <= 0) {
      return false;
    }

    const percentage =
      (attempt.correct_answers / challenge.question_count) * 100;

    return percentage >= 50;
  }

  function formatChallengeType(type: string | null) {
    if (!type) return "Challenge";

    return type
      .replace(/_/g, " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function formatTime(seconds: number) {
    if (seconds < 60) {
      return `${seconds}s/question`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (remainingSeconds === 0) {
      return `${minutes}m/question`;
    }

    return `${minutes}m ${remainingSeconds}s/question`;
  }

  /*
   * ---------------------------------------------------------
   * START FAMILY CHALLENGE
   * ---------------------------------------------------------
   */

  async function handleStartChallenge(challenge: Challenge) {
    /*
     * Coming Soon challenges cannot be started.
     */

    if (isComingSoonChallenge(challenge)) {
      return;
    }

    if (!user || !isFamily) {
      window.location.href = "/login";
      return;
    }

    /*
     * Completed challenges cannot be retaken.
     *
     * Their result is viewed through the result button instead.
     */

    const existingAttempt = attempts[challenge.id];

    if (existingAttempt?.status === "completed") {
      return;
    }

    setErrorMessage("");
    setStartingChallenge(challenge.id);

    try {
      /*
       * Start challenge using Supabase RPC
       */

      const { data, error } = await supabase.rpc("start_family_challenge", {
        p_challenge_id: challenge.id,
      });

      if (error) {
        console.error("Failed to start challenge:", error);

        throw error;
      }

      if (!data?.attempt_id) {
        setErrorMessage(
          "We couldn't start this Family Challenge. Please try again."
        );
        return;
      }

      /*
       * Save returned attempt locally
       */

      if (data.attempt_id) {
        setAttempts((previous) => ({
          ...previous,
          [challenge.id]: {
            id: data.attempt_id,
            challenge_id: challenge.id,
            questions_answered: data.questions_answered || 0,
            correct_answers: data.correct_answers || 0,
            score: data.score || 0,
            status:
              data.status === "completed"
                ? "completed"
                : "in_progress",
            passed:
              typeof data.passed === "boolean"
                ? data.passed
                : null,
          },
        }));
      }

      /*
       * If the RPC discovers an already-completed challenge,
       * send the player to their saved result.
       */

      window.location.href =
        `/family-challenges/${challenge.id}?attempt=${data.attempt_id}`;
    } catch (error) {
      console.error("Challenge start error:", error);

      setErrorMessage(
        "Something went wrong while starting the challenge. Please try again."
      );
    } finally {
      setStartingChallenge(null);
    }
  }

  /*
   * ---------------------------------------------------------
   * VIEW SAVED FAMILY RESULT
   * ---------------------------------------------------------
   */

  function viewChallengeResult(
    challengeId: string,
    attemptId: string
  ) {
    window.location.href =
      `/family-challenges/${challengeId}/result?attempt=${attemptId}`;
  }

  const completedCount = challenges.filter(
    (challenge) =>
      getFamilyChallengeAttempt(challenge.id)?.status === "completed"
  ).length;

  const inProgressCount = challenges.filter(
    (challenge) =>
      getFamilyChallengeAttempt(challenge.id)?.status === "in_progress"
  ).length;

  const timedCount = challenges.filter(
    (challenge) => challenge.time_per_question > 0
  ).length;

  /*
   * ---------------------------------------------------------
   * PAGE
   * ---------------------------------------------------------
   */

  return (
    <main className="sq-page">
      <div className="sq-container">

        {/* NAVBAR */}

        <div className="navbar-wrap">
          <AppNavbar />
        </div>

        {/* HERO */}

        <section className="hero-card">
          <div className="hero-content">
            <div className="sq-badge">
              <span>🏆</span>
              Family Challenge Arena
            </div>

            <h1>
              Challenge your Family knowledge.
              <br />
              <span>Learn together. Grow together.</span>
            </h1>

            <p>
              Take on focused Sahaba challenges, race against the clock,
              build your score, and discover how much you really know.
            </p>

            <div className="hero-actions">
              <button
                type="button"
                onClick={scrollToChallenges}
                className="primary-btn"
              >
                Explore Family Challenges
                <span>→</span>
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-circle circle-one"></div>
            <div className="hero-circle circle-two"></div>

            <div className="trophy-card">
              <div className="trophy-icon">🏆</div>

              <div>
                <strong>Family Challenge Mode</strong>
                <span>Learn. Play. Grow together.</span>
              </div>
            </div>

            <div className="floating-card floating-card-one">
              <span>⚡</span>

              <div>
                <strong>Speed</strong>
                <small>Think fast</small>
              </div>
            </div>

            <div className="floating-card floating-card-two">
              <span>🎯</span>

              <div>
                <strong>Accuracy</strong>
                <small>Learn together</small>
              </div>
            </div>
          </div>
        </section>

        {/* STATS */}

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">🏆</div>

            <div>
              <span>Family Challenges</span>
              <strong>{challenges.length}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⚡</div>

            <div>
              <span>In Progress</span>
              <strong>{inProgressCount}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">✓</div>

            <div>
              <span>Completed</span>
              <strong>{completedCount}</strong>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon">⏱️</div>

            <div>
              <span>Timed</span>
              <strong>{timedCount}</strong>
            </div>
          </div>
        </section>

        {/* ERROR */}

        {errorMessage && (
          <div className="error-card">
            <div className="error-icon">!</div>

            <div>
              <strong>Something went wrong</strong>
              <p>{errorMessage}</p>
            </div>

            <button
              type="button"
              onClick={loadChallenges}
              className="retry-btn"
            >
              Try again
            </button>
          </div>
        )}

        {/* AVAILABLE CHALLENGES */}

        <section
          id="available-challenges"
          className="challenges-section"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                FAMILY CHALLENGE LIBRARY
              </span>

              <h2>Choose your Family challenge</h2>

              <p>
                Each challenge is designed to test a different part
                of your Family Sahaba knowledge.
              </p>
            </div>

            <div className="challenge-count">
              {challenges.length}{" "}
              {challenges.length === 1
                ? "challenge"
                : "challenges"}
            </div>
          </div>

          {loading ? (
            <div className="loading-card">
              <div className="loading-spinner"></div>

              <strong>Loading challenges...</strong>

              <p>
                Preparing your Family Challenge Arena.
              </p>
            </div>
          ) : challenges.length === 0 ? (
            <div className="empty-card">
              <div className="empty-icon">🏆</div>

              <h3>No challenges available yet</h3>

              <p>
                New challenges are being prepared. Check back soon,
                or continue your Family learning journey.
              </p>

              <Link href="/family-dashboard" className="primary-btn">
                Back to Family Dashboard
                <span>→</span>
              </Link>
            </div>
          ) : (
            <div className="challenge-grid">
              {challenges.map((challenge) => {
                const attempt = getFamilyChallengeAttempt(
                  challenge.id
                );

                const isComingSoon = isComingSoonChallenge(
                  challenge
                );

                const isLocked = false;

                const isCompleted =
                  attempt?.status === "completed";

                const isInProgress =
                  attempt?.status === "in_progress";

                const isStarting =
                  startingChallenge === challenge.id;

                const progress =
                  isInProgress && attempt
                    ? getProgressPercentage(attempt)
                    : 0;

                const passed =
                  isCompleted && attempt
                    ? getPassedStatus(attempt, challenge)
                    : false;

                return (
                  <article
                    key={challenge.id}
                    className={`challenge-card ${
                      isComingSoon
                        ? "challenge-coming-soon"
                        : isLocked
                          ? "challenge-locked"
                          : ""
                    } ${
                      isCompleted
                        ? passed
                          ? "challenge-passed"
                          : "challenge-failed"
                        : ""
                    }`}
                  >
                    {/* CARD TOP */}

                    <div className="challenge-top">
                      <div className="challenge-icon">
                        {challenge.icon || "🏆"}
                      </div>

                      {isComingSoon ? (
                        <span className="status-badge coming-soon-badge">
                          ✨ Coming Soon
                        </span>
                      ) : isLocked ? (
                        <span className="status-badge premium-badge">
                          👑 Family
                        </span>
                      ) : isInProgress ? (
                        <span className="status-badge progress-badge">
                          In Progress
                        </span>
                      ) : isCompleted ? (
                        passed ? (
                          <span className="status-badge passed-badge">
                            ✓ Passed
                          </span>
                        ) : (
                          <span className="status-badge failed-badge">
                            ✕ Failed
                          </span>
                        )
                      ) : (
                        <span className="status-badge ready-badge">
                          Ready
                        </span>
                      )}
                    </div>

                    {/* TYPE */}

                    <div className="challenge-type">
                      {formatChallengeType(
                        challenge.challenge_type
                      )}
                    </div>

                    {/* TITLE */}

                    <h3>{challenge.title}</h3>

                    {/* DESCRIPTION */}

                    <p className="challenge-description">
                      {challenge.description ||
                        "Test your knowledge with this focused Sahaba challenge."}
                    </p>

                    {/* META */}

                    <div className="challenge-meta">
                      <div className="meta-chip">
                        <span>📝</span>
                        {challenge.question_count} questions
                      </div>

                      <div className="meta-chip">
                        <span>⏱️</span>
                        {formatTime(
                          challenge.time_per_question
                        )}
                      </div>
                    </div>

                    {/* COMING SOON MESSAGE */}

                    {isComingSoon && (
                      <div className="coming-soon-panel">
                        <div className="coming-soon-panel-icon">
                          ✨
                        </div>

                        <div>
                          <strong>Questions are being prepared</strong>

                          <span>
                            This premium challenge will be available
                            soon.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* IN PROGRESS */}

                    {isInProgress && attempt && !isComingSoon && (
                      <div className="progress-area">
                        <div className="progress-header">
                          <span>Your progress</span>

                          <strong>
                            {progress}%
                          </strong>
                        </div>

                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${progress}%`,
                            }}
                          />
                        </div>

                        <small>
                          {attempt.questions_answered} of{" "}
                          {challenge.question_count} questions
                        </small>
                      </div>
                    )}

                    {/* COMPLETED RESULT */}

                    {isCompleted && attempt && !isComingSoon && (
                      <div
                        className={`completed-panel ${
                          passed
                            ? "passed-panel"
                            : "failed-panel"
                        }`}
                      >
                        <div
                          className={`completed-check ${
                            passed
                              ? "passed-check"
                              : "failed-check"
                          }`}
                        >
                          {passed ? "✓" : "✕"}
                        </div>

                        <div>
                          <strong>
                            {passed
                              ? "Challenge passed"
                              : "Challenge failed"}
                          </strong>

                          <span>
                            You answered{" "}
                            {attempt.correct_answers} of{" "}
                            {attempt.questions_answered}{" "}
                            correctly.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* RESULT SUMMARY */}

                    {isCompleted && attempt && !isComingSoon && (
                      <div className="result-summary">
                        <div>
                          <span>Score</span>

                          <strong>
                            {attempt.score}
                          </strong>
                        </div>

                        <div>
                          <span>Correct</span>

                          <strong>
                            {attempt.correct_answers}/
                            {attempt.questions_answered}
                          </strong>
                        </div>

                        <div>
                          <span>Result</span>

                          <strong
                            className={
                              passed
                                ? "result-passed"
                                : "result-failed"
                            }
                          >
                            {passed
                              ? "Passed"
                              : "Failed"}
                          </strong>
                        </div>
                      </div>
                    )}

                    {/* ACTION */}

                    {isComingSoon ? (
                      <button
                        type="button"
                        className="challenge-action coming-soon-action"
                        disabled
                      >
                        <span>✨</span>
                        Coming Soon
                      </button>
                    ) : isCompleted && attempt ? (
                      /*
                       * Completed challenges cannot be retaken.
                       * This button ONLY opens the saved result.
                       */

                      <button
                        type="button"
                        className={`completed-result-button ${
                          passed
                            ? "passed-result-button"
                            : "failed-result-button"
                        }`}
                        onClick={() =>
                          viewChallengeResult(
                            challenge.id,
                            attempt.id
                          )
                        }
                      >
                        <span>
                          {passed ? "✓" : "✕"}
                        </span>

                        {passed
                          ? "Passed — View Result"
                          : "Failed — View Result"}

                        <span>→</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`challenge-action ${
                          isLocked
                            ? "locked-action"
                            : ""
                        }`}
                        onClick={() =>
                          handleStartChallenge(
                            challenge
                          )
                        }
                        disabled={isStarting}
                      >
                        {isStarting ? (
                          <>
                            <span className="button-spinner"></span>
                            Starting...
                          </>
                        ) : isLocked ? (
                          <>
                            <span>🔒</span>
                            Family access required
                          </>
                        ) : isInProgress ? (
                          <>
                            Continue Challenge
                            <span>→</span>
                          </>
                        ) : (
                          <>
                            Start Challenge
                            <span>→</span>
                          </>
                        )}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* HOW IT WORKS */}

        <section className="how-section">
          <div className="section-heading centered">
            <span className="section-kicker">
              HOW IT WORKS
            </span>

            <h2>
              Challenge your family in three steps
            </h2>

            <p>
              Simple to start. Designed to make learning engaging.
            </p>
          </div>

          <div className="how-grid">
            <div className="how-card">
              <div className="how-number">01</div>

              <div className="how-icon">🎯</div>

              <h3>Pick a challenge</h3>

              <p>
                Choose a challenge that matches the topic or style
                you want to test yourself on.
              </p>
            </div>

            <div className="how-card">
              <div className="how-number">02</div>

              <div className="how-icon">⚡</div>

              <h3>Answer under pressure</h3>

              <p>
                Questions are timed, so trust your knowledge and
                answer as accurately as possible.
              </p>
            </div>

            <div className="how-card">
              <div className="how-number">03</div>

              <div className="how-icon">🏆</div>

              <h3>See your result</h3>

              <p>
                Review your performance, learn from your mistakes,
                and keep building your Sahaba knowledge.
              </p>
            </div>
          </div>
        </section>

        {/* BOTTOM CTA */}

        <section className="bottom-cta">
          <div>
            <span className="cta-small">
              FAMILY JOURNEY
            </span>

            <h2>
              Ready for your next Family Quest?
            </h2>

            <p>
              Play the main quiz and build your foundation before
              taking on the Family Challenge Arena.
            </p>
          </div>

          <Link
            href="/family-dashboard"
            className="cta-button"
          >
            Back to Family Dashboard
            <span>→</span>
          </Link>
        </section>

        {/* FOOTER */}

        <footer className="footer">
          <span>Sahaba Quest</span>
          <span>•</span>
          <span>
            Learn. Remember. Grow together.
          </span>
        </footer>
      </div>

      <style jsx>{`
        .sq-page {
          min-height: 100vh;
          background:
            radial-gradient(
              circle at top left,
              rgba(204, 245, 230, 0.85),
              transparent 34%
            ),
            radial-gradient(
              circle at top right,
              rgba(229, 248, 239, 0.9),
              transparent 32%
            ),
            #f7fbf9;
          color: #123b32;
        }

        .sq-container {
          width: min(1180px, calc(100% - 40px));
          margin: 0 auto;
          padding: 24px 0 50px;
        }

        .navbar-wrap {
          margin-bottom: 28px;
        }

        /* HERO */

        .hero-card {
          position: relative;
          min-height: 410px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          align-items: center;
          overflow: hidden;
          border: 1px solid #dcefe7;
          border-radius: 30px;
          padding: 50px;
          background:
            linear-gradient(
              135deg,
              #ffffff 0%,
              #f2fbf7 52%,
              #e7f7ef 100%
            );
          box-shadow: 0 20px 60px rgba(22, 85, 68, 0.08);
        }

        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 680px;
        }

        .sq-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 13px;
          border-radius: 999px;
          background: #e5f6ef;
          border: 1px solid #ccecdf;
          color: #0f6b56;
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 18px;
        }

        .hero-card h1 {
          margin: 0;
          font-size: clamp(36px, 5vw, 58px);
          line-height: 1.03;
          letter-spacing: -2px;
          color: #103e34;
        }

        .hero-card h1 span {
          color: #0d8066;
        }

        .hero-card p {
          max-width: 610px;
          margin: 20px 0 28px;
          font-size: 16px;
          line-height: 1.75;
          color: #638078;
        }

        .hero-actions {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
        }

        .primary-btn,
        .premium-btn,
        .cta-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          text-decoration: none;
          border-radius: 13px;
          padding: 13px 18px;
          font-size: 14px;
          font-weight: 800;
          transition: 0.2s ease;
        }

        .primary-btn {
          border: 0;
          cursor: pointer;
          background: #0c715a;
          color: white;
          box-shadow: 0 10px 25px rgba(12, 113, 90, 0.2);
        }

        .primary-btn:hover {
          transform: translateY(-2px);
          background: #095c49;
        }

        /* HERO VISUAL */

        .hero-visual {
          position: relative;
          height: 310px;
        }

        .hero-circle {
          position: absolute;
          border-radius: 50%;
        }

        .circle-one {
          width: 260px;
          height: 260px;
          right: 35px;
          top: 15px;
          background: #d5f0e4;
        }

        .circle-two {
          width: 150px;
          height: 150px;
          right: 0;
          bottom: 0;
          background: #c3e9d9;
        }

        .trophy-card {
          position: absolute;
          z-index: 3;
          top: 78px;
          right: 55px;
          width: 250px;
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 20px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid rgba(255, 255, 255, 0.9);
          box-shadow: 0 20px 50px rgba(18, 73, 59, 0.13);
        }

        .trophy-icon {
          width: 55px;
          height: 55px;
          display: grid;
          place-items: center;
          border-radius: 17px;
          background: #fff5d7;
          font-size: 29px;
        }

        .trophy-card strong,
        .floating-card strong {
          display: block;
          color: #173f36;
          font-size: 14px;
        }

        .trophy-card span {
          display: block;
          margin-top: 4px;
          color: #779087;
          font-size: 12px;
        }

        .floating-card {
          position: absolute;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 11px 14px;
          border-radius: 15px;
          background: white;
          box-shadow: 0 14px 35px rgba(18, 73, 59, 0.11);
        }

        .floating-card > span {
          font-size: 19px;
        }

        .floating-card small {
          display: block;
          margin-top: 2px;
          color: #82968f;
          font-size: 10px;
        }

        .floating-card-one {
          top: 35px;
          right: 245px;
        }

        .floating-card-two {
          bottom: 30px;
          right: 90px;
        }

        /* STATS */

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 15px;
          margin: 18px 0;
        }

        .stat-card {
          display: flex;
          align-items: center;
          gap: 13px;
          padding: 18px;
          border: 1px solid #e0eee9;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.85);
        }

        .stat-icon {
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 13px;
          background: #e7f6f0;
          font-size: 19px;
        }

        .stat-card span {
          display: block;
          color: #80948e;
          font-size: 11px;
          font-weight: 700;
        }

        .stat-card strong {
          display: block;
          margin-top: 3px;
          color: #123e34;
          font-size: 21px;
        }

        /* PREMIUM */

        .premium-notice {
          display: flex;
          align-items: center;
          gap: 15px;
          padding: 17px 19px;
          margin-bottom: 30px;
          border: 1px solid #f0dfad;
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            #fffdf5,
            #fff9e8
          );
        }

        .premium-icon {
          width: 45px;
          height: 45px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 14px;
          background: #fff1c6;
          font-size: 21px;
        }

        .premium-content {
          flex: 1;
        }

        .premium-content strong {
          color: #6d5420;
          font-size: 14px;
        }

        .premium-content p {
          margin: 4px 0 0;
          color: #8a7853;
          font-size: 12px;
          line-height: 1.5;
        }

        .premium-btn {
          flex-shrink: 0;
          background: #c99428;
          color: white;
        }

        .premium-btn:hover {
          transform: translateY(-2px);
        }

        /* ERROR */

        .error-card {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 24px;
          padding: 15px 17px;
          border: 1px solid #f1caca;
          border-radius: 16px;
          background: #fff7f7;
        }

        .error-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 50%;
          background: #fce0e0;
          color: #a63838;
          font-weight: 900;
        }

        .error-card strong {
          color: #813535;
          font-size: 13px;
        }

        .error-card p {
          margin: 2px 0 0;
          color: #9b6969;
          font-size: 12px;
        }

        .retry-btn {
          margin-left: auto;
          border: 1px solid #e5caca;
          border-radius: 10px;
          padding: 9px 13px;
          background: white;
          color: #853d3d;
          font-weight: 800;
          cursor: pointer;
        }

        /* SECTIONS */

        .challenges-section {
          margin-top: 38px;
          scroll-margin-top: 25px;
        }

        .section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 20px;
          margin-bottom: 20px;
        }

        .section-kicker,
        .cta-small {
          display: block;
          margin-bottom: 7px;
          color: #0d8066;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .section-heading h2 {
          margin: 0;
          color: #123f35;
          font-size: 28px;
          letter-spacing: -0.7px;
        }

        .section-heading p {
          margin: 7px 0 0;
          color: #81938d;
          font-size: 13px;
        }

        .challenge-count {
          padding: 9px 13px;
          border-radius: 999px;
          background: #e8f6f0;
          color: #16715c;
          font-size: 12px;
          font-weight: 800;
        }

        /* CHALLENGE GRID */

        .challenge-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .challenge-card {
          position: relative;
          display: flex;
          flex-direction: column;
          min-height: 390px;
          padding: 22px;
          border: 1px solid #dfeee8;
          border-radius: 22px;
          background: white;
          box-shadow: 0 10px 35px rgba(24, 80, 65, 0.055);
          transition: 0.22s ease;
        }

        .challenge-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 18px 45px rgba(24, 80, 65, 0.09);
        }

        .challenge-coming-soon {
          border-color: #ddd8c9;
          background: linear-gradient(
            180deg,
            #ffffff,
            #faf9f4
          );
        }

        .challenge-coming-soon:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 38px rgba(80, 73, 50, 0.07);
        }

        .challenge-coming-soon .challenge-icon {
          background: #f3f0e5;
        }

        .challenge-locked {
          border-color: #efdfb4;
          background: linear-gradient(
            180deg,
            #fffef9,
            #fffaf0
          );
        }

        .challenge-passed {
          border-color: #bfe2d0;
          background: linear-gradient(
            180deg,
            #ffffff,
            #f5fbf8
          );
        }

        .challenge-failed {
          border-color: #edc5c5;
          background: linear-gradient(
            180deg,
            #ffffff,
            #fff8f8
          );
        }

        .challenge-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .challenge-icon {
          width: 53px;
          height: 53px;
          display: grid;
          place-items: center;
          border-radius: 16px;
          background: #e8f6f0;
          font-size: 25px;
        }

        .challenge-locked .challenge-icon {
          background: #fff0c8;
        }

        .challenge-passed .challenge-icon {
          background: #def2e7;
        }

        .challenge-failed .challenge-icon {
          background: #fce4e4;
        }

        .status-badge {
          padding: 6px 9px;
          border-radius: 999px;
          font-size: 9px;
          font-weight: 900;
          letter-spacing: 0.2px;
        }

        .ready-badge {
          background: #e8f6f0;
          color: #16715c;
        }

        .progress-badge {
          background: #e8efff;
          color: #47649c;
        }

        .passed-badge {
          background: #dff3e7;
          color: #23724f;
        }

        .failed-badge {
          background: #fde2e2;
          color: #ad3d3d;
        }

        .premium-badge {
          background: #fff0c8;
          color: #8b681f;
        }

        .coming-soon-badge {
          background: #eeeae0;
          color: #756b55;
        }

        .challenge-type {
          margin-top: 20px;
          color: #0d8066;
          font-size: 10px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1.1px;
        }

        .challenge-card h3 {
          margin: 7px 0 7px;
          color: #173f36;
          font-size: 20px;
          letter-spacing: -0.3px;
        }

        .challenge-description {
          min-height: 57px;
          margin: 0;
          color: #7a8f88;
          font-size: 12px;
          line-height: 1.6;
        }

        .challenge-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
          margin-top: 17px;
        }

        .meta-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 9px;
          border-radius: 9px;
          background: #f4f8f6;
          color: #627870;
          font-size: 10px;
          font-weight: 700;
        }

        /* COMING SOON */

        .coming-soon-panel {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 16px;
          padding: 11px;
          border: 1px solid #e7e1d3;
          border-radius: 12px;
          background: #f8f6ef;
        }

        .coming-soon-panel-icon {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 50%;
          background: #eee9dc;
          font-size: 14px;
        }

        .coming-soon-panel strong {
          display: block;
          color: #685f4e;
          font-size: 11px;
        }

        .coming-soon-panel span {
          display: block;
          margin-top: 2px;
          color: #918873;
          font-size: 9px;
          line-height: 1.4;
        }

        /* PROGRESS */

        .progress-area {
          margin-top: 16px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 6px;
          color: #71857e;
          font-size: 10px;
        }

        .progress-header strong {
          color: #0d8066;
        }

        .progress-track {
          height: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: #e6efeb;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: #0d8066;
          transition: width 0.3s ease;
        }

        .progress-area small {
          display: block;
          margin-top: 5px;
          color: #8b9b96;
          font-size: 9px;
        }

        /* COMPLETED PANEL */

        .completed-panel {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 15px;
          padding: 11px;
          border-radius: 12px;
        }

        .passed-panel {
          border: 1px solid #d3ebde;
          background: #eff9f4;
        }

        .failed-panel {
          border: 1px solid #f0d2d2;
          background: #fff2f2;
        }

        .completed-check {
          width: 31px;
          height: 31px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 50%;
          font-weight: 900;
        }

        .passed-check {
          background: #d7efe2;
          color: #247750;
        }

        .failed-check {
          background: #f8dede;
          color: #ad3c3c;
        }

        .completed-panel strong {
          display: block;
          font-size: 11px;
        }

        .passed-panel strong {
          color: #2a604d;
        }

        .failed-panel strong {
          color: #913b3b;
        }

        .completed-panel span {
          display: block;
          margin-top: 2px;
          color: #789088;
          font-size: 9px;
        }

        /* RESULT */

        .result-summary {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          margin-top: 10px;
          padding: 10px;
          border-radius: 12px;
          background: #f7faf8;
        }

        .result-summary div {
          text-align: center;
        }

        .result-summary span {
          display: block;
          color: #8b9b96;
          font-size: 8px;
        }

        .result-summary strong {
          display: block;
          margin-top: 3px;
          color: #254e44;
          font-size: 11px;
        }

        .result-passed {
          color: #23724f !important;
        }

        .result-failed {
          color: #ad3d3d !important;
        }

        /* ACTION */

        .challenge-action,
        .completed-result-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: auto;
          padding: 12px 14px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 900;
        }

        .challenge-action {
          border: 0;
          background: #0d715a;
          color: white;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .challenge-action:hover:not(:disabled) {
          background: #095d4a;
          transform: translateY(-1px);
        }

        .challenge-action:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .locked-action {
          background: #bd8c29;
        }

        .locked-action:hover:not(:disabled) {
          background: #a77a20;
        }

        .coming-soon-action {
          background: #e9e5da;
          color: #756b55;
          cursor: default;
          box-shadow: none;
        }

        .coming-soon-action:hover {
          background: #e9e5da;
          transform: none;
        }

        .coming-soon-action:disabled {
          opacity: 1;
        }

        /*
         * RESULT BUTTONS
         *
         * These do NOT start a challenge.
         * They only open the saved result.
         */

        .completed-result-button {
          border: 0;
          cursor: pointer;
          color: white;
          transition: 0.2s ease;
        }

        .completed-result-button:hover {
          transform: translateY(-1px);
        }

        .passed-result-button {
          background: #238052;
          box-shadow: 0 8px 18px rgba(35, 128, 82, 0.16);
        }

        .passed-result-button:hover {
          background: #1b6d45;
        }

        .failed-result-button {
          background: #c44949;
          box-shadow: 0 8px 18px rgba(196, 73, 73, 0.15);
        }

        .failed-result-button:hover {
          background: #ad3939;
        }

        .button-spinner,
        .loading-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        /* LOADING */

        .loading-card,
        .empty-card {
          min-height: 250px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 35px;
          border: 1px solid #dfeee8;
          border-radius: 22px;
          background: white;
        }

        .loading-spinner {
          width: 28px;
          height: 28px;
          margin-bottom: 15px;
          border-color: #cfe5dc;
          border-top-color: #0d8066;
        }

        .loading-card strong,
        .empty-card h3 {
          color: #254e44;
        }

        .loading-card p,
        .empty-card p {
          max-width: 440px;
          margin: 6px 0 20px;
          color: #81938d;
          font-size: 13px;
          line-height: 1.6;
        }

        .empty-icon {
          width: 60px;
          height: 60px;
          display: grid;
          place-items: center;
          margin-bottom: 12px;
          border-radius: 18px;
          background: #e8f6f0;
          font-size: 28px;
        }

        .empty-card h3 {
          margin: 0;
        }

        /* HOW */

        .how-section {
          margin-top: 70px;
        }

        .centered {
          display: block;
          text-align: center;
        }

        .centered p {
          margin-left: auto;
          margin-right: auto;
        }

        .how-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 17px;
          margin-top: 24px;
        }

        .how-card {
          position: relative;
          padding: 26px;
          border: 1px solid #e0eee9;
          border-radius: 20px;
          background: white;
          overflow: hidden;
        }

        .how-number {
          position: absolute;
          top: 17px;
          right: 20px;
          color: #e2eee9;
          font-size: 30px;
          font-weight: 900;
        }

        .how-icon {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          margin-bottom: 20px;
          border-radius: 15px;
          background: #e8f6f0;
          font-size: 22px;
        }

        .how-card h3 {
          margin: 0 0 8px;
          color: #214a40;
          font-size: 17px;
        }

        .how-card p {
          margin: 0;
          color: #7f918b;
          font-size: 12px;
          line-height: 1.7;
        }

        /* CTA */

        .bottom-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 25px;
          margin-top: 55px;
          padding: 34px 38px;
          border-radius: 24px;
          background: #123f35;
          box-shadow: 0 18px 45px rgba(18, 63, 53, 0.16);
        }

        .bottom-cta .cta-small {
          color: #9dd9c4;
        }

        .bottom-cta h2 {
          margin: 0;
          color: white;
          font-size: 25px;
          letter-spacing: -0.5px;
        }

        .bottom-cta p {
          max-width: 610px;
          margin: 8px 0 0;
          color: #bad3cb;
          font-size: 12px;
          line-height: 1.6;
        }

        .cta-button {
          flex-shrink: 0;
          background: white;
          color: #12483b;
        }

        .cta-button:hover {
          transform: translateY(-2px);
        }

        /* FOOTER */

        .footer {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 35px;
          color: #9aaba6;
          font-size: 10px;
        }

        .footer span:first-child {
          color: #55736a;
          font-weight: 800;
        }

        /* RESPONSIVE */

        @media (max-width: 1050px) {
          .hero-card {
            grid-template-columns: 1fr;
            padding: 40px;
          }

          .hero-visual {
            display: none;
          }

          .challenge-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 800px) {
          .sq-container {
            width: min(100% - 28px, 680px);
            padding-top: 15px;
          }

          .hero-card {
            min-height: auto;
            padding: 32px 25px;
            border-radius: 24px;
          }

          .hero-card h1 {
            font-size: 38px;
            letter-spacing: -1.3px;
          }

          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .premium-notice {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .premium-btn {
            width: 100%;
          }

          .challenge-grid {
            grid-template-columns: 1fr;
          }

          .how-grid {
            grid-template-columns: 1fr;
          }

          .bottom-cta {
            flex-direction: column;
            align-items: flex-start;
            padding: 28px;
          }

          .cta-button {
            width: 100%;
          }
        }

        @media (max-width: 520px) {
          .sq-container {
            width: calc(100% - 20px);
          }

          .hero-card {
            padding: 27px 20px;
          }

          .hero-card h1 {
            font-size: 33px;
          }

          .hero-card p {
            font-size: 14px;
          }

          .hero-actions {
            flex-direction: column;
          }

          .primary-btn {
            width: 100%;
          }

          .stats-grid {
            gap: 9px;
          }

          .stat-card {
            padding: 13px;
            gap: 9px;
          }

          .stat-icon {
            width: 37px;
            height: 37px;
            border-radius: 11px;
          }

          .stat-card strong {
            font-size: 18px;
          }

          .section-heading {
            align-items: flex-start;
            flex-direction: column;
          }

          .section-heading h2 {
            font-size: 24px;
          }

          .challenge-card {
            padding: 18px;
          }

          .footer {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </main>
  );
}