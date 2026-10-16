
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type QuestionStatus = "draft" | "published" | "archived";
type ActivityStatus = "draft" | "published" | "closed";
type ActivityType = "classwork" | "test" | "assignment";
type Difficulty = "easy" | "medium" | "hard";

type SchoolClass = {
  id: string;
  class_name: string;
  description: string | null;
  academic_session: string | null;
  status: string;
};

type Question = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string | null;
  topic: string | null;
  difficulty: Difficulty;
  status: QuestionStatus;
  created_at: string;
  updated_at: string;
};

type Activity = {
  id: string;
  title: string;
  instructions: string | null;
  activity_type: ActivityType;
  status: ActivityStatus;
  due_at: string | null;
  created_at: string;
  class_ids: string[];
  question_ids: string[];
  question_count: number;
};

type QuestionForm = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "A" | "B" | "C" | "D";
  explanation: string;
  topic: string;
  difficulty: Difficulty;
};

type ActivityForm = {
  title: string;
  instructions: string;
  activity_type: ActivityType;
  due_at: string;
  class_ids: string[];
  question_ids: string[];
};

const emptyQuestion: QuestionForm = {
  question_text: "",
  option_a: "",
  option_b: "",
  option_c: "",
  option_d: "",
  correct_option: "A",
  explanation: "",
  topic: "",
  difficulty: "medium",
};

