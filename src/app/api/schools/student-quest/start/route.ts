import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getStudentContext } from "../auth";

const MAX_LEVEL = 10;
const QUESTIONS_PER_QUEST = 50;

export async function POST(request: NextRequest) {
  try {
    const context = await getStudentContext(request);

    if ("error" in context) {
      return context.error;
    }

    const {
      student,
      progress,
    } = context;

    /*
     * ---------------------------------------------------------
     * Validate the student's current level
     * ---------------------------------------------------------
     */

    if (
      progress.current_level < 1 ||
      progress.current_level > MAX_LEVEL
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            `Your current level is not available yet. ` +
            `The current Quest system supports Levels 1–${MAX_LEVEL}.`,
        },
        { status: 400 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Check whether the student already has an active Quest
     *
     * This allows the student to leave the page and return
     * without accidentally creating another Quest session.
     * ---------------------------------------------------------
     */

    const {
      data: existingSession,
      error: existingSessionError,
    } = await supabaseServer
      .from("school_student_game_sessions")
      .select(
        `
        id,
        level,
        score,
        questions_answered,
        correct_answers,
        started_at,
        status,
        current_question_id,
        current_question_started_at
        `
      )
      .eq("student_id", student.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (existingSessionError) {
      console.error(
        "School Quest active session lookup error:",
        existingSessionError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "We could not check your active Quest.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Resume an existing Quest
     * ---------------------------------------------------------
     */

    if (existingSession) {
      return NextResponse.json({
        success: true,
        action: "resume",

        session: existingSession,

        questions_required:
          QUESTIONS_PER_QUEST,

        current_level:
          progress.current_level,
      });
    }

    /*
     * ---------------------------------------------------------
     * Create a new Quest session
     * ---------------------------------------------------------
     */

    const {
      data: gameSession,
      error: createSessionError,
    } = await supabaseServer
      .from("school_student_game_sessions")
      .insert({
        student_id: student.id,

        level:
          progress.current_level,

        score: 0,

        questions_answered: 0,

        correct_answers: 0,

        status: "active",

        track: "shared",
      })
      .select(
        `
        id,
        level,
        score,
        questions_answered,
        correct_answers,
        started_at,
        status,
        current_question_id,
        current_question_started_at
        `
      )
      .single();

    if (createSessionError) {
      console.error(
        "School Quest session creation error:",
        createSessionError
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "We could not start your Quest. Please try again.",
        },
        { status: 500 }
      );
    }

    /*
     * ---------------------------------------------------------
     * Successfully created a new Quest
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,

      action: "new",

      session: gameSession,

      questions_required:
        QUESTIONS_PER_QUEST,

      current_level:
        progress.current_level,
    });
  } catch (error) {
    console.error(
      "School Quest start error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while starting your Quest.",
      },
      { status: 500 }
    );
  }
}