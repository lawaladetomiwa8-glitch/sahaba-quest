"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SchoolClass = {
  id: string;
  class_name: string;
  academic_session: string | null;
  status: "active" | "archived";
};

type Student = {
  id: string;
  first_name: string;
  last_name: string;
  student_id: string;
  status: "active" | "inactive";
  class_id: string | null;
  created_at: string;
  school_classes?: {
    class_name: string;
    academic_session: string | null;
  } | null;
};

type StudentsResponse = {
  success: boolean;
  students: Student[];
  seats?: {
    limit: number;
    used: number;
    remaining: number;
  };
  message?: string;
};

type CreatedStudentResponse = {
  success: boolean;
  student: Student;
  credentials: {
    student_id: string;
    pin: string;
  };
  seats: {
    limit: number;
    used: number;
    remaining: number;
  };
  message?: string;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid var(--border, #e5e7eb)",
  background: "var(--card, #fff)",
  color: "var(--foreground, #111827)",
  fontSize: 14,
  outline: "none",
};

const primaryButton: React.CSSProperties = {
  border: 0,
  borderRadius: 10,
  padding: "11px 16px",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

export default function SchoolStudentsPage() {
  const router = useRouter();

  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [seatLimit, setSeatLimit] = useState(0);
  const [seatUsed, setSeatUsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [showAddForm, setShowAddForm] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [classId, setClassId] = useState("");

  const [credentials, setCredentials] = useState<{
    student_id: string;
    pin: string;
  } | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPin, setResetPin] = useState<string | null>(null);

  const seatRemaining = Math.max(seatLimit - seatUsed, 0);
  const seatsFull = seatLimit > 0 && seatUsed >= seatLimit;

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      router.replace("/login");
      return null;
    }

    return session.access_token;
  }


  async function readJsonResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();

    if (!raw.trim()) {
      throw new Error(
        `The server returned an empty response (HTTP ${response.status}).`
      );
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(
        `The server returned an invalid response (HTTP ${response.status}).`
      );
    }
  }

  async function loadStudents() {
    setLoading(true);
    setPageError("");

    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch("/api/schools/students", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonResponse<StudentsResponse>(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load students.");
      }

      setStudents(data.students || []);
      setSeatLimit(data.seats?.limit || 0);
      setSeatUsed(data.seats?.used || 0);
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to load students."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadClasses() {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch("/api/schools/classes", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await readJsonResponse<{
        success: boolean;
        classes?: SchoolClass[];
        message?: string;
      }>(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load classes.");
      }

      setClasses(
        (data.classes || []).filter(
          (item: SchoolClass) => item.status === "active"
        )
      );
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to load classes."
      );
    }
  }

  useEffect(() => {
    loadStudents();
    loadClasses();
  }, []);

  const filteredStudents = useMemo(() => {
    const term = search.trim().toLowerCase();

    return students.filter((student) => {
      const matchesSearch =
        !term ||
        student.first_name.toLowerCase().includes(term) ||
        student.last_name.toLowerCase().includes(term) ||
        student.student_id.toLowerCase().includes(term);

      const matchesClass =
        classFilter === "all" || student.class_id === classFilter;

      const matchesStatus =
        statusFilter === "all" || student.status === statusFilter;

      return matchesSearch && matchesClass && matchesStatus;
    });
  }, [students, search, classFilter, statusFilter]);

  async function handleAddStudent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firstName.trim() || !lastName.trim() || !classId) {
      setPageError("Please enter the student's first name, last name and class.");
      return;
    }

    if (seatsFull) {
      setPageError(
        "All student seats are currently in use. Increase your school capacity before adding another student."
      );
      return;
    }

    setSaving(true);
    setPageError("");
    setSuccessMessage("");
    setCredentials(null);

    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch("/api/schools/students", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          class_id: classId,
        }),
      });

      const data = await readJsonResponse<CreatedStudentResponse>(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to create student.");
      }

      setStudents((current) => [data.student, ...current]);
      setSeatLimit(data.seats.limit);
      setSeatUsed(data.seats.used);
      setCredentials(data.credentials);

      setFirstName("");
      setLastName("");
      setClassId("");
      setShowAddForm(false);
      setSuccessMessage("Student account created successfully.");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to create student."
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStudent(
    student: Student,
    payload: { status?: "active" | "inactive"; class_id?: string | null }
  ) {
    setUpdatingId(student.id);
    setPageError("");
    setSuccessMessage("");

    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`/api/schools/students/${student.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await readJsonResponse<{
        success: boolean;
        message?: string;
        student?: Student;
        seats?: {
          limit: number;
          used: number;
          remaining: number;
        };
      }>(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update student.");
      }

      if (data.student) {
        setStudents((current) =>
          current.map((item) =>
            item.id === student.id ? { ...item, ...data.student } : item
          )
        );
      }

      if (data.seats) {
        setSeatLimit(data.seats.limit);
        setSeatUsed(data.seats.used);
      }

      setSuccessMessage("Student updated successfully.");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to update student."
      );
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleResetPin(student: Student) {
    const confirmed = window.confirm(
      `Generate a new PIN for ${student.first_name} ${student.last_name}? The current PIN will stop working.`
    );

    if (!confirmed) return;

    setResettingId(student.id);
    setResetPin(null);
    setPageError("");
    setSuccessMessage("");

    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(`/api/schools/students/${student.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reset_pin: true }),
      });

      const data = await readJsonResponse<{
        success: boolean;
        message?: string;
        credentials?: {
          student_id: string;
          pin: string;
        } | null;
      }>(response);

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to reset PIN.");
      }

      setResetPin(data.credentials?.pin || null);
      setSuccessMessage("A new student PIN has been generated.");
    } catch (error) {
      setPageError(
        error instanceof Error ? error.message : "Unable to reset PIN."
      );
    } finally {
      setResettingId(null);
    }
  }

  function closeCredentialNotice() {
    setCredentials(null);
    setResetPin(null);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f7f8fa",
        color: "#111827",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div>
            <button
              type="button"
              onClick={() => router.push("/schools/dashboard")}
              style={{
                border: 0,
                background: "transparent",
                padding: 0,
                cursor: "pointer",
                color: "#6b7280",
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 4,
              }}
            >
              ← School Dashboard
            </button>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>
              Students
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              setPageError("");
              setSuccessMessage("");
              setCredentials(null);
              setShowAddForm((value) => !value);
            }}
            disabled={seatsFull}
            style={{
              ...primaryButton,
              opacity: seatsFull ? 0.55 : 1,
              cursor: seatsFull ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            + Add Student
          </button>
        </div>
      </header>

      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "28px 20px 60px",
        }}
      >
        {pageError && (
          <div
            role="alert"
            style={{
              marginBottom: 16,
              padding: "13px 15px",
              borderRadius: 12,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 14,
            }}
          >
            {pageError}
          </div>
        )}

        {successMessage && (
          <div
            style={{
              marginBottom: 16,
              padding: "13px 15px",
              borderRadius: 12,
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              color: "#166534",
              fontSize: 14,
            }}
          >
            {successMessage}
          </div>
        )}

        {(credentials || resetPin) && (
          <div
            style={{
              marginBottom: 22,
              padding: 20,
              borderRadius: 16,
              background: "#fffbeb",
              border: "1px solid #fcd34d",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <div>
                <h2 style={{ margin: "0 0 6px", fontSize: 18 }}>
                  Student Credentials
                </h2>
                <p style={{ margin: 0, color: "#92400e", fontSize: 13 }}>
                  Save or print these credentials now. The PIN is not stored in
                  plain text and cannot be displayed again.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCredentialNotice}
                style={{
                  border: 0,
                  background: "transparent",
                  cursor: "pointer",
                  color: "#92400e",
                  fontSize: 20,
                }}
                aria-label="Close credentials"
              >
                ×
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 12,
                marginTop: 16,
              }}
            >
              {credentials && (
                <CredentialBox
                  label="Student ID"
                  value={credentials.student_id}
                />
              )}
              {credentials && (
                <CredentialBox label="PIN" value={credentials.pin} />
              )}
              {resetPin && (
                <CredentialBox label="New PIN" value={resetPin} />
              )}
            </div>
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          <StatCard
            label="Total Students"
            value={students.length}
            helper={`${students.filter((s) => s.status === "active").length} active`}
          />
          <StatCard
            label="Seats Used"
            value={`${seatUsed} / ${seatLimit}`}
            helper={`${seatRemaining} remaining`}
          />
          <StatCard
            label="Active Students"
            value={students.filter((s) => s.status === "active").length}
            helper="Currently enrolled"
          />
          <StatCard
            label="Inactive Students"
            value={students.filter((s) => s.status === "inactive").length}
            helper="History preserved"
          />
        </section>

        {showAddForm && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: 20,
              marginBottom: 22,
              boxShadow: "0 4px 18px rgba(17,24,39,0.04)",
            }}
          >
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Add a Student</h2>
              <p
                style={{
                  margin: "5px 0 0",
                  color: "#6b7280",
                  fontSize: 13,
                }}
              >
                A unique Student ID and six-digit PIN will be generated
                automatically.
              </p>
            </div>

            <form
              onSubmit={handleAddStudent}
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 14,
                alignItems: "end",
              }}
            >
              <label style={{ fontSize: 13, fontWeight: 700 }}>
                First name
                <input
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  placeholder="e.g. Ahmad"
                  style={{ ...inputStyle, marginTop: 7 }}
                  autoComplete="off"
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Last name
                <input
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  placeholder="e.g. Ibrahim"
                  style={{ ...inputStyle, marginTop: 7 }}
                  autoComplete="off"
                />
              </label>

              <label style={{ fontSize: 13, fontWeight: 700 }}>
                Class
                <select
                  value={classId}
                  onChange={(event) => setClassId(event.target.value)}
                  style={{ ...inputStyle, marginTop: 7 }}
                >
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.class_name}
                      {item.academic_session
                        ? ` — ${item.academic_session}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="submit"
                disabled={saving || seatsFull}
                style={{
                  ...primaryButton,
                  height: 44,
                  opacity: saving || seatsFull ? 0.6 : 1,
                  cursor: saving || seatsFull ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Creating..." : "Create Student"}
              </button>
            </form>

            {seatsFull && (
              <p
                style={{
                  margin: "14px 0 0",
                  color: "#b45309",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Your current student capacity has been reached.
              </p>
            )}
          </section>
        )}

        <section
          style={{
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 4px 18px rgba(17,24,39,0.04)",
          }}
        >
          <div
            style={{
              padding: 18,
              borderBottom: "1px solid #e5e7eb",
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) 180px 150px",
              gap: 10,
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or Student ID..."
              style={inputStyle}
            />

            <select
              value={classFilter}
              onChange={(event) => setClassFilter(event.target.value)}
              style={inputStyle}
            >
              <option value="all">All classes</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.class_name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "all" | "active" | "inactive"
                )
              }
              style={inputStyle}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {loading ? (
            <div
              style={{
                padding: 50,
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              Loading students...
            </div>
          ) : filteredStudents.length === 0 ? (
            <div
              style={{
                padding: 55,
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              <div style={{ fontSize: 34, marginBottom: 8 }}>🎓</div>
              <strong style={{ color: "#111827" }}>No students found</strong>
              <p style={{ margin: "6px 0 0", fontSize: 13 }}>
                {students.length === 0
                  ? "Add your first student to get started."
                  : "Try changing your search or filters."}
              </p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    minWidth: 850,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      {[
                        "Student",
                        "Student ID",
                        "Class",
                        "Status",
                        "Added",
                        "Actions",
                      ].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            textAlign: "left",
                            padding: "12px 16px",
                            fontSize: 11,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            color: "#6b7280",
                            borderBottom: "1px solid #e5e7eb",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredStudents.map((student) => (
                      <tr key={student.id}>
                        <td
                          style={{
                            padding: "15px 16px",
                            borderBottom: "1px solid #f0f1f3",
                          }}
                        >
                          <div style={{ fontWeight: 750 }}>
                            {student.first_name} {student.last_name}
                          </div>
                        </td>

                        <td
                          style={{
                            padding: "15px 16px",
                            borderBottom: "1px solid #f0f1f3",
                            fontFamily: "monospace",
                            fontWeight: 700,
                            fontSize: 13,
                          }}
                        >
                          {student.student_id}
                        </td>

                        <td
                          style={{
                            padding: "15px 16px",
                            borderBottom: "1px solid #f0f1f3",
                          }}
                        >
                          <div style={{ fontWeight: 650 }}>
                            {student.school_classes?.class_name || "Unassigned"}
                          </div>
                          {student.school_classes?.academic_session && (
                            <div
                              style={{
                                fontSize: 12,
                                color: "#6b7280",
                                marginTop: 2,
                              }}
                            >
                              {student.school_classes.academic_session}
                            </div>
                          )}
                        </td>

                        <td
                          style={{
                            padding: "15px 16px",
                            borderBottom: "1px solid #f0f1f3",
                          }}
                        >
                          <StatusBadge status={student.status} />
                        </td>

                        <td
                          style={{
                            padding: "15px 16px",
                            borderBottom: "1px solid #f0f1f3",
                            color: "#6b7280",
                            fontSize: 13,
                          }}
                        >
                          {new Date(student.created_at).toLocaleDateString()}
                        </td>

                        <td
                          style={{
                            padding: "15px 16px",
                            borderBottom: "1px solid #f0f1f3",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: 7,
                            }}
                          >
                            <select
                              value={student.class_id || ""}
                              disabled={updatingId === student.id}
                              onChange={(event) =>
                                updateStudent(student, {
                                  class_id: event.target.value || null,
                                })
                              }
                              style={{
                                ...inputStyle,
                                width: 145,
                                padding: "8px 9px",
                                fontSize: 12,
                              }}
                              aria-label={`Change class for ${student.first_name}`}
                            >
                              <option value="">Unassigned</option>
                              {classes.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.class_name}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={updatingId === student.id}
                              onClick={() =>
                                updateStudent(student, {
                                  status:
                                    student.status === "active"
                                      ? "inactive"
                                      : "active",
                                })
                              }
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 8,
                                background: "#fff",
                                padding: "8px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {student.status === "active"
                                ? "Deactivate"
                                : "Activate"}
                            </button>

                            <button
                              type="button"
                              disabled={resettingId === student.id}
                              onClick={() => handleResetPin(student)}
                              style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 8,
                                background: "#fff",
                                padding: "8px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {resettingId === student.id
                                ? "Resetting..."
                                : "Reset PIN"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid #e5e7eb",
                  color: "#6b7280",
                  fontSize: 12,
                }}
              >
                Showing {filteredStudents.length} of {students.length} students
              </div>
            </>
          )}
        </section>
      </div>

      <style jsx>{`
        @media (max-width: 760px) {
          header > div {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }

          main > div {
            padding-left: 14px !important;
            padding-right: 14px !important;
          }
        }

        @media (max-width: 680px) {
          section form {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 700px) {
          section:first-of-type {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 620px) {
          section:first-of-type {
            grid-template-columns: 1fr !important;
          }

          header h1 {
            font-size: 20px !important;
          }

          header button {
            padding: 9px 11px !important;
            font-size: 12px !important;
          }
        }

        @media (max-width: 560px) {
          section:nth-of-type(3) > div:first-child {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        padding: 18,
      }}
    >
      <div
        style={{
          color: "#6b7280",
          fontSize: 12,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 7,
          fontSize: 26,
          fontWeight: 850,
          letterSpacing: "-0.03em",
        }}
      >
        {value}
      </div>
      <div style={{ marginTop: 3, color: "#9ca3af", fontSize: 12 }}>
        {helper}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  const active = status === "active";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "5px 9px",
        borderRadius: 999,
        background: active ? "#ecfdf3" : "#f3f4f6",
        color: active ? "#047857" : "#6b7280",
        fontSize: 11,
        fontWeight: 800,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? "#10b981" : "#9ca3af",
        }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function CredentialBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #f3d38a",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          color: "#92400e",
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 7,
          fontSize: 20,
          fontWeight: 850,
          fontFamily: "monospace",
          letterSpacing: "0.04em",
          color: "#111827",
        }}
      >
        {value}
      </div>
    </div>
  );
}
