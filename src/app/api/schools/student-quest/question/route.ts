import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getStudentContext } from "../auth";

export async function POST(request: NextRequest) {
  try {
    const context = await getStudentContext(request);

    if ("error" in context) {
      return context.error;
    }

    const { student } = context;

    const body = await request.json().catch(() => ({}));

    const sessionId =
      typeof body.session_id === "string"
        ? body.session_id
        : "";

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          message: "Quest session is required.",
        },
        { status: 400 }
      );
    }

    /*
     * The database function locks the Quest gameplay session
     * before deciding whether to return the existing active
     * question or assign a new one.
     *
     * This prevents concurrent /question requests from
     * replacing the question currently displayed to the student.
     */
    const {
      data,
      error,
    } = await supabaseServer.rpc(
      "get_or_start_school_quest_question",
      {
        p_student_id: student.id,
        p_session_id: sessionId,
      }
    );

    if (error) {
      console.error(
        "School Quest question RPC error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "We could not prepare your next question.",
        },
        { status: 500 }
      );
    }

    if (!data?.success) {
      const status =
        data?.code === "SESSION_NOT_FOUND"
          ? 404
          : 400;

      return NextResponse.json(
        data ?? {
          success: false,
          message:
            "We could not prepare your next question.",
        },
        { status }
      );
    }

    return NextResponse.json(data);

  } catch (error) {
    console.error(
      "School Quest question error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while loading the question.",
      },
      { status: 500 }
    );
  }
}