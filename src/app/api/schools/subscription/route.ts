import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: NextRequest) {
  try {
    const header = request.headers.get("authorization");
    if (!header?.startsWith("Bearer ")) return NextResponse.json({ success: false, error: "Authentication required." }, { status: 401 });
    const { data: { user }, error: authError } = await db.auth.getUser(header.slice(7).trim());
    if (authError || !user) return NextResponse.json({ success: false, error: "Your session is invalid or has expired." }, { status: 401 });
    const { data: admin, error: adminError } = await db.from("school_admins").select("id, school_id, role, status").eq("user_id", user.id).eq("status", "active").maybeSingle();
    if (adminError) return NextResponse.json({ success: false, error: "Could not verify your school administrator account." }, { status: 500 });
    if (!admin) return NextResponse.json({ success: false, error: "You do not have an active School Admin account." }, { status: 403 });
    const { data: school, error: schoolError } = await db.from("schools").select("id, school_name, school_code, status").eq("id", admin.school_id).maybeSingle();
    if (schoolError || !school) return NextResponse.json({ success: false, error: "Could not load your school information." }, { status: 500 });
    const { data: subs, error: subError } = await db.from("school_subscriptions").select("id, currency, billing_interval, student_seat_limit, price_per_student, total_amount, status, current_period_start, current_period_end, created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(1);
    if (subError) return NextResponse.json({ success: false, error: "Could not load subscription details." }, { status: 500 });
    const { data: pricing, error: pricingError } = await db.from("school_pricing").select("id, currency, billing_interval, price_per_student, display_name, is_active").eq("is_active", true).order("billing_interval", { ascending: true });
    if (pricingError) return NextResponse.json({ success: false, error: "Could not load current subscription prices." }, { status: 500 });
    const { data: transactions, error: txError } = await db.from("school_payment_transactions").select("id, transaction_reference, currency, billing_interval, student_seat_limit, total_amount, status, payment_type, created_at").eq("school_id", school.id).eq("payment_type", "school_subscription").order("created_at", { ascending: false }).limit(20);
    if (txError) return NextResponse.json({ success: false, error: "Could not load payment history." }, { status: 500 });
    return NextResponse.json({ success: true, school, subscription: subs?.[0] ?? null, pricing: pricing ?? [], transactions: transactions ?? [] });
  } catch (error) {
    console.error("School subscription endpoint error:", error);
    return NextResponse.json({ success: false, error: "Unexpected error loading subscription details." }, { status: 500 });
  }
}
