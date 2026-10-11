
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

function isValidMonth(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function numberValue(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, message },
    { status }
  );
}

export async function GET(request: NextRequest) {
  try {
    // -------------------------------------------------------
    // 1. Authenticate the school administrator.
    // -------------------------------------------------------
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return errorResponse("Unauthorized.", 401);
    }

    const token = authorization.slice("Bearer ".length).trim();

    if (!token) {
      return errorResponse("Unauthorized.", 401);
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser(token);

    if (authError || !user) {
      return errorResponse("Invalid or expired session.", 401);
    }

    const { data: admin, error: adminError } =
      await supabaseServer
        .from("school_admins")
        .select("school_id, role, status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

    if (adminError) {
      console.error("Leaderboard admin lookup:", adminError);
      return errorResponse("Unable to verify administrator access.", 500);
    }

    if (!admin?.school_id) {
      return errorResponse("School administrator access required.", 403);
    }

    // -------------------------------------------------------
    // 2. Validate the selected month.
    // -------------------------------------------------------
    const requestedMonth =
      request.nextUrl.searchParams.get("month")?.trim() ?? "";

    if (requestedMonth && !isValidMonth(requestedMonth)) {
      return errorResponse("Invalid month. Use YYYY-MM.", 400);
    }

    const month =
      requestedMonth || new Date().toISOString().slice(0, 7);

    const monthStart = `${month}-01`;
    const nextMonthDate = new Date(`${monthStart}T00:00:00.000Z`);
    nextMonthDate.setUTCMonth(nextMonthDate.getUTCMonth() + 1);
    const nextMonthStart = nextMonthDate.toISOString();

    // -------------------------------------------------------
    // 3. Load active classes for this school.
    // -------------------------------------------------------
    const { data: classes, error: classesError } =
      await supabaseServer
        .from("school_classes")
        .select("id, class_name, academic_session")
        .eq("school_id", admin.school_id)
        .order("class_name", { ascending: true });

    if (classesError) {
      console.error("Leaderboard class lookup:", classesError);
      return errorResponse("Unable to load school classes.", 500);
    }

    // -------------------------------------------------------
    // 4. Load active students belonging to this school.
    // -------------------------------------------------------
    const { data: students, error: studentsError } =
      await supabaseServer
        .from("school_students")
        .select(
          "id, school_id, class_id, first_name, last_name, student_id"
        )
        .eq("school_id", admin.school_id)
        .eq("status", "active");

    if (studentsError) {
      console.error("Leaderboard student lookup:", studentsError);
      return errorResponse("Unable to load school students.", 500);
    }

    const activeStudents = students ?? [];
    const studentIds = activeStudents.map((student) => student.id);

    // -------------------------------------------------------
    // 5. Load cumulative XP from existing student progress.
    // -------------------------------------------------------
    const progressByStudent = new Map<
      string,
      { total_xp: number; questions_answered: number; correct_answers: number }
    >();

    if (studentIds.length > 0) {
      const { data: progress, error: progressError } =
        await supabaseServer
          .from("school_student_progress")
          .select(
            "student_id, total_xp, questions_answered, correct_answers"
          )
          .in("student_id", studentIds);

      if (progressError) {
        console.error("Leaderboard progress lookup:", progressError);
        return errorResponse("Unable to load student XP records.", 500);
      }

      for (const row of progress ?? []) {
        progressByStudent.set(row.student_id, {
          total_xp: numberValue(row.total_xp),
          questions_answered: numberValue(row.questions_answered),
          correct_answers: numberValue(row.correct_answers),
        });
      }
    }

    // -------------------------------------------------------
    // 6. Calculate selected-month statistics from question
    //    attempts, matching the existing class leaderboard.
    // -------------------------------------------------------
    const monthlyByStudent = new Map<
      string,
      { monthly_xp: number; questions_answered: number; correct_answers: number }
    >();

    if (studentIds.length > 0) {
      const { data: attempts, error: attemptsError } =
        await supabaseServer
          .from("school_student_question_attempts")
          .select("student_id, xp_earned, is_correct")
          .in("student_id", studentIds)
          .gte("answered_at", `${monthStart}T00:00:00.000Z`)
          .lt("answered_at", nextMonthStart);

      if (attemptsError) {
        console.error("Leaderboard attempt lookup:", attemptsError);
        return errorResponse("Unable to load monthly XP statistics.", 500);
      }

      for (const attempt of attempts ?? []) {
        const existing = monthlyByStudent.get(attempt.student_id) ?? {
          monthly_xp: 0,
          questions_answered: 0,
          correct_answers: 0,
        };

        existing.monthly_xp += numberValue(attempt.xp_earned);
        existing.questions_answered += 1;

        if (attempt.is_correct === true) {
          existing.correct_answers += 1;
        }

        monthlyByStudent.set(attempt.student_id, existing);
      }
    }

    // -------------------------------------------------------
    // 7. Build the overall school leaderboard.
    // -------------------------------------------------------
    const classNameById = new Map(
      (classes ?? []).map((item) => [item.id, item.class_name])
    );

    const overallLeaderboard = activeStudents
      .map((student) => {
        const progress = progressByStudent.get(student.id);
        const monthly = monthlyByStudent.get(student.id);

        return {
          student_id: student.id,
          student_code: student.student_id,
          student_name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
          class_id: student.class_id,
          class_name: student.class_id
            ? classNameById.get(student.class_id) ?? "Unassigned"
            : "Unassigned",
          total_xp: progress?.total_xp ?? 0,
          monthly_xp: monthly?.monthly_xp ?? 0,
          questions_answered: monthly?.questions_answered ?? 0,
          correct_answers: monthly?.correct_answers ?? 0,
        };
      })
      .sort(
        (a, b) =>
          b.total_xp - a.total_xp ||
          b.monthly_xp - a.monthly_xp ||
          a.student_name.localeCompare(b.student_name)
      )
      .map((student, index) => ({
        ...student,
        rank: index + 1,
      }));

    // -------------------------------------------------------
    // 8. Build a separate leaderboard for each class.
    // -------------------------------------------------------
    const classLeaderboards = (classes ?? []).map((schoolClass) => {
      const classStudents = overallLeaderboard
        .filter((student) => student.class_id === schoolClass.id)
        .sort(
          (a, b) =>
            b.total_xp - a.total_xp ||
            b.monthly_xp - a.monthly_xp ||
            a.student_name.localeCompare(b.student_name)
        )
        .map((student, index) => ({
          ...student,
          rank: index + 1,
        }));

      return {
        class_id: schoolClass.id,
        class_name: schoolClass.class_name,
        academic_session: schoolClass.academic_session ?? null,
        student_count: classStudents.length,
        total_xp: classStudents.reduce(
          (sum, student) => sum + student.total_xp,
          0
        ),
        leaderboard: classStudents,
      };
    });

    // -------------------------------------------------------
    // 9. Return school totals and rankings.
    // -------------------------------------------------------
    const totalSchoolXp = overallLeaderboard.reduce(
      (sum, student) => sum + student.total_xp,
      0
    );

    const totalMonthlyXp = overallLeaderboard.reduce(
      (sum, student) => sum + student.monthly_xp,
      0
    );

    return NextResponse.json(
      {
        success: true,
        month,
        school_id: admin.school_id,
        summary: {
          total_students: activeStudents.length,
          total_classes: (classes ?? []).length,
          total_xp: totalSchoolXp,
          monthly_xp: totalMonthlyXp,
        },
        overall_leaderboard: overallLeaderboard,
        classes: classLeaderboards,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("School leaderboard API error:", error);

    return errorResponse(
      "Something went wrong while loading the school leaderboard.",
      500
    );
  }
}
