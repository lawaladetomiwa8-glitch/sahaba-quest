
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

  if (scheme?.toLowerCase() !== "bearer" || !token) return null;

  return token.trim();
}

export async function GET(request: Request) {
  try {
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

    const { data: session, error: sessionError } = await supabaseServer
      .from("school_student_sessions")
      .select("id, student_id, expires_at, revoked_at")
      .eq("token_hash", hashToken(token))
      .maybeSingle();

    if (sessionError) {
      console.error(
        "Student activities session lookup failed:",
        sessionError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify your student session.",
        },
        { status: 500 }
      );
    }

    if (
      !session ||
      session.revoked_at ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Your student session is invalid or expired.",
        },
        { status: 401 }
      );
    }

    const { data: student, error: studentError } = await supabaseServer
      .from("school_students")
      .select("id, school_id, class_id, status")
      .eq("id", session.student_id)
      .maybeSingle();

    if (studentError) {
      console.error(
        "Student activities student lookup failed:",
        studentError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to load your student account.",
        },
        { status: 500 }
      );
    }

    if (!student || student.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message: "Your student account is inactive or unavailable.",
        },
        { status: 403 }
      );
    }

    const noStoreHeaders = {
      "Cache-Control": "no-store, max-age=0",
    };

    if (!student.class_id) {
      return NextResponse.json(
        { success: true, activities: [] },
        { headers: noStoreHeaders }
      );
    }

    const { data: school, error: schoolError } = await supabaseServer
      .from("schools")
      .select("id, status")
      .eq("id", student.school_id)
      .maybeSingle();

    if (schoolError) {
      console.error(
        "Student activities school lookup failed:",
        schoolError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify your school.",
        },
        { status: 500 }
      );
    }

    if (!school || school.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          message: "Your school's access is currently unavailable.",
        },
        { status: 403 }
      );
    }

    const { data: classData, error: classError } = await supabaseServer
      .from("school_classes")
      .select("id")
      .eq("id", student.class_id)
      .eq("school_id", student.school_id)
      .eq("status", "active")
      .maybeSingle();

    if (classError) {
      console.error(
        "Student activities class lookup failed:",
        classError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to verify your class.",
        },
        { status: 500 }
      );
    }

    if (!classData) {
      return NextResponse.json(
        { success: true, activities: [] },
        { headers: noStoreHeaders }
      );
    }

    const { data: assignments, error: assignmentsError } =
      await supabaseServer
        .from("school_question_activity_classes")
        .select("activity_id")
        .eq("class_id", classData.id);

    if (assignmentsError) {
      console.error(
        "Student activities assignment lookup failed:",
        assignmentsError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to load your class assignments.",
        },
        { status: 500 }
      );
    }

    const activityIds = [
      ...new Set((assignments ?? []).map((item) => item.activity_id)),
    ];

    if (activityIds.length === 0) {
      return NextResponse.json(
        { success: true, activities: [] },
        { headers: noStoreHeaders }
      );
    }

    const { data: activities, error: activitiesError } =
      await supabaseServer
        .from("school_question_activities")
        .select(
          "id, school_id, title, instructions, activity_type, due_at, status, created_at, time_limit_minutes"
        )
        .eq("school_id", student.school_id)
        .eq("status", "published")
        .in("id", activityIds)
        .order("created_at", { ascending: false });

    if (activitiesError) {
      console.error(
        "Student activities list lookup failed:",
        activitiesError
      );

      return NextResponse.json(
        {
          success: false,
          message: "Unable to load published activities.",
        },
        { status: 500 }
      );
    }

    const published = activities ?? [];
    const publishedIds = published.map((activity) => activity.id);

    const questionCounts: Record<string, number> = {};

    if (publishedIds.length > 0) {
      const { data: questionLinks, error: questionLinksError } =
        await supabaseServer
          .from("school_question_activity_questions")
          .select("activity_id, question_id")
          .in("activity_id", publishedIds);

      if (questionLinksError) {
        console.error(
          "Student activities question count lookup failed:",
          questionLinksError
        );

        return NextResponse.json(
          {
            success: false,
            message: "Unable to load activity questions.",
          },
          { status: 500 }
        );
      }

      for (const link of questionLinks ?? []) {
        questionCounts[link.activity_id] =
          (questionCounts[link.activity_id] ?? 0) + 1;
      }
    }

    return NextResponse.json(
      {
        success: true,
        activities: published.map((activity) => ({
          id: activity.id,
          title: activity.title,
          instructions: activity.instructions,
          activity_type: activity.activity_type,
          due_at: activity.due_at,
          time_limit_minutes: activity.time_limit_minutes,
          question_count: questionCounts[activity.id] ?? 0,
        })),
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    console.error("Student activities API error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while loading your school activities.",
      },
      { status: 500 }
    );
  }
}
