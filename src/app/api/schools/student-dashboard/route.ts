import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) return null;

  const [scheme, token] = authorization.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export async function GET(request: Request) {
  try {
    const token = getToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Student session required." },
        { status: 401 }
      );
    }

    const tokenHash = hashToken(token);

    const { data: session, error: sessionError } = await supabaseServer
      .from("school_student_sessions")
      .select(`
        id,
        student_id,
        expires_at,
        revoked_at,
        school_students (
          id,
          school_id,
          class_id,
          first_name,
          last_name,
          student_id,
          status,
          schools (
            id,
            school_name,
            school_code,
            school_type,
            status
          ),
          school_classes (
            id,
            class_name,
            academic_session
          )
        )
      `)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (sessionError) {
      console.error("Student dashboard session lookup error:", sessionError);

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

    const now = new Date();

    if (session.revoked_at || new Date(session.expires_at) <= now) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your learning session has expired. Please sign in again.",
        },
        { status: 401 }
      );
    }

    const studentData = Array.isArray(session.school_students)
      ? session.school_students[0] ?? null
      : session.school_students;

    if (!studentData) {
      return NextResponse.json(
        {
          success: false,
          message: "Student account could not be found.",
        },
        { status: 401 }
      );
    }

    if (studentData.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message: "Your student account is currently inactive.",
        },
        { status: 403 }
      );
    }

    const schoolData = Array.isArray(studentData.schools)
      ? studentData.schools[0] ?? null
      : studentData.schools;

    if (!schoolData || schoolData.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your school's Sahaba Quest account is currently unavailable.",
        },
        { status: 403 }
      );
    }

    const { data: subscription, error: subscriptionError } =
      await supabaseServer
        .from("school_subscriptions")
        .select(`
          id,
          status,
          billing_interval,
          current_period_end
        `)
        .eq("school_id", studentData.school_id)
        .eq("status", "active")
        .gt("current_period_end", now.toISOString())
        .order("current_period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (subscriptionError) {
      console.error(
        "Student dashboard subscription error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify your school's subscription.",
        },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your school's Sahaba Quest subscription has ended.",
        },
        { status: 403 }
      );
    }

    const { data: progress, error: progressError } = await supabaseServer
      .from("school_student_progress")
      .select(`
        current_level,
        total_xp,
        questions_answered,
        correct_answers,
        current_streak,
        best_streak
      `)
      .eq("student_id", studentData.id)
      .maybeSingle();

    if (progressError) {
      console.error(
        "Student dashboard progress error:",
        progressError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to load your learning progress.",
        },
        { status: 500 }
      );
    }

    const studentProgress = progress ?? {
      current_level: 1,
      total_xp: 0,
      questions_answered: 0,
      correct_answers: 0,
      current_streak: 0,
      best_streak: 0,
    };

    const classData = Array.isArray(studentData.school_classes)
      ? studentData.school_classes[0] ?? null
      : studentData.school_classes;

    /*
     * IMPORTANT:
     * The dashboard page expects school and class at the TOP LEVEL:
     *
     * data.school
     * data.class
     *
     * The previous version incorrectly placed them inside:
     *
     * data.student.school
     * data.student.class
     *
     * That mismatch caused data.school to be undefined and produced
     * the "school information could not be loaded" error.
     */
    return NextResponse.json({
      success: true,

      student: {
        id: studentData.id,
        student_id: studentData.student_id,
        first_name: studentData.first_name,
        last_name: studentData.last_name,
        status: studentData.status,
      },

      school: {
        id: schoolData.id,
        school_name: schoolData.school_name,
        school_code: schoolData.school_code,
        school_type: schoolData.school_type ?? undefined,
        status: schoolData.status,
      },

      class: classData
        ? {
            id: classData.id,
            class_name: classData.class_name,
            academic_session: classData.academic_session,
          }
        : null,

      progress: studentProgress,

      subscription: {
        billing_interval: subscription.billing_interval,
        current_period_end: subscription.current_period_end,
      },

      session_expires_at: session.expires_at,
    });
  } catch (error) {
    console.error("Student dashboard unexpected error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while loading your dashboard.",
      },
      { status: 500 }
    );
  }
}
