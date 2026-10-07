import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getStudentContext } from "../auth";

function parseOptionalClientClick(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const timestamp =
    new Date(value);

  return Number.isFinite(
    timestamp.getTime()
  )
    ? timestamp.toISOString()
    : null;
}

function parseClockOffset(
  value: unknown
): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return 0;
  }

  /*
   * Keep the client-provided offset bounded.
   * The value is only used to compensate for normal
   * browser/server clock differences; it is not
   * trusted as proof of the student's identity
   * or authorization.
   */

  return Math.max(
    -10 * 60 * 1000,
    Math.min(
      10 * 60 * 1000,
      Math.trunc(value)
    )
  );
}

export async function POST(
  request: NextRequest
) {
  try {
    const context =
      await getStudentContext(
        request
      );

    if ("error" in context) {
      return context.error;
    }

    const { student } =
      context;

    const body =
      await request
        .json()
        .catch(() => ({}));

    const sessionId =
      typeof body.session_id ===
      "string"
        ? body.session_id
        : "";

    const questionId =
      typeof body.question_id ===
      "string"
        ? body.question_id
        : "";

    const selectedAnswer =
      typeof body.selected_answer ===
      "string"
        ? body.selected_answer
        : "";

    if (
      !sessionId ||
      !questionId
    ) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Quest session and question are required.",
        },
        { status: 400 }
      );
    }

    const clientClickedAt =
      parseOptionalClientClick(
        body.client_clicked_at
      );

    const clientClockOffsetMs =
      parseClockOffset(
        body.client_clock_offset_ms
      );

    const {
      data,
      error,
    } =
      await supabaseServer.rpc(
        "process_school_quest_answer_v2",
        {
          p_student_id:
            student.id,

          p_session_id:
            sessionId,

          p_question_id:
            questionId,

          p_selected_answer:
            selectedAnswer,

          p_client_clicked_at:
            clientClickedAt,

          p_client_clock_offset_ms:
            clientClockOffsetMs,
        }
      );

    if (error) {
      console.error(
        "School Quest answer RPC error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "We could not submit your answer. Please try again.",
        },
        { status: 500 }
      );
    }

    if (!data?.success) {
      const statusByCode:
        Record<string, number> = {
        SESSION_NOT_FOUND: 404,
        QUESTION_NOT_FOUND: 404,
        SESSION_NOT_ACTIVE: 400,
        QUESTION_NOT_ACTIVE: 400,
        TIMER_NOT_FOUND: 400,
        QUESTION_LEVEL_MISMATCH: 400,
        DUPLICATE_ANSWER: 409,
      };

      return NextResponse.json(
        data,
        {
          status:
            statusByCode[
              data?.code
            ] ?? 400,
        }
      );
    }

    return NextResponse.json(
      data
    );
  } catch (error) {
    console.error(
      "School Quest answer error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while submitting your answer.",
      },
      { status: 500 }
    );
  }
}