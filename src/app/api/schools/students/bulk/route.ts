import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

type ImportStudent = {
  first_name?: unknown;
  last_name?: unknown;
  class_name?: unknown;
};

type NormalizedStudent = {
  first_name: string;
  last_name: string;
  class_name: string;
  class_id: string;
};

function generatePin(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashPin(pin: string): string {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function getSchoolAdmin(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { success: false, error: "Authentication required." },
        { status: 401 }
      ),
    };
  }

  const accessToken = authorization.substring("Bearer ".length);
  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { success: false, error: "Invalid or expired session." },
        { status: 401 }
      ),
    };
  }

  const { data: schoolAdmin, error: adminError } = await supabaseServer
    .from("school_admins")
    .select("id, school_id, user_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError) {
    console.error("School admin lookup failed:", adminError);
    return {
      error: NextResponse.json(
        { success: false, error: "Unable to verify school administrator account." },
        { status: 500 }
      ),
    };
  }

  if (!schoolAdmin) {
    return {
      error: NextResponse.json(
        { success: false, error: "You are not an active school administrator." },
        { status: 403 }
      ),
    };
  }

  const { data: school, error: schoolError } = await supabaseServer
    .from("schools")
    .select("id, school_name, school_code, status")
    .eq("id", schoolAdmin.school_id)
    .maybeSingle();

  if (schoolError) {
    console.error("School lookup failed:", schoolError);
    return {
      error: NextResponse.json(
        { success: false, error: "Unable to load school information." },
        { status: 500 }
      ),
    };
  }

  if (!school) {
    return {
      error: NextResponse.json(
        { success: false, error: "School could not be found." },
        { status: 404 }
      ),
    };
  }

  return { user, schoolAdmin, school };
}

