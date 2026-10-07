import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

const SESSION_DURATION_DAYS = 7;

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function verifyPin(pin: string, storedHash: string): boolean {
  const pinHash = crypto
    .createHash("sha256")
    .update(pin)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(pinHash, "hex"),
    Buffer.from(storedHash, "hex")
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const studentId =
      typeof body.student_id === "string"
        ? body.student_id.trim().toUpperCase()
        : "";

    const pin =
      typeof body.pin === "string"
        ? body.pin.trim()
        : "";

    if (!studentId || !pin) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter your Student ID and PIN.",
        },
        { status: 400 }
      );
    }

    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        {
          success: false,
          message: "The Student ID or PIN is incorrect.",
        },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // Find student
    // ----------------------------------------------------------

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
          pin_hash,
          status,
          school_classes (
            class_name,
            academic_session
          )
        `
        )
        .eq("student_id", studentId)
        .maybeSingle();

    if (studentError) {
      console.error("Student lookup error:", studentError);

      return NextResponse.json(
        {
          success: false,
          message: "Unable to sign in at the moment. Please try again.",
        },
        { status: 500 }
      );
    }

    // Deliberately generic to prevent Student ID enumeration.
    if (!student) {
      return NextResponse.json(
        {
          success: false,
          message: "The Student ID or PIN is incorrect.",
        },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // Verify PIN
    // ----------------------------------------------------------

    let pinIsValid = false;

    try {
      pinIsValid = verifyPin(pin, student.pin_hash);
    } catch (error) {
      console.error("PIN verification error:", error);
      pinIsValid = false;
    }

    if (!pinIsValid) {
      return NextResponse.json(
        {
          success: false,
          message: "The Student ID or PIN is incorrect.",
        },
        { status: 401 }
      );
    }

    // ----------------------------------------------------------
    // Student must be active
    // ----------------------------------------------------------

    if (student.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your student account is currently inactive. Please speak with your school administrator.",
        },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------
    // Verify school
    // ----------------------------------------------------------

    const { data: school, error: schoolError } =
      await supabaseServer
        .from("schools")
        .select(
          `
          id,
          school_name,
          school_code,
          status
        `
        )
        .eq("id", student.school_id)
        .maybeSingle();

    if (schoolError) {
      console.error("School lookup error:", schoolError);

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify your school account.",
        },
        { status: 500 }
      );
    }

    if (!school || school.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your school account is currently unavailable. Please speak with your school administrator.",
        },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------
    // Verify active school subscription
    // ----------------------------------------------------------

    const { data: subscription, error: subscriptionError } =
      await supabaseServer
        .from("school_subscriptions")
        .select(
          `
          id,
          status,
          billing_interval,
          currency,
          student_seat_limit,
          current_period_start,
          current_period_end
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
        "School subscription lookup error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify your school subscription.",
        },
        { status: 500 }
      );
    }

    if (!subscription) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your school's Sahaba Quest subscription is not currently active.",
        },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------
    // Verify subscription period
    // ----------------------------------------------------------

    const now = new Date();

    const periodEnd = new Date(
      subscription.current_period_end
    );

    if (periodEnd <= now) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your school's subscription period has ended. Please speak with your school administrator.",
        },
        { status: 403 }
      );
    }

    // ----------------------------------------------------------
    // Create secure session
    // ----------------------------------------------------------

    const sessionToken = crypto.randomBytes(32).toString("hex");

    const tokenHash = hashToken(sessionToken);

    const expiresAt = new Date(
      now.getTime() +
        SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    const { data: session, error: sessionError } =
      await supabaseServer
        .from("school_student_sessions")
        .insert({
          student_id: student.id,
          token_hash: tokenHash,
          expires_at: expiresAt.toISOString(),
        })
        .select("id, expires_at")
        .single();

    if (sessionError || !session) {
      console.error(
        "Student session creation error:",
        sessionError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to start your learning session. Please try again.",
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // Ensure student progress exists
    // ----------------------------------------------------------

    const { error: progressError } =
      await supabaseServer
        .from("school_student_progress")
        .upsert(
          {
            student_id: student.id,
          },
          {
            onConflict: "student_id",
            ignoreDuplicates: true,
          }
        );

    if (progressError) {
      console.error(
        "Student progress initialization error:",
        progressError
      );

      // Revoke session if progress initialization fails.
      await supabaseServer
        .from("school_student_sessions")
        .update({
          revoked_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to prepare your learning account. Please try again.",
        },
        { status: 500 }
      );
    }

    // ----------------------------------------------------------
    // Update last login
    // ----------------------------------------------------------

    const { error: loginUpdateError } =
      await supabaseServer
        .from("school_students")
        .update({
          last_login_at: now.toISOString(),
        })
        .eq("id", student.id);

    if (loginUpdateError) {
      console.error(
        "Student last login update error:",
        loginUpdateError
      );
    }

    // ----------------------------------------------------------
    // Return student session
    // ----------------------------------------------------------

    const classData = Array.isArray(student.school_classes)
      ? student.school_classes[0] ?? null
      : student.school_classes;

    return NextResponse.json({
      success: true,

      message:
        "Assalamu Alaikum. Your learning session has started.",

      session: {
        token: sessionToken,
        expires_at: session.expires_at,
      },

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
    });
  } catch (error) {
    console.error(
      "Student login unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while signing you in. Please try again.",
      },
      { status: 500 }
    );
  }
}