const emptyActivity: ActivityForm = {
  title: "",
  instructions: "",
  activity_type: "classwork",
  due_at: "",
  class_ids: [],
  question_ids: [],
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const labelClass = "mb-2 block text-sm font-semibold text-slate-700";

function formatDate(value: string | null) {
  if (!value) return "No due date";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Invalid date";

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function badgeClass(status: string) {
  switch (status) {
    case "published":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20";
    case "draft":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "archived":
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
    case "closed":
      return "bg-rose-50 text-rose-700 ring-rose-600/20";
    default:
      return "bg-slate-100 text-slate-600 ring-slate-500/20";
  }
}

function humanize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default function SchoolQuestionsPage() {
  const router = useRouter();

  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [notice, setNotice] = useState("");

  const [activeTab, setActiveTab] = useState<
    "questions" | "activities"
  >("questions");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");

  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null
  );
  const [questionForm, setQuestionForm] =
    useState<QuestionForm>(emptyQuestion);

  const [showActivityForm, setShowActivityForm] = useState(false);
  const [activityForm, setActivityForm] =
    useState<ActivityForm>(emptyActivity);

  const [showQuestionPreview, setShowQuestionPreview] =
    useState<string | null>(null);

  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const getToken = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      router.replace("/login");
      throw new Error("Your session has expired. Please sign in again.");
    }

    return session.access_token;
  }, [router]);

  const requestApi = useCallback(
    async (
      method: "GET" | "POST" | "PATCH" | "DELETE",
      body?: Record<string, unknown>,
      query?: string
    ) => {
      const token = await getToken();

      const response = await fetch(
        `/api/schools/questions${query ? `?${query}` : ""}`,
        {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
          },
          ...(body ? { body: JSON.stringify(body) } : {}),
          cache: "no-store",
        }
      );

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        router.replace("/login");
        throw new Error("Your session has expired. Please sign in again.");
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Something went wrong.");
      }

      return result;
    },
    [getToken, router]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const result = await requestApi("GET");

      setQuestions(result.questions ?? []);
      setClasses(result.classes ?? []);
      setActivities(result.activities ?? []);
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : "We could not load the School Questions dashboard."
      );
    } finally {
      setLoading(false);
    }
  }, [requestApi]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeClasses = useMemo(
    () => classes.filter((item) => item.status === "active"),
    [classes]
  );

  const filteredQuestions = useMemo(() => {
    const term = search.trim().toLowerCase();

    return questions.filter((question) => {
      const matchesSearch =
        !term ||
        question.question_text.toLowerCase().includes(term) ||
        (question.topic ?? "").toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || question.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [questions, search, statusFilter]);

  const filteredActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activityFilter === "all" ||
          activity.activity_type === activityFilter
      ),
    [activities, activityFilter]
  );

  const questionStats = useMemo(
    () => ({
      total: questions.filter((item) => item.status !== "archived").length,
      published: questions.filter((item) => item.status === "published")
        .length,
      drafts: questions.filter((item) => item.status === "draft").length,
      archived: questions.filter((item) => item.status === "archived")
        .length,
    }),
    [questions]
  );

  const activityStats = useMemo(
    () => ({
      total: activities.length,
      published: activities.filter((item) => item.status === "published")
        .length,
      drafts: activities.filter((item) => item.status === "draft").length,
      closed: activities.filter((item) => item.status === "closed").length,
    }),
    [activities]
  );

  function updateQuestionField<K extends keyof QuestionForm>(
    key: K,
    value: QuestionForm[K]
  ) {
    setQuestionForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateActivityField<K extends keyof ActivityForm>(
    key: K,
    value: ActivityForm[K]
  ) {
    setActivityForm((previous) => ({ ...previous, [key]: value }));
  }

  function openNewQuestion() {
    setQuestionForm(emptyQuestion);
    setEditingQuestionId(null);
    setShowQuestionForm(true);
    setNotice("");
    setPageError("");
  }

  function openEditQuestion(question: Question) {
    setQuestionForm({
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      correct_option: question.correct_option,
      explanation: question.explanation ?? "",
      topic: question.topic ?? "",
      difficulty: question.difficulty,
    });

    setEditingQuestionId(question.id);
    setShowQuestionForm(true);
    setNotice("");
    setPageError("");
  }

  async function saveQuestion(
    event: React.FormEvent<HTMLFormElement>,
    status: "draft" | "published"
  ) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setPageError("");

    try {
      const payload = {
        action: "question",
        ...questionForm,
        status,
      };

      if (editingQuestionId) {
        await requestApi("PATCH", {
          ...payload,
          id: editingQuestionId,
        });
        setNotice("Question updated successfully.");
      } else {
        await requestApi("POST", payload);
        setNotice(
          status === "published"
            ? "Question published successfully."
            : "Question saved as a draft."
        );
      }

      setShowQuestionForm(false);
      setEditingQuestionId(null);
      setQuestionForm(emptyQuestion);
      await loadData();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to save question."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeQuestionStatus(
    question: Question,
    status: QuestionStatus
  ) {
    setActionBusyId(question.id);
    setNotice("");
    setPageError("");

    try {
      await requestApi("PATCH", {
        action: "question",
        id: question.id,
        status,
      });

      setNotice(
        status === "published"
          ? "Question published successfully."
          : status === "draft"
            ? "Question moved back to drafts."
            : "Question archived successfully."
      );

      await loadData();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to update question."
      );
    } finally {
      setActionBusyId(null);
    }
  }

  function openNewActivity() {
    setActivityForm(emptyActivity);
    setShowActivityForm(true);
    setActiveTab("activities");
    setNotice("");
    setPageError("");
  }

  function toggleActivityClass(classId: string) {
    setActivityForm((previous) => ({
      ...previous,
      class_ids: previous.class_ids.includes(classId)
        ? previous.class_ids.filter((id) => id !== classId)
        : [...previous.class_ids, classId],
    }));
  }

  function toggleActivityQuestion(questionId: string) {
    setActivityForm((previous) => ({
      ...previous,
      question_ids: previous.question_ids.includes(questionId)
        ? previous.question_ids.filter((id) => id !== questionId)
        : [...previous.question_ids, questionId],
    }));
  }

  const publishedQuestions = useMemo(
    () => questions.filter((question) => question.status === "published"),
    [questions]
  );

  async function saveActivity(
    event: React.FormEvent<HTMLFormElement>,
    status: "draft" | "published"
  ) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    setPageError("");

    try {
      const payload = {
        action: "activity",
        ...activityForm,
        due_at: activityForm.due_at
          ? new Date(activityForm.due_at).toISOString()
          : null,
        status,
      };

      await requestApi("POST", payload);

      setNotice(
        status === "published"
          ? "Activity published and assigned successfully."
          : "Activity saved as a draft."
      );

      setShowActivityForm(false);
      setActivityForm(emptyActivity);
      await loadData();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to save activity."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeActivityStatus(
    activity: Activity,
    status: ActivityStatus
  ) {
    setActionBusyId(activity.id);
    setNotice("");
    setPageError("");

    try {
      await requestApi("PATCH", {
        action: "activity",
        id: activity.id,
        status,
      });

      setNotice(`Activity ${status} successfully.`);
      await loadData();
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to update activity."
      );
    } finally {
      setActionBusyId(null);
    }
  }

  const buttonPrimary =
    "inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50";

  const buttonSecondary =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

  const availableQuestionCount = publishedQuestions.length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="flex items-start gap-3">
            <Link
              href="/schools/dashboard"
              className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
              aria-label="Back to school dashboard"
            >
              ←
            </Link>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                Sahaba Quest · Schools & Madrasas
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
                School Questions
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Create questions and set learning activities for your classes.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className={buttonSecondary}
              disabled={loading}
            >
              ↻ Refresh
            </button>

            <button
              type="button"
              onClick={openNewQuestion}
              className={buttonPrimary}
            >
              + Create question
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {pageError && (
          <div
            role="alert"
            className="flex items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          >
            <p>{pageError}</p>
            <button
              type="button"
              onClick={() => setPageError("")}
              className="font-bold"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            <p>{notice}</p>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="font-bold"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Questions",
              value: questionStats.total,
              detail: "Not archived",
              icon: "✎",
            },
            {
              label: "Published questions",
              value: questionStats.published,
              detail: "Available for activities",
              icon: "✓",
            },
            {
              label: "Draft questions",
              value: questionStats.drafts,
              detail: "Still being prepared",
              icon: "◷",
            },
            {
              label: "Activities",
              value: activityStats.total,
              detail: `${activityStats.published} published`,
              icon: "▤",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-slate-500 sm:text-sm">
                  {stat.label}
                </p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-700">
                  {stat.icon}
                </span>
              </div>
              <p className="mt-3 text-2xl font-bold sm:text-3xl">
                {loading ? "—" : stat.value}
              </p>
              <p className="mt-1 text-xs text-slate-500">{stat.detail}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                Teaching tools
              </p>
              <h2 className="mt-1 text-lg font-bold">
                Build your own learning activities
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Write original multiple-choice questions, choose the correct
                answers, and organize published questions into classwork, tests,
                and assignments for your school classes.
              </p>
            </div>

            <button
              type="button"
              onClick={openNewActivity}
              className={buttonPrimary}
            >
              + Create activity
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
            <span className="rounded-full border border-emerald-100 bg-white px-3 py-1.5">
              {activeClasses.length} active classes
            </span>
            <span className="rounded-full border border-emerald-100 bg-white px-3 py-1.5">
              {availableQuestionCount} published questions available
            </span>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setActiveTab("questions")}
              className={`border-b-2 px-3 py-4 text-sm font-semibold transition sm:px-5 ${
                activeTab === "questions"
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Question bank ({questions.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("activities")}
              className={`border-b-2 px-3 py-4 text-sm font-semibold transition sm:px-5 ${
                activeTab === "activities"
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              Activities ({activities.length})
            </button>
          </div>

          {activeTab === "questions" && (
            <div>
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h2 className="font-bold">Your question bank</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    These questions belong to your school.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search questions or topics"
                    aria-label="Search questions"
                    className={`${inputClass} sm:w-64`}
                  />

                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter questions by status"
                    className={inputClass}
                  >
                    <option value="all">All statuses</option>
                    <option value="draft">Drafts</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Loading your questions…
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
                    ✎
                  </div>
                  <h3 className="mt-4 font-bold">No questions found</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    {questions.length === 0
                      ? "Create your first custom question to start building your school question bank."
                      : "Try a different search term or status filter."}
                  </p>
                  {questions.length === 0 && (
                    <button
                      type="button"
                      onClick={openNewQuestion}
                      className={`${buttonPrimary} mt-5`}
                    >
                      Create your first question
                    </button>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredQuestions.map((question, index) => (
                    <article key={question.id} className="p-4 sm:px-6 sm:py-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            <p className="whitespace-pre-wrap font-semibold leading-6 text-slate-900">
                              {question.question_text}
                            </p>

                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass(question.status)}`}
                              >
                                {humanize(question.status)}
                              </span>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                {humanize(question.difficulty)}
                              </span>
                              {question.topic && (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                                  {question.topic}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 sm:shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setShowQuestionPreview(
                                showQuestionPreview === question.id
                                  ? null
                                  : question.id
                              )
                            }
                            className={buttonSecondary}
                          >
                            {showQuestionPreview === question.id
                              ? "Hide answers"
                              : "View answers"}
                          </button>

                          {question.status !== "archived" && (
                            <button
                              type="button"
                              onClick={() => openEditQuestion(question)}
                              className={buttonSecondary}
                            >
                              Edit
                            </button>
                          )}

                          {question.status === "draft" && (
                            <button
                              type="button"
                              disabled={actionBusyId === question.id}
                              onClick={() =>
                                void changeQuestionStatus(question, "published")
                              }
                              className={buttonPrimary}
                            >
                              Publish
                            </button>
                          )}

                          {question.status === "published" && (
                            <button
                              type="button"
                              disabled={actionBusyId === question.id}
                              onClick={() =>
                                void changeQuestionStatus(question, "draft")
                              }
                              className={buttonSecondary}
                            >
                              Unpublish
                            </button>
                          )}

                          {question.status !== "archived" && (
                            <button
                              type="button"
                              disabled={actionBusyId === question.id}
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Archive this question? It will no longer be available for new activities."
                                  )
                                ) {
                                  void changeQuestionStatus(question, "archived");
                                }
                              }}
                              className="inline-flex items-center justify-center rounded-xl border border-rose-200 px-3 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>

                      {showQuestionPreview === question.id && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                            Answer options
                          </p>

                          <div className="grid gap-2 sm:grid-cols-2">
                            {(
                              [
                                ["A", question.option_a],
                                ["B", question.option_b],
                                ["C", question.option_c],
                                ["D", question.option_d],
                              ] as const
                            ).map(([letter, option]) => (
                              <div
                                key={letter}
                                className={`rounded-xl border p-3 text-sm ${
                                  question.correct_option === letter
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                                    : "border-slate-200 bg-white text-slate-700"
                                }`}
                              >
                                <span className="mr-2 font-bold">
                                  {letter}.
                                </span>
                                {option}
                                {question.correct_option === letter && (
                                  <span className="ml-2 text-xs font-bold">
                                    Correct answer
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>

                          {question.explanation && (
                            <div className="mt-3 rounded-xl border border-emerald-100 bg-white p-3 text-sm leading-6 text-slate-700">
                              <span className="font-bold text-emerald-800">
                                Explanation:{" "}
                              </span>
                              {question.explanation}
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "activities" && (
            <div>
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div>
                  <h2 className="font-bold">Class activities</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Manage classwork, tests and assignments.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={activityFilter}
                    onChange={(event) => setActivityFilter(event.target.value)}
                    aria-label="Filter activities by type"
                    className={inputClass}
                  >
                    <option value="all">All activity types</option>
                    <option value="classwork">Classwork</option>
                    <option value="test">Tests</option>
                    <option value="assignment">Assignments</option>
                  </select>

                  <button
                    type="button"
                    onClick={openNewActivity}
                    className={buttonPrimary}
                  >
                    + New activity
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center text-sm text-slate-500">
                  Loading activities…
                </div>
              ) : filteredActivities.length === 0 ? (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-2xl text-emerald-700">
                    ▤
                  </div>
                  <h3 className="mt-4 font-bold">No activities yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Create an activity, choose the classes, and add published
                    questions.
                  </p>
                  <button
                    type="button"
                    onClick={openNewActivity}
                    className={`${buttonPrimary} mt-5`}
                  >
                    Create an activity
                  </button>
                </div>
              ) : (
                <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-2">
                  {filteredActivities.map((activity) => {
                    const assignedClasses = classes.filter((item) =>
                      activity.class_ids.includes(item.id)
                    );

                    return (
                      <article
                        key={activity.id}
                        className="rounded-2xl border border-slate-200 p-5 transition hover:border-emerald-200"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                              {humanize(activity.activity_type)}
                            </span>
                            <h3 className="mt-1 break-words text-lg font-bold">
                              {activity.title}
                            </h3>
                          </div>

                          <span
                            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badgeClass(activity.status)}`}
                          >
                            {humanize(activity.status)}
                          </span>
                        </div>

                        {activity.instructions && (
                          <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                            {activity.instructions}
                          </p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-3">
                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Questions</p>
                            <p className="mt-1 font-bold">
                              {activity.question_count}
                            </p>
                          </div>

                          <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Due date</p>
                            <p className="mt-1 text-sm font-semibold">
                              {formatDate(activity.due_at)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold text-slate-500">
                            Assigned classes
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {assignedClasses.length > 0 ? (
                              assignedClasses.map((item) => (
                                <span
                                  key={item.id}
                                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700"
                                >
                                  {item.class_name}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-500">
                                No classes found
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                          {activity.status === "draft" && (
                            <button
                              type="button"
                              disabled={actionBusyId === activity.id}
                              onClick={() =>
                                void changeActivityStatus(activity, "published")
                              }
                              className={buttonPrimary}
                            >
                              Publish activity
                            </button>
                          )}

                          {activity.status === "published" && (
                            <button
                              type="button"
                              disabled={actionBusyId === activity.id}
                              onClick={() =>
                                void changeActivityStatus(activity, "closed")
                              }
                              className={buttonSecondary}
                            >
                              Close activity
                            </button>
                          )}

                          {activity.status === "closed" && (
                            <button
                              type="button"
                              disabled={actionBusyId === activity.id}
                              onClick={() =>
                                void changeActivityStatus(activity, "published")
                              }
                              className={buttonSecondary}
                            >
                              Reopen activity
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </section>

        <p className="text-center text-xs leading-5 text-slate-500">
          School questions are stored separately from Sahaba Quest&apos;s shared
          question bank.
        </p>
      </div>

      {/* QUESTION EDITOR */}
      {showQuestionForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowQuestionForm(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-editor-title"
            className="max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Question bank
                </p>
                <h2
                  id="question-editor-title"
                  className="mt-1 text-xl font-bold"
                >
                  {editingQuestionId ? "Edit question" : "Create a question"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add four answer options and identify the correct one.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowQuestionForm(false)}
                disabled={saving}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-lg text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                aria-label="Close question editor"
              >
                ×
              </button>
            </div>

            <form className="space-y-5 p-5 sm:p-7">
              <div>
                <label className={labelClass} htmlFor="question-text">
                  Question <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="question-text"
                  value={questionForm.question_text}
                  onChange={(event) =>
                    updateQuestionField("question_text", event.target.value)
                  }
                  maxLength={2000}
                  rows={4}
                  required
                  placeholder="Enter your question here…"
                  className={inputClass}
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {questionForm.question_text.length}/2000
                </p>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-800">
                    Answer options
                  </h3>
                  <span className="text-xs text-slate-500">
                    Select the correct answer
                  </span>
                </div>

                <div className="space-y-3">
                  {(
                    [
                      ["A", "option_a"],
                      ["B", "option_b"],
                      ["C", "option_c"],
                      ["D", "option_d"],
                    ] as const
                  ).map(([letter, key]) => (
                    <div
                      key={key}
                      className={`rounded-2xl border p-3 sm:p-4 ${
                        questionForm.correct_option === letter
                          ? "border-emerald-300 bg-emerald-50/70"
                          : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <label className="flex shrink-0 cursor-pointer items-center gap-2 pt-2">
                          <input
                            type="radio"
                            name="correct-option"
                            value={letter}
                            checked={questionForm.correct_option === letter}
                            onChange={() =>
                              updateQuestionField(
                                "correct_option",
                                letter as QuestionForm["correct_option"]
                              )
                            }
                            className="h-4 w-4 accent-emerald-700"
                          />
                          <span className="text-sm font-bold">{letter}</span>
                        </label>

                        <div className="min-w-0 flex-1">
                          <label
                            className="mb-1 block text-xs font-semibold text-slate-500"
                            htmlFor={`answer-${letter}`}
                          >
                            Option {letter}
                          </label>
                          <input
                            id={`answer-${letter}`}
                            value={questionForm[key]}
                            onChange={(event) =>
                              updateQuestionField(key, event.target.value)
                            }
                            maxLength={500}
                            required
                            placeholder={`Enter option ${letter}`}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="mt-2 text-xs text-slate-500">
                  The selected answer will be marked as correct.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="question-topic">
                    Topic
                  </label>
                  <input
                    id="question-topic"
                    value={questionForm.topic}
                    onChange={(event) =>
                      updateQuestionField("topic", event.target.value)
                    }
                    maxLength={150}
                    placeholder="e.g. Seerah, Fiqh, Hadith"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass} htmlFor="question-difficulty">
                    Difficulty
                  </label>
                  <select
                    id="question-difficulty"
                    value={questionForm.difficulty}
                    onChange={(event) =>
                      updateQuestionField(
                        "difficulty",
                        event.target.value as Difficulty
                      )
                    }
                    className={inputClass}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="question-explanation">
                  Explanation (optional)
                </label>
                <textarea
                  id="question-explanation"
                  value={questionForm.explanation}
                  onChange={(event) =>
                    updateQuestionField("explanation", event.target.value)
                  }
                  maxLength={3000}
                  rows={3}
                  placeholder="Explain why the selected answer is correct…"
                  className={inputClass}
                />
              </div>

              <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white p-5 sm:-mx-7 sm:-mb-7 sm:flex-row sm:justify-end sm:px-7">
                <button
                  type="button"
                  onClick={() => setShowQuestionForm(false)}
                  disabled={saving}
                  className={buttonSecondary}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    if (form && !form.reportValidity()) return;

                    if (form) {
                      void saveQuestion(
                        {
                          preventDefault: () => {},
                        } as React.FormEvent<HTMLFormElement>,
                        "draft"
                      );
                    }
                  }}
                  className={buttonSecondary}
                >
                  {saving ? "Saving…" : "Save draft"}
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={(event) => {
                    const form = event.currentTarget.closest("form");
                    if (form && !form.reportValidity()) return;

                    if (form) {
                      void saveQuestion(
                        {
                          preventDefault: () => {},
                        } as React.FormEvent<HTMLFormElement>,
                        "published"
                      );
                    }
                  }}
                  className={buttonPrimary}
                >
                  {saving
                    ? "Saving…"
                    : editingQuestionId
                      ? "Save changes"
                      : "Publish question"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ACTIVITY CREATOR */}
      {showActivityForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowActivityForm(false);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="activity-editor-title"
            className="max-h-[95dvh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-2xl sm:max-w-3xl sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">
                  Classroom tools
                </p>
                <h2
                  id="activity-editor-title"
                  className="mt-1 text-xl font-bold"
                >
                  Create an activity
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Choose the activity type, classes and published questions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowActivityForm(false)}
                disabled={saving}
                aria-label="Close activity form"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              className="space-y-6 px-5 py-6 sm:px-7"
              onSubmit={(event) => void saveActivity(event, "published")}
            >
              <div>
                <label className={labelClass} htmlFor="activity-title">
                  Activity title <span className="text-rose-600">*</span>
                </label>
                <input
                  id="activity-title"
                  required
                  maxLength={150}
                  value={activityForm.title}
                  onChange={(event) => updateActivityField("title", event.target.value)}
                  placeholder="e.g. Week 2 Islamic History Test"
                  className={inputClass}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="activity-type">
                    Activity type <span className="text-rose-600">*</span>
                  </label>
                  <select
                    id="activity-type"
                    required
                    value={activityForm.activity_type}
                    onChange={(event) => updateActivityField("activity_type", event.target.value as ActivityType)}
                    className={inputClass}
                  >
                    <option value="classwork">Classwork</option>
                    <option value="test">Test</option>
                    <option value="assignment">Assignment</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="activity-due-at">
                    Due date and time <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="activity-due-at"
                    type="datetime-local"
                    value={activityForm.due_at}
                    onChange={(event) => updateActivityField("due_at", event.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass} htmlFor="activity-instructions">
                  Instructions <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id="activity-instructions"
                  rows={3}
                  maxLength={5000}
                  value={activityForm.instructions}
                  onChange={(event) => updateActivityField("instructions", event.target.value)}
                  placeholder="Explain what students should do before the deadline."
                  className={inputClass}
                />
              </div>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Assign to classes <span className="text-rose-600">*</span>
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">Select one or more active classes.</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{activityForm.class_ids.length} selected</span>
                </div>
                {activeClasses.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    You do not have any active classes yet. Create or activate a class before assigning an activity.
                  </div>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {activeClasses.map((schoolClass) => {
                      const selected = activityForm.class_ids.includes(schoolClass.id);
                      return (
                        <label key={schoolClass.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleActivityClass(schoolClass.id)}
                            className="mt-1 h-4 w-4 accent-emerald-700"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-slate-800">{schoolClass.class_name}</span>
                            {schoolClass.academic_session && <span className="mt-1 block text-xs text-slate-500">{schoolClass.academic_session}</span>}
                            {schoolClass.description && <span className="mt-1 block text-xs text-slate-500">{schoolClass.description}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              <section>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Choose questions <span className="text-rose-600">*</span>
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">Only published questions can be added to an activity.</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{activityForm.question_ids.length} selected</span>
                </div>
                {publishedQuestions.length === 0 ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Publish at least one question before creating an activity.
                    <button type="button" onClick={openNewQuestion} className="ml-1 font-bold underline">Create a question</button>
                  </div>
                ) : (
                  <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                    {publishedQuestions.map((question) => {
                      const selected = activityForm.question_ids.includes(question.id);
                      return (
                        <label key={question.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${selected ? "border-emerald-400 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleActivityQuestion(question.id)}
                            className="mt-1 h-4 w-4 accent-emerald-700"
                          />
                          <span className="min-w-0">
                            <span className="block whitespace-pre-wrap text-sm font-medium leading-5 text-slate-800">{question.question_text}</span>
                            {question.topic && <span className="mt-1 block text-xs text-slate-500">{question.topic}</span>}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </section>

              <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setShowActivityForm(false)}
                  disabled={saving}
                  className={buttonSecondary}
                >
                  Cancel
                </button>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={saving || activeClasses.length === 0 || publishedQuestions.length === 0}
                    onClick={(event) => {
                      const form = event.currentTarget.form;
                      if (form && !form.reportValidity()) return;
                      if (activityForm.class_ids.length === 0) {
                        setPageError("Select at least one class.");
                        return;
                      }
                      if (activityForm.question_ids.length === 0) {
                        setPageError("Select at least one published question.");
                        return;
                      }
                      void saveActivity({ preventDefault: () => {} } as React.FormEvent<HTMLFormElement>, "draft");
                    }}
                    className={buttonSecondary}
                  >
                    {saving ? "Saving…" : "Save draft"}
                  </button>
                  <button
                    type="submit"
                    disabled={saving || activeClasses.length === 0 || publishedQuestions.length === 0}
                    onClick={(event) => {
                      if (activityForm.class_ids.length === 0) {
                        event.preventDefault();
                        setPageError("Select at least one class.");
                      } else if (activityForm.question_ids.length === 0) {
                        event.preventDefault();
                        setPageError("Select at least one published question.");
                      }
                    }}
                    className={buttonPrimary}
                  >
                    {saving ? "Publishing…" : "Publish activity"}
                  </button>
                </div>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
