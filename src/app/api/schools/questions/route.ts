
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseServer = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

type ActivityType = "classwork" | "test" | "assignment";
type ActivityStatus = "draft" | "published" | "closed";
type QuestionStatus = "draft" | "published" | "archived";
type Difficulty = "easy" | "medium" | "hard";
type CorrectOption = "A" | "B" | "C" | "D";

const isRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string =>
  typeof value === "string";

const isUuid = (value: unknown): value is string =>
  isString(value) &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

function respondError(error: string, status = 400) {
  return NextResponse.json(
    { success: false, error },
    { status }
  );
}

function cleanText(value: unknown): string {
  return isString(value) ? value.trim() : "";
}

/* =========================================================
   AUTHENTICATE SCHOOL ADMIN
========================================================= */

async function getSchoolAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: "Authentication required.",
      status: 401,
    } as const;
  }

  const accessToken = authorization.slice(7).trim();

  if (!accessToken) {
    return {
      error: "Authentication required.",
      status: 401,
    } as const;
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: "Your session is invalid or has expired.",
      status: 401,
    } as const;
  }

  const {
    data: schoolAdmins,
    error: adminError,
  } = await supabaseServer
    .from("school_admins")
    .select("id, school_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(2);

  if (adminError) {
    console.error("School admin lookup error:", adminError);

    return {
      error: "We could not verify your school administrator account.",
      status: 500,
    } as const;
  }

  // Do not guess which school to use if an account belongs to
  // multiple active school-admin records.
  if (!schoolAdmins || schoolAdmins.length === 0) {
    return {
      error: "You do not have an active School Admin account.",
      status: 403,
    } as const;
  }

  if (schoolAdmins.length > 1) {
    return {
      error:
        "Your account has multiple active school memberships. Please contact support to resolve this before managing questions.",
      status: 403,
    } as const;
  }

  return {
    user,
    schoolAdmin: schoolAdmins[0],
  };
}

/* =========================================================
   GET — LOAD QUESTIONS, CLASSES AND ACTIVITIES
========================================================= */

export async function GET(request: NextRequest) {
  try {
    const auth = await getSchoolAdmin(request);

    if ("error" in auth) {
      return respondError(String(auth.error ?? "Authentication required."), Number(auth.status ?? 401));
    }

    const schoolId = auth.schoolAdmin.school_id;

    const [
      questionsResult,
      classesResult,
      activitiesResult,
    ] = await Promise.all([
      supabaseServer
        .from("school_custom_questions")
        .select("*")
        .eq("school_id", schoolId)
        .order("updated_at", { ascending: false }),

      supabaseServer
        .from("school_classes")
        .select(
          "id, class_name, description, academic_session, status"
        )
        .eq("school_id", schoolId)
        .order("class_name", { ascending: true }),

      supabaseServer
        .from("school_question_activities")
        .select("*")
        .eq("school_id", schoolId)
        .order("created_at", { ascending: false }),
    ]);

    if (questionsResult.error) {
      console.error("Load school questions error:", questionsResult.error);
      return respondError("We could not load your questions.", 500);
    }

    if (classesResult.error) {
      console.error("Load school classes error:", classesResult.error);
      return respondError("We could not load your classes.", 500);
    }

    if (activitiesResult.error) {
      console.error("Load school activities error:", activitiesResult.error);
      return respondError("We could not load your activities.", 500);
    }

    const activities = activitiesResult.data ?? [];
    const activityIds = activities.map((activity) => activity.id);

    let classAssignments: Array<{
      activity_id: string;
      class_id: string;
    }> = [];

    let questionAssignments: Array<{
      activity_id: string;
      question_id: string;
      question_order: number;
      points: number;
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
          "Load activity assignments error:",
          classLinksResult.error ?? questionLinksResult.error
        );

        return respondError(
          "We could not load activity assignments.",
          500
        );
      }

      classAssignments = classLinksResult.data ?? [];
      questionAssignments = questionLinksResult.data ?? [];
    }

    const formattedActivities = activities.map((activity) => ({
      ...activity,
      class_ids: classAssignments
        .filter((item) => item.activity_id === activity.id)
        .map((item) => item.class_id),
      question_ids: questionAssignments
        .filter((item) => item.activity_id === activity.id)
        .sort((a, b) => a.question_order - b.question_order)
        .map((item) => item.question_id),
      question_count: questionAssignments.filter(
        (item) => item.activity_id === activity.id
      ).length,
    }));

    return NextResponse.json({
      success: true,
      questions: questionsResult.data ?? [],
      classes: classesResult.data ?? [],
      activities: formattedActivities,
    });
  } catch (error) {
    console.error("School questions GET error:", error);
    return respondError(
      "An unexpected error occurred while loading school questions.",
      500
    );
  }
}

