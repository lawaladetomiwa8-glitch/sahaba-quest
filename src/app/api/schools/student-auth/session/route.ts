import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export async function GET(request: Request) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. READ SESSION TOKEN
     * ---------------------------------------------------------
     */

    const token = getToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "Student session required.",
        },
        { status: 401 }
      );
    }

    const tokenHash = hashToken(token);

    /*
     * ---------------------------------------------------------
     * 2. FIND SESSION
     * ---------------------------------------------------------
     *
     * Keep this query deliberately simple.
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
        "Student session lookup error:",
        sessionError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify your learning session.",
        },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json(
        {
          success: false,
          message: "Your learning session is invalid.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 3. CHECK SESSION EXPIRY / REVOCATION
     * ---------------------------------------------------------
     */

    const now = new Date();

    if (
      session.revoked_at ||
      !session.expires_at ||
      new Date(session.expires_at) <= now
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your learning session has expired. Please sign in again.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 4. LOAD STUDENT
     * ---------------------------------------------------------
     */

    const { data: student, error: studentError } =
      await supabaseServer
        .from("school_students")
        .select(
          `
          id,
          school_id,
          class_id,
          first_name,
          last_name,
          student_id,
          status
        `
        )
        .eq("id", session.student_id)
        .maybeSingle();

    if (studentError) {
      console.error(
        "Student session student lookup error:",
        studentError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to verify your student account.",
        },
        { status: 500 }
      );
    }

    if (!student) {
      return NextResponse.json(
        {
          success: false,
          message: "Student account could not be found.",
        },
        { status: 401 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 5. CHECK STUDENT STATUS
     * ---------------------------------------------------------
     */

    if (student.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your student account is currently inactive.",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 6. LOAD SCHOOL
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

    if (schoolError) {
      console.error(
        "Student session school lookup error:",
        schoolError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to verify your school's account.",
        },
        { status: 500 }
      );
    }

    if (!school || school.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your school's Sahaba Quest account is currently unavailable.",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 7. CHECK SCHOOL SUBSCRIPTION
     * ---------------------------------------------------------
     */

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseServer
      .from("school_subscriptions")
      .select(
        `
        id,
        status,
        current_period_start,
        current_period_end,
        billing_interval
        `
      )
      .eq("school_id", student.school_id)
      .eq("status", "active")
      .order("current_period_end", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Student session subscription error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to verify your school's subscription.",
        },
        { status: 500 }
      );
    }

    if (
      !subscription ||
      !subscription.current_period_end ||
      new Date(subscription.current_period_end) <= now
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your school's Sahaba Quest subscription has ended.",
        },
        { status: 403 }
      );
    }

    /*
     * ---------------------------------------------------------
     * 8. LOAD CLASS
     * ---------------------------------------------------------
     */

    let classData: {
      class_name: string;
      academic_session: string | null;
    } | null = null;

    if (student.class_id) {
      const { data: schoolClass, error: classError } =
        await supabaseServer
          .from("school_classes")
          .select(
            "class_name, academic_session"
          )
          .eq("id", student.class_id)
          .eq("school_id", student.school_id)
          .maybeSingle();

      if (classError) {
        console.error(
          "Student session class lookup error:",
          classError
        );

        return NextResponse.json(
          {
            success: false,
            message:
              "Unable to load your class information.",
          },
          { status: 500 }
        );
      }

      classData = schoolClass;
    }

    /*
     * ---------------------------------------------------------
     * 9. REFRESH SESSION ACTIVITY
     * ---------------------------------------------------------
     */

    const { error: activityError } =
      await supabaseServer
        .from("school_student_sessions")
        .update({
          last_seen_at: now.toISOString(),
        })
        .eq("id", session.id);

    if (activityError) {
      /*
       * Do not invalidate an otherwise valid student session
       * merely because the activity timestamp could not be
       * refreshed.
       */
      console.error(
        "Student session activity update error:",
        activityError
      );
    }

    /*
     * ---------------------------------------------------------
     * 10. RETURN VALID SESSION
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      student: {
        id: student.id,
        student_id: student.student_id,
        first_name: student.first_name,
        last_name: student.last_name,

        school: {
          id: school.id,
          name: school.school_name,
          code: school.school_code,
        },

        class: classData
          ? {
              name: classData.class_name,
              academic_session:
                classData.academic_session,
            }
          : null,
      },

      subscription: {
        billing_interval:
          subscription.billing_interval,
        current_period_end:
          subscription.current_period_end,
      },

      session: {
        expires_at: session.expires_at,
      },
    });
  } catch (error) {
    console.error(
      "Student session validation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while verifying your session.",
      },
      { status: 500 }
    );
  }
}