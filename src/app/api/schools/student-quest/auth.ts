import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getBearerToken(request: NextRequest): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const parts = authorization.trim().split(/\s+/);

  if (
    parts.length !== 2 ||
    parts[0].toLowerCase() !== "bearer"
  ) {
    return null;
  }

  return parts[1] || null;
}

export async function getStudentContext(request: NextRequest) {
  const token = getBearerToken(request);

  if (!token) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Student session is required.",
        },
        { status: 401 }
      ),
    };
  }

  const tokenHash = hashToken(token);

  /*
   * ---------------------------------------------------------
   * 1. Validate student session
   * ---------------------------------------------------------
   */

  const { data: session, error: sessionError } =
    await supabaseServer
      .from("school_student_sessions")
      .select(
        "id, student_id, expires_at, revoked_at"
      )
      .eq("token_hash", tokenHash)
      .maybeSingle();

  if (sessionError) {
    console.error(
      "School Quest session error:",
      sessionError
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "We could not verify your learning session.",
        },
        { status: 500 }
      ),
    };
  }

  if (!session) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "Your learning session is no longer valid.",
        },
        { status: 401 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 2. Check session expiry/revocation
   * ---------------------------------------------------------
   */

  if (
    session.revoked_at ||
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "Your learning session has expired. Please sign in again.",
        },
        { status: 401 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 3. Load student
   * ---------------------------------------------------------
   */

  const { data: student, error: studentError } =
    await supabaseServer
      .from("school_students")
      .select(
        "id, school_id, first_name, last_name, student_id, status"
      )
      .eq("id", session.student_id)
      .maybeSingle();

  if (studentError || !student) {
    console.error(
      "School Quest student error:",
      studentError
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "Student account could not be found.",
        },
        { status: 401 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 4. Student must be active
   * ---------------------------------------------------------
   */

  if (student.status !== "active") {
    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "Your student account is currently inactive.",
        },
        { status: 403 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 5. Load school
   * ---------------------------------------------------------
   */

  const { data: school, error: schoolError } =
    await supabaseServer
      .from("schools")
      .select(
        "id, school_name, school_code, status"
      )
      .eq("id", student.school_id)
      .maybeSingle();

  if (schoolError || !school) {
    console.error(
      "School Quest school error:",
      schoolError
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "We could not load your school information.",
        },
        { status: 500 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 6. School must be active
   * ---------------------------------------------------------
   */

  if (school.status !== "active") {
    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "Your school's Sahaba Quest access is currently unavailable.",
        },
        { status: 403 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 7. Verify active school subscription
   * ---------------------------------------------------------
   */

  const { data: subscription, error: subscriptionError } =
    await supabaseServer
      .from("school_subscriptions")
      .select(
        "id, status, billing_interval, current_period_end"
      )
      .eq("school_id", school.id)
      .eq("status", "active")
      .gt(
        "current_period_end",
        new Date().toISOString()
      )
      .order("current_period_end", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

  if (subscriptionError || !subscription) {
    console.error(
      "School Quest subscription error:",
      subscriptionError
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "Your school's Sahaba Quest subscription is inactive or expired.",
        },
        { status: 403 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 8. Load student progress
   * ---------------------------------------------------------
   */

  const { data: progress, error: progressError } =
    await supabaseServer
      .from("school_student_progress")
      .select(
        `
        id,
        current_level,
        total_xp,
        questions_answered,
        correct_answers,
        current_streak,
        best_streak
        `
      )
      .eq("student_id", student.id)
      .maybeSingle();

  if (progressError) {
    console.error(
      "School Quest progress error:",
      progressError
    );

    return {
      error: NextResponse.json(
        {
          success: false,
          message:
            "We could not load your learning progress.",
        },
        { status: 500 }
      ),
    };
  }

  /*
   * ---------------------------------------------------------
   * 9. Create progress if it doesn't exist
   * ---------------------------------------------------------
   */

  let studentProgress = progress;

  if (!studentProgress) {
    const {
      data: createdProgress,
      error: createError,
    } = await supabaseServer
      .from("school_student_progress")
      .insert({
        student_id: student.id,
      })
      .select(
        `
        id,
        current_level,
        total_xp,
        questions_answered,
        correct_answers,
        current_streak,
        best_streak
        `
      )
      .single();

    if (createError) {
      console.error(
        "School Quest progress creation error:",
        createError
      );

      return {
        error: NextResponse.json(
          {
            success: false,
            message:
              "We could not initialize your learning progress.",
          },
          { status: 500 }
        ),
      };
    }

    studentProgress = createdProgress;
  }

  /*
   * ---------------------------------------------------------
   * 10. Return complete student context
   * ---------------------------------------------------------
   */

  return {
    token,
    session,
    student,
    school,
    subscription,
    progress: studentProgress,
  };
}