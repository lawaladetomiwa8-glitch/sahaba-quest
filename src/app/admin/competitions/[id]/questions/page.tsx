"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Question = {
  id: string;
  competition_id: string;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  time_limit_seconds: number;
  base_xp: number;
  created_at: string;
  updated_at: string;
};

type QuestionForm = {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: "a" | "b" | "c" | "d";
  timeLimitSeconds: string;
  baseXp: string;
};

const emptyForm: QuestionForm = {
  questionText: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
  correctOption: "a",
  timeLimitSeconds: "15",
  baseXp: "100",
};

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

function optionLabel(option: "a" | "b" | "c" | "d") {
  return option.toUpperCase();
}

export default function SponsoredQuestionsPage() {
  const params = useParams<{ id: string }>();
  const competitionId = params.id;

  const [competitionTitle, setCompetitionTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState<QuestionForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadQuestions() {
    setLoading(true);
    setErrorMessage("");

    const [competitionResult, questionsResult] =
      await Promise.all([
        supabase
          .from("sponsored_competitions")
          .select("id,title")
          .eq("id", competitionId)
          .maybeSingle(),

        supabase
          .from("sponsored_questions")
          .select(
            "id,competition_id,question_number,question_text,option_a,option_b,option_c,option_d,correct_option,time_limit_seconds,base_xp,created_at,updated_at"
          )
          .eq("competition_id", competitionId)
          .order("question_number", { ascending: true }),
      ]);

    if (competitionResult.error) {
      setErrorMessage(competitionResult.error.message);
      setLoading(false);
      return;
    }

    if (!competitionResult.data) {
      setErrorMessage("Competition not found.");
      setLoading(false);
      return;
    }

    if (questionsResult.error) {
      setErrorMessage(questionsResult.error.message);
      setLoading(false);
      return;
    }

    setCompetitionTitle(competitionResult.data.title);
    setQuestions((questionsResult.data ?? []) as Question[]);
    setLoading(false);
  }

  useEffect(() => {
    loadQuestions();
  }, [competitionId]);

  const nextQuestionNumber = useMemo(() => {
    if (questions.length === 0) return 1;

    return (
      Math.max(
        ...questions.map((question) => question.question_number)
      ) + 1
    );
  }, [questions]);

  function updateForm(
    field: keyof QuestionForm,
    value: string
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setErrorMessage("");
  }

  function startEditing(question: Question) {
    setEditingId(question.id);
    setForm({
      questionText: question.question_text,
      optionA: question.option_a,
      optionB: question.option_b,
      optionC: question.option_c,
      optionD: question.option_d,
      correctOption: question.correct_option,
      timeLimitSeconds: String(question.time_limit_seconds),
      baseXp: String(question.base_xp),
    });

    setSuccessMessage("");
    setErrorMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const questionText = form.questionText.trim();
    const optionA = form.optionA.trim();
    const optionB = form.optionB.trim();
    const optionC = form.optionC.trim();
    const optionD = form.optionD.trim();

    if (!questionText) {
      setErrorMessage("Question text is required.");
      return;
    }

    if (!optionA || !optionB || !optionC || !optionD) {
      setErrorMessage(
        "All four answer options are required."
      );
      return;
    }

    const timeLimit = Number.parseInt(
      form.timeLimitSeconds,
      10
    );

    const baseXp = Number.parseInt(form.baseXp, 10);

    if (
      !Number.isInteger(timeLimit) ||
      timeLimit < 1 ||
      timeLimit > 3600
    ) {
      setErrorMessage(
        "Time limit must be between 1 and 3600 seconds."
      );
      return;
    }

    if (
      !Number.isInteger(baseXp) ||
      baseXp < 0 ||
      baseXp > 100000
    ) {
      setErrorMessage(
        "Base XP must be between 0 and 100,000."
      );
      return;
    }

    setSaving(true);

    try {
      if (editingId) {
        const { error } = await supabase
          .from("sponsored_questions")
          .update({
            question_text: questionText,
            option_a: optionA,
            option_b: optionB,
            option_c: optionC,
            option_d: optionD,
            correct_option: form.correctOption,
            time_limit_seconds: timeLimit,
            base_xp: baseXp,
          })
          .eq("id", editingId)
          .eq("competition_id", competitionId);

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setSuccessMessage("Question updated successfully.");
      } else {
        const { error } = await supabase
          .from("sponsored_questions")
          .insert({
            competition_id: competitionId,
            question_number: nextQuestionNumber,
            question_text: questionText,
            option_a: optionA,
            option_b: optionB,
            option_c: optionC,
            option_d: optionD,
            correct_option: form.correctOption,
            time_limit_seconds: timeLimit,
            base_xp: baseXp,
          });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        setSuccessMessage(
          `Question ${nextQuestionNumber} added successfully.`
        );
      }

      resetForm();
      await loadQuestions();
    } catch (error: any) {
      setErrorMessage(
        error?.message ||
          "Unable to save the question. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteQuestion(question: Question) {
    const confirmed = window.confirm(
      `Delete Question ${question.question_number}? This cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingId(question.id);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { error } = await supabase
        .from("sponsored_questions")
        .delete()
        .eq("id", question.id)
        .eq("competition_id", competitionId);

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      if (editingId === question.id) {
        resetForm();
      }

      setSuccessMessage(
        `Question ${question.question_number} deleted.`
      );

      await loadQuestions();
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <main style={{ textAlign: "center", padding: 60 }}>
        <div style={{ fontSize: 38 }}>⏳</div>
        <h3>Loading questions...</h3>
      </main>
    );
  }

  return (
    <main>
      <div style={{ marginBottom: 22 }}>
        <Link
          href={`/admin/competitions/${competitionId}`}
          style={{
            textDecoration: "none",
            color: "var(--muted)",
            fontSize: 13,
            fontWeight: 800,
          }}
        >
          ← Back to Competition
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginTop: 14,
          }}
        >
          <div>
            <span className="sq-badge">Questions</span>
            <h1
              className="sq-title"
              style={{ marginTop: 10, marginBottom: 6 }}
            >
              {competitionTitle}
            </h1>
            <p className="sq-subtitle" style={{ margin: 0 }}>
              Create and manage the manually authored questions
              for this sponsored competition.
            </p>
          </div>

          <div
            style={{
              padding: "10px 13px",
              borderRadius: 10,
              border: "1px solid var(--border)",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {questions.length}{" "}
            {questions.length === 1 ? "Question" : "Questions"}
          </div>
        </div>
      </div>

      {errorMessage && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 18,
          }}
        >
          <strong>Notice</strong>
          <p
            className="sq-subtitle"
            style={{ marginBottom: 0 }}
          >
            {errorMessage}
          </p>
        </div>
      )}

      {successMessage && (
        <div
          className="sq-card"
          style={{
            padding: 16,
            marginBottom: 18,
          }}
        >
          <strong>✓ {successMessage}</strong>
        </div>
      )}

      <section
        className="sq-card"
        style={{
          padding: 24,
          marginBottom: 22,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 20,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              {editingId
                ? "Edit Question"
                : `Add Question ${nextQuestionNumber}`}
            </h2>

            <p className="sq-subtitle" style={{ marginBottom: 0 }}>
              Each question has one correct answer, a time limit
              and a base XP value.
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              className="sq-button-secondary"
              onClick={resetForm}
              style={{
                border: "1px solid var(--border)",
                cursor: "pointer",
              }}
            >
              Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>
              Question *
            </label>

            <textarea
              style={{
                ...inputStyle,
                minHeight: 110,
                resize: "vertical",
              }}
              value={form.questionText}
              onChange={(e) =>
                updateForm(
                  "questionText",
                  e.target.value
                )
              }
              placeholder="Enter the question exactly as players should see it."
              required
            />
          </div>

          <div
            className="options-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",
              gap: 16,
            }}
          >
            {(
              [
                ["a", "optionA", "Option A"],
                ["b", "optionB", "Option B"],
                ["c", "optionC", "Option C"],
                ["d", "optionD", "Option D"],
              ] as const
            ).map(([letter, field, label]) => (
              <div key={field}>
                <label style={labelStyle}>
                  {label} *
                </label>

                <input
                  style={inputStyle}
                  value={form[field]}
                  onChange={(e) =>
                    updateForm(field, e.target.value)
                  }
                  placeholder={`Enter ${label.toLowerCase()}`}
                  required
                />
              </div>
            ))}
          </div>

          <div
            className="settings-grid"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(3,minmax(0,1fr))",
              gap: 16,
              marginTop: 18,
            }}
          >
            <div>
              <label style={labelStyle}>
                Correct Answer *
              </label>

              <select
                style={inputStyle}
                value={form.correctOption}
                onChange={(e) =>
                  updateForm(
                    "correctOption",
                    e.target.value
                  )
                }
              >
                <option value="a">Option A</option>
                <option value="b">Option B</option>
                <option value="c">Option C</option>
                <option value="d">Option D</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>
                Time Limit (seconds) *
              </label>

              <input
                style={inputStyle}
                type="number"
                min="1"
                max="3600"
                value={form.timeLimitSeconds}
                onChange={(e) =>
                  updateForm(
                    "timeLimitSeconds",
                    e.target.value
                  )
                }
                required
              />
            </div>

            <div>
              <label style={labelStyle}>
                Base XP *
              </label>

              <input
                style={inputStyle}
                type="number"
                min="0"
                max="100000"
                value={form.baseXp}
                onChange={(e) =>
                  updateForm("baseXp", e.target.value)
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
              border: "1px solid var(--border)",
              background: "var(--background)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            <strong>Speed scoring:</strong> when a player
            answers correctly, the system uses the remaining
            time to calculate the speed bonus. Wrong answers
            receive 0 XP.
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 20,
            }}
          >
            <button
              type="submit"
              className="sq-button-primary"
              disabled={saving}
              style={{
                border: 0,
                cursor: saving
                  ? "not-allowed"
                  : "pointer",
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving
                ? "Saving..."
                : editingId
                ? "Update Question"
                : `Add Question ${nextQuestionNumber}`}
            </button>
          </div>
        </form>
      </section>

      <section
        className="sq-card"
        style={{ overflow: "hidden" }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <h2 style={{ margin: 0 }}>
            Competition Questions
          </h2>
          <p className="sq-subtitle" style={{ marginBottom: 0 }}>
            Players will receive these questions in this order.
          </p>
        </div>

        {questions.length === 0 ? (
          <div
            style={{
              padding: 55,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 44 }}>❓</div>
            <h3>No questions yet</h3>
            <p className="sq-subtitle">
              Add the first question above.
            </p>
          </div>
        ) : (
          <div>
            {questions.map((question) => (
              <article
                key={question.id}
                style={{
                  padding: "22px 24px",
                  borderBottom:
                    "1px solid var(--border)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      flex: "1 1 500px",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        minWidth: 38,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background:
                          "var(--primary-light)",
                        color: "var(--primary)",
                        fontWeight: 900,
                      }}
                    >
                      {question.question_number}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <h3
                        style={{
                          margin: 0,
                          lineHeight: 1.45,
                        }}
                      >
                        {question.question_text}
                      </h3>

                      <div
                        className="answer-grid"
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(2,minmax(0,1fr))",
                          gap: 8,
                          marginTop: 14,
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
                          const correct =
                            question.correct_option ===
                            letter;

                          return (
                            <div
                              key={letter}
                              style={{
                                padding: "9px 10px",
                                borderRadius: 8,
                                border: correct
                                  ? "1px solid var(--primary)"
                                  : "1px solid var(--border)",
                                background: correct
                                  ? "var(--primary-light)"
                                  : "transparent",
                                fontSize: 12,
                              }}
                            >
                              <strong>
                                {optionLabel(letter)}.
                              </strong>{" "}
                              {text}
                              {correct && (
                                <span
                                  style={{
                                    marginLeft: 6,
                                    fontWeight: 900,
                                  }}
                                >
                                  ✓
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 14,
                          flexWrap: "wrap",
                          marginTop: 12,
                          color: "var(--muted)",
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        <span>
                          ⏱{" "}
                          {question.time_limit_seconds}s
                        </span>
                        <span>
                          ⭐ {question.base_xp} base XP
                        </span>
                        <span>
                          Correct:{" "}
                          {optionLabel(
                            question.correct_option
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                    }}
                  >
                    <button
                      type="button"
                      className="sq-button-secondary"
                      onClick={() =>
                        startEditing(question)
                      }
                      style={{
                        border:
                          "1px solid var(--border)",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="sq-button-secondary"
                      onClick={() =>
                        deleteQuestion(question)
                      }
                      disabled={
                        deletingId === question.id
                      }
                      style={{
                        border:
                          "1px solid var(--border)",
                        cursor:
                          deletingId === question.id
                            ? "not-allowed"
                            : "pointer",
                        opacity:
                          deletingId === question.id
                            ? 0.6
                            : 1,
                      }}
                    >
                      {deletingId === question.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <style jsx>{`
        @media (max-width: 760px) {
          .options-grid,
          .settings-grid,
          .answer-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
