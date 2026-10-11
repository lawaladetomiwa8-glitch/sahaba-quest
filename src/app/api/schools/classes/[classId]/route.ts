
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

async function getSchoolAdmin(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: "Authentication required.",
      status: 401,
    };
  }

  const accessToken = authorization.replace("Bearer ", "").trim();

  if (!accessToken) {
    return {
      error: "Authentication required.",
      status: 401,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: "Your session is invalid or has expired.",
      status: 401,
    };
  }

  const {
    data: schoolAdmin,
    error: schoolAdminError,
  } = await supabaseServer
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
    console.error("School Admin lookup error:", schoolAdminError);

    return {
      error:
        "We could not verify your school administrator account.",
      status: 500,
    };
  }

  if (!schoolAdmin) {
    return {
      error: "You do not have an active School Admin account.",
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
   Existing behavior preserved.
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
    const auth = await getSchoolAdmin(request);

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
    const { classId } = await context.params;

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
          error: "Status must be either active or archived.",
        },
        { status: 400 }
      );
    }

    const {
      data: existingClass,
      error: classError,
    } = await supabaseServer
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
      .eq("school_id", schoolAdmin.school_id)
      .maybeSingle();

    if (classError) {
      console.error("Class lookup error:", classError);

      return NextResponse.json(
        {
          success: false,
          error: "We could not load the class.",
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

    const {
      data: updatedClass,
      error: updateError,
    } = await supabaseServer
      .from("school_classes")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", classId)
      .eq("school_id", schoolAdmin.school_id)
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
      console.error("Class status update error:", updateError);

      return NextResponse.json(
        {
          success: false,
          error: "We could not update the class.",
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
    console.error("Unexpected school class PATCH error:", error);

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

/* =========================================================
   DELETE — PERMANENTLY DELETE A CLASS

   Students are retained. The confirmed foreign key
   ON DELETE SET NULL clears their class_id.
========================================================= */

export async function DELETE(
  request: NextRequest,
  context: {
    params: Promise<{
      classId: string;
    }>;
  }
) {
  try {
    const auth = await getSchoolAdmin(request);

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
    const { classId } = await context.params;

    if (!classId) {
      return NextResponse.json(
        {
          success: false,
          error: "Class ID is required.",
        },
        { status: 400 }
      );
    }

    // Verify ownership before deleting anything.
    const {
      data: existingClass,
      error: lookupError,
    } = await supabaseServer
      .from("school_classes")
      .select("id, class_name")
      .eq("id", classId)
      .eq("school_id", schoolAdmin.school_id)
      .maybeSingle();

    if (lookupError) {
      console.error("Class deletion lookup error:", lookupError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to verify the class.",
        },
        { status: 500 }
      );
    }

    if (!existingClass) {
      return NextResponse.json(
        {
          success: false,
          error: "Class not found in your school.",
        },
        { status: 404 }
      );
    }

    // The database SET NULL constraint keeps the students
    // and removes their association with this class.
    const {
      data: deletedClass,
      error: deleteError,
    } = await supabaseServer
      .from("school_classes")
      .delete()
      .eq("id", existingClass.id)
      .eq("school_id", schoolAdmin.school_id)
      .select("id")
      .maybeSingle();

    if (deleteError) {
      console.error("Class deletion error:", deleteError);

      return NextResponse.json(
        {
          success: false,
          error: "Unable to delete the class.",
        },
        { status: 500 }
      );
    }

    if (!deletedClass) {
      return NextResponse.json(
        {
          success: false,
          error: "The class could not be deleted. Please try again.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message:
          "Class deleted successfully. Its students remain in the school but are now unassigned.",
        deletedClassId: deletedClass.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Unexpected school class DELETE error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while deleting the class.",
      },
      { status: 500 }
    );
  }
}
