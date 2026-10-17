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

  const [deletingId, setDeletingId] =
    useState<string | null>(null);



  const [error, setError] =

    useState("");



  const [success, setSuccess] =

    useState("");



  const [showForm, setShowForm] =

    useState(false);

  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);



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



  function beginEditClass(schoolClass: SchoolClass) {
    setEditingClass(schoolClass);
    setClassName(schoolClass.class_name);
    setAcademicSession(schoolClass.academic_session);
    setDescription(schoolClass.description || "");
    setShowForm(true);
    setError("");
    setSuccess("");
  }

  function cancelClassForm() {
    setShowForm(false);
    setEditingClass(null);
    setClassName("");
    setAcademicSession("");
    setDescription("");
  }

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

          editingClass ? `/api/schools/classes/${editingClass.id}` : "/api/schools/classes",

          {

            method: editingClass ? "PATCH" : "POST",

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

        editingClass ? "Class details updated successfully." : "Class created successfully."

      );



      setClassName("");

      setAcademicSession("");

      setDescription("");

      setEditingClass(null);

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



  /* =====================================================
     PERMANENTLY DELETE CLASS
  ===================================================== */

  async function deleteClass(schoolClass: SchoolClass) {
    const confirmed = window.confirm(
      `PERMANENTLY DELETE the class "${schoolClass.class_name}"?\n\n` +
        `Students currently assigned to this class: ${schoolClass.student_count}.\n\n` +
        "The class will be deleted, but its students will be retained and become unassigned. " +
        "This action cannot be undone.\n\nContinue?"
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(schoolClass.id);

    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`/api/schools/classes/${schoolClass.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || result.error || "Unable to delete class.");
      }

      setClasses((current) => current.filter((item) => item.id !== schoolClass.id));
      setSuccess(
        result.message ||
          `Class "${schoolClass.class_name}" deleted successfully. Its students have been retained and unassigned.`
      );
    } catch (err) {
      console.error("Delete class error:", err);
      setError(err instanceof Error ? err.message : "Unable to delete class.");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {

    return (

      <div className="min-h-screen bg-gray-50">

        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-end px-4 sm:px-6 lg:px-8">
            <Link
              href="/schools/dashboard"
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              ← Dashboard
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
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-end px-4 sm:px-6 lg:px-8">
          <Link
            href="/schools/dashboard"
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            ← Dashboard
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
                if (showForm) { cancelClassForm(); }
                else { setEditingClass(null); setClassName(""); setAcademicSession(""); setDescription(""); setShowForm(true); }
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

                {editingClass ? "Edit Class Details" : "Create a New Class"}

              </h2>



              <p className="mt-1 text-sm text-gray-500">

                {editingClass ? "Update the class name, academic session, or description. Existing student assignments will be preserved." : "Add a class that students can be assigned to."}

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

                    ? (editingClass ? "Saving..." : "Creating...")

                    : (editingClass ? "Save Changes" : "Create Class")}

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

                            <button type="button" onClick={() => beginEditClass(schoolClass)} disabled={submitting || deletingId === schoolClass.id} className="mr-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-800 transition hover:bg-green-100 disabled:opacity-50">Edit</button>

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
                              <button
                                type="button"
                                disabled={deletingId === schoolClass.id || updatingId === schoolClass.id}
                                onClick={() => deleteClass(schoolClass)}
                                className="ml-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingId === schoolClass.id ? "Deleting..." : "Delete"}
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



                      <button type="button" onClick={() => beginEditClass(schoolClass)} disabled={submitting || deletingId === schoolClass.id} className="mt-4 w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-800 transition hover:bg-green-100 disabled:opacity-50">Edit Class Details</button>

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
                      <button
                        type="button"
                        disabled={deletingId === schoolClass.id || updatingId === schoolClass.id}
                        onClick={() => deleteClass(schoolClass)}
                        className="mt-2 w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === schoolClass.id ? "Deleting..." : "Delete Class"}
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