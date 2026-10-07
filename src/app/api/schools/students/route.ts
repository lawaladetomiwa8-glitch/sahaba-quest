import { NextResponse } from "next/server";
import crypto from "crypto";

import { supabaseServer } from "@/lib/supabase-server";

/**
 * Get the authenticated school administrator and their school.
 *
 * This route is intentionally isolated from:
 * - Individual accounts
 * - Family accounts
 * - Existing organization tables
 */
async function getSchoolAdmin(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      ),
    };
  }

  const accessToken =
    authorization.substring("Bearer ".length);

  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Invalid or expired session.",
        },
        { status: 401 }
      ),
    };
  }

  const {
    data: schoolAdmin,
    error: adminError,
  } = await supabaseServer
    .from("school_admins")
    .select(
      `
        id,
        school_id,
        user_id,
        role,
        status
      `
    )
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError) {
    console.error(
      "School admin lookup failed:",
      adminError
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify school administrator account.",
        },
        { status: 500 }
      ),
    };
  }

  if (!schoolAdmin) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error:
            "You are not an active school administrator.",
        },
        { status: 403 }
      ),
    };
  }

  const {
    data: school,
    error: schoolError,
  } = await supabaseServer
    .from("schools")
    .select(
      `
        id,
        school_name,
        school_code,
        status
      `
    )
    .eq("id", schoolAdmin.school_id)
    .maybeSingle();

  if (schoolError) {
    console.error(
      "School lookup failed:",
      schoolError
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          error: "Unable to load school information.",
        },
        { status: 500 }
      ),
    };
  }

  if (!school) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: "School could not be found.",
        },
        { status: 404 }
      ),
    };
  }

  return {
    user,
    schoolAdmin,
    school,
  };
}

/**
 * GET
 *
 * Returns all students belonging to the authenticated
 * school administrator's school.
 */
export async function GET(request: Request) {
  try {
    const auth = await getSchoolAdmin(request);

    if (auth.error) {
      return auth.error;
    }

    const { school } = auth;

    const {
      data: students,
      error: studentsError,
    } = await supabaseServer
      .from("school_students")
      .select(
        `
          id,
          school_id,
          class_id,
          first_name,
          last_name,
          student_id,
          status,
          created_at,
          updated_at,
          school_classes (
            id,
            class_name,
            academic_session
          )
        `
      )
      .eq("school_id", school.id)
      .order("created_at", {
        ascending: false,
      });

    if (studentsError) {
      console.error(
        "Students lookup failed:",
        studentsError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Unable to load students.",
        },
        { status: 500 }
      );
    }

    /**
     * Active subscription
     */
    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseServer
      .from("school_subscriptions")
      .select(
        `
          id,
          student_seat_limit,
          current_period_end,
          status
        `
      )
      .eq("school_id", school.id)
      .eq("status", "active")
      .order("current_period_end", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "School subscription lookup failed:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify school subscription.",
        },
        { status: 500 }
      );
    }

    /**
     * Count active students only.
     *
     * Inactive students do not consume seats.
     */
    const {
      count: activeStudentCount,
      error: activeCountError,
    } = await supabaseServer
      .from("school_students")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("school_id", school.id)
      .eq("status", "active");

    if (activeCountError) {
      console.error(
        "Active student count failed:",
        activeCountError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to calculate student seat usage.",
        },
        { status: 500 }
      );
    }

    const seatLimit =
      subscription?.student_seat_limit ?? 0;

    const seatsUsed =
      activeStudentCount ?? 0;

    const seatsRemaining = Math.max(
      0,
      seatLimit - seatsUsed
    );

    return NextResponse.json({
      success: true,

      students: students ?? [],

      seats: {
        limit: seatLimit,
        used: seatsUsed,
        remaining: seatsRemaining,
      },

      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            student_seat_limit:
              subscription.student_seat_limit,
            current_period_end:
              subscription.current_period_end,
          }
        : null,
    });
  } catch (error) {
    console.error(
      "Unexpected GET students error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while loading students.",
      },
      { status: 500 }
    );
  }
}

