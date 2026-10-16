
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

  const accessToken = authorization.slice("Bearer ".length).trim();

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

// =========================================================
// PATCH — EDIT CLASS DETAILS OR CHANGE CLASS STATUS
// =========================================================

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
      class_name?: unknown;
      academic_session?: unknown;
      description?: unknown;
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

    const hasStatus = Object.prototype.hasOwnProperty.call(
      body,
      "status"
    );

    const hasClassName = Object.prototype.hasOwnProperty.call(
      body,
      "class_name"
    );

    const hasAcademicSession = Object.prototype.hasOwnProperty.call(
      body,
      "academic_session"
    );

    const hasDescription = Object.prototype.hasOwnProperty.call(
      body,
      "description"
    );

    if (
      !hasStatus &&
      !hasClassName &&
      !hasAcademicSession &&
      !hasDescription
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "No class changes were requested.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // VALIDATE CLASS DETAILS
    // ---------------------------------------------------------

    let nextClassName: string | undefined;
    let nextAcademicSession: string | undefined;
    let nextDescription: string | null | undefined;

    if (hasClassName) {
      if (typeof body.class_name !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "Class name must be a string.",
          },
          { status: 400 }
        );
      }

      nextClassName = body.class_name.trim();

      if (!nextClassName || nextClassName.length > 100) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Class name is required and must be 100 characters or fewer.",
          },
          { status: 400 }
        );
      }
    }

    if (hasAcademicSession) {
      if (typeof body.academic_session !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "Academic session must be a string.",
          },
          { status: 400 }
        );
      }

      nextAcademicSession = body.academic_session.trim();

      if (
        !nextAcademicSession ||
        nextAcademicSession.length > 100
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Academic session is required and must be 100 characters or fewer.",
          },
          { status: 400 }
        );
      }
    }

    if (hasDescription) {
      if (
        body.description !== null &&
        typeof body.description !== "string"
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Description must be text or null.",
          },
          { status: 400 }
        );
      }

      nextDescription =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;

      if (
        nextDescription !== null &&
        nextDescription.length > 1000
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Description must be 1,000 characters or fewer.",
          },
          { status: 400 }
        );
      }
    }

    // ---------------------------------------------------------
    // VALIDATE STATUS
    // ---------------------------------------------------------

    let newStatus: "active" | "archived" | undefined;

    if (hasStatus) {
      if (
        body.status !== "active" &&
        body.status !== "archived"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Status must be either active or archived.",
          },
          { status: 400 }
        );
      }

      newStatus = body.status;
    }

    // ---------------------------------------------------------
    // VERIFY CLASS OWNERSHIP
    // ---------------------------------------------------------

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
          description,
          academic_session,
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

    // ---------------------------------------------------------
    // UPDATE ONLY THE REQUESTED FIELDS
    // ---------------------------------------------------------

    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (hasClassName) {
      updatePayload.class_name = nextClassName;
    }

    if (hasAcademicSession) {
      updatePayload.academic_session = nextAcademicSession;
    }

    if (hasDescription) {
      updatePayload.description = nextDescription;
    }

    if (newStatus) {
      updatePayload.status = newStatus;
    }

    const {
      data: updatedClass,
      error: updateError,
    } = await supabaseServer
      .from("school_classes")
      .update(updatePayload)
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

    if (updateError || !updatedClass) {
      console.error("Class update error:", updateError);

      return NextResponse.json(
        {
          success: false,
          error: "We could not update the class.",
        },
        { status: 500 }
      );
    }

    let message = "Class updated successfully.";

    if (newStatus === "archived") {
      message = "Class archived successfully.";
    } else if (newStatus === "active") {
      message = "Class reactivated successfully.";
    }

    return NextResponse.json({
      success: true,
      message,
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

// =========================================================
// DELETE — PERMANENTLY DELETE A CLASS
//
// Students are retained. The existing foreign-key
// ON DELETE SET NULL constraint clears their class_id.
// =========================================================

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
      console.error(
        "Class deletion lookup error:",
        lookupError
      );

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

    // The existing SET NULL constraint retains students
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
          error:
            "The class could not be deleted. Please try again.",
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
