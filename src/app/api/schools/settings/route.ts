import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function authorize(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return { error: "Authentication required.", status: 401 as const };
  const token = header.slice(7).trim();
  if (!token) return { error: "Authentication required.", status: 401 as const };
  const { data, error } = await supabaseServer.auth.getUser(token);
  if (error || !data.user) return { error: "Your session is invalid or has expired.", status: 401 as const };
  const { data: admin, error: adminError } = await supabaseServer
    .from("school_admins").select("id, school_id, role, status")
    .eq("user_id", data.user.id).eq("status", "active").limit(1).maybeSingle();
  if (adminError) {
    console.error("School settings admin lookup error:", adminError);
    return { error: "We could not verify your school administrator account.", status: 500 as const };
  }
  if (!admin) return { error: "You do not have an active School Admin account.", status: 403 as const };
  return { user: data.user, admin };
}

const columns = "id, school_name, school_type, country, state, city, address, contact_phone, school_code, status, created_at";

export async function GET(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const { data: school, error } = await supabaseServer.from("schools").select(columns).eq("id", auth.admin.school_id).single();
    if (error || !school) {
      console.error("School settings profile lookup error:", error);
      return NextResponse.json({ success: false, error: "We could not load your school profile." }, { status: 500 });
    }
    return NextResponse.json({ success: true, admin: { email: auth.user.email ?? null, role: auth.admin.role }, school });
  } catch (error) {
    console.error("Unexpected school settings GET error:", error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ success: false, error: "Invalid request body." }, { status: 400 });
    const fields = body as Record<string, unknown>;
    const text = (key: string) => typeof fields[key] === "string" ? (fields[key] as string).trim() : null;
    const school_name = text("school_name");
    const school_type = text("school_type");
    const country = text("country");
    const state = text("state") ?? "";
    const city = text("city") ?? "";
    const address = text("address") ?? "";
    const contact_phone = text("contact_phone") ?? "";
    if (!school_name || school_name.length > 160) return NextResponse.json({ success: false, error: "Enter a school name of 1–160 characters." }, { status: 400 });
    if (!school_type || school_type.length > 80) return NextResponse.json({ success: false, error: "Enter an institution type of 1–80 characters." }, { status: 400 });
    if (!country || country.length > 80 || state.length > 100 || city.length > 100 || address.length > 500 || contact_phone.length > 40) return NextResponse.json({ success: false, error: "One or more fields are missing or exceed the allowed length." }, { status: 400 });
    const { data: school, error } = await supabaseServer.from("schools").update({
      school_name, school_type, country, state: state || null, city: city || null,
      address: address || null, contact_phone: contact_phone || null,
    }).eq("id", auth.admin.school_id).select(columns).single();
    if (error || !school) {
      console.error("School settings profile update error:", error);
      return NextResponse.json({ success: false, error: "We could not save your school profile." }, { status: 500 });
    }
    return NextResponse.json({ success: true, school });
  } catch (error) {
    console.error("Unexpected school settings PATCH error:", error);
    return NextResponse.json({ success: false, error: "An unexpected error occurred." }, { status: 500 });
  }
}