/* =========================================================
   POST — CREATE QUESTION OR ACTIVITY
========================================================= */

export async function POST(request: NextRequest) {
  try {
    const auth = await getSchoolAdmin(request);

    if ("error" in auth) {
      return respondError(String(auth.error ?? "Authentication required."), Number(auth.status ?? 401));
    }

    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (!isRecord(parsed)) {
        return respondError("Invalid request body.");
      }

      body = parsed;
    } catch {
      return respondError("Invalid request body.");
    }

    const schoolId = auth.schoolAdmin.school_id;
    const userId = auth.user.id;
    const action = cleanText(body.action);

    /* -------------------------------------------------------
       CREATE A CUSTOM QUESTION
    ------------------------------------------------------- */

    if (action === "question") {
      const questionText = cleanText(body.question_text);
      const optionA = cleanText(body.option_a);
      const optionB = cleanText(body.option_b);
      const optionC = cleanText(body.option_c);
      const optionD = cleanText(body.option_d);
      const explanation = cleanText(body.explanation);
      const topic = cleanText(body.topic);

      const correctOption = body.correct_option;
      const difficulty = body.difficulty ?? "medium";
      const status = body.status ?? "draft";

      if (!questionText) {
        return respondError("Enter the question.");
      }

      if (questionText.length > 2000) {
        return respondError(
          "The question must not exceed 2,000 characters."
        );
      }

      const options = [optionA, optionB, optionC, optionD];

      if (options.some((option) => !option)) {
        return respondError("All four answer options are required.");
      }

      if (options.some((option) => option.length > 500)) {
        return respondError(
          "Each answer option must not exceed 500 characters."
        );
      }

      if (!["A", "B", "C", "D"].includes(String(correctOption))) {
        return respondError("Select the correct answer.");
      }

      if (!["easy", "medium", "hard"].includes(String(difficulty))) {
        return respondError("Select a valid difficulty.");
      }

      if (!["draft", "published"].includes(String(status))) {
        return respondError("Select a valid question status.");
      }

      if (explanation.length > 3000) {
        return respondError(
          "The explanation must not exceed 3,000 characters."
        );
      }

      if (topic.length > 150) {
        return respondError("The topic must not exceed 150 characters.");
      }

      const { data: question, error } = await supabaseServer
        .from("school_custom_questions")
        .insert({
          school_id: schoolId,
          created_by: userId,
          question_text: questionText,
          option_a: optionA,
          option_b: optionB,
          option_c: optionC,
          option_d: optionD,
          correct_option: correctOption as CorrectOption,
          explanation: explanation || null,
          topic: topic || null,
          difficulty: difficulty as Difficulty,
          status: status as QuestionStatus,
        })
        .select("*")
        .single();

      if (error) {
        console.error("Create school question error:", error);
        return respondError("We could not save this question.", 500);
      }

      return NextResponse.json(
        {
          success: true,
          message: "Question saved successfully.",
          question,
        },
        { status: 201 }
      );
    }

    /* -------------------------------------------------------
       CREATE CLASSWORK, TEST OR ASSIGNMENT
    ------------------------------------------------------- */

    if (action === "activity") {
      const title = cleanText(body.title);
      const instructions = cleanText(body.instructions);
      const activityType = body.activity_type;
      const status = body.status ?? "draft";
      const dueAt = body.due_at;

      const classIds = Array.isArray(body.class_ids)
        ? [...new Set(body.class_ids)]
        : [];

      const questionIds = Array.isArray(body.question_ids)
        ? [...new Set(body.question_ids)]
        : [];

      if (!title) {
        return respondError("Enter an activity title.");
      }

      if (title.length > 150) {
        return respondError("The activity title must not exceed 150 characters.");
      }

      if (instructions.length > 5000) {
        return respondError("Instructions must not exceed 5,000 characters.");
      }

      if (
        !["classwork", "test", "assignment"].includes(
          String(activityType)
        )
      ) {
        return respondError("Select classwork, test or assignment.");
      }

      if (!["draft", "published"].includes(String(status))) {
        return respondError(
          "New activities can only be saved as drafts or published."
        );
      }

      if (classIds.length === 0) {
        return respondError("Select at least one class.");
      }

      if (questionIds.length === 0) {
        return respondError("Add at least one question to the activity.");
      }

      if (
        classIds.some((id) => !isUuid(id)) ||
        questionIds.some((id) => !isUuid(id))
      ) {
        return respondError("One or more selected IDs are invalid.");
      }

      let normalizedDueAt: string | null = null;

      if (dueAt !== undefined && dueAt !== null && dueAt !== "") {
        if (
          !isString(dueAt) ||
          Number.isNaN(Date.parse(dueAt))
        ) {
          return respondError("Enter a valid due date and time.");
        }

        normalizedDueAt = new Date(dueAt).toISOString();
      }

      // A published activity must have a due date only if your
      // school workflow requires one; drafts may be left undated.

      const [
        ownedClassesResult,
        ownedQuestionsResult,
      ] = await Promise.all([
        supabaseServer
          .from("school_classes")
          .select("id")
          .eq("school_id", schoolId)
          .eq("status", "active")
          .in("id", classIds),

        supabaseServer
          .from("school_custom_questions")
          .select("id")
          .eq("school_id", schoolId)
          .eq("status", "published")
          .in("id", questionIds),
      ]);

      if (ownedClassesResult.error || ownedQuestionsResult.error) {
        console.error(
          "Validate activity selections error:",
          ownedClassesResult.error ?? ownedQuestionsResult.error
        );

        return respondError(
          "We could not validate your selected classes and questions.",
          500
        );
      }

      if ((ownedClassesResult.data ?? []).length !== classIds.length) {
        return respondError(
          "One or more selected classes are unavailable or do not belong to your school."
        );
      }

      if ((ownedQuestionsResult.data ?? []).length !== questionIds.length) {
        return respondError(
          "Activities can only include published questions from your own school. Check your selections and try again."
        );
      }

      const { data: activity, error: activityError } =
        await supabaseServer
          .from("school_question_activities")
          .insert({
            school_id: schoolId,
            created_by: userId,
            title,
            instructions: instructions || null,
            activity_type: activityType as ActivityType,
            status: status as ActivityStatus,
            due_at: normalizedDueAt,
          })
          .select("*")
          .single();

      if (activityError || !activity) {
        console.error("Create school activity error:", activityError);
        return respondError("We could not create this activity.", 500);
      }

      const classLinks = classIds.map((classId) => ({
        activity_id: activity.id,
        class_id: classId as string,
      }));

      const questionLinks = questionIds.map((questionId, index) => ({
        activity_id: activity.id,
        question_id: questionId as string,
        question_order: index + 1,
        points: 1,
      }));

      const { error: classLinkError } = await supabaseServer
        .from("school_question_activity_classes")
        .insert(classLinks);

      if (classLinkError) {
        console.error("Assign activity classes error:", classLinkError);

        // Best-effort cleanup so an incomplete activity is not left behind.
        await supabaseServer
          .from("school_question_activities")
          .delete()
          .eq("id", activity.id)
          .eq("school_id", schoolId);

        return respondError(
          "We could not assign the activity to the selected classes. No activity was saved.",
          500
        );
      }

      const { error: questionLinkError } = await supabaseServer
        .from("school_question_activity_questions")
        .insert(questionLinks);

      if (questionLinkError) {
        console.error(
          "Attach activity questions error:",
          questionLinkError
        );

        // The foreign-key cascade removes the class links too.
        await supabaseServer
          .from("school_question_activities")
          .delete()
          .eq("id", activity.id)
          .eq("school_id", schoolId);

        return respondError(
          "We could not attach the selected questions. No activity was saved.",
          500
        );
      }

      return NextResponse.json(
        {
          success: true,
          message:
            status === "published"
              ? "Activity published and assigned successfully."
              : "Activity saved as a draft successfully.",
          activity: {
            ...activity,
            class_ids: classIds,
            question_ids: questionIds,
            question_count: questionIds.length,
          },
        },
        { status: 201 }
      );
    }

    return respondError(
      'Invalid action. Use action "question" or "activity".'
    );
  } catch (error) {
    console.error("School questions POST error:", error);
    return respondError(
      "An unexpected error occurred while saving your changes.",
      500
    );
  }
}

