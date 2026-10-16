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
  return scheme?.toLowerCase() === "bearer" && token ? token.trim() : null;
}
function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status, headers: { "Cache-Control": "no-store" } });
}
async function authenticateStudent(request: Request) {
  const token = getToken(request);
  if (!token) return { error: jsonError("Student session required.", 401) } as const;
  const { data: session, error: sessionError } = await supabaseServer
    .from("school_student_sessions")
    .select("id, student_id, expires_at, revoked_at")
    .eq("token_hash", hashToken(token)).maybeSingle();
  if (sessionError) {
    console.error("Activity attempt session lookup:", sessionError);
    return { error: jsonError("Unable to verify your student session.", 500) } as const;
  }
  if (!session || session.revoked_at || new Date(session.expires_at).getTime() <= Date.now()) {
    return { error: jsonError("Your student session is invalid or expired.", 401) } as const;
  }
  const { data: student, error: studentError } = await supabaseServer
    .from("school_students")
    .select("id, school_id, class_id, status")
    .eq("id", session.student_id).maybeSingle();
  if (studentError) {
    console.error("Activity attempt student lookup:", studentError);
    return { error: jsonError("Unable to load your student account.", 500) } as const;
  }
  if (!student || student.status !== "active") return { error: jsonError("Student account unavailable.", 403) } as const;
  return { student } as const;
}

