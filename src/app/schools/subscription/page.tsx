"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type School = { id: string; school_name: string; school_code: string; status: string };
type Subscription = { id: string; currency: string; billing_interval: string; student_seat_limit: number; price_per_student: number; total_amount: number; status: string; current_period_start: string | null; current_period_end: string | null; created_at: string };
type Pricing = { id: string; currency: string; billing_interval: string; price_per_student: number; display_name: string | null; is_active: boolean };
type Transaction = { id: string; transaction_reference: string; currency: string; billing_interval: string; student_seat_limit: number; total_amount: number; status: string; payment_type: string; created_at: string };
type PageData = { success: boolean; school: School; subscription: Subscription | null; pricing: Pricing[]; transactions: Transaction[]; error?: string };
const CURRENCIES = ["NGN", "USD", "GBP", "EUR"] as const;
const INTERVALS = ["monthly", "termly"] as const;

function money(amount: number | null | undefined, currency: string) {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  const value = currency === "NGN" ? Number(amount) : Number(amount) / 100;
  try { return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: currency === "NGN" ? 0 : 2 }).format(value); }
  catch { return `${currency} ${value.toLocaleString()}`; }
}
function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
function label(value?: string | null) { return value ? value.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase()) : "No subscription"; }

export default function SchoolSubscriptionPage() {
  const router = useRouter();
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [seatsText, setSeatsText] = useState("50");
  const [interval, setInterval] = useState<(typeof INTERVALS)[number]>("monthly");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("NGN");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) { router.replace("/schools"); return; }
      const response = await fetch("/api/schools/subscription", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const result = await response.json() as PageData;
      if (!response.ok || !result.success) throw new Error(result.error || "Unable to load subscription.");
      setData(result);
      if (result.subscription) {
        setSeatsText(String(Math.max(1, result.subscription.student_seat_limit || 1)));
        if (INTERVALS.includes(result.subscription.billing_interval as (typeof INTERVALS)[number])) setInterval(result.subscription.billing_interval as (typeof INTERVALS)[number]);
        if (CURRENCIES.includes(result.subscription.currency as (typeof CURRENCIES)[number])) setCurrency(result.subscription.currency as (typeof CURRENCIES)[number]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load subscription."); }
    finally { setLoading(false); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  const pricing = useMemo(() => data?.pricing.find(p => p.currency === currency && p.billing_interval === interval), [data, currency, interval]);
  const seats = Number(seatsText);
  const total = pricing && Number.isInteger(seats) && seats > 0 ? pricing.price_per_student * seats : null;
  const sub = data?.subscription;
  const active = sub?.status?.toLowerCase() === "active" && (!sub.current_period_end || new Date(sub.current_period_end).getTime() >= Date.now());

  async function pay() {
    if (!data) return;
    if (!Number.isInteger(seats) || seats < 1 || seats > 100000) { setError("Enter a valid student seat limit."); return; }
    if (!pricing) { setError("This currency and billing interval is unavailable. Choose another option."); return; }
    setBusy(true); setError("");
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) { router.replace("/schools"); return; }
      const response = await fetch("/api/schools/payment/initialize", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ school_id: data.school.id, student_seat_limit: seats, billing_interval: interval, currency }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not initialize payment.");
      const url = result.checkout_url || result.payment_link || result.data?.link;
      if (typeof url !== "string" || !url) throw new Error("Payment service did not return a checkout URL.");
      window.location.assign(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start payment."); setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50 text-slate-900"><div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-4"><div>
      <Link href="/schools/dashboard" className="text-sm font-semibold text-teal-700 hover:text-teal-900">← Back to dashboard</Link>
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">Sahaba Quest · Schools & Madrasas</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Subscription &amp; billing</h1><p className="mt-2 text-slate-600">Manage subscription access, student seats, renewals, and payment history.</p>
    </div><div className="rounded-2xl border border-teal-100 bg-white px-5 py-4 shadow-sm"><p className="text-xs uppercase tracking-wide text-slate-500">School account</p><p className="mt-1 font-bold">{data?.school.school_name || "Your school"}</p>{data?.school.school_code && <p className="mt-1 text-sm text-slate-500">Code: {data.school.school_code}</p>}</div></header>
    {error && <div role="alert" className="mb-6 flex justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
    {loading ? <div className="rounded-2xl border bg-white p-10 text-center text-slate-600">Loading subscription details…</div> : <>
      <section className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-[#073d32] p-6 text-white shadow-sm md:col-span-2"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-emerald-100">Current / most recent subscription</p><h2 className="mt-1 text-2xl font-bold">{label(sub?.status)}</h2></div><span className={`inline-flex shrink-0 items-center self-center rounded-full px-3 py-2 text-xs font-bold leading-none ${active ? "bg-emerald-200 text-emerald-950" : "bg-amber-100 text-amber-900"}`}>{active ? "Access active" : "Renewal required"}</span></div>
        {sub ? <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-emerald-100">Billing</p><p className="mt-1 font-semibold capitalize">{sub.billing_interval}</p></div><div><p className="text-xs text-emerald-100">Student seats</p><p className="mt-1 font-semibold">{sub.student_seat_limit.toLocaleString()}</p></div><div><p className="text-xs text-emerald-100">Subscription total</p><p className="mt-1 font-semibold">{money(sub.total_amount, sub.currency)}</p></div><div><p className="text-xs text-emerald-100">Expires / renews</p><p className="mt-1 font-semibold">{fmtDate(sub.current_period_end)}</p></div></div> : <p className="mt-4 text-sm text-emerald-50">Your school has no subscription record yet. Choose a billing option below to activate access.</p>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm text-slate-500">Price per student</p><p className="mt-2 text-2xl font-bold text-[#073d32]">{pricing ? money(pricing.price_per_student, currency) : "—"}</p><p className="mt-1 text-sm text-slate-500">For selected billing option</p><div className="mt-5 border-t pt-4"><p className="text-sm text-slate-500">Estimated total</p><p className="mt-1 text-xl font-bold">{total == null ? "—" : money(total, currency)}</p></div></div></section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"><p className="text-sm font-semibold text-teal-700">Renew or subscribe</p><h2 className="mt-1 text-xl font-bold">Choose billing option</h2><p className="mt-2 text-sm text-slate-600">Choose student capacity, billing interval, and currency. Prices use the active official pricing.</p>
        <div className="mt-6 space-y-5"><div><label htmlFor="seatLimit" className="mb-2 block text-sm font-semibold">Student seat limit</label><input id="seatLimit" type="number" min={1} max={100000} step={1} value={seatsText} onChange={e => setSeatsText(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3" /><p className="mt-1 text-xs text-slate-500">Maximum active student accounts for your school.</p></div>
        <div><label htmlFor="interval" className="mb-2 block text-sm font-semibold">Billing interval</label><select id="interval" value={interval} onChange={e => setInterval(e.target.value as (typeof INTERVALS)[number])} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3"><option value="monthly">Monthly</option><option value="termly">Termly</option></select></div>
        <div><label htmlFor="currency" className="mb-2 block text-sm font-semibold">Payment currency</label><select id="currency" value={currency} onChange={e => setCurrency(e.target.value as (typeof CURRENCIES)[number])} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="rounded-xl bg-teal-50 p-4">{pricing ? <><p className="font-semibold text-[#073d32]">{pricing.display_name || `${interval} school subscription`}</p><p className="mt-1 text-sm text-teal-900">{money(pricing.price_per_student, currency)} per student · {seats > 0 ? seats.toLocaleString() : "—"} seats</p><p className="mt-2 text-lg font-bold text-[#073d32]">Total: {total == null ? "—" : money(total, currency)}</p></> : <p className="text-sm text-amber-900">This currency and interval are unavailable. Choose another option.</p>}</div>
        <button onClick={pay} disabled={busy || !pricing || !Number.isInteger(seats) || seats < 1} className="w-full rounded-xl bg-[#08745b] px-5 py-3.5 font-bold text-white hover:bg-[#073d32] disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Connecting to secure checkout…" : sub ? "Renew / update subscription" : "Continue to secure payment"}</button><p className="text-xs text-slate-500">Flutterwave processes payment. Your subscription changes only after the existing verification flow confirms payment.</p></div>
      </div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7"><h2 className="text-xl font-bold">Subscription details</h2><p className="mt-2 text-sm text-slate-600">Your current or most recent subscription.</p><dl className="mt-5 divide-y divide-slate-100">{[["Status", label(sub?.status)], ["Started", fmtDate(sub?.current_period_start)], ["Period ends", fmtDate(sub?.current_period_end)], ["Currency", sub?.currency || "—"], ["Seats purchased", sub ? sub.student_seat_limit.toLocaleString() : "—"]].map(([k,v]) => <div key={k} className="flex justify-between gap-4 py-3"><dt className="text-sm text-slate-500">{k}</dt><dd className="text-sm font-semibold">{v}</dd></div>)}</dl><div className="mt-5 rounded-xl border p-4"><p className="font-semibold">Need to manage students?</p><p className="mt-1 text-sm text-slate-600">Return to your dashboard to manage classes and student accounts.</p><Link href="/schools/dashboard" className="mt-3 inline-flex font-semibold text-teal-700">Go to school dashboard →</Link></div></div></section>
      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-5"><div><h2 className="text-xl font-bold">Payment history</h2><p className="mt-1 text-sm text-slate-500">Your school’s 20 most recent subscription payment attempts.</p></div><button onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50">Refresh history</button></div>
        {data?.transactions.length ? <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100 text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>{["Date","Reference","Billing","Seats","Amount","Status"].map(h => <th key={h} className="px-6 py-3">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.transactions.map(t => <tr key={t.id} className="hover:bg-slate-50"><td className="whitespace-nowrap px-6 py-4">{fmtDate(t.created_at)}</td><td className="whitespace-nowrap px-6 py-4 font-mono text-xs">{t.transaction_reference}</td><td className="px-6 py-4 capitalize">{t.billing_interval}</td><td className="px-6 py-4">{t.student_seat_limit.toLocaleString()}</td><td className="whitespace-nowrap px-6 py-4 font-semibold">{money(t.total_amount, t.currency)}</td><td className="px-6 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${t.status === "success" ? "bg-emerald-100 text-emerald-800" : t.status === "pending" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"}`}>{label(t.status)}</span></td></tr>)}</tbody></table></div> : <div className="px-6 py-10 text-center"><p className="font-semibold">No payment history yet</p><p className="mt-1 text-sm text-slate-500">Subscription payment attempts will appear here.</p></div>}
      </section>
    </>}
    <footer className="mt-8 pb-4 text-center text-xs text-slate-400">Sahaba Quest · Schools & Madrasas</footer>
  </div></main>;
}
