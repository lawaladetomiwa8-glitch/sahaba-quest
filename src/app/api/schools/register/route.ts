import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase-server";

type SchoolType =
  | "school"
  | "madrasa"
  | "islamic_centre"
  | "other";

interface RegisterSchoolBody {
  school_name?: string;
  school_type?: SchoolType;
  country?: string;
  state?: string;
  city?: string;
  address?: string;
  contact_phone?: string;

  admin_full_name?: string;
  admin_email?: string;
  admin_password?: string;
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function generateSchoolCode(): string {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `SQ-${random}`;
}

async function createUniqueSchool(
  schoolName: string,
  schoolType: SchoolType,
  country: string,
  state: string | null,
  city: string | null,
  address: string | null,
  contactPhone: string | null
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const schoolCode = generateSchoolCode();

    const { data, error } = await supabaseServer
      .from("schools")
      .insert({
        school_name: schoolName,
        school_type: schoolType,
        country,
        state,
        city,
        address,
        contact_phone: contactPhone,
        school_code: schoolCode,
        status: "pending",
      })
      .select("id, school_name, school_code, status")
      .single();

    if (!error && data) {
      return data;
    }

    // Retry only for a school-code collision.
    if (error?.code !== "23505") {
      throw error;
    }
  }

  throw new Error("Unable to generate a unique school code.");
}

export async function POST(request: NextRequest) {
  let createdSchoolId: string | null = null;
  let createdUserId: string | null = null;

  try {
    const body = (await request.json()) as RegisterSchoolBody;

    const schoolName = cleanString(body.school_name);
    const schoolType = cleanString(body.school_type) as SchoolType;
    const country = cleanString(body.country) || "Nigeria";
    const state = cleanString(body.state);
    const city = cleanString(body.city);
    const address = cleanString(body.address);
    const contactPhone = cleanString(body.contact_phone);

    const adminFullName = cleanString(body.admin_full_name);
    const adminEmail = cleanString(body.admin_email).toLowerCase();
    const adminPassword = cleanString(body.admin_password);

    // ---------------------------------------------------------
    // Validation
    // ---------------------------------------------------------

    if (!schoolName) {
      return NextResponse.json(
        { success: false, error: "School name is required." },
        { status: 400 }
      );
    }

    if (schoolName.length < 2 || schoolName.length > 150) {
      return NextResponse.json(
        {
          success: false,
          error: "School name must be between 2 and 150 characters.",
        },
        { status: 400 }
      );
    }

    const validSchoolTypes: SchoolType[] = [
      "school",
      "madrasa",
      "islamic_centre",
      "other",
    ];

    if (!validSchoolTypes.includes(schoolType)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid school type.",
        },
        { status: 400 }
      );
    }

    if (!adminFullName) {
      return NextResponse.json(
        {
          success: false,
          error: "Administrator full name is required.",
        },
        { status: 400 }
      );
    }

    if (adminFullName.length < 2 || adminFullName.length > 120) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Administrator name must be between 2 and 120 characters.",
        },
        { status: 400 }
      );
    }

    if (!adminEmail || !isValidEmail(adminEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "A valid administrator email is required.",
        },
        { status: 400 }
      );
    }

    if (!adminPassword || !isStrongPassword(adminPassword)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character.",
        },
        { status: 400 }
      );
    }

    if (!contactPhone) {
      return NextResponse.json(
        {
          success: false,
          error: "Contact phone number is required.",
        },
        { status: 400 }
      );
    }

    // ---------------------------------------------------------
    // 1. Create the school as PENDING
    // ---------------------------------------------------------

    const school = await createUniqueSchool(
      schoolName,
      schoolType,
      country,
      state || null,
      city || null,
      address || null,
      contactPhone
    );

    createdSchoolId = school.id;

    // ---------------------------------------------------------
    // 2. Create the school administrator's Supabase Auth user
    // ---------------------------------------------------------

    const {
      data: authData,
      error: authError,
    } = await supabaseServer.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminFullName,
        account_role: "school_admin",
        school_id: school.id,
      },
    });

    if (authError || !authData.user) {
      // Remove the pending school if Auth creation fails.
      await supabaseServer
        .from("schools")
        .delete()
        .eq("id", school.id);

      createdSchoolId = null;

      return NextResponse.json(
        {
          success: false,
          error:
            authError?.message ||
            "Unable to create the school administrator account.",
        },
        { status: 400 }
      );
    }

    createdUserId = authData.user.id;

    // ---------------------------------------------------------
    // 3. Link Auth user to the school
    // ---------------------------------------------------------

    const { error: adminLinkError } = await supabaseServer
      .from("school_admins")
      .insert({
        school_id: school.id,
        user_id: authData.user.id,
        role: "owner",
        status: "active",
      });

    if (adminLinkError) {
      // Cleanup Auth user.
      await supabaseServer.auth.admin.deleteUser(authData.user.id);

      // Cleanup school.
      await supabaseServer
        .from("schools")
        .delete()
        .eq("id", school.id);

      createdSchoolId = null;
      createdUserId = null;

      return NextResponse.json(
        {
          success: false,
          error:
            "Unable to link the administrator to the school.",
        },
        { status: 500 }
      );
    }

    // ---------------------------------------------------------
    // 4. Registration succeeded
    //
    // School remains PENDING until payment is successfully
    // verified by the separate school payment system.
    // ---------------------------------------------------------

    return NextResponse.json(
      {
        success: true,
        message:
          "School registration created successfully. Complete payment to activate the school.",
        school: {
          id: school.id,
          school_name: school.school_name,
          school_code: school.school_code,
          status: school.status,
        },
        admin: {
          id: authData.user.id,
          email: adminEmail,
          full_name: adminFullName,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("School registration error:", error);

    // Defensive cleanup if something unexpected happens after
    // records have already been created.
    if (createdUserId) {
      try {
        await supabaseServer.auth.admin.deleteUser(createdUserId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up school auth user:",
          cleanupError
        );
      }
    }

    if (createdSchoolId) {
      try {
        await supabaseServer
          .from("schools")
          .delete()
          .eq("id", createdSchoolId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up school:",
          cleanupError
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unable to complete school registration.",
      },
      { status: 500 }
    );
  }
}