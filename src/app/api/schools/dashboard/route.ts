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

export async function GET(request: NextRequest) {
  try {
    /* =====================================================
       AUTHENTICATE USER
    ===================================================== */

    const authorization =
      request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const accessToken =
      authorization.replace("Bearer ", "").trim();

    if (!accessToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required.",
        },
        { status: 401 }
      );
    }

    const {
      data: { user },
      error: userError,
    } = await supabaseServer.auth.getUser(accessToken);

    if (userError || !user) {
      console.error(
        "School dashboard authentication error:",
        userError
      );

      return NextResponse.json(
        {
          success: false,
          error: "Your session is invalid or has expired.",
        },
        { status: 401 }
      );
    }

    /* =====================================================
       VERIFY SCHOOL ADMIN
       
       school_admins is the source of truth for School Admin
       identity. We deliberately do NOT use profiles.account_type.
    ===================================================== */

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
      console.error(
        "School Admin lookup error:",
        schoolAdminError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not verify your school administrator account.",
        },
        { status: 500 }
      );
    }

    if (!schoolAdmin) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have an active School Admin account.",
        },
        { status: 403 }
      );
    }

    /* =====================================================
       SCHOOL
    ===================================================== */

    const {
      data: school,
      error: schoolError,
    } = await supabaseServer
      .from("schools")
      .select(
        `
          id,
          school_name,
          school_type,
          country,
          state,
          city,
          address,
          contact_phone,
          school_code,
          status,
          created_at
        `
      )
      .eq("id", schoolAdmin.school_id)
      .single();

    if (schoolError || !school) {
      console.error(
        "School lookup error:",
        schoolError
      );

      return NextResponse.json(
        {
          success: false,
          error: "We could not load your school information.",
        },
        { status: 500 }
      );
    }

    /* =====================================================
       ACTIVE SCHOOL SUBSCRIPTION
    ===================================================== */

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabaseServer
      .from("school_subscriptions")
      .select(
        `
          id,
          currency,
          billing_interval,
          student_seat_limit,
          price_per_student,
          total_amount,
          status,
          current_period_start,
          current_period_end,
          created_at
        `
      )
      .eq("school_id", school.id)
      .eq("status", "active")
      .order("created_at", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      console.error(
        "School subscription lookup error:",
        subscriptionError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not load your school subscription.",
        },
        { status: 500 }
      );
    }

    /* =====================================================
       STUDENT COUNTS
       
       We count students from the school itself rather than
       relying on a stored counter.
    ===================================================== */

    const {
      count: totalStudents,
      error: studentCountError,
    } = await supabaseServer
      .from("school_students")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("school_id", school.id);

    if (studentCountError) {
      console.error(
        "Student count error:",
        studentCountError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not load your student information.",
        },
        { status: 500 }
      );
    }

    const {
      count: activeStudents,
      error: activeStudentCountError,
    } = await supabaseServer
      .from("school_students")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("school_id", school.id)
      .eq("status", "active");

    if (activeStudentCountError) {
      console.error(
        "Active student count error:",
        activeStudentCountError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not load your active student information.",
        },
        { status: 500 }
      );
    }

    /* =====================================================
       CLASS COUNT
    ===================================================== */

    const {
      count: totalClasses,
      error: classCountError,
    } = await supabaseServer
      .from("school_classes")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("school_id", school.id)
      .eq("status", "active");

    if (classCountError) {
      console.error(
        "Class count error:",
        classCountError
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "We could not load your class information.",
        },
        { status: 500 }
      );
    }

    /* =====================================================
       SEAT CALCULATION
    ===================================================== */

    const seatLimit =
      subscription?.student_seat_limit ?? 0;

    const usedSeats = activeStudents ?? 0;

    const remainingSeats = Math.max(
      seatLimit - usedSeats,
      0
    );

    /* =====================================================
       RESPONSE
    ===================================================== */

    return NextResponse.json({
      success: true,

      admin: {
        id: schoolAdmin.id,
        user_id: user.id,
        email: user.email ?? null,
        role: schoolAdmin.role,
      },

      school: {
        id: school.id,
        school_name: school.school_name,
        school_type: school.school_type,
        country: school.country,
        state: school.state,
        city: school.city,
        address: school.address,
        contact_phone: school.contact_phone,
        school_code: school.school_code,
        status: school.status,
        created_at: school.created_at,
      },

      subscription: subscription
        ? {
            id: subscription.id,
            currency: subscription.currency,
            billing_interval:
              subscription.billing_interval,
            student_seat_limit:
              subscription.student_seat_limit,
            price_per_student:
              subscription.price_per_student,
            total_amount:
              subscription.total_amount,
            status: subscription.status,
            current_period_start:
              subscription.current_period_start,
            current_period_end:
              subscription.current_period_end,
            created_at: subscription.created_at,
          }
        : null,

      statistics: {
        total_students: totalStudents ?? 0,
        active_students: activeStudents ?? 0,
        total_classes: totalClasses ?? 0,
        seat_limit: seatLimit,
        used_seats: usedSeats,
        remaining_seats: remainingSeats,
      },
    });
  } catch (error) {
    console.error(
      "Unexpected school dashboard error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "An unexpected error occurred while loading the school dashboard.",
      },
      { status: 500 }
    );
  }
}