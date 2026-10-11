"use client";

import { ChangeEvent, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";

type SchoolClass = {
  id: string;
  class_name: string;
  status: "active" | "archived";
};

type ImportRow = {
  first_name: string;
  last_name: string;
  class_name: string;
};

type CreatedCredential = ImportRow & {
  student_id: string;
  pin: string;
};

type BulkImportResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  credentials?: CreatedCredential[];
  invalid_rows?: Array<{
    row?: number;
    class_name?: string;
    reason?: string;
    missing?: string[];
  }>;
  duplicate_rows?: Array<{
    row?: number;
    first_name?: string;
    last_name?: string;
    class_name?: string;
  }>;
};

const buttonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  borderRadius: 9,
  padding: "10px 13px",
  background: "white",
  color: "#111827",
  fontWeight: 700,
  cursor: "pointer",
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, "");
}

function parseRows(matrix: unknown[][]): ImportRow[] {
  if (matrix.length < 2) {
    throw new Error(
      "The file must contain a header row and at least one student."
    );
  }

  const headers = matrix[0].map(normalizeHeader);
  const firstNameIndex = headers.findIndex((header) =>
    ["firstname", "first", "givenname"].includes(header)
  );
  const lastNameIndex = headers.findIndex((header) =>
    ["lastname", "last", "surname", "familyname"].includes(header)
  );
  const classIndex = headers.findIndex((header) =>
    ["class", "classname", "grade"].includes(header)
  );

  if (firstNameIndex < 0 || lastNameIndex < 0 || classIndex < 0) {
    throw new Error(
      "Required columns: First Name, Last Name, and Class. Please use the template if needed."
    );
  }

  return matrix
    .slice(1)
    .map((cells) => ({
      first_name: String(cells[firstNameIndex] ?? "").trim(),
      last_name: String(cells[lastNameIndex] ?? "").trim(),
      class_name: String(cells[classIndex] ?? "").trim(),
    }))
    .filter((row) => row.first_name || row.last_name || row.class_name);
}