/**
 * Generate the next Student ID.
 *
 * IMPORTANT:
 *
 * School code:
 *   SQ-303444
 *
 * Generated Student ID:
 *   SQ-303444-0001
 *
 * NOT:
 *   SQ-SQ-303444-0001
 */
async function generateStudentId(
  schoolId: string,
  schoolCode: string
) {
  /**
   * Get existing IDs belonging to this school.
   *
   * We use the school_code as the prefix.
   */
  const {
    data: existingStudents,
    error,
  } = await supabaseServer
    .from("school_students")
    .select("student_id")
    .eq("school_id", schoolId)
    .like("student_id", `${schoolCode}-%`)
    .order("student_id", {
      ascending: false,
    })
    .limit(1);

  if (error) {
    console.error(
      "Student ID lookup failed:",
      error
    );

    throw new Error(
      "Unable to generate student ID."
    );
  }

  let nextSequence = 1;

  if (
    existingStudents &&
    existingStudents.length > 0
  ) {
    const latestStudentId =
      existingStudents[0].student_id;

    /**
     * Example:
     *
     * SQ-303444-0012
     *
     * We extract:
     *
     * 0012
     */
    const prefix = `${schoolCode}-`;

    if (
      latestStudentId.startsWith(prefix)
    ) {
      const sequencePart =
        latestStudentId.substring(
          prefix.length
        );

      const parsedSequence =
        Number.parseInt(
          sequencePart,
          10
        );

      if (
        Number.isFinite(parsedSequence) &&
        parsedSequence >= 1
      ) {
        nextSequence =
          parsedSequence + 1;
      }
    }
  }

  return `${schoolCode}-${nextSequence
    .toString()
    .padStart(4, "0")}`;
}

/**
 * Generate a six-digit PIN.
 */
function generatePin(): string {
  return crypto
    .randomInt(100000, 1000000)
    .toString();
}

/**
 * Hash the PIN before storing it.
 *
 * The plaintext PIN is NEVER stored in the database.
 */
function hashPin(pin: string): string {
  return crypto
    .createHash("sha256")
    .update(pin)
    .digest("hex");
}

/**
 * POST
 *
 * Creates a new school student.
 */
