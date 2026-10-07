"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type Question = {
  id: string;
  level: number;
  question: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  explanation: string | null;
  question_type:
    | "multiple_choice"
    | "fill_blank";
};

type QuestSession = {
  id: string;
  level: number;
  score: number;
  questions_answered: number;
  correct_answers: number;
  status:
    | "active"
    | "completed"
    | "abandoned";
};

type QuestResult = {
  success: boolean;
  is_correct: boolean;
  timed_out: boolean;
  correct_answer: string;
  question_type: string;
  xp_earned: number;
  current_streak: number;
  best_streak: number;
  level_completed: boolean;
  level_passed: boolean;
  current_level: number;
  questions_answered_in_level: number;
  correct_answers_in_attempt: number;
  questions_required: number;
  correct_required_to_pass: number;
  response_time_ms: number;
};

const options = [
  ["A", "option_a"],
  ["B", "option_b"],
  ["C", "option_c"],
  ["D", "option_d"],
] as const;

const QUESTION_TIME_MS = 15000;

export default function SchoolStudentQuestPage() {
  const router = useRouter();

  const [session, setSession] =
    useState<QuestSession | null>(null);

  const [question, setQuestion] =
    useState<Question | null>(null);

  const [questionNumber, setQuestionNumber] =
    useState(1);

  const [totalQuestions, setTotalQuestions] =
    useState(50);

  const [timeLeft, setTimeLeft] =
    useState(15);

  const [selectedAnswer, setSelectedAnswer] =
    useState("");

  const [result, setResult] =
    useState<QuestResult | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [message, setMessage] =
    useState("");

  /*
   * ---------------------------------------------------------
   * Refs used to prevent duplicate answer submissions.
   * ---------------------------------------------------------
   *
   * React state updates are asynchronous.
   *
   * The timer and answer button can theoretically fire
   * within the same event window before `submitting` becomes
   * true.
   *
   * These refs provide an immediate synchronous lock.
   */

  const questionStartedAt =
    useRef<string | null>(null);

  const questionTimeMsRef =
    useRef(QUESTION_TIME_MS);

  // The server returns the authoritative deadline and server clock.
  // These refs prevent browser/server clock drift from shortening the
  // visible timer or causing a premature timeout.

  const questionDeadlineAt =
    useRef<string | null>(null);

  const serverClockOffsetMs =
    useRef(0);

  const answerSubmittedRef =
    useRef(false);

  const submissionInProgressRef =
    useRef(false);

  /*
   * ---------------------------------------------------------
   * Quest initialization lock
   * ---------------------------------------------------------
   *
   * React development mode can run effects more than once.
   * Without an immediate ref lock, two startQuest() calls can
   * race and two question requests can overwrite the active
   * question in the database.
   */

  const questInitializationRef =
    useRef(false);

  /*
   * ---------------------------------------------------------
   * Load the next question
   * ---------------------------------------------------------
   */

  const loadQuestion = useCallback(
    async (sessionId: string) => {
      /*
       * Reset all question-specific submission state
       * BEFORE requesting the new question.
       */

      submissionInProgressRef.current = false;
      answerSubmittedRef.current = false;

      questionDeadlineAt.current = null;
      serverClockOffsetMs.current = 0;

      setSubmitting(false);
      setSelectedAnswer("");
      setResult(null);
      setMessage("");

      const currentToken =
        typeof window !== "undefined"
          ? sessionStorage.getItem(
              "school_student_session_token"
            )
          : null;

      if (!currentToken) {
        router.replace(
          "/schools/student-login"
        );
        return;
      }

      const questionRequestStartedAtMs =
        Date.now();

      const response = await fetch(
        "/api/schools/student-quest/question",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${currentToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            session_id: sessionId,
          }),
          cache: "no-store",
        }
      );

      const questionResponseReceivedAtMs =
        Date.now();

      const data =
        await response
          .json()
          .catch(() => ({}));

      /*
       * Session expired.
       */

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
        response.status === 400 &&
        data?.code === "QUESTION_NOT_ACTIVE"
      ) {
        /*
         * The server is authoritative. If a stale request reaches
         * this point, silently reconcile by asking for the current
         * active question again instead of showing a technical error.
         */

        await new Promise((resolve) =>
          window.setTimeout(resolve, 100)
        );

        const retryRequestStartedAtMs =
          Date.now();

        const retryResponse = await fetch(
          "/api/schools/student-quest/question",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${currentToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id: sessionId,
            }),
            cache: "no-store",
          }
        );

        const retryResponseReceivedAtMs =
          Date.now();

        const retryData =
          await retryResponse
            .json()
            .catch(() => ({}));

        if (retryResponse.status === 401) {
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

        if (!retryResponse.ok) {
          if (
            retryResponse.status === 400 &&
            retryData?.code ===
              "QUESTION_NOT_ACTIVE"
          ) {
            /*
             * Keep technical synchronization states completely hidden
             * from the student. A later Next Question click can retry.
             */

            setMessage("");
            return;
          }

          throw new Error(
            retryData.message ||
              "We could not load your next question."
          );
        }

        setQuestion(
          retryData.question
        );

        setQuestionNumber(
          retryData.question_number
        );

        setTotalQuestions(
          retryData.total_questions
        );

        questionStartedAt.current =
          retryData.question_started_at;

        const retryStartedAtMs =
          new Date(
            retryData.question_started_at
          ).getTime();

        const retryTimeMs =
          Number(
            retryData.time_per_question
          ) > 0
            ? Number(
                retryData.time_per_question
              ) * 1000
            : QUESTION_TIME_MS;

        questionTimeMsRef.current =
          retryTimeMs;

        const retryServerNowMs =
          retryData.server_now_at
            ? new Date(
                retryData.server_now_at
              ).getTime()
            : Date.now();

        const retryRequestMidpointMs =
          (
            retryRequestStartedAtMs +
            retryResponseReceivedAtMs
          ) / 2;

        serverClockOffsetMs.current =
          Number.isFinite(
            retryServerNowMs
          )
            ? retryServerNowMs -
              retryRequestMidpointMs
            : 0;

        const retryDeadlineAt =
          retryData.question_deadline_at ||
          new Date(
            retryStartedAtMs +
              retryTimeMs
          ).toISOString();

        questionDeadlineAt.current =
          retryDeadlineAt;

        const retryDeadlineMs =
          new Date(
            retryDeadlineAt
          ).getTime();

        const retryRemainingMs =
          retryDeadlineMs -
          (
            Date.now() +
            serverClockOffsetMs.current
          );

        setTimeLeft(
          Math.max(
            0,
            Math.ceil(
              retryRemainingMs /
                1000
            )
          )
        );

        answerSubmittedRef.current =
          false;

        submissionInProgressRef.current =
          false;

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "We could not load your next question."
        );
      }

      setQuestion(
        data.question
      );

      setQuestionNumber(
        data.question_number
      );

      setTotalQuestions(
        data.total_questions
      );

      questionStartedAt.current =
        data.question_started_at;

      /*
       * The server deadline is authoritative.
       *
       * The browser may have a slightly different clock from the
       * server, so also keep the server's current timestamp and use
       * it to estimate the clock offset for the visible countdown.
       */

      const startedAtMs =
        new Date(
          data.question_started_at
        ).getTime();

      const questionTimeMs =
        Number(
          data.time_per_question
        ) > 0
          ? Number(
              data.time_per_question
            ) * 1000
          : QUESTION_TIME_MS;

      questionTimeMsRef.current =
        questionTimeMs;

      const serverNowMs =
        data.server_now_at
          ? new Date(
              data.server_now_at
            ).getTime()
          : Date.now();

      const questionRequestMidpointMs =
        (
          questionRequestStartedAtMs +
          questionResponseReceivedAtMs
        ) / 2;

      serverClockOffsetMs.current =
        Number.isFinite(
          serverNowMs
        )
          ? serverNowMs -
            questionRequestMidpointMs
          : 0;

      const deadlineAt =
        data.question_deadline_at ||
        new Date(
          startedAtMs +
            questionTimeMs
        ).toISOString();

      questionDeadlineAt.current =
        deadlineAt;

      const deadlineMs =
        new Date(
          deadlineAt
        ).getTime();

      const remainingMs =
        deadlineMs -
        (
          Date.now() +
          serverClockOffsetMs.current
        );

      const remainingSeconds =
        Math.max(
          0,
          Math.ceil(
            remainingMs /
              1000
          )
        );

      setTimeLeft(
        remainingSeconds
      );

      /*
       * The new question is now active.
       */

      answerSubmittedRef.current =
        false;

      submissionInProgressRef.current =
        false;
    },
    [router]
  );

  /*
   * ---------------------------------------------------------
   * Start or resume Quest
   * ---------------------------------------------------------
   */

  const startQuest = useCallback(
    async () => {
      const currentToken =
        typeof window !== "undefined"
          ? sessionStorage.getItem(
              "school_student_session_token"
            )
          : null;

      if (!currentToken) {
        router.replace(
          "/schools/student-login"
        );

        return;
      }

      setLoading(true);
      setMessage("");

      try {
        const response =
          await fetch(
            "/api/schools/student-quest/start",
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${currentToken}`,
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({}),
              cache: "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(() => ({}));

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

        if (!response.ok) {
          throw new Error(
            data.message ||
              "We could not start your Quest."
          );
        }

        setSession(
          data.session
        );

        await loadQuestion(
          data.session.id
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not start your Quest."
        );
      } finally {
        setLoading(false);
      }
    },
    [loadQuestion, router]
  );

  /*
   * ---------------------------------------------------------
   * Start Quest when page opens
   * ---------------------------------------------------------
   */

  useEffect(() => {
    /*
     * Prevent duplicate Quest initialization.
     *
     * In React development mode, effects may be invoked more
     * than once. The synchronous ref prevents a second
     * startQuest() request from creating a question-loading race.
     */

    if (
      questInitializationRef.current
    ) {
      return;
    }

    questInitializationRef.current =
      true;

    void startQuest();
  }, [startQuest]);

  /*
   * ---------------------------------------------------------
   * Countdown timer
   * ---------------------------------------------------------
   *
   * The server deadline is the source of truth.
   *
   * The browser estimates the server's current time using the
   * server_now_at value returned with the question. This avoids
   * relying on the browser clock alone when the two clocks differ.
   */

  useEffect(() => {
    if (
      !question ||
      !questionStartedAt.current ||
      !questionDeadlineAt.current ||
      result ||
      submitting ||
      answerSubmittedRef.current ||
      submissionInProgressRef.current
    ) {
      return;
    }

    const deadlineMs =
      new Date(
        questionDeadlineAt.current
      ).getTime();

    if (
      !Number.isFinite(
        deadlineMs
      )
    ) {
      return;
    }

    const updateTimer = () => {
      const estimatedServerNowMs =
        Date.now() +
        serverClockOffsetMs.current;

      const remainingMs =
        deadlineMs -
        estimatedServerNowMs;

      const remainingSeconds =
        Math.max(
          0,
          Math.ceil(
            remainingMs /
              1000
          )
        );

      setTimeLeft(
        remainingSeconds
      );

      if (
        remainingMs <= 0 &&
        !answerSubmittedRef.current &&
        !submissionInProgressRef.current
      ) {
        void submitAnswer(
          "",
          null
        );
      }
    };

    updateTimer();

    const timer =
      window.setInterval(
        updateTimer,
        100
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    question,
    result,
    submitting,
  ]);

  /*
   * ---------------------------------------------------------
   * Submit answer
   * ---------------------------------------------------------
   */

  async function submitAnswer(
    answer: string,
    clientClickedAt: string | null =
      new Date().toISOString()
  ) {
    /*
     * First and most important protection:
     *
     * This synchronous ref prevents both the timer and
     * answer button from submitting the same question.
     */

    if (
      answerSubmittedRef.current ||
      submissionInProgressRef.current
    ) {
      return;
    }

    if (
      !question ||
      !session
    ) {
      return;
    }

    const currentToken =
      typeof window !== "undefined"
        ? sessionStorage.getItem(
            "school_student_session_token"
          )
        : null;

    if (!currentToken) {
      router.replace(
        "/schools/student-login"
      );

      return;
    }

    /*
     * Lock immediately.
     *
     * Do NOT wait for React's setState().
     */

    submissionInProgressRef.current =
      true;

    setSubmitting(true);

    /*
     * Preserve the student's selected answer.
     *
     * For timeout submissions this is intentionally empty.
     */

    setSelectedAnswer(
      answer
    );

    try {
      const response =
        await fetch(
          "/api/schools/student-quest/answer",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${currentToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id:
                session.id,
              question_id:
                question.id,
              selected_answer:
                answer,
              client_clicked_at:
                clientClickedAt,
              client_clock_offset_ms:
                serverClockOffsetMs.current,
            }),
            cache: "no-store",
          }
        );

      const data =
        await response
          .json()
          .catch(() => ({}));

      /*
       * Session expired.
       */

      if (
        response.status === 401
      ) {
        submissionInProgressRef.current =
          false;

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

      /*
       * Duplicate answer / inactive question.
       *
       * This should normally never happen anymore because
       * the synchronous ref prevents the frontend race.
       */

      if (
        response.status === 400 &&
        data?.code ===
          "QUESTION_NOT_ACTIVE"
      ) {
        /*
         * The server has already advanced this question.
         * Never expose this technical state to the student.
         */

        console.warn(
          "School Quest received QUESTION_NOT_ACTIVE; ignoring stale submission.",
          data
        );

        answerSubmittedRef.current =
          true;

        submissionInProgressRef.current =
          false;

        setSubmitting(false);
        setMessage("");

        return;
      }

      if (
        response.status === 409
      ) {
        /*
         * Duplicate submissions are safely rejected by the backend.
         * They should never become a visible technical error.
         */

        console.warn(
          "School Quest duplicate answer prevented:",
          data
        );

        answerSubmittedRef.current =
          true;

        submissionInProgressRef.current =
          false;

        setSubmitting(false);
        setMessage("");

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "We could not submit your answer."
        );
      }

      /*
       * The server accepted the answer.
       *
       * Permanently mark this question as submitted
       * before updating the UI.
       */

      answerSubmittedRef.current =
        true;

      submissionInProgressRef.current =
        false;

      setResult(data);

      /*
       * Update the local Quest session state.
       *
       * The database remains the source of truth.
       */

      setSession(
        (current) =>
          current
            ? {
                ...current,
                score:
                  current.score +
                  data.xp_earned,
                questions_answered:
                  data.questions_answered_in_level,
                correct_answers:
                  data.correct_answers_in_attempt,
                status:
                  data.level_completed
                    ? "completed"
                    : "active",
              }
            : current
      );

      /*
       * IMPORTANT:
       *
       * The submission is finished, so re-enable the UI.
       *
       * `answerSubmittedRef` remains TRUE, meaning the timer
       * still cannot submit this question again.
       */

      setSubmitting(false);
    } catch (error) {
      /*
       * Only unlock the question when the request genuinely
       * failed before the server accepted the answer.
       */

      submissionInProgressRef.current =
        false;

      setSubmitting(false);

      setMessage(
        error instanceof Error
          ? error.message
          : "We could not submit your answer."
      );
    }
  }

  /*
   * ---------------------------------------------------------
   * Move to next question / result page
   * ---------------------------------------------------------
   */

  async function nextQuestion() {
    if (
      !session ||
      !result
    ) {
      return;
    }

    if (
      result.level_completed
    ) {
      router.replace(
        `/schools/student-quest/result?passed=${
          result.level_passed
            ? "1"
            : "0"
        }&level=${
          result.current_level
        }&xp=${
          result.xp_earned
        }&correct=${
          result.correct_answers_in_attempt
        }`
      );

      return;
    }

    try {
      setMessage("");

      await loadQuestion(
        session.id
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the next question."
      );

      setSubmitting(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * Loading screen
   * ---------------------------------------------------------
   */

  if (
    loading &&
    !question
  ) {
    return (
      <main className="sq-quest-page">
        <div className="sq-quest-loading">
          <div className="sq-quest-logo">
            SQ
          </div>

          <h1>
            Bismillah — preparing your Quest...
          </h1>

          <p>
            May Allah increase you in
            beneficial knowledge.
          </p>
        </div>

        <QuestStyles />
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * Error state
   * ---------------------------------------------------------
   */

  if (
    !question ||
    !session
  ) {
    return (
      <main className="sq-quest-page">
        <div className="sq-quest-error">
          <h1>
            Assalamu Alaikum
          </h1>

          <p>
            {message ||
              "Your Quest could not be loaded."}
          </p>

          <button
            onClick={startQuest}
          >
            Try Again
          </button>

          <button
            className="secondary"
            onClick={() =>
              router.push(
                "/schools/student-dashboard"
              )
            }
          >
            Back to Dashboard
          </button>
        </div>

        <QuestStyles />
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * Main Quest interface
   * ---------------------------------------------------------
   */

  return (
    <main className="sq-quest-page">
      <header className="sq-quest-header">
        <button
          className="sq-quest-back"
          onClick={() =>
            router.push(
              "/schools/student-dashboard"
            )
          }
        >
          ← Dashboard
        </button>

        <div className="sq-quest-brand">
          Sahaba Quest
        </div>

        <div className="sq-quest-level">
          Level {session.level}
        </div>
      </header>

      <div className="sq-quest-shell">
        <div className="sq-quest-top">
          <div>
            <span>
              YOUR QUEST
            </span>

            <strong>
              Question{" "}
              {questionNumber} of{" "}
              {totalQuestions}
            </strong>
          </div>

          <div
            className={`sq-timer ${
              timeLeft <= 5
                ? "danger"
                : ""
            }`}
          >
            {timeLeft}s
          </div>
        </div>

        <div className="sq-quest-progress">
          <div
            style={{
              width: `${
                (questionNumber /
                  totalQuestions) *
                100
              }%`,
            }}
          />
        </div>

        <section className="sq-question-card">
          <span className="sq-question-label">
            LEVEL {question.level}
          </span>

          <h1>
            {question.question}
          </h1>

          <div className="sq-answer-grid">
            {options.map(
              ([letter, key]) => {
                const value =
                  question[key];

                if (!value) {
                  return null;
                }

                const isSelected =
                  selectedAnswer ===
                  value;

                const isCorrect =
                  result?.correct_answer ===
                  value;

                const isWrong =
                  result &&
                  isSelected &&
                  !result.is_correct;

                return (
                  <button
                    key={letter}
                    className={[
                      "sq-answer",
                      isSelected
                        ? "selected"
                        : "",
                      result &&
                      isCorrect
                        ? "correct"
                        : "",
                      isWrong
                        ? "wrong"
                        : "",
                    ].join(" ")}
                    onClick={() =>
                      submitAnswer(
                        value
                      )
                    }
                    disabled={
                      !!result ||
                      submitting ||
                      answerSubmittedRef.current ||
                      submissionInProgressRef.current
                    }
                  >
                    <span className="sq-answer-letter">
                      {letter}
                    </span>

                    <span>
                      {value}
                    </span>
                  </button>
                );
              }
            )}
          </div>

          {result && (
            <div
              className={`sq-result ${
                result.is_correct
                  ? "good"
                  : "bad"
              }`}
            >
              <strong>
                {result.timed_out
                  ? "Time is up."
                  : result.is_correct
                  ? `MashaAllah! +${result.xp_earned} XP`
                  : "Not quite — keep learning."}
              </strong>

              <span>
                Correct answer:{" "}
                <b>
                  {result.correct_answer}
                </b>
              </span>

              {result.level_completed && (
                <span>
                  {result.level_passed
                    ? `You passed Level ${session.level}.`
                    : `You need ${result.correct_required_to_pass} correct answers to pass this level.`}
                </span>
              )}

              <button
                onClick={
                  nextQuestion
                }
              >
                {result.level_completed
                  ? "View Result"
                  : "Next Question →"}
              </button>
            </div>
          )}
        </section>

        {message && (
          <div className="sq-quest-message">
            {message}
          </div>
        )}
      </div>

      <QuestStyles />
    </main>
  );
}

/*
 * ============================================================
 * Sahaba Quest Quest Styles
 * ============================================================
 */

function QuestStyles() {
  return (
    <style jsx global>{`
      .sq-quest-page {
        min-height: 100vh;
        background: #f7f9f8;
        color: #17221d;
      }

      .sq-quest-header {
        min-height: 70px;
        background: #ffffff;
        border-bottom: 1px solid #e2e8e5;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 28px;
      }

      .sq-quest-back {
        border: 0;
        background: transparent;
        color: #0f766e;
        font-weight: 800;
        cursor: pointer;
      }

      .sq-quest-brand {
        font-weight: 900;
        color: #115e59;
      }

      .sq-quest-level {
        font-weight: 800;
        color: #64746d;
      }

      .sq-quest-shell {
        width: min(
          900px,
          calc(100% - 32px)
        );
        margin: 30px auto 60px;
      }

      .sq-quest-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .sq-quest-top span,
      .sq-question-label {
        display: block;
        font-size: 11px;
        letter-spacing: 0.1em;
        font-weight: 900;
        color: #0f766e;
      }

      .sq-quest-top strong {
        display: block;
        margin-top: 5px;
        font-size: 18px;
      }

      .sq-timer {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: grid;
        place-items: center;
        background: #ccfbf1;
        color: #115e59;
        font-weight: 900;
        border: 4px solid
          rgba(15, 118, 110, 0.14);
      }

      .sq-timer.danger {
        background: #fee2e2;
        color: #b91c1c;
      }

      .sq-quest-progress {
        height: 8px;
        background: #e2e8e5;
        border-radius: 99px;
        overflow: hidden;
        margin-bottom: 18px;
      }

      .sq-quest-progress > div {
        height: 100%;
        background:
          linear-gradient(
            90deg,
            #0f766e,
            #d4a72c
          );
        border-radius: inherit;
        transition:
          width 0.2s ease;
      }

      .sq-question-card {
        background: #ffffff;
        border: 1px solid #e2e8e5;
        border-radius: 24px;
        padding: 36px;
        box-shadow:
          0 18px 45px
          rgba(15, 118, 110, 0.08);
      }

      .sq-question-card h1 {
        margin: 12px 0 28px;
        font-size: clamp(
          24px,
          4vw,
          36px
        );
        line-height: 1.25;
        letter-spacing: -0.03em;
      }

      .sq-answer-grid {
        display: grid;
        gap: 12px;
      }

      .sq-answer {
        min-height: 68px;
        border: 1px solid #dbe5e1;
        background: #ffffff;
        border-radius: 16px;
        padding: 12px 16px;
        display: flex;
        align-items: center;
        gap: 14px;
        text-align: left;
        font-size: 15px;
        font-weight: 700;
        color: #26352e;
        cursor: pointer;
        transition:
          0.18s ease;
      }

      .sq-answer:hover:not(
          :disabled
        ) {
        border-color: #0f766e;
        background: #f0fdfa;
        transform: translateY(
          -1px
        );
      }

      .sq-answer.selected {
        border-color: #0f766e;
        background: #ecfdf5;
      }

      .sq-answer.correct {
        border-color: #16a34a;
        background: #f0fdf4;
      }

      .sq-answer.wrong {
        border-color: #dc2626;
        background: #fef2f2;
      }

      .sq-answer-letter {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        display: grid;
        place-items: center;
        background: #f0fdfa;
        color: #0f766e;
        font-weight: 900;
        flex: 0 0 auto;
      }

      .sq-result {
        margin-top: 20px;
        border-radius: 16px;
        padding: 18px;
        display: grid;
        gap: 7px;
      }

      .sq-result.good {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
      }

      .sq-result.bad {
        background: #fff7ed;
        border: 1px solid #fed7aa;
      }

      .sq-result button,
      .sq-quest-error button {
        margin-top: 10px;
        width: fit-content;
        border: 0;
        border-radius: 10px;
        padding: 11px 17px;
        background: #0f766e;
        color: #ffffff;
        font-weight: 800;
        cursor: pointer;
      }

      .sq-quest-error {
        min-height: 100vh;
        display: grid;
        place-items: center;
        align-content: center;
        gap: 10px;
        text-align: center;
        padding: 24px;
      }

      .sq-quest-error .secondary {
        background: #ffffff;
        color: #0f766e;
        border: 1px solid #dbe5e1;
      }

      .sq-quest-loading {
        min-height: 100vh;
        display: grid;
        place-items: center;
        align-content: center;
        text-align: center;
        gap: 10px;
      }

      .sq-quest-logo {
        width: 62px;
        height: 62px;
        border-radius: 18px;
        display: grid;
        place-items: center;
        background: #0f766e;
        color: #ffffff;
        font-weight: 900;
      }

      .sq-quest-message {
        margin-top: 14px;
        padding: 12px 15px;
        border-radius: 12px;
        background: #fef2f2;
        color: #991b1b;
        border: 1px solid #fecaca;
      }

      @media (max-width: 640px) {
        .sq-quest-header {
          padding: 0 16px;
        }

        .sq-quest-brand {
          font-size: 14px;
        }

        .sq-quest-shell {
          width: min(
            100% - 20px,
            900px
          );
          margin-top: 20px;
        }

        .sq-question-card {
          padding: 22px 16px;
          border-radius: 18px;
        }

        .sq-answer {
          min-height: 62px;
        }
      }
    `}</style>
  );
}