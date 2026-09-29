"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  useParams,
  useSearchParams,
  useRouter,
} from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type CurrentQuestion = {
  id: string;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  time_limit_seconds: number;
  remaining_ms: number;
  base_xp: number;
};

type SubmitResult = {
  success?: boolean;
  completed?: boolean;
  expired?: boolean;
  total_xp?: number;
  xp_awarded?: number;
  correct?: boolean;
  correct_answers?: number;
  total_questions?: number;
  next_question_number?: number;
  message?: string;
};

export default function SponsoredCompetitionPlayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const competitionId = params.id;
  const attemptFromUrl = searchParams.get("attempt");

  const [attemptId, setAttemptId] = useState(
    attemptFromUrl || ""
  );

  const [question, setQuestion] =
    useState<CurrentQuestion | null>(null);

  const [selected, setSelected] = useState<
    "a" | "b" | "c" | "d" | null
  >(null);

  const [timeLeftMs, setTimeLeftMs] = useState(0);
  const [totalXp, setTotalXp] = useState(0);
  const [completed, setCompleted] = useState(false);

  const [lastResult, setLastResult] =
    useState<SubmitResult | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const submittedRef = useRef(false);

  /*
   * ---------------------------------------------------------
   * LOAD CURRENT QUESTION
   * ---------------------------------------------------------
   */
  const loadQuestion = useCallback(
    async (id: string) => {
      setMessage("");
      setSelected(null);

      const { data, error } = await supabase.rpc(
        "get_sponsored_current_question",
        {
          p_attempt_id: id,
        }
      );

      if (error) {
        /*
         * Important:
         * Clear the old question so an expired/inactive attempt
         * cannot leave a stale question visible on screen.
         */
        setQuestion(null);
        setTimeLeftMs(0);
        submittedRef.current = false;

        setMessage(error.message);
        return;
      }

      if (
        !data ||
        (Array.isArray(data) && data.length === 0)
      ) {
        setQuestion(null);
        setTimeLeftMs(0);
        submittedRef.current = false;

        setMessage(
          "No active question was returned. Your attempt may already be complete or expired."
        );

        return;
      }

      const row = Array.isArray(data) ? data[0] : data;

      setQuestion(row as CurrentQuestion);

      setTimeLeftMs(
        Number(
          row.remaining_ms ??
            row.time_limit_seconds * 1000
        )
      );

      submittedRef.current = false;
    },
    []
  );

  /*
   * ---------------------------------------------------------
   * START / RESUME COMPETITION
   * ---------------------------------------------------------
   */
  useEffect(() => {
    let mounted = true;

    async function start() {
      const { data: auth } =
        await supabase.auth.getUser();

      if (!auth.user) {
        router.replace("/login");
        return;
      }

      /*
       * If an attempt ID already exists in the URL,
       * resume that attempt.
       *
       * Otherwise create/resume one through the secure RPC.
       */
      let id = attemptFromUrl;

      if (!id) {
        const { data, error } =
          await supabase.rpc(
            "start_sponsored_competition",
            {
              p_competition_id: competitionId,
            }
          );

        if (error) {
          if (mounted) {
            setMessage(error.message);
            setLoading(false);
          }

          return;
        }

        id = data?.attempt_id || "";
      }

      if (!id) {
        if (mounted) {
          setMessage(
            "Unable to start the competition."
          );

          setLoading(false);
        }

        return;
      }

      if (mounted) {
        setAttemptId(id);
      }

      await loadQuestion(id);

      if (mounted) {
        setLoading(false);
      }
    }

    void start();

    return () => {
      mounted = false;
    };
  }, [
    attemptFromUrl,
    competitionId,
    loadQuestion,
    router,
  ]);

  /*
   * ---------------------------------------------------------
   * COUNTDOWN TIMER
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      !question ||
      completed ||
      submitting
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      setTimeLeftMs((current) => {
        if (current <= 100) {
          window.clearInterval(timer);
          return 0;
        }

        return current - 100;
      });
    }, 100);

    return () =>
      window.clearInterval(timer);
  }, [
    question,
    completed,
    submitting,
  ]);

  /*
   * ---------------------------------------------------------
   * AUTOMATIC TIMEOUT SUBMISSION
   * ---------------------------------------------------------
   */
  useEffect(() => {
    if (
      !question ||
      completed ||
      submitting ||
      timeLeftMs > 0
    ) {
      return;
    }

    void submitAnswer(null);
  }, [
    timeLeftMs,
    question,
    completed,
    submitting,
  ]);

  /*
   * ---------------------------------------------------------
   * SUBMIT ANSWER
   * ---------------------------------------------------------
   */
  async function submitAnswer(
    option: "a" | "b" | "c" | "d" | null
  ) {
    if (
      !attemptId ||
      !question ||
      submittedRef.current ||
      submitting
    ) {
      return;
    }

    submittedRef.current = true;
    setSubmitting(true);
    setMessage("");

    try {
      const { data, error } =
        await supabase.rpc(
          "submit_sponsored_answer",
          {
            p_attempt_id: attemptId,
            p_question_id: question.id,
            p_selected_option: option,
          }
        );

      if (error) {
        submittedRef.current = false;
        setMessage(error.message);
        return;
      }

      const result =
        (data || {}) as SubmitResult;

      setLastResult(result);

      if (
        typeof result.total_xp === "number"
      ) {
        setTotalXp(result.total_xp);
      }

      /*
       * Competition finished or attempt expired.
       */
      if (
        result.completed ||
        result.expired
      ) {
        setCompleted(true);
        setQuestion(null);
        setTimeLeftMs(0);
        return;
      }

      /*
       * Move to the next question.
       */
      await loadQuestion(attemptId);
    } finally {
      setSubmitting(false);
    }
  }

  /*
   * ---------------------------------------------------------
   * SELECT ANSWER
   * ---------------------------------------------------------
   */
  function choose(
    option: "a" | "b" | "c" | "d"
  ) {
    if (
      submitting ||
      completed ||
      !question
    ) {
      return;
    }

    setSelected(option);
  }

  /*
   * ---------------------------------------------------------
   * SUBMIT SELECTED ANSWER
   * ---------------------------------------------------------
   */
  function submitSelected() {
    void submitAnswer(selected);
  }

  /*
   * ---------------------------------------------------------
   * LOADING
   * ---------------------------------------------------------
   */
  if (loading) {
    return (
      <main
        style={{
          padding: 60,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 35 }}>
          ⏳
        </div>

        <h3>
          Preparing your competition...
        </h3>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * COMPLETED / EXPIRED SCREEN
   * ---------------------------------------------------------
   */
  if (completed) {
    return (
      <main>
        <section
          className="sq-card"
          style={{
            maxWidth: 700,
            margin: "30px auto",
            padding: 30,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 55,
            }}
          >
            🏆
          </div>

          <h1 className="sq-title">
            Competition Complete
          </h1>

          <p className="sq-subtitle">
            Your attempt has been recorded.
            Your Sponsored XP is separate from
            your normal Sahaba Quest XP.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,1fr)",
              gap: 12,
              margin: "24px 0",
            }}
          >
            <div
              style={{
                padding: 18,
                border:
                  "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  fontWeight: 800,
                }}
              >
                SPONSORED XP
              </div>

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  marginTop: 5,
                }}
              >
                {totalXp}
              </div>
            </div>

            <div
              style={{
                padding: 18,
                border:
                  "1px solid var(--border)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  fontWeight: 800,
                }}
              >
                RESULT
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  marginTop: 10,
                }}
              >
                {lastResult?.expired
                  ? "Expired"
                  : "Submitted"}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Link
              href={`/sponsored-competitions/${competitionId}/leaderboard`}
              className="sq-button-primary"
            >
              🏆 View Sponsored Leaderboard
            </Link>

            <Link
              href={`/sponsored-competitions/${competitionId}`}
              className="sq-button-secondary"
            >
              Competition
            </Link>

            <Link
              href="/sponsored-competitions"
              className="sq-button-secondary"
            >
              Sponsored Competitions
            </Link>
          </div>
        </section>
      </main>
    );
  }

  /*
   * ---------------------------------------------------------
   * NO ACTIVE QUESTION
   * ---------------------------------------------------------
   */
  if (!question) {
    return (
      <main
        style={{
          padding: 40,
          textAlign: "center",
        }}
      >
        <div
          className="sq-card"
          style={{
            padding: 30,
            maxWidth: 650,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              fontSize: 45,
            }}
          >
            ⏱️
          </div>

          <h2>
            This attempt is no longer active
          </h2>

          <p className="sq-subtitle">
            {message ||
              "There is no active question for this attempt."}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              flexWrap: "wrap",
              marginTop: 18,
            }}
          >
            <Link
              href={`/sponsored-competitions/${competitionId}`}
              className="sq-button-secondary"
            >
              Back to Competition
            </Link>

            <Link
              href={`/sponsored-competitions/${competitionId}/leaderboard`}
              className="sq-button-primary"
            >
              🏆 View Leaderboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const seconds = Math.ceil(
    timeLeftMs / 1000
  );

  const timerPercentage =
    question.time_limit_seconds > 0
      ? Math.max(
          0,
          Math.min(
            100,
            (timeLeftMs /
              (question.time_limit_seconds *
                1000)) *
              100
          )
        )
      : 0;

  /*
   * ---------------------------------------------------------
   * QUESTION SCREEN
   * ---------------------------------------------------------
   */
  return (
    <main>
      <section
        className="sq-card"
        style={{
          padding: 20,
          marginBottom: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div>
            <span className="sq-badge">
              Sponsored Competition
            </span>

            <div
              style={{
                marginTop: 8,
                fontSize: 13,
                color: "var(--muted)",
                fontWeight: 800,
              }}
            >
              Question{" "}
              {question.question_number}
            </div>
          </div>

          <div
            style={{
              minWidth: 70,
              padding: "10px 12px",
              borderRadius: 12,
              textAlign: "center",
              border:
                "1px solid var(--border)",
              background:
                seconds <= 5
                  ? "var(--primary-light)"
                  : "var(--background)",
              fontWeight: 900,
              fontSize: 18,
            }}
          >
            {seconds}s
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            height: 7,
            borderRadius: 999,
            background: "var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${timerPercentage}%`,
              height: "100%",
              background:
                "var(--primary)",
              transition:
                "width .1s linear",
            }}
          />
        </div>
      </section>

      {message && (
        <section
          className="sq-card"
          style={{
            padding: 15,
            marginBottom: 18,
          }}
        >
          <strong>Notice</strong>

          <p
            className="sq-subtitle"
            style={{
              marginBottom: 0,
            }}
          >
            {message}
          </p>
        </section>
      )}

      <section
        className="sq-card"
        style={{
          padding: 26,
          maxWidth: 850,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            fontSize: 25,
            lineHeight: 1.4,
            marginTop: 0,
          }}
        >
          {question.question_text}
        </h1>

        <div
          style={{
            display: "grid",
            gap: 12,
            marginTop: 24,
          }}
        >
          {(
            [
              ["a", question.option_a],
              ["b", question.option_b],
              ["c", question.option_c],
              ["d", question.option_d],
            ] as const
          ).map(([letter, text]) => {
            const active =
              selected === letter;

            return (
              <button
                key={letter}
                type="button"
                onClick={() =>
                  choose(letter)
                }
                disabled={submitting}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "16px 17px",
                  border: active
                    ? "2px solid var(--primary)"
                    : "1px solid var(--border)",
                  borderRadius: 12,
                  background: active
                    ? "var(--primary-light)"
                    : "var(--background)",
                  color: "inherit",
                  cursor: submitting
                    ? "not-allowed"
                    : "pointer",
                  fontSize: 14,
                  fontWeight: active
                    ? 800
                    : 600,
                }}
              >
                <span
                  style={{
                    display:
                      "inline-flex",
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    marginRight: 10,
                    background: active
                      ? "var(--primary)"
                      : "var(--border)",
                    color: active
                      ? "#fff"
                      : "inherit",
                    fontWeight: 900,
                  }}
                >
                  {letter.toUpperCase()}
                </span>

                {text}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="sq-button-primary"
          onClick={submitSelected}
          disabled={
            !selected || submitting
          }
          style={{
            width: "100%",
            border: 0,
            cursor:
              !selected || submitting
                ? "not-allowed"
                : "pointer",
            marginTop: 22,
            opacity:
              !selected || submitting
                ? 0.6
                : 1,
          }}
        >
          {submitting
            ? "Submitting..."
            : "Submit Answer"}
        </button>

        <p
          className="sq-subtitle"
          style={{
            textAlign: "center",
            marginBottom: 0,
            marginTop: 14,
          }}
        >
          Correct answers earn base XP
          plus a speed bonus based on your
          remaining time. Wrong answers earn
          0 XP.
        </p>
      </section>

      <style jsx>{`
        @media (max-width: 600px) {
          .sq-card {
            width: 100%;
            box-sizing: border-box;
          }
        }
      `}</style>
    </main>
  );
}