export async function POST(request: Request) {
  try {
    const auth = await getSchoolAdmin(request);
    if (auth.error) return auth.error;

    const { school } = auth;

    if (school.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your school account is not active. Please activate or renew your subscription before adding students.",
        },
        { status: 403 }
      );
    }

    let body: { students?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid request body." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.students) || body.students.length === 0) {
      return NextResponse.json(
        { success: false, error: "Upload at least one student record." },
        { status: 400 }
      );
    }

    if (body.students.length > 500) {
      return NextResponse.json(
        { success: false, error: "A single import can contain at most 500 students." },
        { status: 400 }
      );
    }

    const inputRows = body.students as ImportStudent[];
    const normalizedRows = inputRows.map((row, index) => ({
      rowNumber: index + 1,
      first_name: cleanText(row?.first_name),
      last_name: cleanText(row?.last_name),
      class_name: cleanText(row?.class_name),
    }));

    const invalidRows = normalizedRows.filter(
      (row) => !row.first_name || !row.last_name || !row.class_name
    );

    if (invalidRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Every row must include first name, last name, and class.",
          invalid_rows: invalidRows.map((row) => ({
            row: row.rowNumber,
            missing: [
              !row.first_name ? "first_name" : null,
              !row.last_name ? "last_name" : null,
              !row.class_name ? "class_name" : null,
            ].filter(Boolean),
          })),
        },
        { status: 400 }
      );
    }

    const { data: classes, error: classesError } = await supabaseServer
      .from("school_classes")
      .select("id, class_name, status")
      .eq("school_id", school.id)
      .eq("status", "active");

    if (classesError) {
      console.error("School classes lookup failed:", classesError);
      return NextResponse.json(
        { success: false, error: "Unable to load your school's active classes." },
        { status: 500 }
      );
    }

    const classesByName = new Map<string, { id: string; class_name: string }>();
    for (const schoolClass of classes ?? []) {
      const key = schoolClass.class_name.trim().toLocaleLowerCase();
      // Avoid silently choosing one class if names are duplicated.
      if (!classesByName.has(key)) {
        classesByName.set(key, {
          id: schoolClass.id,
          class_name: schoolClass.class_name,
        });
      } else {
        classesByName.set(key, { id: "", class_name: schoolClass.class_name });
      }
    }

    const unresolvedRows: Array<{ row: number; class_name: string; reason: string }> = [];
    const resolvedRows: NormalizedStudent[] = [];

    for (const row of normalizedRows) {
      const match = classesByName.get(row.class_name.toLocaleLowerCase());
      if (!match) {
        unresolvedRows.push({
          row: row.rowNumber,
          class_name: row.class_name,
          reason: "No active class with this name exists in your school.",
        });
        continue;
      }
      if (!match.id) {
        unresolvedRows.push({
          row: row.rowNumber,
          class_name: row.class_name,
          reason: "More than one active class has this name. Please use unique class names.",
        });
        continue;
      }
      resolvedRows.push({
        first_name: row.first_name,
        last_name: row.last_name,
        class_name: match.class_name,
        class_id: match.id,
      });
    }

    if (unresolvedRows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Some rows could not be matched to an active class. No students were created.",
          invalid_rows: unresolvedRows,
        },
        { status: 400 }
      );
    }

    const duplicateRows = new Map<string, number>();
    const duplicates: Array<{ row: number; first_name: string; last_name: string; class_name: string }> = [];
    normalizedRows.forEach((row) => {
      const key = `${row.first_name.toLocaleLowerCase()}|${row.last_name.toLocaleLowerCase()}|${row.class_name.toLocaleLowerCase()}`;
      const previousRow = duplicateRows.get(key);
      if (previousRow !== undefined) {
        duplicates.push({
          row: row.rowNumber,
          first_name: row.first_name,
          last_name: row.last_name,
          class_name: row.class_name,
        });
      } else {
        duplicateRows.set(key, row.rowNumber);
      }
    });

    if (duplicates.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Duplicate student rows were found in the uploaded file. No students were created.",
          duplicate_rows: duplicates,
        },
        { status: 400 }
      );
    }

    const { data: subscription, error: subscriptionError } = await supabaseServer
      .from("school_subscriptions")
      .select("id, student_seat_limit, current_period_end, status")
      .eq("school_id", school.id)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error("Subscription lookup failed:", subscriptionError);
      return NextResponse.json(
        { success: false, error: "Unable to verify school subscription." },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "Your school does not have an active subscription." },
        { status: 403 }
      );
    }

    if (
      subscription.current_period_end &&
      new Date(subscription.current_period_end).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Your school subscription has expired. Please renew it before adding students.",
        },
        { status: 403 }
      );
    }

    const { count: activeStudentCount, error: countError } = await supabaseServer
      .from("school_students")
      .select("id", { count: "exact", head: true })
      .eq("school_id", school.id)
      .eq("status", "active");

    if (countError) {
      console.error("Active student count failed:", countError);
      return NextResponse.json(
        { success: false, error: "Unable to calculate available student seats." },
        { status: 500 }
      );
    }

    const activeStudents = activeStudentCount ?? 0;
    const seatLimit = subscription.student_seat_limit ?? 0;
    const seatsRemaining = Math.max(0, seatLimit - activeStudents);

    if (resolvedRows.length > seatsRemaining) {
      return NextResponse.json(
        {
          success: false,
          error: `This upload contains ${resolvedRows.length} students, but only ${seatsRemaining} student seat(s) remain. No students were created.`,
          seats: { limit: seatLimit, used: activeStudents, remaining: seatsRemaining },
        },
        { status: 409 }
      );
    }

    // Match the existing route's ID format: school_code + '-' + a 4-digit sequence.
    const { data: existingStudents, error: idsError } = await supabaseServer
      .from("school_students")
      .select("student_id")
      .eq("school_id", school.id)
      .like("student_id", `${school.school_code}-%`);

    if (idsError) {
      console.error("Student ID lookup failed:", idsError);
      return NextResponse.json(
        { success: false, error: "Unable to generate student IDs." },
        { status: 500 }
      );
    }

    const prefix = `${school.school_code}-`;
    let highestSequence = 0;
    for (const existing of existingStudents ?? []) {
      const id = existing.student_id;
      if (typeof id !== "string" || !id.startsWith(prefix)) continue;
      const sequence = Number.parseInt(id.substring(prefix.length), 10);
      if (Number.isSafeInteger(sequence) && sequence > highestSequence) {
        highestSequence = sequence;
      }
    }

    const credentials: Array<{
      first_name: string;
      last_name: string;
      class_name: string;
      student_id: string;
      pin: string;
    }> = [];

    const recordsToInsert = resolvedRows.map((student, index) => {
      const studentId = `${prefix}${String(highestSequence + index + 1).padStart(4, "0")}`;
      const pin = generatePin();
      credentials.push({
        first_name: student.first_name,
        last_name: student.last_name,
        class_name: student.class_name,
        student_id: studentId,
        pin,
      });
      return {
        school_id: school.id,
        class_id: student.class_id,
        first_name: student.first_name,
        last_name: student.last_name,
        student_id: studentId,
        pin_hash: hashPin(pin),
        status: "active",
      };
    });

    // Insert the entire batch in one database operation. If a unique constraint
    // is hit, the batch is rejected rather than partially importing students.
    const { data: insertedStudents, error: insertError } = await supabaseServer
      .from("school_students")
      .insert(recordsToInsert)
      .select("id, first_name, last_name, student_id, class_id, status, created_at");

    if (insertError) {
      console.error("Bulk student creation failed:", insertError);
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            error: "A student ID or unique-record conflict occurred. No students were imported. Please retry the import.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: "Unable to create students. No credentials have been issued." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `${insertedStudents?.length ?? 0} student(s) created successfully. Save or print the credentials now; PINs cannot be retrieved later.`,
        students: insertedStudents ?? [],
        credentials,
        seats: {
          limit: seatLimit,
          used: activeStudents + resolvedRows.length,
          remaining: Math.max(0, seatLimit - activeStudents - resolvedRows.length),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected bulk student creation error:", error);
    return NextResponse.json(
      { success: false, error: "An unexpected error occurred while importing students." },
      { status: 500 }
    );
  }
}