export async function POST(request: Request) {
  try {
    const auth = await getSchoolAdmin(request);

    if (auth.error) {
      return auth.error;
    }

    const { school } = auth;

    /**
     * Parse request body.
     */
    let body: {
      first_name?: unknown;
      last_name?: unknown;
      class_id?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const firstName =
      typeof body.first_name === "string"
        ? body.first_name.trim()
        : "";

    const lastName =
      typeof body.last_name === "string"
        ? body.last_name.trim()
        : "";

    const classId =
      typeof body.class_id === "string"
        ? body.class_id.trim()
        : "";

    /**
     * Validate names.
     */
    if (!firstName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Student first name is required.",
        },
        { status: 400 }
      );
    }

    if (!lastName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Student last name is required.",
        },
        { status: 400 }
      );
    }

    /**
     * Validate class.
     */
    if (!classId) {
      return NextResponse.json(
        {
          success: false,
          error: "Student class is required.",
        },
        { status: 400 }
      );
    }

    /**
     * The school must be active before students
     * can be created.
     */
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

    /**
     * Verify that the selected class belongs to
     * this school and is active.
     */
    const {
      data: schoolClass,
      error: classError,
    } = await supabaseServer
      .from("school_classes")
      .select(
        `
          id,
          school_id,
          class_name,
          academic_session,
          status
        `
      )
      .eq("id", classId)
      .eq("school_id", school.id)
      .maybeSingle();

    if (classError) {
      console.error(
        "Class lookup failed:",
        classError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify the selected class.",
        },
        { status: 500 }
      );
    }

    if (!schoolClass) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected class does not belong to your school.",
        },
        { status: 400 }
      );
    }

    if (schoolClass.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Students can only be added to an active class.",
        },
        { status: 400 }
      );
    }

    /**
     * Load active school subscription.
     */
    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseServer
      .from("school_subscriptions")
      .select(
        `
          id,
          student_seat_limit,
          current_period_end,
          status
        `
      )
      .eq("school_id", school.id)
      .eq("status", "active")
      .order("current_period_end", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Subscription lookup failed:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to verify school subscription.",
        },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your school does not have an active subscription.",
        },
        { status: 403 }
      );
    }

    /**
     * Verify subscription period.
     */
    if (
      subscription.current_period_end &&
      new Date(
        subscription.current_period_end
      ).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your school subscription has expired. Please renew your subscription before adding students.",
        },
        { status: 403 }
      );
    }

    /**
     * Count ACTIVE students.
     *
     * Inactive students do not consume seats.
     */
    const {
      count: activeStudentCount,
      error: activeCountError,
    } = await supabaseServer
      .from("school_students")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("school_id", school.id)
      .eq("status", "active");

    if (activeCountError) {
      console.error(
        "Active student count failed:",
        activeCountError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to calculate available student seats.",
        },
        { status: 500 }
      );
    }

    const activeStudents =
      activeStudentCount ?? 0;

    const seatLimit =
      subscription.student_seat_limit;

    /**
     * Strict backend seat enforcement.
     */
    if (activeStudents >= seatLimit) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your school has reached its student seat limit. Please increase your seat capacity before adding another student.",
          seats: {
            limit: seatLimit,
            used: activeStudents,
            remaining: 0,
          },
        },
        { status: 409 }
      );
    }

    /**
     * Generate Student ID.
     *
     * Correct format:
     *
     * SQ-303444-0001
     */
    let studentId = "";

    try {
      studentId =
        await generateStudentId(
          school.id,
          school.school_code
        );
    } catch (error) {
      console.error(
        "Student ID generation failed:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to generate a student ID.",
        },
        { status: 500 }
      );
    }

    /**
     * Generate the student's six-digit PIN.
     */
    const pin = generatePin();

    /**
     * Store only the hashed PIN.
     */
    const pinHash = hashPin(pin);

    /**
     * Insert student.
     */
    const {
      data: student,
      error: insertError,
    } = await supabaseServer
      .from("school_students")
      .insert({
        school_id: school.id,
        class_id: schoolClass.id,
        first_name: firstName,
        last_name: lastName,
        student_id: studentId,
        pin_hash: pinHash,
        status: "active",
      })
      .select(
        `
          id,
          school_id,
          class_id,
          first_name,
          last_name,
          student_id,
          status,
          created_at
        `
      )
      .single();

    if (insertError) {
      console.error(
        "Student creation failed:",
        insertError
      );

      /**
       * If the Student ID collided because another
       * request generated the same sequence, tell
       * the client to retry rather than creating
       * an incorrect record.
       */
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            success: false,
            error:
              "A student ID collision occurred. Please try again.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to create the student.",
        },
        { status: 500 }
      );
    }

    /**
     * New seat usage after creation.
     */
    const newUsedCount =
      activeStudents + 1;

    const newRemainingSeats = Math.max(
      0,
      seatLimit - newUsedCount
    );

    /**
     * IMPORTANT:
     *
     * The plaintext PIN is returned ONLY in this
     * creation response.
     *
     * It is not stored in the database.
     */
    return NextResponse.json(
      {
        success: true,

        student: {
          id: student.id,
          first_name: student.first_name,
          last_name: student.last_name,
          student_id: student.student_id,
          status: student.status,
          class_id: student.class_id,
          created_at: student.created_at,
        },

        credentials: {
          student_id: student.student_id,
          pin,
        },

        seats: {
          limit: seatLimit,
          used: newUsedCount,
          remaining: newRemainingSeats,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Unexpected POST students error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while creating the student.",
      },
      { status: 500 }
    );
  }
}