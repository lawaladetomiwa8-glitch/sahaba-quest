import { NextRequest, NextResponse } from "next/server";

import { supabaseServer } from "@/lib/supabase-server";
import { getStudentContext } from "@/app/api/schools/student-quest/auth";

type LeaderboardRow = {
  rank: number;
  student_id: string;
  student_name: string;
  student_code: string;
  class_id: string;
  class_name: string;
  monthly_xp: number | string;
  questions_answered: number | string;
  correct_answers: number | string;
  accuracy: number | string;
  is_current_student: boolean;
};

function isValidMonth(value: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function toNumber(
  value: number | string | null | undefined
): number {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed) ? parsed : 0;
}

export async function GET(request: NextRequest) {
  try {
    /*
     * ---------------------------------------------------------
     * Verify the student's school learning session.
     * ---------------------------------------------------------
     */

    const context = await getStudentContext(request);

    if ("error" in context) {
      return context.error;
    }

    const { student, school } = context;

    /*
     * ---------------------------------------------------------
     * Get the student's current class.
     *
     * getStudentContext() does not return schoolClass,
     * so we deliberately load it here from school_students.
     * ---------------------------------------------------------
     */

    const { data: studentRecord, error: studentError } =
      await supabaseServer
        .from("school_students")
        .select(
          `
            id,
            school_id,
            class_id
          `
        )
        .eq("id", student.id)
        .eq("school_id", school.id)
        .eq("status", "active")
        .maybeSingle();

    if (studentError) {
      console.error(
        "School student class lookup error:",
        studentError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "We could not determine your current class.",
        },
        { status: 500 }
      );
    }

    if (!studentRecord) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your student record could not be found.",
        },
        { status: 404 }
      );
    }

    if (!studentRecord.class_id) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You are not currently assigned to a class, so your class leaderboard is not available yet.",
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Load the student's class.
     *
     * The class must belong to the same school as the student.
     * ---------------------------------------------------------
     */

    const { data: schoolClass, error: classError } =
      await supabaseServer
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
        .eq("id", studentRecord.class_id)
        .eq("school_id", school.id)
        .maybeSingle();

    if (classError) {
      console.error(
        "School class lookup error:",
        classError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "We could not load your current class.",
        },
        { status: 500 }
      );
    }

    if (!schoolClass) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Your assigned class could not be found.",
        },
        { status: 404 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Validate requested month.
     *
     * Expected format:
     *
     * YYYY-MM
     *
     * Example:
     *
     * 2026-10
     * ---------------------------------------------------------
     */

    const requestedMonth =
      request.nextUrl.searchParams
        .get("month")
        ?.trim() ?? "";

    if (
      requestedMonth &&
      !isValidMonth(requestedMonth)
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Invalid month. Please use the YYYY-MM format.",
        },
        { status: 400 }
      );
    }

    /*
     * Use the current month when no month was supplied.
     *
     * We use the server date here because the leaderboard
     * should always be based on the server's current month.
     */

    const month =
      requestedMonth ||
      new Date().toISOString().slice(0, 7);

    /*
     * ---------------------------------------------------------
     * Get the class leaderboard.
     * ---------------------------------------------------------
     *
     * The RPC itself determines the student's school and class
     * from the supplied student UUID.
     *
     * It also calculates:
     * - rank
     * - monthly XP
     * - questions answered
     * - correct answers
     * - accuracy
     * - current student
     */

    const { data, error } =
      await supabaseServer.rpc(
        "get_school_class_leaderboard",
        {
          p_student_id: student.id,
          p_month: `${month}-01`,
        }
      );

    if (error) {
      console.error(
        "School class leaderboard RPC error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "We could not load your class leaderboard right now.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Normalize the RPC response.
     * ---------------------------------------------------------
     */

    const leaderboard: LeaderboardRow[] =
      (data ?? []).map(
        (row: LeaderboardRow) => ({
          rank: toNumber(row.rank),
          student_id: row.student_id,
          student_name: row.student_name,
          student_code: row.student_code,
          class_id: row.class_id,
          class_name: row.class_name,
          monthly_xp: toNumber(row.monthly_xp),
          questions_answered: toNumber(
            row.questions_answered
          ),
          correct_answers: toNumber(
            row.correct_answers
          ),
          accuracy: toNumber(row.accuracy),
          is_current_student:
            Boolean(row.is_current_student),
        })
      );

    /*
     * ---------------------------------------------------------
     * Find the currently logged-in student's leaderboard row.
     * ---------------------------------------------------------
     */

    const currentStudent =
      leaderboard.find(
        (row) => row.is_current_student
      ) ?? null;

    /*
     * ---------------------------------------------------------
     * Return the leaderboard.
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      month,

      class: {
        id: schoolClass.id,
        name: schoolClass.class_name,
        academic_session:
          schoolClass.academic_session ?? null,
      },

      student: {
        id: student.id,
        student_id: student.student_id,
        name: `${student.first_name} ${student.last_name}`.trim(),
      },

      leaderboard,

      current_student: currentStudent,
    });
  } catch (error) {
    console.error(
      "School class leaderboard error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while loading the leaderboard.",
      },
      { status: 500 }
    );
  }
}