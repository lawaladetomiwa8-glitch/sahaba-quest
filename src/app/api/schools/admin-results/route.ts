import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

type AdminAuthResult =
  | {
      success: true;
      schoolId: string;
    }
  | {
      success: false;
      error: string;
      status: number;
    };

async function getSchoolAdmin(
  request: NextRequest
): Promise<AdminAuthResult> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      success: false,
      error: "Authentication required.",
      status: 401,
    };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return {
      success: false,
      error: "Authentication required.",
      status: 401,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser(token);

  if (userError || !user) {
    return {
      success: false,
      error: "Your session is invalid or has expired.",
      status: 401,
    };
  }

  const { data: admins, error } = await supabaseServer
    .from("school_admins")
    .select("id, school_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(2);

  if (error) {
    console.error("Admin results membership lookup:", error);

    return {
      success: false,
      error: "Unable to verify your school administrator account.",
      status: 500,
    };
  }

  if (!admins || admins.length === 0) {
    return {
      success: false,
      error: "You do not have an active School Admin account.",
      status: 403,
    };
  }

  if (admins.length > 1) {
    return {
      success: false,
      error:
        "Your account has multiple active school memberships. Please resolve this before viewing results.",
      status: 403,
    };
  }

  const rawSchoolId: unknown = admins[0].school_id;

  if (
    typeof rawSchoolId !== "string" ||
    rawSchoolId.trim().length === 0
  ) {
    return {
      success: false,
      error:
        "Your school administrator account is not linked to a valid school.",
      status: 403,
    };
  }

  return {
    success: true,
    schoolId: rawSchoolId.trim(),
  };
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
  fallback: string
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSchoolAdmin(request);

    if (!auth.success) {
      return jsonError(auth.error, auth.status);
    }

    // Guaranteed to be a non-empty string after authentication.
    const schoolId: string = auth.schoolId;

    const [
      activitiesResult,
      classesResult,
      studentsResult,
      attemptsResult,
      startsResult,
    ] = await Promise.all([
      supabaseServer
        .from("school_question_activities")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),

      supabaseServer
        .from("school_classes")
        .select("*")
        .eq("school_id", schoolId),

      supabaseServer
        .from("school_students")
        .select("*")
        .eq("school_id", schoolId),

      supabaseServer
        .from("school_student_activity_attempts")
        .select("*")
        .eq("school_id", schoolId)
        .order("submitted_at", { ascending: false }),

      supabaseServer
        .from("school_student_activity_starts")
        .select(
          "activity_id, student_id, started_at, deadline_at, answers"
        )
        .eq("school_id", schoolId),
    ]);

    const failedResults = [
      activitiesResult,
      classesResult,
      studentsResult,
      attemptsResult,
      startsResult,
    ];

    const failed = failedResults.find(
      (result) => result.error !== null
    );

    if (failed?.error) {
      console.error("Admin results load error:", failed.error);

      return jsonError(
        "Unable to load activity results. Confirm that the activity timer and answer-autosave migrations have been applied.",
        500
      );
    }

    const activities = activitiesResult.data ?? [];
    const activityIds = activities.map((activity) => activity.id);

    let classLinks: Array<{
      activity_id: string;
      class_id: string;
    }> = [];

    let questionLinks: Array<{
      activity_id: string;
      question_id: string;
      question_order: number | null;
      points: number | null;
    }> = [];

    if (activityIds.length > 0) {
      const [classLinksResult, questionLinksResult] =
        await Promise.all([
          supabaseServer
            .from("school_question_activity_classes")
            .select("activity_id, class_id")
            .in("activity_id", activityIds),

          supabaseServer
            .from("school_question_activity_questions")
            .select(
              "activity_id, question_id, question_order, points"
            )
            .in("activity_id", activityIds)
            .order("question_order", { ascending: true }),
        ]);

      if (classLinksResult.error || questionLinksResult.error) {
        console.error(
          "Admin results activity links error:",
          classLinksResult.error || questionLinksResult.error
        );

        return jsonError(
          "Unable to load activity assignments and questions.",
          500
        );
      }

      classLinks = classLinksResult.data ?? [];
      questionLinks = questionLinksResult.data ?? [];
    }

    const questionIds = [
      ...new Set(questionLinks.map((link) => link.question_id)),
    ];

    let questionRows: Array<{
      id: string;
      question_text: string;
      option_a: string;
      option_b: string;
      option_c: string;
      option_d: string;
      correct_option: string;
      explanation: string | null;
    }> = [];

    if (questionIds.length > 0) {
      const questionsResult = await supabaseServer
        .from("school_custom_questions")
        .select(
          "id, question_text, option_a, option_b, option_c, option_d, correct_option, explanation"
        )
        .eq("school_id", schoolId)
        .in("id", questionIds);

      if (questionsResult.error) {
        console.error(
          "Admin results question lookup error:",
          questionsResult.error
        );

        return jsonError(
          "Unable to load question review data.",
          500
        );
      }

      questionRows = (questionsResult.data ?? []) as typeof questionRows;
    }

    const classes = (classesResult.data ?? []).map(
      (item: Record<string, unknown>) => ({
        id: String(item.id),
        name: firstString(
          item,
          ["class_name", "name", "title"],
          "Unnamed class"
        ),
        status:
          typeof item.status === "string" ? item.status : "",
      })
    );

    const students = (studentsResult.data ?? []).map(
      (item: Record<string, unknown>) => ({
        id: String(item.id),
        class_id:
          typeof item.class_id === "string"
            ? item.class_id
            : null,
        name: firstString(
          item,
          ["full_name", "student_name", "name", "display_name"],
          [
            item.first_name,
            item.last_name,
          ]
            .filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0
            )
            .join(" ") ||
            firstString(
              item,
              ["admission_number", "student_code"],
              "Student"
            )
        ),
        admission_number: firstString(
          item,
          ["admission_number", "student_code", "student_id"],
          ""
        ),
        status:
          typeof item.status === "string" ? item.status : "",
      })
    );

    const classIdsByActivity = new Map<string, string[]>();

    for (const link of classLinks) {
      const current = classIdsByActivity.get(link.activity_id) ?? [];

      classIdsByActivity.set(link.activity_id, [
        ...current,
        link.class_id,
      ]);
    }

    const questionIdsByActivity = new Map<string, string[]>();
    const pointsByActivityQuestion = new Map<string, number>();

    for (const link of questionLinks) {
      const current =
        questionIdsByActivity.get(link.activity_id) ?? [];

      questionIdsByActivity.set(link.activity_id, [
        ...current,
        link.question_id,
      ]);

      pointsByActivityQuestion.set(
        `${link.activity_id}:${link.question_id}`,
        Number(link.points ?? 1)
      );
    }

    const questionMap = new Map(
      questionRows.map((question) => [question.id, question])
    );

    const questionsByActivity = new Map<string, unknown[]>();

    for (const link of questionLinks) {
      const question = questionMap.get(link.question_id);

      if (!question) {
        continue;
      }

      const current =
        questionsByActivity.get(link.activity_id) ?? [];

      questionsByActivity.set(link.activity_id, [
        ...current,
        {
          id: question.id,
          question_text: question.question_text,
          option_a: question.option_a,
          option_b: question.option_b,
          option_c: question.option_c,
          option_d: question.option_d,
          correct_option: question.correct_option,
          explanation: question.explanation,
          points:
            pointsByActivityQuestion.get(
              `${link.activity_id}:${link.question_id}`
            ) ?? 1,
        },
      ]);
    }

    const attempts = (attemptsResult.data ?? []).map((attempt) => ({
      ...attempt,
      percentage:
        Number(attempt.max_score) > 0
          ? Math.round(
              (Number(attempt.score) /
                Number(attempt.max_score)) *
                100
            )
          : 0,
    }));

    return NextResponse.json(
      {
        success: true,

        activities: activities.map((activity) => ({
          ...activity,
          class_ids:
            classIdsByActivity.get(activity.id) ?? [],
          question_ids:
            questionIdsByActivity.get(activity.id) ?? [],
          question_count:
            (questionIdsByActivity.get(activity.id) ?? []).length,
          questions:
            questionsByActivity.get(activity.id) ?? [],
        })),

        classes,
        students,
        attempts,
        starts: startsResult.data ?? [],
      },
      {
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("Admin results API error:", error);

    return jsonError(
      "Something went wrong while loading activity results.",
      500
    );
  }
}