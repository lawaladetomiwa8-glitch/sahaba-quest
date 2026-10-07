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

/* =========================================================
   AUTHENTICATE SCHOOL ADMIN
========================================================= */

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

  if (!accessToken) {
    return {
      error: "Authentication required.",
      status: 401,
    };
  }

  const {
    data: { user },
    error: userError,
  } =
    await supabaseServer.auth.getUser(
      accessToken
    );

  if (userError || !user) {
    console.error(
      "School class authentication error:",
      userError
    );

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
   GET — LIST SCHOOL CLASSES
========================================================= */

export async function GET(
  request: NextRequest
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

    const {
      data: classes,
      error: classesError,
    } =
      await supabaseServer
        .from("school_classes")
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
        .eq(
          "school_id",
          schoolAdmin.school_id
        )
        .order("status", {
          ascending: true,
        })
        .order("class_name", {
          ascending: true,
        });

    if (classesError) {
      console.error(
        "School classes lookup error:",
        classesError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not load your classes.",
        },
        { status: 500 }
      );
    }

    /*
     * Get student counts separately.
     *
     * We deliberately count students from school_students
     * instead of storing a potentially stale count on the
     * class record.
     */

    const classIds =
      classes?.map((item) => item.id) ?? [];

    let studentCounts: Record<
      string,
      number
    > = {};

    if (classIds.length > 0) {
      const {
        data: students,
        error: studentsError,
      } =
        await supabaseServer
          .from("school_students")
          .select("id, class_id")
          .eq(
            "school_id",
            schoolAdmin.school_id
          )
          .in("class_id", classIds);

      if (studentsError) {
        console.error(
          "Class student count error:",
          studentsError
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "We could not calculate class student counts.",
          },
          { status: 500 }
        );
      }

      studentCounts =
        students?.reduce(
          (
            result: Record<
              string,
              number
            >,
            student
          ) => {
            if (!student.class_id) {
              return result;
            }

            result[student.class_id] =
              (result[
                student.class_id
              ] ?? 0) + 1;

            return result;
          },
          {}
        ) ?? {};
    }

    const formattedClasses =
      (classes ?? []).map((item) => ({
        ...item,
        student_count:
          studentCounts[item.id] ?? 0,
      }));

    return NextResponse.json({
      success: true,
      classes: formattedClasses,
    });
  } catch (error) {
    console.error(
      "Unexpected school classes GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while loading classes.",
      },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST — CREATE CLASS
========================================================= */

export async function POST(
  request: NextRequest
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

    let body: {
      class_name?: unknown;
      description?: unknown;
      academic_session?: unknown;
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

    const className =
      typeof body.class_name === "string"
        ? body.class_name.trim()
        : "";

    const description =
      typeof body.description === "string"
        ? body.description.trim()
        : null;

    const academicSession =
      typeof body.academic_session ===
      "string"
        ? body.academic_session.trim()
        : "";

    /* -------------------------------------------------------
       VALIDATION
    ------------------------------------------------------- */

    if (!className) {
      return NextResponse.json(
        {
          success: false,
          error: "Class name is required.",
        },
        { status: 400 }
      );
    }

    if (className.length > 100) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Class name must not exceed 100 characters.",
        },
        { status: 400 }
      );
    }

    if (!academicSession) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Academic session is required.",
        },
        { status: 400 }
      );
    }

    if (academicSession.length > 50) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Academic session must not exceed 50 characters.",
        },
        { status: 400 }
      );
    }

    if (
      description &&
      description.length > 500
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Description must not exceed 500 characters.",
        },
        { status: 400 }
      );
    }

    /* -------------------------------------------------------
       DUPLICATE CHECK
    ------------------------------------------------------- */

    const {
      data: existingClass,
      error: existingClassError,
    } =
      await supabaseServer
        .from("school_classes")
        .select("id, class_name")
        .eq(
          "school_id",
          schoolAdmin.school_id
        )
        .ilike("class_name", className)
        .maybeSingle();

    if (existingClassError) {
      console.error(
        "Existing class lookup error:",
        existingClassError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not verify whether this class already exists.",
        },
        { status: 500 }
      );
    }

    if (existingClass) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A class with this name already exists in your school.",
        },
        { status: 409 }
      );
    }

    /* -------------------------------------------------------
       CREATE CLASS
    ------------------------------------------------------- */

    const {
      data: newClass,
      error: createError,
    } =
      await supabaseServer
        .from("school_classes")
        .insert({
          school_id:
            schoolAdmin.school_id,
          class_name: className,
          description:
            description || null,
          academic_session:
            academicSession,
          status: "active",
        })
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

    if (createError) {
      console.error(
        "Create school class error:",
        createError
      );

      /*
       * Protect against the database unique constraint
       * even if another request created the class between
       * our duplicate check and insert.
       */
      if (
        createError.code === "23505"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A class with this name already exists in your school.",
          },
          { status: 409 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not create the class.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Class created successfully.",
        class: {
          ...newClass,
          student_count: 0,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(
      "Unexpected school classes POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while creating the class.",
      },
      { status: 500 }
    );
  }
}