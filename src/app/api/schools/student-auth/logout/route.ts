import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

function hashToken(token: string): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

function getToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
}

export async function POST(request: Request) {
  try {
    const token = getToken(request);

    if (!token) {
      return NextResponse.json({
        success: true,
        message: "You have been signed out.",
      });
    }

    const tokenHash = hashToken(token);

    const { error } = await supabaseServer
      .from("school_student_sessions")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("token_hash", tokenHash)
      .is("revoked_at", null);

    if (error) {
      console.error(
        "Student logout error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message:
            "Unable to complete sign out. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "You have been signed out successfully.",
    });
  } catch (error) {
    console.error(
      "Student logout unexpected error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message:
          "Something went wrong while signing you out.",
      },
      { status: 500 }
    );
  }
}