/* =========================================================
   PATCH — UPDATE A QUESTION OR ACTIVITY
========================================================= */

export async function PATCH(request: NextRequest) {
  try {
    const auth = await getSchoolAdmin(request);

    if ("error" in auth) {
      return respondError(String(auth.error ?? "Authentication required."), Number(auth.status ?? 401));
    }

    let body: Record<string, unknown>;

    try {
      const parsed: unknown = await request.json();

      if (!isRecord(parsed)) {
        return respondError("Invalid request body.");
      }

      body = parsed;
    } catch {
      return respondError("Invalid request body.");
    }

    const schoolId = auth.schoolAdmin.school_id;
    const action = cleanText(body.action);
    const id = body.id;

    if (!isUuid(id)) {
      return respondError("A valid record ID is required.");
    }

    /* -------------------------------------------------------
       UPDATE A CUSTOM QUESTION
    ------------------------------------------------------- */

    if (action === "question") {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if ("question_text" in body) {
        const value = cleanText(body.question_text);

        if (!value || value.length > 2000) {
          return respondError(
            "The question must contain between 1 and 2,000 characters."
          );
        }

        updates.question_text = value;
      }

      for (const key of [
        "option_a",
        "option_b",
        "option_c",
        "option_d",
      ]) {
        if (key in body) {
          const value = cleanText(body[key]);

          if (!value || value.length > 500) {
            return respondError(
              "Each answer option must contain between 1 and 500 characters."
            );
          }

          updates[key] = value;
        }
      }

      if ("correct_option" in body) {
        if (!["A", "B", "C", "D"].includes(String(body.correct_option))) {
          return respondError("Select a valid correct answer.");
        }

        updates.correct_option = body.correct_option;
      }

      if ("explanation" in body) {
        const value = cleanText(body.explanation);

        if (value.length > 3000) {
          return respondError("Explanation must not exceed 3,000 characters.");
        }

        updates.explanation = value || null;
      }

      if ("topic" in body) {
        const value = cleanText(body.topic);

        if (value.length > 150) {
          return respondError("Topic must not exceed 150 characters.");
        }

        updates.topic = value || null;
      }

      if ("difficulty" in body) {
        if (!["easy", "medium", "hard"].includes(String(body.difficulty))) {
          return respondError("Select a valid difficulty.");
        }

        updates.difficulty = body.difficulty;
      }

      if ("status" in body) {
        if (
          !["draft", "published", "archived"].includes(String(body.status))
        ) {
          return respondError("Select a valid question status.");
        }

        updates.status = body.status;
      }

      const { data: question, error } = await supabaseServer
        .from("school_custom_questions")
        .update(updates)
        .eq("id", id)
        .eq("school_id", schoolId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Update school question error:", error);
        return respondError("We could not update this question.", 500);
      }

      if (!question) {
        return respondError("Question not found in your school.", 404);
      }

      return NextResponse.json({
        success: true,
        message: "Question updated successfully.",
        question,
      });
    }

    /* -------------------------------------------------------
       UPDATE ACTIVITY DETAILS OR STATUS
    ------------------------------------------------------- */

    if (action === "activity") {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if ("title" in body) {
        const title = cleanText(body.title);

        if (!title || title.length > 150) {
          return respondError(
            "The activity title must contain between 1 and 150 characters."
          );
        }

        updates.title = title;
      }

      if ("instructions" in body) {
        const instructions = cleanText(body.instructions);

        if (instructions.length > 5000) {
          return respondError("Instructions must not exceed 5,000 characters.");
        }

        updates.instructions = instructions || null;
      }

      if ("activity_type" in body) {
        if (
          !["classwork", "test", "assignment"].includes(
            String(body.activity_type)
          )
        ) {
          return respondError("Select a valid activity type.");
        }

        updates.activity_type = body.activity_type;
      }

      if ("status" in body) {
        if (
          !["draft", "published", "closed"].includes(String(body.status))
        ) {
          return respondError("Select a valid activity status.");
        }

        updates.status = body.status;
      }

      if ("due_at" in body) {
        if (body.due_at === null || body.due_at === "") {
          updates.due_at = null;
        } else if (
          isString(body.due_at) &&
          !Number.isNaN(Date.parse(body.due_at))
        ) {
          updates.due_at = new Date(body.due_at).toISOString();
        } else {
          return respondError("Enter a valid due date and time.");
        }
      }

      const { data: activity, error } = await supabaseServer
        .from("school_question_activities")
        .update(updates)
        .eq("id", id)
        .eq("school_id", schoolId)
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Update school activity error:", error);
        return respondError("We could not update this activity.", 500);
      }

      if (!activity) {
        return respondError("Activity not found in your school.", 404);
      }

      return NextResponse.json({
        success: true,
        message: "Activity updated successfully.",
        activity,
      });
    }

    return respondError(
      'Invalid action. Use action "question" or "activity".'
    );
  } catch (error) {
    console.error("School questions PATCH error:", error);
    return respondError(
      "An unexpected error occurred while updating your changes.",
      500
    );
  }
}

