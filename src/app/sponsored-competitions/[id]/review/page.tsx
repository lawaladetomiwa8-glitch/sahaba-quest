"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type ReviewRow = {
  question_number: number;
  question_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  selected_option: string | null;
  selected_answer: string;
  correct_option: string;
  correct_answer: string;
  is_correct: boolean;
};


export default function SponsoredCompetitionReviewPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const competitionId = params.id;
  const attemptId = searchParams.get("attempt") || "";

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [savingReview, setSavingReview] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadReview() {
      setLoading(true);
      setErrorMessage("");

      if (!attemptId) {
        if (active) {
          setErrorMessage(
            "We could not identify this competition attempt. Please return to your completed competition and open the review again."
          );
          setLoading(false);
        }
        return;
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser();

      if (authError || !authData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase.rpc(
        "get_sponsored_answer_review",
        { p_attempt_id: attemptId }
      );

      if (!active) return;

      if (error) {
        setErrorMessage(error.message);
        setRows([]);
        setLoading(false);
        return;
      }

      const reviewRows = (Array.isArray(data) ? data : []) as ReviewRow[];

      if (reviewRows.length === 0) {
        setErrorMessage(
          "No answer review was found for this attempt. If you have just completed the competition, refresh this page and try again."
        );
      } else {
        setRows(reviewRows);
      }

      setLoading(false);
    }

    void loadReview();

    return () => {
      active = false;
    };
  }, [attemptId, router]);

  const summary = useMemo(() => {
    const correct = rows.filter((row) => row.is_correct).length;
    return {
      correct,
      incorrect: rows.length - correct,
      total: rows.length,
    };
  }, [rows]);

  async function confirmReviewAndContinue() {
    if (!attemptId || savingReview || rows.length === 0) return;

    setSavingReview(true);
    setErrorMessage("");

    const { error } = await supabase.rpc(
      "complete_sponsored_answer_review",
      { p_attempt_id: attemptId }
    );

    if (error) {
      setErrorMessage(error.message);
      setSavingReview(false);
      return;
    }

    router.replace(
      `/sponsored-competitions/${competitionId}/leaderboard`
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 60, textAlign: "center" }}>
        <div style={{ fontSize: 35 }}>⏳</div>
        <h3>Preparing your answer review...</h3>
      </main>
    );
  }

  if (errorMessage) {
    return (
      <main style={{ padding: 30 }}>
        <section
          className="sq-card"
          style={{ maxWidth: 700, margin: "30px auto", padding: 28 }}
        >
          <h1 className="sq-title">Unable to load your review</h1>
          <p className="sq-subtitle">{errorMessage}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="sq-button-primary"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            <Link
              href={`/sponsored-competitions/${competitionId}`}
              className="sq-button-secondary"
            >
              Back to Competition
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={{ paddingBottom: 40 }}>
      <section
        className="sq-card"
        style={{ maxWidth: 900, margin: "24px auto", padding: 24 }}
      >
        <span className="sq-badge">Sponsored Competition</span>
        <h1 className="sq-title" style={{ marginTop: 12 }}>
          Review Your Answers
        </h1>
        <p className="sq-subtitle">
          Here is a breakdown of the questions assigned to you, the answers you
          selected, and the correct answers. Use this review to learn from the
          competition.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            margin: "24px 0",
          }}
        >
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>CORRECT</div>
            <div style={{ ...summaryValueStyle, color: "#15803d" }}>
              {summary.correct}
            </div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>INCORRECT</div>
            <div style={{ ...summaryValueStyle, color: "#dc2626" }}>
              {summary.incorrect}
            </div>
          </div>
          <div style={summaryCardStyle}>
            <div style={summaryLabelStyle}>QUESTIONS</div>
            <div style={summaryValueStyle}>{summary.total}</div>
          </div>
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          {rows.map((row, index) => {
            const options = [
              ["a", row.option_a],
              ["b", row.option_b],
              ["c", row.option_c],
              ["d", row.option_d],
            ] as const;

            return (
              <article
                key={row.question_id}
                className="sq-card"
                style={{ padding: 20, border: "1px solid var(--border)" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <span className="sq-badge">
                    Question {row.question_number || index + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: row.is_correct ? "#15803d" : "#dc2626",
                    }}
                  >
                    {row.is_correct ? "✓ Correct" : "✕ Incorrect"}
                  </span>
                </div>

                <h2 style={{ fontSize: 18, lineHeight: 1.55, margin: 0 }}>
                  {row.question_text}
                </h2>

                <div style={{ display: "grid", gap: 9, marginTop: 18 }}>
                  {options.map(([letter, optionText]) => {
                    const isSelected = row.selected_option?.toLowerCase() === letter;
                    const isCorrect = row.correct_option?.toLowerCase() === letter;
                    const background = isCorrect
                      ? "rgba(22, 163, 74, 0.09)"
                      : isSelected
                        ? "rgba(220, 38, 38, 0.08)"
                        : "var(--background)";
                    const borderColor = isCorrect
                      ? "#16a34a"
                      : isSelected
                        ? "#dc2626"
                        : "var(--border)";

                    return (
                      <div
                        key={letter}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                          padding: "12px 14px",
                          border: `1px solid ${borderColor}`,
                          borderRadius: 11,
                          background,
                        }}
                      >
                        <strong style={{ textTransform: "uppercase" }}>
                          {letter}.
                        </strong>
                        <span style={{ flex: 1 }}>{optionText}</span>
                        {isCorrect && (
                          <span
                            style={{ color: "#15803d", fontSize: 12, fontWeight: 800 }}
                          >
                            Correct answer
                          </span>
                        )}
                        {isSelected && !isCorrect && (
                          <span
                            style={{ color: "#dc2626", fontSize: 12, fontWeight: 800 }}
                          >
                            Your answer
                          </span>
                        )}
                        {isSelected && isCorrect && (
                          <span
                            style={{ color: "#15803d", fontSize: 12, fontWeight: 800 }}
                          >
                            Your answer
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {!row.selected_option && (
                  <p style={{ color: "#dc2626", fontSize: 13, marginBottom: 0 }}>
                    You did not submit an answer for this question.
                  </p>
                )}
              </article>
            );
          })}
        </div>

        <div
          style={{
            marginTop: 30,
            padding: 20,
            border: "1px solid var(--border)",
            borderRadius: 14,
            textAlign: "center",
            background: "var(--background)",
          }}
        >
          <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>
            You have reached the end of your answer review
          </h2>
          <p className="sq-subtitle" style={{ margin: "0 0 18px" }}>
            Confirm that you have reviewed the questions and answers above.
            Your score, Sponsored XP, and ranking will not be changed.
          </p>
          <button
            type="button"
            className="sq-button-primary"
            onClick={() => void confirmReviewAndContinue()}
            disabled={savingReview}
            style={{
              border: 0,
              cursor: savingReview ? "wait" : "pointer",
              opacity: savingReview ? 0.65 : 1,
            }}
          >
            {savingReview
              ? "Saving your review..."
              : "✓ I've Reviewed My Answers — Continue to Leaderboard"}
          </button>
          {errorMessage && (
            <p role="alert" style={{ color: "#dc2626", marginTop: 12 }}>
              {errorMessage}
            </p>
          )}
          <div style={{ marginTop: 14 }}>
            <Link
              href={`/sponsored-competitions/${competitionId}`}
              className="sq-button-secondary"
            >
              Competition Details
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 600px) {
          main {
            padding-left: 12px;
            padding-right: 12px;
          }
        }
      `}</style>
    </main>
  );
}

const summaryCardStyle: CSSProperties = {
  padding: 16,
  border: "1px solid var(--border)",
  borderRadius: 12,
  textAlign: "center",
};

const summaryLabelStyle: CSSProperties = {
  fontSize: 10,
  color: "var(--muted)",
  fontWeight: 800,
  letterSpacing: "0.06em",
};

const summaryValueStyle: CSSProperties = {
  fontSize: 29,
  fontWeight: 900,
  marginTop: 5,
};