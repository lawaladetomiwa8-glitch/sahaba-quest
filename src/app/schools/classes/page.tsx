"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type SchoolClass = {
  id: string;
  school_id: string;
  class_name: string;
  description: string | null;
  academic_session: string;
  status: "active" | "archived";
  student_count: number;
  created_at: string;
  updated_at: string;
};

export default function SchoolClassesPage() {
  const router = useRouter();

  const [classes, setClasses] =
    useState<SchoolClass[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [updatingId, setUpdatingId] =
    useState<string | null>(null);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [className, setClassName] =
    useState("");

  const [
    academicSession,
    setAcademicSession,
  ] = useState("");

  const [description, setDescription] =
    useState("");

  /* =====================================================
     AUTHENTICATED REQUEST
  ===================================================== */

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } =
      await supabase.auth.getSession();

    if (
      sessionError ||
      !session?.access_token
    ) {
      router.replace("/login");
      return null;
    }

    return session.access_token;
  }

  /* =====================================================
     LOAD CLASSES
  ===================================================== */

  const loadClasses =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const token =
          await getAccessToken();

        if (!token) {
          return;
        }

        const response =
          await fetch(
            "/api/schools/classes",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
              },
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (!response.ok || !result.success) {
          if (
            response.status === 401
          ) {
            router.replace("/login");
            return;
          }

          throw new Error(
            result.error ||
              "Unable to load classes."
          );
        }

        setClasses(
          result.classes ?? []
        );
      } catch (err) {
        console.error(
          "Load classes error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load classes."
        );
      } finally {
        setLoading(false);
      }
    }, [router]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  /* =====================================================
     CREATE CLASS
  ===================================================== */

  async function handleCreateClass(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!className.trim()) {
      setError(
        "Please enter a class name."
      );
      return;
    }

    if (!academicSession.trim()) {
      setError(
        "Please enter the academic session."
      );
      return;
    }

    try {
      setSubmitting(true);

      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          "/api/schools/classes",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              class_name:
                className.trim(),
              academic_session:
                academicSession.trim(),
              description:
                description.trim() ||
                null,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Unable to create class."
        );
      }

      setSuccess(
        "Class created successfully."
      );

      setClassName("");
      setAcademicSession("");
      setDescription("");
      setShowForm(false);

      await loadClasses();
    } catch (err) {
      console.error(
        "Create class error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to create class."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =====================================================
     ARCHIVE / REACTIVATE
  ===================================================== */

  async function changeClassStatus(
    schoolClass: SchoolClass
  ) {
    setError("");
    setSuccess("");
    setUpdatingId(schoolClass.id);

    const nextStatus =
      schoolClass.status === "active"
        ? "archived"
        : "active";

    try {
      const token =
        await getAccessToken();

      if (!token) {
        return;
      }

      const response =
        await fetch(
          `/api/schools/classes/${schoolClass.id}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              status: nextStatus,
            }),
          }
        );

      const result =
        await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
            "Unable to update class."
        );
      }

      setSuccess(
        nextStatus === "archived"
          ? "Class archived successfully."
          : "Class reactivated successfully."
      );

      await loadClasses();
    } catch (err) {
      console.error(
        "Change class status error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to update class."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <Link
              href="/schools/dashboard"
              className="text-lg font-bold text-gray-900"
            >
              Sahaba Quest
            </Link>
          </div>
        </header>

        <main className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />

            <p className="text-sm text-gray-600">
              Loading classes...
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* =====================================================
     PAGE
  ===================================================== */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/schools/dashboard"
            className="flex items-center gap-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-700 text-sm font-bold text-white">
              SQ
            </div>

            <div>
              <p className="text-sm font-bold text-gray-900">
                Sahaba Quest
              </p>

              <p className="text-[11px] text-gray-500">
                Schools & Madrasas
              </p>
            </div>
          </Link>

          <Link
            href="/schools/dashboard"
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* =================================================
            PAGE HEADER
        ================================================= */}

        <section className="mb-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <p className="mb-2 text-sm font-semibold text-green-700">
                School Management
              </p>

              <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                Classes
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                Create and organize the classes
                students belong to.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowForm(
                  (current) => !current
                );
                setError("");
                setSuccess("");
              }}
              className="rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              {showForm
                ? "Cancel"
                : "+ Add Class"}
            </button>
          </div>
        </section>

        {/* =================================================
            ALERTS
        ================================================= */}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {success}
          </div>
        )}

        {/* =================================================
            CREATE FORM
        ================================================= */}

        {showForm && (
          <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">
                Create a New Class
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Add a class that students can be
                assigned to.
              </p>
            </div>

            <form
              onSubmit={handleCreateClass}
              className="space-y-5"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="class-name"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Class Name
                  </label>

                  <input
                    id="class-name"
                    type="text"
                    value={className}
                    onChange={(event) =>
                      setClassName(
                        event.target.value
                      )
                    }
                    placeholder="e.g. JS1, Hifz 1, Class 4"
                    maxLength={100}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label
                    htmlFor="academic-session"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Academic Session
                  </label>

                  <input
                    id="academic-session"
                    type="text"
                    value={academicSession}
                    onChange={(event) =>
                      setAcademicSession(
                        event.target.value
                      )
                    }
                    placeholder="e.g. 2026/2027"
                    maxLength={50}
                    className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                    disabled={submitting}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Description{" "}
                  <span className="font-normal text-gray-400">
                    (Optional)
                  </span>
                </label>

                <textarea
                  id="description"
                  value={description}
                  onChange={(event) =>
                    setDescription(
                      event.target.value
                    )
                  }
                  placeholder="Optional description for this class..."
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-100"
                  disabled={submitting}
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting
                    ? "Creating..."
                    : "Create Class"}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* =================================================
            CLASS LIST
        ================================================= */}

        <section className="rounded-2xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Your Classes
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {classes.length}{" "}
                  {classes.length === 1
                    ? "class"
                    : "classes"}{" "}
                  created
                </p>
              </div>
            </div>
          </div>

          {classes.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 text-2xl">
                🏫
              </div>

              <h3 className="text-lg font-bold text-gray-900">
                No classes yet
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-500">
                Create your first class so you
                can start organizing students.
              </p>

              <button
                type="button"
                onClick={() =>
                  setShowForm(true)
                }
                className="mt-5 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
              >
                + Add Your First Class
              </button>
            </div>
          ) : (
            <>
              {/* Desktop */}

              <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/70">
                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Class
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Academic Session
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Students
                      </th>

                      <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Status
                      </th>

                      <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {classes.map(
                      (schoolClass) => (
                        <tr
                          key={
                            schoolClass.id
                          }
                          className="border-b border-gray-100 last:border-0"
                        >
                          <td className="px-6 py-5">
                            <div>
                              <p className="font-semibold text-gray-900">
                                {
                                  schoolClass.class_name
                                }
                              </p>

                              {schoolClass.description && (
                                <p className="mt-1 max-w-sm text-xs text-gray-500">
                                  {
                                    schoolClass.description
                                  }
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-5 text-sm text-gray-600">
                            {
                              schoolClass.academic_session
                            }
                          </td>

                          <td className="px-6 py-5">
                            <span className="text-sm font-semibold text-gray-900">
                              {schoolClass.student_count.toLocaleString()}
                            </span>
                          </td>

                          <td className="px-6 py-5">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                schoolClass.status ===
                                "active"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {schoolClass.status ===
                              "active"
                                ? "Active"
                                : "Archived"}
                            </span>
                          </td>

                          <td className="px-6 py-5 text-right">
                            <button
                              type="button"
                              disabled={
                                updatingId ===
                                schoolClass.id
                              }
                              onClick={() =>
                                changeClassStatus(
                                  schoolClass
                                )
                              }
                              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                            >
                              {updatingId ===
                              schoolClass.id
                                ? "Updating..."
                                : schoolClass.status ===
                                  "active"
                                ? "Archive"
                                : "Reactivate"}
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}

              <div className="divide-y divide-gray-100 md:hidden">
                {classes.map(
                  (schoolClass) => (
                    <div
                      key={
                        schoolClass.id
                      }
                      className="p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-gray-900">
                            {
                              schoolClass.class_name
                            }
                          </h3>

                          <p className="mt-1 text-xs text-gray-500">
                            {
                              schoolClass.academic_session
                            }
                          </p>
                        </div>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            schoolClass.status ===
                            "active"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {schoolClass.status ===
                          "active"
                            ? "Active"
                            : "Archived"}
                        </span>
                      </div>

                      {schoolClass.description && (
                        <p className="mt-4 text-sm leading-6 text-gray-600">
                          {
                            schoolClass.description
                          }
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between">
                        <span className="text-sm text-gray-500">
                          Students
                        </span>

                        <span className="text-sm font-semibold text-gray-900">
                          {schoolClass.student_count}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={
                          updatingId ===
                          schoolClass.id
                        }
                        onClick={() =>
                          changeClassStatus(
                            schoolClass
                          )
                        }
                        className="mt-4 w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                      >
                        {updatingId ===
                        schoolClass.id
                          ? "Updating..."
                          : schoolClass.status ===
                            "active"
                          ? "Archive Class"
                          : "Reactivate Class"}
                      </button>
                    </div>
                  )
                )}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}