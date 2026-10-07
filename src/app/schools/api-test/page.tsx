"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SchoolClass = {
  id: string;
  class_name: string;
  academic_session: string | null;
};

const TEST_STUDENT_UUID =
  "a9c3793e-76c7-47b9-a051-74416c832f91";

export default function SchoolApiTestPage() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState("");
  const [output, setOutput] = useState(
    "Ready for testing."
  );
  const [loading, setLoading] = useState(false);

  async function getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      throw new Error(
        `Session error: ${error.message}`
      );
    }

    if (!session) {
      throw new Error(
        "No active session. Please log in as a school administrator first."
      );
    }

    return session;
  }

  // --------------------------------------------------
  // LOAD CLASSES
  // --------------------------------------------------

  async function loadClasses() {
    setLoading(true);

    try {
      const session = await getSession();

      const response = await fetch(
        "/api/schools/classes",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      console.log("Classes status:", response.status);
      console.log("Classes result:", result);

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load classes."
        );
      }

      const loadedClasses = result.classes || [];

      setClasses(loadedClasses);

      if (loadedClasses.length > 0) {
        setClassId(loadedClasses[0].id);
      }

      setOutput(
        JSON.stringify(
          {
            test: "GET /api/schools/classes",
            status: response.status,
            result,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(error);

      setOutput(
        error instanceof Error
          ? error.message
          : "Unknown error."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // LOAD STUDENTS
  // --------------------------------------------------

  async function loadStudents() {
    setLoading(true);

    try {
      const session = await getSession();

      const response = await fetch(
        "/api/schools/students",
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      console.log(
        "Students GET status:",
        response.status
      );

      console.log(
        "Students GET result:",
        result
      );

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to load students."
        );
      }

      setOutput(
        JSON.stringify(
          {
            test: "GET /api/schools/students",
            status: response.status,
            result,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(error);

      setOutput(
        error instanceof Error
          ? error.message
          : "Unknown error."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // CREATE TEST STUDENT
  // --------------------------------------------------

  async function createTestStudent() {
    setLoading(true);

    try {
      const session = await getSession();

      if (!classId) {
        throw new Error(
          "Please load classes and select a class first."
        );
      }

      const response = await fetch(
        "/api/schools/students",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            first_name: "Test",
            last_name: "Student",
            class_id: classId,
          }),
        }
      );

      const result = await response.json();

      console.log(
        "Create student status:",
        response.status
      );

      console.log(
        "Create student result:",
        result
      );

      setOutput(
        JSON.stringify(
          {
            test: "POST /api/schools/students",
            status: response.status,
            result,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(error);

      setOutput(
        error instanceof Error
          ? error.message
          : "Unknown error."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // DEACTIVATE STUDENT
  // --------------------------------------------------

  async function deactivateStudent() {
    setLoading(true);

    try {
      const session = await getSession();

      const response = await fetch(
        `/api/schools/students/${TEST_STUDENT_UUID}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            status: "inactive",
          }),
        }
      );

      const result = await response.json();

      console.log(
        "Deactivate status:",
        response.status
      );

      console.log(
        "Deactivate result:",
        result
      );

      setOutput(
        JSON.stringify(
          {
            test: "PATCH student → inactive",
            status: response.status,
            result,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(error);

      setOutput(
        error instanceof Error
          ? error.message
          : "Unknown error."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // REACTIVATE STUDENT
  // --------------------------------------------------

  async function reactivateStudent() {
    setLoading(true);

    try {
      const session = await getSession();

      const response = await fetch(
        `/api/schools/students/${TEST_STUDENT_UUID}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            status: "active",
          }),
        }
      );

      const result = await response.json();

      console.log(
        "Reactivate status:",
        response.status
      );

      console.log(
        "Reactivate result:",
        result
      );

      setOutput(
        JSON.stringify(
          {
            test: "PATCH student → active",
            status: response.status,
            result,
          },
          null,
          2
        )
      );
    } catch (error) {
      console.error(error);

      setOutput(
        error instanceof Error
          ? error.message
          : "Unknown error."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // LOAD CLASSES ON PAGE LOAD
  // --------------------------------------------------

  useEffect(() => {
    loadClasses();
  }, []);

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "40px",
        background: "#f8fafc",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            marginBottom: "8px",
          }}
        >
          School Students API Test
        </h1>

        <p
          style={{
            color: "#64748b",
            marginBottom: "30px",
          }}
        >
          Temporary testing page for the Schools &
          Madrasas student backend.
        </p>

        {/* CLASS SELECTION */}

        <section
          style={{
            background: "#ffffff",
            padding: "24px",
            borderRadius: "12px",
            marginBottom: "20px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              marginTop: 0,
              marginBottom: "16px",
            }}
          >
            1. Select Class
          </h2>

          {classes.length === 0 ? (
            <p>No classes found.</p>
          ) : (
            <select
              value={classId}
              onChange={(e) =>
                setClassId(e.target.value)
              }
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "8px",
                border:
                  "1px solid #cbd5e1",
                fontSize: "15px",
              }}
            >
              {classes.map((schoolClass) => (
                <option
                  key={schoolClass.id}
                  value={schoolClass.id}
                >
                  {schoolClass.class_name}
                  {schoolClass.academic_session
                    ? ` — ${schoolClass.academic_session}`
                    : ""}
                </option>
              ))}
            </select>
          )}
        </section>

        {/* CREATE */}

        <section
          style={{
            background: "#ffffff",
            padding: "24px",
            borderRadius: "12px",
            marginBottom: "20px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            2. Create Student
          </h2>

          <p
            style={{
              color: "#64748b",
            }}
          >
            Creates a student named Test Student.
          </p>

          <button
            onClick={createTestStudent}
            disabled={
              loading || !classId
            }
            style={{
              padding: "12px 20px",
              border: "none",
              borderRadius: "8px",
              cursor:
                loading || !classId
                  ? "not-allowed"
                  : "pointer",
              background: "#111827",
              color: "#ffffff",
              fontWeight: 600,
            }}
          >
            {loading
              ? "Processing..."
              : "Create Test Student"}
          </button>
        </section>

        {/* GET */}

        <section
          style={{
            background: "#ffffff",
            padding: "24px",
            borderRadius: "12px",
            marginBottom: "20px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            3. Load Students
          </h2>

          <p
            style={{
              color: "#64748b",
            }}
          >
            Confirms that the student belongs to
            this school.
          </p>

          <button
            onClick={loadStudents}
            disabled={loading}
            style={{
              padding: "12px 20px",
              border: "none",
              borderRadius: "8px",
              cursor: loading
                ? "not-allowed"
                : "pointer",
              background: "#334155",
              color: "#ffffff",
              fontWeight: 600,
            }}
          >
            Load Students
          </button>
        </section>

        {/* STATUS */}

        <section
          style={{
            background: "#ffffff",
            padding: "24px",
            borderRadius: "12px",
            marginBottom: "20px",
            border: "1px solid #e2e8f0",
          }}
        >
          <h2
            style={{
              marginTop: 0,
            }}
          >
            4. Student Status
          </h2>

          <p
            style={{
              color: "#64748b",
            }}
          >
            Test that deactivating a student releases
            the seat and reactivating the student
            consumes it again.
          </p>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={deactivateStudent}
              disabled={loading}
              style={{
                padding: "12px 20px",
                border: "none",
                borderRadius: "8px",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                background: "#dc2626",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              Deactivate Test Student
            </button>

            <button
              onClick={reactivateStudent}
              disabled={loading}
              style={{
                padding: "12px 20px",
                border: "none",
                borderRadius: "8px",
                cursor: loading
                  ? "not-allowed"
                  : "pointer",
                background: "#16a34a",
                color: "#ffffff",
                fontWeight: 600,
              }}
            >
              Reactivate Test Student
            </button>
          </div>
        </section>

        {/* OUTPUT */}

        <section>
          <h2>API Response</h2>

          <pre
            style={{
              marginTop: "15px",
              padding: "20px",
              background: "#111827",
              color: "#f9fafb",
              borderRadius: "10px",
              whiteSpace: "pre-wrap",
              overflowX: "auto",
              lineHeight: 1.6,
            }}
          >
            {output}
          </pre>
        </section>
      </div>
    </main>
  );
}