/* =========================================================
   DELETE — ARCHIVE A CUSTOM QUESTION
   Questions are archived, not physically deleted.
========================================================= */

export async function DELETE(request: NextRequest) {
  try {
    const auth = await getSchoolAdmin(request);

    if ("error" in auth) {
      return respondError(String(auth.error ?? "Authentication required."), Number(auth.status ?? 401));
    }

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get("id");

    if (!isUuid(questionId)) {
      return respondError("A valid question ID is required.");
    }

    const { data: question, error: lookupError } = await supabaseServer
      .from("school_custom_questions")
      .select("id, status")
      .eq("id", questionId)
      .eq("school_id", auth.schoolAdmin.school_id)
      .maybeSingle();

    if (lookupError) {
      console.error("Find question for archive error:", lookupError);
      return respondError("We could not find this question.", 500);
    }

    if (!question) {
      return respondError("Question not found in your school.", 404);
    }

    const { data: linkedActivities, error: linksError } =
      await supabaseServer
        .from("school_question_activity_questions")
        .select("activity_id")
        .eq("question_id", questionId);

    if (linksError) {
      console.error("Check question assignments error:", linksError);
      return respondError(
        "We could not verify whether this question is assigned to an activity.",
        500
      );
    }

    if ((linkedActivities ?? []).length > 0) {
      return respondError(
        "This question is included in one or more activities. Remove it from those activities before archiving it.",
        409
      );
    }

    const { data: archivedQuestion, error: archiveError } =
      await supabaseServer
        .from("school_custom_questions")
        .update({
          status: "archived",
          updated_at: new Date().toISOString(),
        })
        .eq("id", questionId)
        .eq("school_id", auth.schoolAdmin.school_id)
        .select("*")
        .single();

    if (archiveError) {
      console.error("Archive school question error:", archiveError);
      return respondError("We could not archive this question.", 500);
    }

    return NextResponse.json({
      success: true,
      message: "Question archived successfully.",
      question: archivedQuestion,
    });
  } catch (error) {
    console.error("School questions DELETE error:", error);
    return respondError(
      "An unexpected error occurred while archiving this question.",
      500
    );
  }
}