function downloadCredentialsCsv(credentials: CreatedCredential[]) {
  const escapeCsv = (value: string) => `"${value.replace(/"/g, '""')}"`;
  const lines = [
    ["First Name", "Last Name", "Class", "Student ID", "PIN"],
    ...credentials.map((credential) => [
      credential.first_name,
      credential.last_name,
      credential.class_name,
      credential.student_id,
      credential.pin,
    ]),
  ];
  const csv =
    "\uFEFF" +
    lines.map((line) => line.map(escapeCsv).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "sahaba-quest-student-credentials.csv";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function BulkStudentImport({
  classes,
  onComplete,
}: {
  classes: SchoolClass[];
  onComplete: () => void | Promise<void>;
}) {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [credentials, setCredentials] = useState<CreatedCredential[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  const previewErrors = useMemo(
    () =>
      rows.flatMap((row, index) => {
        const issues: string[] = [];
        if (!row.first_name || !row.last_name || !row.class_name) {
          issues.push("first name, last name, and class are required");
        }
        if (
          row.class_name &&
          !classes.some(
            (schoolClass) =>
              schoolClass.status === "active" &&
              schoolClass.class_name.trim().toLocaleLowerCase() ===
                row.class_name.toLocaleLowerCase()
          )
        ) {
          issues.push(`unknown active class “${row.class_name}”`);
        }
        return issues.length ? [`Spreadsheet row ${index + 2}: ${issues.join("; ")}`] : [];
      }),
    [rows, classes]
  );

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setError("");
    setNotice("");
    setCredentials([]);
    setRows([]);
    setFileName("");

    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const fileBytes = await file.arrayBuffer();
      const workbook = XLSX.read(fileBytes, { type: "array", raw: false });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new Error("No worksheet was found in this file.");
      }
      const worksheet = workbook.Sheets[firstSheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
        header: 1,
        defval: "",
        raw: false,
      });
      const parsedRows = parseRows(matrix);
      if (parsedRows.length === 0) {
        throw new Error("No student rows were found in the file.");
      }
      if (parsedRows.length > 500) {
        throw new Error("Please upload no more than 500 students at a time.");
      }
      setRows(parsedRows);
      setFileName(file.name);
    } catch (fileError) {
      setError(
        fileError instanceof Error
          ? fileError.message
          : "Unable to read this file. Please check the file format."
      );
    } finally {
      // Allow the same file to be selected again after correcting it.
      event.target.value = "";
    }
  }

  async function handleImport() {
    setError("");
    setNotice("");

    if (!rows.length) {
      setError("Choose a CSV or Excel file containing student records first.");
      return;
    }
    if (previewErrors.length > 0) {
      setError("Please correct the spreadsheet rows marked with errors before importing.");
      return;
    }

    setBusy(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/schools/students/bulk", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ students: rows }),
      });

      const result = (await response.json().catch(() => ({}))) as BulkImportResponse;

      if (!response.ok || !result.success) {
        const details: string[] = [];
        if (result.error) details.push(result.error);
        if (result.invalid_rows?.length) {
          details.push(
            ...result.invalid_rows.slice(0, 15).map((item) => {
              const rowLabel = item.row ? `Row ${item.row}: ` : "";
              if (item.reason) return `${rowLabel}${item.reason}`;
              if (item.missing?.length) {
                return `${rowLabel}missing ${item.missing.join(", ")}`;
              }
              return `${rowLabel}please check this row`;
            })
          );
        }
        if (result.duplicate_rows?.length) {
          details.push(
            ...result.duplicate_rows.slice(0, 15).map((item) => {
              const rowLabel = item.row ? `Row ${item.row}: ` : "";
              return `${rowLabel}duplicate student record (${item.first_name ?? ""} ${item.last_name ?? ""}, ${item.class_name ?? ""})`.trim();
            })
          );
        }
        throw new Error(details.join("\n") || "Unable to import students.");
      }

      const issuedCredentials = result.credentials ?? [];
      setCredentials(issuedCredentials);
      setNotice(
        result.message || `${issuedCredentials.length} student(s) registered successfully.`
      );
      setRows([]);
      setFileName("");
      await onComplete();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Unable to import students. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["First Name", "Last Name", "Class"],
      ["Ahmad", "Ibrahim", classes.find((item) => item.status === "active")?.class_name ?? "JSS 1"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Students");
    XLSX.writeFile(workbook, "sahaba-quest-student-template.xlsx");
  }

  return (
    <section
      style={{
        margin: "0 0 22px",
        padding: 18,
        border: "1px solid #e5e7eb",
        borderRadius: 14,
        background: "var(--card, #fff)",
        color: "var(--foreground, #111827)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 5px", fontSize: 18 }}>Bulk Student Registration</h2>
          <p style={{ margin: 0, color: "var(--muted-foreground, #6b7280)", fontSize: 13 }}>
            Upload a spreadsheet to register multiple students and generate their login credentials.
          </p>
        </div>
        <button
          type="button"
          style={buttonStyle}
          onClick={() => setIsOpen((current) => !current)}
        >
          {isOpen ? "Close upload" : "Upload students"}
        </button>
      </div>

      {isOpen && (
        <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" style={buttonStyle} onClick={downloadTemplate}>
              Download Excel template
            </button>
            <span style={{ color: "var(--muted-foreground, #6b7280)", fontSize: 12 }}>
              Required columns: First Name, Last Name, Class. Maximum 500 students per upload.
            </span>
          </div>

          <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
            Select CSV or Excel file
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
              onChange={handleFileChange}
            />
          </label>

          {fileName && (
            <p style={{ margin: 0, fontSize: 13 }}>
              Selected: <strong>{fileName}</strong> · {rows.length} student row(s)
            </p>
          )}

          {rows.length > 0 && (
            <div
              style={{
                overflowX: "auto",
                maxHeight: 260,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
              }}
            >
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
                <thead>
                  <tr>
                    {["First Name", "Last Name", "Class"].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          padding: 9,
                          background: "#f9fafb",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((row, index) => (
                    <tr key={`${index}-${row.first_name}-${row.last_name}`}>
                      {[row.first_name, row.last_name, row.class_name].map((value, cellIndex) => (
                        <td
                          key={cellIndex}
                          style={{ padding: 9, borderBottom: "1px solid #f3f4f6" }}
                        >
                          {value || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && (
                <p style={{ padding: 10, margin: 0, fontSize: 12 }}>
                  Showing the first 100 rows in the preview. All {rows.length} rows will be checked.
                </p>
              )}
            </div>
          )}

          {previewErrors.length > 0 && (
            <div
              role="alert"
              style={{
                whiteSpace: "pre-wrap",
                padding: 12,
                borderRadius: 8,
                background: "#fff7ed",
                color: "#9a3412",
                fontSize: 13,
              }}
            >
              {previewErrors.slice(0, 12).join("\n")}
              {previewErrors.length > 12 ? `\n…and ${previewErrors.length - 12} more issue(s).` : ""}
            </div>
          )}

          {error && (
            <div
              role="alert"
              style={{
                whiteSpace: "pre-wrap",
                padding: 12,
                borderRadius: 8,
                background: "#fef2f2",
                color: "#991b1b",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              style={{
                padding: 12,
                borderRadius: 8,
                background: "#f0fdf4",
                color: "#166534",
                fontSize: 13,
              }}
            >
              {notice}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              style={{
                ...buttonStyle,
                background: "#111827",
                color: "white",
                borderColor: "#111827",
                opacity: busy || !rows.length || previewErrors.length ? 0.55 : 1,
              }}
              disabled={busy || !rows.length || previewErrors.length > 0}
              onClick={handleImport}
            >
              {busy ? "Registering students…" : `Register ${rows.length} student(s)`}
            </button>

            {credentials.length > 0 && (
              <>
                <button
                  type="button"
                  style={buttonStyle}
                  onClick={() => downloadCredentialsCsv(credentials)}
                >
                  Download credentials CSV
                </button>
                <button type="button" style={buttonStyle} onClick={() => window.print()}>
                  Print credentials
                </button>
              </>
            )}
          </div>

          {credentials.length > 0 && (
            <div id="student-credentials-print" style={{ marginTop: 8 }}>
              <h3 style={{ fontSize: 16 }}>Generated Student Credentials</h3>
              <p style={{ color: "#92400e", fontSize: 12 }}>
                Download or print these credentials now. PINs are shown only after registration and are not stored in plain text.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr>
                      {["Name", "Class", "Student ID", "PIN"].map((heading) => (
                        <th
                          key={heading}
                          style={{
                            textAlign: "left",
                            padding: 8,
                            borderBottom: "1px solid #ddd",
                          }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map((credential) => (
                      <tr key={credential.student_id}>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                          {credential.first_name} {credential.last_name}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                          {credential.class_name}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                          {credential.student_id}
                        </td>
                        <td
                          style={{
                            padding: 8,
                            borderBottom: "1px solid #eee",
                            fontFamily: "monospace",
                          }}
                        >
                          {credential.pin}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #student-credentials-print,
          #student-credentials-print * {
            visibility: visible;
          }
          #student-credentials-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
