import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

async function getSchoolAdmin(
  request: NextRequest
) {
  const authorization =
    request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: "Authentication required.",
      status: 401,
    };
  }

  const accessToken =
    authorization.replace("Bearer ", "").trim();

  const {
    data: { user },
    error: userError,
  } =
    await supabaseServer.auth.getUser(
      accessToken
    );

  if (userError || !user) {
    return {
      error:
        "Your session is invalid or has expired.",
      status: 401,
    };
  }

  const {
    data: schoolAdmin,
    error: schoolAdminError,
  } =
    await supabaseServer
      .from("school_admins")
      .select(
        `
          id,
          school_id,
          role,
          status
        `
      )
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

  if (schoolAdminError) {
    console.error(
      "School Admin lookup error:",
      schoolAdminError
    );

    return {
      error:
        "We could not verify your school administrator account.",
      status: 500,
    };
  }

  if (!schoolAdmin) {
    return {
      error:
        "You do not have an active School Admin account.",
      status: 403,
    };
  }

  return {
    user,
    schoolAdmin,
  };
}

/* =========================================================
   PATCH — CHANGE CLASS STATUS
========================================================= */

export async function PATCH(
  request: NextRequest,
  context: {
    params: Promise<{
      classId: string;
    }>;
  }
) {
  try {
    const auth = await getSchoolAdmin(
      request
    );

    if ("error" in auth) {
      return NextResponse.json(
        {
          success: false,
          error: auth.error,
        },
        { status: auth.status }
      );
    }

    const { schoolAdmin } = auth;

    const { classId } =
      await context.params;

    if (!classId) {
      return NextResponse.json(
        {
          success: false,
          error: "Class ID is required.",
        },
        { status: 400 }
      );
    }

    let body: {
      status?: unknown;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body.",
        },
        { status: 400 }
      );
    }

    const newStatus =
      body.status === "active"
        ? "active"
        : body.status === "archived"
        ? "archived"
        : null;

    if (!newStatus) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Status must be either active or archived.",
        },
        { status: 400 }
      );
    }

    /* -------------------------------------------------------
       VERIFY CLASS BELONGS TO THIS SCHOOL
    ------------------------------------------------------- */

    const {
      data: existingClass,
      error: classError,
    } =
      await supabaseServer
        .from("school_classes")
        .select(
          `
            id,
            school_id,
            class_name,
            status
          `
        )
        .eq("id", classId)
        .eq(
          "school_id",
          schoolAdmin.school_id
        )
        .maybeSingle();

    if (classError) {
      console.error(
        "Class lookup error:",
        classError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not load the class.",
        },
        { status: 500 }
      );
    }

    if (!existingClass) {
      return NextResponse.json(
        {
          success: false,
          error: "Class not found.",
        },
        { status: 404 }
      );
    }

    /* -------------------------------------------------------
       UPDATE
    ------------------------------------------------------- */

    const {
      data: updatedClass,
      error: updateError,
    } =
      await supabaseServer
        .from("school_classes")
        .update({
          status: newStatus,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", classId)
        .eq(
          "school_id",
          schoolAdmin.school_id
        )
        .select(
          `
            id,
            school_id,
            class_name,
            description,
            academic_session,
            status,
            created_at,
            updated_at
          `
        )
        .single();

    if (updateError) {
      console.error(
        "Class status update error:",
        updateError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not update the class.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        newStatus === "archived"
          ? "Class archived successfully."
          : "Class reactivated successfully.",
      class: updatedClass,
    });
  } catch (error) {
    console.error(
      "Unexpected school class PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while updating the class.",
      },
      { status: 500 }
    );
  }
}