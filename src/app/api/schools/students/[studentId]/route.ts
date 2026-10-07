import { NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseServer } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ studentId: string }>;
};

async function getSchoolAdmin(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const accessToken = authorization.slice("Bearer ".length).trim();

  if (!accessToken) {
    return {
      error: NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      ),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabaseServer.auth.getUser(accessToken);

  if (userError || !user) {
    return {
      error: NextResponse.json(
        { success: false, message: "Invalid or expired session." },
        { status: 401 }
      ),
    };
  }

  const { data: admin, error: adminError } = await supabaseServer
    .from("school_admins")
    .select("school_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (adminError) {
    console.error("School admin lookup failed:", adminError);
    return {
      error: NextResponse.json(
        {
          success: false,
          message: "Unable to verify your school administrator account.",
        },
        { status: 500 }
      ),
    };
  }

  if (!admin) {
    return {
      error: NextResponse.json(
        { success: false, message: "School administrator access required." },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    admin,
  };
}

async function getSeatSummary(schoolId: string) {
  const { data: subscription, error: subscriptionError } =
    await supabaseServer
      .from("school_subscriptions")
      .select("student_seat_limit, current_period_end, status")
      .eq("school_id", schoolId)
      .eq("status", "active")
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (subscriptionError) {
    throw new Error(
      `Unable to load school subscription: ${subscriptionError.message}`
    );
  }

  const { count, error: countError } = await supabaseServer
    .from("school_students")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (countError) {
    throw new Error(`Unable to count active students: ${countError.message}`);
  }

  const limit = Number(subscription?.student_seat_limit ?? 0);
  const used = Number(count ?? 0);

  return {
    limit,
    used,
    remaining: Math.max(limit - used, 0),
    current_period_end: subscription?.current_period_end ?? null,
  };
}

function generatePin() {
  return crypto.randomInt(100000, 1000000).toString();
}

function hashPin(pin: string) {
  return crypto.createHash("sha256").update(pin).digest("hex");
}

export async function PATCH(
  request: Request,
  context: RouteContext
) {
  try {
    const auth = await getSchoolAdmin(request);

    if ("error" in auth) {
      return auth.error;
    }

    const { admin } = auth;
    const { studentId } = await context.params;

    if (!studentId) {
      return NextResponse.json(
        { success: false, message: "Student ID is required." },
        { status: 400 }
      );
    }

    let body: {
      status?: "active" | "inactive";
      class_id?: string | null;
      reset_pin?: boolean;
    };

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid request body." },
        { status: 400 }
      );
    }

    const requestedStatus = body?.status;
    const hasClassChange = Object.prototype.hasOwnProperty.call(
      body,
      "class_id"
    );
    const resetPin = body?.reset_pin === true;

    if (
      requestedStatus !== undefined &&
      requestedStatus !== "active" &&
      requestedStatus !== "inactive"
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid student status." },
        { status: 400 }
      );
    }

    if (!requestedStatus && !hasClassChange && !resetPin) {
      return NextResponse.json(
        { success: false, message: "No student changes were requested." },
        { status: 400 }
      );
    }

    const { data: existingStudent, error: studentLookupError } =
      await supabaseServer
        .from("school_students")
        .select(
          "id, school_id, class_id, first_name, last_name, student_id, status, created_at"
        )
        .eq("id", studentId)
        .eq("school_id", admin.school_id)
        .maybeSingle();

    if (studentLookupError) {
      console.error("Student lookup failed:", studentLookupError);
      return NextResponse.json(
        { success: false, message: "Unable to find the student." },
        { status: 500 }
      );
    }

    if (!existingStudent) {
      return NextResponse.json(
        { success: false, message: "Student not found." },
        { status: 404 }
      );
    }

    // ---------------------------------------------------------
    // CLASS CHANGE
    // ---------------------------------------------------------
    let nextClassId = existingStudent.class_id;

    if (hasClassChange) {
      if (body.class_id === null || body.class_id === "") {
        nextClassId = null;
      } else {
        const { data: targetClass, error: classError } =
          await supabaseServer
            .from("school_classes")
            .select("id, status")
            .eq("id", body.class_id)
            .eq("school_id", admin.school_id)
            .maybeSingle();

        if (classError) {
          console.error("Target class lookup failed:", classError);
          return NextResponse.json(
            { success: false, message: "Unable to verify the selected class." },
            { status: 500 }
          );
        }

        if (!targetClass) {
          return NextResponse.json(
            { success: false, message: "Selected class was not found." },
            { status: 404 }
          );
        }

        if (targetClass.status !== "active") {
          return NextResponse.json(
            {
              success: false,
              message: "Students can only be assigned to active classes.",
            },
            { status: 400 }
          );
        }

        nextClassId = targetClass.id;
      }
    }

    // ---------------------------------------------------------
    // ACTIVATION
    // ---------------------------------------------------------
    if (
      requestedStatus === "active" &&
      existingStudent.status !== "active"
    ) {
      const { data: school, error: schoolError } = await supabaseServer
        .from("schools")
        .select("id, status")
        .eq("id", admin.school_id)
        .maybeSingle();

      if (schoolError) {
        console.error("School lookup failed:", schoolError);
        return NextResponse.json(
          { success: false, message: "Unable to verify the school." },
          { status: 500 }
        );
      }

      if (!school || school.status !== "active") {
        return NextResponse.json(
          {
            success: false,
            message: "The school account is not currently active.",
          },
          { status: 403 }
        );
      }

      const seats = await getSeatSummary(admin.school_id);

      if (
        !seats.current_period_end ||
        new Date(seats.current_period_end).getTime() <= Date.now()
      ) {
        return NextResponse.json(
          {
            success: false,
            message:
              "The school's subscription is not currently active. Renew the subscription before activating students.",
          },
          { status: 403 }
        );
      }

      if (seats.used >= seats.limit) {
        return NextResponse.json(
          {
            success: false,
            message:
              "All purchased student seats are currently in use. Increase the school capacity before activating this student.",
            seats,
          },
          { status: 409 }
        );
      }
    }

    // ---------------------------------------------------------
    // BUILD UPDATE
    // ---------------------------------------------------------
    const updatePayload: Record<string, unknown> = {};

    if (requestedStatus) {
      updatePayload.status = requestedStatus;
    }

    if (hasClassChange) {
      updatePayload.class_id = nextClassId;
    }

    let newPin: string | null = null;

    if (resetPin) {
      newPin = generatePin();
      updatePayload.pin_hash = hashPin(newPin);
    }

    const { data: updatedStudent, error: updateError } =
      await supabaseServer
        .from("school_students")
        .update(updatePayload)
        .eq("id", existingStudent.id)
        .eq("school_id", admin.school_id)
        .select(
          `
            id,
            first_name,
            last_name,
            student_id,
            status,
            class_id,
            created_at,
            school_classes (
              class_name,
              academic_session
            )
          `
        )
        .single();

    if (updateError || !updatedStudent) {
      console.error("Student update failed:", updateError);
      return NextResponse.json(
        {
          success: false,
          message: updateError?.message || "Unable to update student.",
        },
        { status: 500 }
      );
    }

    const seats = await getSeatSummary(admin.school_id);

    return NextResponse.json(
      {
        success: true,
        message: resetPin
          ? "A new student PIN has been generated."
          : "Student updated successfully.",
        student: updatedStudent,
        credentials: newPin
          ? {
              student_id: updatedStudent.student_id,
              pin: newPin,
            }
          : null,
        seats: {
          limit: seats.limit,
          used: seats.used,
          remaining: seats.remaining,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("School student PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while updating the student.",
      },
      { status: 500 }
    );
  }
}
