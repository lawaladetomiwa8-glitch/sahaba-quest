"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type SchoolProfile = {
  id: string; school_name: string; school_type: string; country: string;
  state: string | null; city: string | null; address: string | null;
  contact_phone: string | null; school_code: string; status: string; created_at: string;
};
type ApiResult = { success?: boolean; school?: SchoolProfile; admin?: { email: string | null; role: string }; error?: string };
const inputClass = "mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-600/10";
const labelClass = "block text-sm font-semibold text-slate-700";

export default function SchoolSettingsPage() {
  const router = useRouter();
  const [school, setSchool] = useState<SchoolProfile | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ school_name: "", school_type: "", country: "", state: "", city: "", address: "", contact_phone: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) { router.replace("/login"); return; }
      const session = data.session;
      const token = session.access_token;
      if (!token) { router.replace("/login"); return; }
      const response = await fetch("/api/schools/settings", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = (await response.json().catch(() => ({}))) as ApiResult;
      if (response.status === 401) { router.replace("/login"); return; }
      if (!response.ok || !result.school) throw new Error(result.error || "Unable to load school settings.");
      const s = result.school; setSchool(s); setEmail(result.admin?.email ?? session.user.email ?? ""); setRole(result.admin?.role ?? "");
      setForm({ school_name: s.school_name ?? "", school_type: s.school_type ?? "", country: s.country ?? "", state: s.state ?? "", city: s.city ?? "", address: s.address ?? "", contact_phone: s.contact_phone ?? "" });
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load school settings."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  const change = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) { router.replace("/login"); return; }
      const token = data.session.access_token;
      if (!token) { router.replace("/login"); return; }
      const response = await fetch("/api/schools/settings", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = (await response.json().catch(() => ({}))) as ApiResult;
      if (!response.ok || !result.school) throw new Error(result.error || "Unable to save school profile.");
      setSchool(result.school); setMessage("School profile saved successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save changes."); }
    finally { setSaving(false); }
  }
  async function passwordReset() {
    if (!email) { setError("Administrator email is unavailable."); return; }
    setResetting(true); setMessage(""); setError("");
    try { const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/update-password` }); if (resetError) throw resetError; setMessage("Password reset instructions have been requested. Check your email inbox."); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to request password reset."); }
    finally { setResetting(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
      <Link href="/schools/dashboard" className="flex items-center gap-3"><div className="h-11 w-11 overflow-hidden rounded-2xl bg-slate-900"><img src="https://cdn.phototourl.com/member/2026-09-30-957223ee-05a5-4299-9fc6-c4ca9f12695a.png" alt="Sahaba Quest logo" className="h-full w-full object-contain" /></div><div><p className="font-bold">Sahaba Quest</p><p className="text-xs font-medium text-slate-500">Schools &amp; Madrasas</p></div></Link>
      <Link href="/schools/dashboard" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">← Back to dashboard</Link>
    </div></header>
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-teal-700">Schools &amp; Madrasas</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">School settings</h1><p className="mt-3 mb-8 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Manage your institution&apos;s profile and administrator account.</p>
      {message && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{message}</div>}{error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</div>}
      {loading ? <div className="rounded-2xl border bg-white p-8 text-sm text-slate-500">Loading your school settings…</div> : <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-3 pb-2 pt-1 text-xs font-bold uppercase tracking-wider text-slate-400">Settings menu</p>{[["School profile","#school-profile"],["Account & security","#account-security"],["Help & support","#help-support"]].map(([name,href],i)=><a key={href} href={href} className={`mt-1 block rounded-xl px-3 py-2.5 text-sm font-medium ${i===0?"bg-teal-50 text-teal-800":"text-slate-600 hover:bg-slate-50"}`}>{name}</a>)}{school && <div className="mt-4 rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">School code</p><p className="mt-1 font-mono text-sm font-bold tracking-wider">{school.school_code}</p></div>}</aside>
        <div className="space-y-6">
          <section id="school-profile" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-5 py-5 sm:px-7"><h2 className="text-lg font-bold">School profile</h2><p className="mt-1 text-sm text-slate-500">Keep your institution&apos;s contact and location details up to date.</p></div>
            <form onSubmit={save} className="space-y-5 px-5 py-6 sm:px-7"><div className="grid gap-5 sm:grid-cols-2">
              <label className={labelClass}>School or madrasa name<input className={inputClass} value={form.school_name} onChange={e=>change("school_name",e.target.value)} required maxLength={160}/></label>
              <label className={labelClass}>Institution type<input className={inputClass} value={form.school_type} onChange={e=>change("school_type",e.target.value)} required maxLength={80}/></label>
              <label className={labelClass}>Contact phone<input className={inputClass} value={form.contact_phone} onChange={e=>change("contact_phone",e.target.value)} maxLength={40} inputMode="tel"/></label>
              <label className={labelClass}>Country<input className={inputClass} value={form.country} onChange={e=>change("country",e.target.value)} required maxLength={80}/></label>
              <label className={labelClass}>State<input className={inputClass} value={form.state} onChange={e=>change("state",e.target.value)} maxLength={100}/></label>
              <label className={labelClass}>City / town<input className={inputClass} value={form.city} onChange={e=>change("city",e.target.value)} maxLength={100}/></label>
            </div><label className={labelClass}>Street address<textarea className={inputClass} rows={3} value={form.address} onChange={e=>change("address",e.target.value)} maxLength={500}/></label>
            <div className="flex flex-col justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:items-center"><p className="text-xs leading-5 text-slate-500">School code and subscription details are protected and cannot be edited here.</p><button type="submit" disabled={saving} className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-60">{saving?"Saving changes…":"Save profile"}</button></div></form>
          </section>
          <section id="account-security" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-bold">Account &amp; security</h2><p className="mt-1 text-sm text-slate-500">Review your administrator account and request a secure password reset.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Administrator email</p><p className="mt-2 break-all text-sm font-semibold">{email||"Not available"}</p><p className="mt-1 text-xs text-slate-500">Email changes require verified account recovery.</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">School access role</p><p className="mt-2 text-sm font-semibold">{role?role.replace(/_/g," "):"School administrator"}</p><p className="mt-1 text-xs text-slate-500">Roles cannot be elevated from this page.</p></div></div><button type="button" onClick={passwordReset} disabled={resetting||!email} className="mt-5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold hover:bg-slate-50 disabled:opacity-60">{resetting?"Requesting reset…":"Send password reset email"}</button></section>
          <section id="help-support" className="scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><h2 className="text-lg font-bold">Help &amp; support</h2><p className="mt-1 text-sm text-slate-500">Need help with school access, billing, or student management?</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><a href="mailto:support.sahabaquest@gmail.com?subject=Sahaba%20Quest%20School%20Support" className="inline-flex items-center justify-center rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white hover:bg-teal-800">Email support</a><Link href="/schools/subscription" className="inline-flex items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50">View subscription</Link></div></section>
          <p className="px-1 text-xs leading-5 text-slate-500">Registered {school?.created_at?new Date(school.created_at).toLocaleDateString():"date unavailable"} · School status: {school?.status??"unknown"}</p>
        </div></div>}
    </div>
  </main>;
}