async function getAssignedActivity(student: { id: string; school_id: string; class_id: string | null }, activityId: string) {
  if (!student.class_id) return { activity: null, error: null };
  const { data: assignment, error: assignmentError } = await supabaseServer
    .from("school_question_activity_classes")
    .select("activity_id")
    .eq("activity_id", activityId).eq("class_id", student.class_id).maybeSingle();
  if (assignmentError) return { activity: null, error: assignmentError };
  if (!assignment) return { activity: null, error: null };
  const { data: activity, error } = await supabaseServer
    .from("school_question_activities")
    .select("id, school_id, title, instructions, activity_type, due_at, status, time_limit_minutes")
    .eq("id", activityId).eq("school_id", student.school_id).eq("status", "published").maybeSingle();
  return { activity, error };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateStudent(request);
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const { activity, error } = await getAssignedActivity(auth.student, id);
    if (error) {
      console.error("Load assigned activity:", error);
      return jsonError("Unable to load this activity.", 500);
    }
    if (!activity) return jsonError("This activity is not available to your class.", 404);
    if (activity.due_at && new Date(activity.due_at).getTime() < Date.now()) {
      return jsonError("The due date for this activity has passed.", 403);
    }
    const { data: activityStart, error: startError } = await supabaseServer
      .from("school_student_activity_starts")
      .select("started_at, deadline_at, answers")
      .eq("activity_id", id)
      .eq("student_id", auth.student.id)
      .maybeSingle();
    if (startError) {
      console.error("Check activity start:", startError);
      return jsonError("Unable to check the activity start time. Confirm the activity-timer database migration has been applied.", 500);
    }

    const { data: existingAttempt, error: attemptError } = await supabaseServer
      .from("school_student_activity_attempts").select("id, score, max_score, correct_count, total_questions, submitted_at, timed_out")
      .eq("activity_id", id).eq("student_id", auth.student.id).maybeSingle();
    if (attemptError) {
      console.error("Check existing attempt:", attemptError);
      return jsonError("Unable to check your previous attempt. Apply the database migration first if this is a new setup.", 500);
    }
    if (existingAttempt) return NextResponse.json({ success: true, activity, alreadySubmitted: true, result: existingAttempt, startedAt: activityStart?.started_at ?? null, deadlineAt: activityStart?.deadline_at ?? null, savedAnswers: activityStart?.answers ?? {} }, { headers: { "Cache-Control": "no-store" } });
    const { data: links, error: linksError } = await supabaseServer
      .from("school_question_activity_questions")
      .select("question_id, question_order, points")
      .eq("activity_id", id).order("question_order", { ascending: true });
    if (linksError) {
      console.error("Load activity question links:", linksError);
      return jsonError("Unable to load activity questions.", 500);
    }
    const questionIds = (links ?? []).map((link) => link.question_id);
    if (!questionIds.length) return jsonError("This activity has no questions yet.", 409);
    const { data: questions, error: questionsError } = await supabaseServer
      .from("school_custom_questions")
      .select("id, question_text, option_a, option_b, option_c, option_d, explanation")
      .eq("school_id", auth.student.school_id).eq("status", "published").in("id", questionIds);
    if (questionsError) {
      console.error("Load activity questions:", questionsError);
      return jsonError("Unable to load the questions.", 500);
    }
    const byId = new Map((questions ?? []).map((q) => [q.id, q]));
    const safeQuestions = (links ?? []).flatMap((link) => {
      const q = byId.get(link.question_id);
      return q ? [{ id: q.id, question_text: q.question_text, option_a: q.option_a, option_b: q.option_b, option_c: q.option_c, option_d: q.option_d, points: link.points ?? 1 }] : [];
    });
    return NextResponse.json({ success: true, activity, questions: safeQuestions, startedAt: activityStart?.started_at ?? null, deadlineAt: activityStart?.deadline_at ?? null, savedAnswers: activityStart?.answers ?? {} }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Student activity GET error:", error);
    return jsonError("Something went wrong while opening this activity.", 500);
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateStudent(request);
    if ("error" in auth) return auth.error;
    const { id } = await context.params;
    const { activity, error } = await getAssignedActivity(auth.student, id);
    if (error) {
      console.error("Validate submitted activity:", error);
      return jsonError("Unable to verify this activity.", 500);
    }
    if (!activity) return jsonError("This activity is not available to your class.", 404);
    if (activity.due_at && new Date(activity.due_at).getTime() < Date.now()) return jsonError("The due date for this activity has passed.", 403);
    const body = await request.json().catch(() => null) as { action?: unknown; answers?: unknown } | null;
    if (!body || typeof body !== "object") return jsonError("Invalid request body.");

    // Explicit start action: the timer begins only when the student presses Start.
    if (body.action === "start") {
      const { data: existingStart, error: existingStartError } = await supabaseServer
        .from("school_student_activity_starts")
        .select("started_at, deadline_at")
        .eq("activity_id", id)
        .eq("student_id", auth.student.id)
        .maybeSingle();
      if (existingStartError) {
        console.error("Load existing activity start:", existingStartError);
        return jsonError("Unable to check the activity start time.", 500);
      }
      if (existingStart) {
        return NextResponse.json({ success: true, startedAt: existingStart.started_at, deadlineAt: existingStart.deadline_at }, { headers: { "Cache-Control": "no-store" } });
      }

      const startedAt = new Date();
      const limit = Number(activity.time_limit_minutes ?? 0);
      const deadlineAt = limit > 0 ? new Date(startedAt.getTime() + limit * 60_000).toISOString() : null;
      const { data: insertedStart, error: insertStartError } = await supabaseServer
        .from("school_student_activity_starts")
        .insert({
          school_id: auth.student.school_id,
          activity_id: id,
          student_id: auth.student.id,
          started_at: startedAt.toISOString(),
          deadline_at: deadlineAt,
        })
        .select("started_at, deadline_at")
        .single();
      if (insertStartError) {
        // Another tab/device may have started it at the same time. Reuse that deadline.
        if (insertStartError.code === "23505") {
          const { data: racedStart, error: racedStartError } = await supabaseServer
            .from("school_student_activity_starts")
            .select("started_at, deadline_at")
            .eq("activity_id", id)
            .eq("student_id", auth.student.id)
            .maybeSingle();
          if (!racedStartError && racedStart) {
            return NextResponse.json({ success: true, startedAt: racedStart.started_at, deadlineAt: racedStart.deadline_at }, { headers: { "Cache-Control": "no-store" } });
          }
        }
        console.error("Create activity start:", insertStartError);
        return jsonError("We could not start this activity. Confirm the activity-timer database migration has been applied.", 500);
      }
      return NextResponse.json({ success: true, startedAt: insertedStart.started_at, deadlineAt: insertedStart.deadline_at }, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.action === "save_answers") {
      if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) {
        return jsonError("Invalid answer draft.");
      }
      const draft = body.answers as Record<string, unknown>;
      const { data: currentStart, error: currentStartError } = await supabaseServer
        .from("school_student_activity_starts")
        .select("started_at, deadline_at")
        .eq("activity_id", id)
        .eq("student_id", auth.student.id)
        .maybeSingle();
      if (currentStartError) {
        console.error("Check activity start before autosave:", currentStartError);
        return jsonError("Unable to verify the activity start time.", 500);
      }
      if (Number(activity.time_limit_minutes ?? 0) > 0 && !currentStart) {
        return jsonError("Start this activity before saving answers.", 409);
      }
      if (currentStart?.deadline_at && Date.now() >= new Date(currentStart.deadline_at).getTime()) {
        return jsonError("Time is up. Submit the activity to finish.", 409);
      }
      let saveDraftError;
      if (!currentStart && Number(activity.time_limit_minutes ?? 0) <= 0) {
        // Untimed activities can be opened without a separate start action.
        // Create their draft row on the first autosave; the unique constraint
        // makes concurrent tabs converge on the same student/activity row.
        const { error } = await supabaseServer.from("school_student_activity_starts").upsert({
          school_id: auth.student.school_id,
          activity_id: id,
          student_id: auth.student.id,
          started_at: new Date().toISOString(),
          deadline_at: null,
          answers: draft,
        }, { onConflict: "activity_id,student_id", ignoreDuplicates: true });
        saveDraftError = error;
        if (!saveDraftError) {
          const { error: updateError } = await supabaseServer.from("school_student_activity_starts")
            .update({ answers: draft }).eq("activity_id", id).eq("student_id", auth.student.id);
          saveDraftError = updateError;
        }
      } else {
        const { error } = await supabaseServer
          .from("school_student_activity_starts")
          .update({ answers: draft })
          .eq("activity_id", id)
          .eq("student_id", auth.student.id);
        saveDraftError = error;
      }
      if (saveDraftError) {
        console.error("Autosave student activity answers:", saveDraftError);
        return jsonError("Unable to save your answers. Confirm the answer-autosave migration has been applied.", 500);
      }
      return NextResponse.json({ success: true, savedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
    }

    if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) return jsonError("Submit your selected answers first.");
    const answers = body.answers as Record<string, unknown>;
    const { data: activityStart, error: activityStartError } = await supabaseServer
      .from("school_student_activity_starts")
      .select("started_at, deadline_at")
      .eq("activity_id", id)
      .eq("student_id", auth.student.id)
      .maybeSingle();
    if (activityStartError) {
      console.error("Check activity start before submission:", activityStartError);
      return jsonError("Unable to verify the activity start time.", 500);
    }
    const timeLimit = Number(activity.time_limit_minutes ?? 0);
    if (timeLimit > 0 && !activityStart) return jsonError("Start this activity before submitting answers.", 409);
    const timedOut = Boolean(activityStart?.deadline_at && Date.now() >= new Date(activityStart.deadline_at).getTime());
    const { data: links, error: linksError } = await supabaseServer.from("school_question_activity_questions")
      .select("question_id, points, question_order").eq("activity_id", id).order("question_order", { ascending: true });
    if (linksError) {
      console.error("Load answer key links:", linksError);
      return jsonError("Unable to grade this activity.", 500);
    }
    if (!links?.length) return jsonError("This activity has no questions.", 409);
    const questionIds = links.map((link) => link.question_id);
    const { data: questions, error: questionsError } = await supabaseServer.from("school_custom_questions")
      .select("id, correct_option").eq("school_id", auth.student.school_id).eq("status", "published").in("id", questionIds);
    if (questionsError) {
      console.error("Load answer key:", questionsError);
      return jsonError("Unable to grade your answers.", 500);
    }
    const keys = new Map((questions ?? []).map((q) => [q.id, q.correct_option]));
    let score = 0;
    let maxScore = 0;
    let correctCount = 0;
    for (const link of links) {
      const points = Math.max(0, Number(link.points ?? 1));
      maxScore += points;
      if (keys.has(link.question_id) && answers[link.question_id] === keys.get(link.question_id)) {
        score += points;
        correctCount += 1;
      }
    }
    const { data: attempt, error: saveError } = await supabaseServer.from("school_student_activity_attempts").insert({
      school_id: auth.student.school_id, activity_id: id, student_id: auth.student.id,
      answers, score, max_score: maxScore, correct_count: correctCount, total_questions: links.length, timed_out: timedOut,
    }).select("id, score, max_score, correct_count, total_questions, submitted_at, timed_out").single();
    if (saveError) {
      if (saveError.code === "23505") return jsonError("You have already submitted this activity.", 409);
      console.error("Save student activity attempt:", saveError);
      return jsonError("We could not save your submission. Confirm the student-attempt database migration has been applied.", 500);
    }
    return NextResponse.json({ success: true, message: timedOut ? "Time is up. Your answers have been submitted." : "Your answers have been submitted.", result: attempt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Student activity POST error:", error);
    return jsonError("Something went wrong while submitting your answers.", 500);
  }
}