
import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

type SchoolAdminResult =
  | {
      ok: true;
      schoolId: string;
    }
  | {
      ok: false;
      error: string;
      status: number;
    };

type ActivityClassLink = {
  activity_id: string;
  class_id: string;
};

type ActivityQuestionLink = {
  activity_id: string;
  question_id: string;
  question_order: number | null;
  points: number | null;
};

type CustomQuestion = {
  id: string;
  question_text: string;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  correct_option: string;
  explanation: string | null;
};

function jsonError(message: string, status = 400) {
  return NextResponse.json(
    { success: false, message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

async function getSchoolAdmin(
  request: NextRequest
): Promise<SchoolAdminResult> {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      ok: false,
      error: "Authentication required.",
      status: 401,
    };
  }

  const token = authorization.slice(7).trim();

  if (!token) {
    return {
      ok: false,
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
      ok: false,
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
    console.error("Admin reports membership lookup:", error);

    return {
      ok: false,
      error: "Unable to verify your school administrator account.",
      status: 500,
    };
  }

  if (!admins || admins.length === 0) {
    return {
      ok: false,
      error: "You do not have an active School Admin account.",
      status: 403,
    };
  }

  if (admins.length > 1) {
    return {
      ok: false,
      error:
        "Your account has multiple active school memberships. Please resolve this before viewing results.",
      status: 403,
    };
  }

  const schoolId = admins[0]?.school_id;

  if (typeof schoolId !== "string" || schoolId.trim().length === 0) {
    return {
      ok: false,
      error:
        "Your school administrator account does not have a valid school assigned.",
      status: 403,
    };
  }

  return {
    ok: true,
    schoolId,
  };
}

function firstString(
  record: Record<string, unknown>,
  keys: string[],
  fallback: string
): string {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return fallback;
}

function toRecord(value: unknown): Record<string, unknown> {
  if (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value as Record<string, unknown>;
  }

  return {};
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getSchoolAdmin(request);

    if (!auth.ok) {
      return jsonError(auth.error, auth.status);
    }

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

    const failed = [
      activitiesResult,
      classesResult,
      studentsResult,
      attemptsResult,
      startsResult,
    ].find((result) => result.error !== null);

    if (failed?.error) {
      console.error("Admin reports load error:", failed.error);

      return jsonError(
        "Unable to load activity results. Confirm that the required activity timer and answer-autosave database changes have been applied.",
        500
      );
    }

    const activities = activitiesResult.data ?? [];

    // Built-in Sahaba Quest gameplay is stored in school-specific tables.
    // These tables do not carry school_id, so scope them through the IDs of
    // students already fetched using the authenticated administrator's school_id.
    const schoolStudentIds = (studentsResult.data ?? [])
      .map((student) => student.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0);

    let builtInQuizSessions: Record<string, unknown>[] = [];
    let builtInQuizQuestionAttempts: Record<string, unknown>[] = [];

    if (schoolStudentIds.length > 0) {
      const [gameSessionsResult, questionAttemptsResult] = await Promise.all([
        supabaseServer
          .from("school_student_game_sessions")
          .select(
            "id, student_id, level, score, questions_answered, correct_answers, started_at, status, completed_at, track, created_at"
          )
          .in("student_id", schoolStudentIds)
          .order("created_at", { ascending: false }),

        supabaseServer
          .from("school_student_question_attempts")
          .select(
            "id, student_id, session_id, question_id, is_correct, xp_earned, selected_answer, response_time_ms, answered_at"
          )
          .in("student_id", schoolStudentIds)
          .order("answered_at", { ascending: false }),
      ]);

      if (gameSessionsResult.error || questionAttemptsResult.error) {
        console.error(
          "Admin reports built-in quiz lookup error:",
          gameSessionsResult.error || questionAttemptsResult.error
        );
        return jsonError("Unable to load built-in Sahaba Quest quiz results.", 500);
      }

      const studentById = new Map(
        (studentsResult.data ?? []).map((student) => {
          const fullName = [student.first_name, student.last_name]
            .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
            .join(" ");
          return [student.id, {
            student_id: student.id,
            student_name: fullName || student.student_id,
            admission_number: student.student_id,
            class_id: student.class_id,
          }] as const;
        })
      );

      builtInQuizSessions = (gameSessionsResult.data ?? []).map((session) => {
        const answered = Number(session.questions_answered ?? 0);
        const correct = Number(session.correct_answers ?? 0);
        return {
          ...session,
          ...(studentById.get(session.student_id) ?? {}),
          accuracy_percentage: answered > 0
            ? Math.round((correct / answered) * 100)
            : 0,
        };
      });

      builtInQuizQuestionAttempts = (questionAttemptsResult.data ?? []).map((attempt) => ({
        ...attempt,
        ...(studentById.get(attempt.student_id) ?? {}),
      }));
    }

    const activityIds: string[] = activities
      .map((activity) => activity.id)
      .filter(
        (id): id is string =>
          typeof id === "string" && id.trim().length > 0
      );

    let classLinks: ActivityClassLink[] = [];
    let questionLinks: ActivityQuestionLink[] = [];

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
          "Admin reports activity links error:",
          classLinksResult.error || questionLinksResult.error
        );

        return jsonError(
          "Unable to load activity assignments and questions.",
          500
        );
      }

      classLinks = (classLinksResult.data ?? []).map((link) => ({
        activity_id: link.activity_id,
        class_id: link.class_id,
      }));

      questionLinks = (questionLinksResult.data ?? []).map((link) => ({
        activity_id: link.activity_id,
        question_id: link.question_id,
        question_order: link.question_order,
        points: link.points,
      }));
    }

    const questionIds: string[] = [
      ...new Set(
        questionLinks
          .map((link) => link.question_id)
          .filter(
            (id): id is string =>
              typeof id === "string" && id.trim().length > 0
          )
      ),
    ];

    let questions: CustomQuestion[] = [];

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
          "Admin reports question lookup error:",
          questionsResult.error
        );

        return jsonError(
          "Unable to load question review data.",
          500
        );
      }

      questions = (questionsResult.data ?? []).map((question) => ({
        id: question.id,
        question_text: question.question_text,
        option_a: question.option_a,
        option_b: question.option_b,
        option_c: question.option_c,
        option_d: question.option_d,
        correct_option: question.correct_option,
        explanation: question.explanation,
      }));
    }

    const classes = (classesResult.data ?? []).map((item) => {
      const row = toRecord(item);

      return {
        id: typeof row.id === "string" ? row.id : "",
        name: firstString(
          row,
          ["class_name", "name", "title"],
          "Unnamed class"
        ),
        status: typeof row.status === "string" ? row.status : "",
      };
    });

    const students = (studentsResult.data ?? []).map((item) => {
      const row = toRecord(item);

      const combinedName = [
        row.first_name,
        row.last_name,
      ]
        .filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
        .join(" ");

      return {
        id: typeof row.id === "string" ? row.id : "",
        class_id:
          typeof row.class_id === "string" ? row.class_id : null,
        name: firstString(
          row,
          ["full_name", "student_name", "name", "display_name"],
          combinedName ||
            firstString(
              row,
              ["admission_number", "student_code"],
              "Student"
            )
        ),
        admission_number: firstString(
          row,
          ["admission_number", "student_code", "student_id"],
          ""
        ),
        status: typeof row.status === "string" ? row.status : "",
      };
    });

    const classIdsByActivity = new Map<string, string[]>();

    for (const link of classLinks) {
      const existing = classIdsByActivity.get(link.activity_id) ?? [];

      classIdsByActivity.set(link.activity_id, [
        ...existing,
        link.class_id,
      ]);
    }

    const questionIdsByActivity = new Map<string, string[]>();
    const pointsByActivityQuestion = new Map<string, number>();

    for (const link of questionLinks) {
      const existing =
        questionIdsByActivity.get(link.activity_id) ?? [];

      questionIdsByActivity.set(link.activity_id, [
        ...existing,
        link.question_id,
      ]);

      pointsByActivityQuestion.set(
        `${link.activity_id}:${link.question_id}`,
        Number(link.points ?? 1)
      );
    }

    const questionMap = new Map<string, CustomQuestion>(
      questions.map(
        (question): [string, CustomQuestion] => [
          question.id,
          question,
        ]
      )
    );

    const questionsByActivity = new Map<string, unknown[]>();

    for (const link of questionLinks) {
      const question = questionMap.get(link.question_id);

      if (!question) {
        continue;
      }

      const existing =
        questionsByActivity.get(link.activity_id) ?? [];

      questionsByActivity.set(link.activity_id, [
        ...existing,
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

    const attempts = (attemptsResult.data ?? []).map((attempt) => {
      const maxScore = Number(attempt.max_score);
      const score = Number(attempt.score);

      return {
        ...attempt,
        percentage:
          Number.isFinite(maxScore) &&
          Number.isFinite(score) &&
          maxScore > 0
            ? Math.round((score / maxScore) * 100)
            : 0,
      };
    });

    return NextResponse.json(
      {
        success: true,
        activities: activities.map((activity) => ({
          ...activity,
          class_ids: classIdsByActivity.get(activity.id) ?? [],
          question_ids:
            questionIdsByActivity.get(activity.id) ?? [],
          question_count:
            (questionIdsByActivity.get(activity.id) ?? []).length,
          questions: questionsByActivity.get(activity.id) ?? [],
        })),
        classes,
        students,
        attempts,
        starts: startsResult.data ?? [],
        builtInQuizSessions,
        builtInQuizQuestionAttempts,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Admin reports API error:", error);

    return jsonError(
      "Something went wrong while loading activity results.",
      500
    );
  }
}
