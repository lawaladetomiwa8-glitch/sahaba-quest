"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type DashboardData = {
  success: boolean;

  admin: {
    id: string;
    user_id: string;
    email: string | null;
    role: string;
  };

  school: {
    id: string;
    school_name: string;
    school_type: string;
    country: string;
    state: string | null;
    city: string | null;
    address: string | null;
    contact_phone: string | null;
    school_code: string;
    status: string;
    created_at: string;
  };

  subscription: {
    id: string;
    currency: string;
    billing_interval: string;
    student_seat_limit: number;
    price_per_student: number;
    total_amount: number;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
    created_at: string;
  } | null;

  statistics: {
    total_students: number;
    active_students: number;
    total_classes: number;
    seat_limit: number;
    used_seats: number;
    remaining_seats: number;
  };
};

function formatCurrency(
  amount: number,
  currency: string
) {
  const currencyMap: Record<string, string> = {
    NGN: "₦",
    USD: "$",
    GBP: "£",
    EUR: "€",
  };

  const symbol = currencyMap[currency] ?? currency;

  /*
   * Stored school prices are integer minor units:
   * NGN 800 = ₦800
   * USD 100 = $1.00
   * GBP 100 = £1.00
   * EUR 100 = €1.00
   */

  const majorAmount =
    currency === "NGN"
      ? amount
      : amount / 100;

  return `${symbol}${majorAmount.toLocaleString(
    undefined,
    {
      minimumFractionDigits:
        currency === "NGN" ? 0 : 2,
      maximumFractionDigits:
        currency === "NGN" ? 0 : 2,
    }
  )}`;
}

function formatDate(
  value: string | null | undefined
) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function formatBillingInterval(
  value: string
) {
  if (value === "monthly") {
    return "Monthly";
  }

  if (value === "termly") {
    return "Termly";
  }

  return value;
}

function formatSchoolType(
  value: string
) {
  const labels: Record<string, string> = {
    school: "School",
    madrasa: "Madrasa",
    islamic_centre: "Islamic Centre",
    other: "Other",
  };

  return (
    labels[value] ??
    value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      )
  );
}

export default function SchoolDashboardPage() {
  const router = useRouter();

  const [data, setData] =
    useState<DashboardData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [signingOut, setSigningOut] =
    useState(false);

  /* =====================================================
     LOAD DASHBOARD
  ===================================================== */

  const loadDashboard =
    useCallback(async () => {
      try {
        setLoading(true);
        setError("");

        const {
          data: {
            session,
          },
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (
          sessionError ||
          !session?.access_token
        ) {
          router.replace("/login");
          return;
        }

        const response =
          await fetch(
            "/api/schools/dashboard",
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (!response.ok || !result.success) {
          if (
            response.status === 401
          ) {
            router.replace("/login");
            return;
          }

          if (
            response.status === 403
          ) {
            setError(
              result.error ||
                "You do not have access to this school dashboard."
            );
            return;
          }

          throw new Error(
            result.error ||
              "Unable to load the school dashboard."
          );
        }

        setData(result);
      } catch (err) {
        console.error(
          "School dashboard error:",
          err
        );

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load your school dashboard."
        );
      } finally {
        setLoading(false);
      }
    }, [router]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /* =====================================================
     SIGN OUT
  ===================================================== */

  async function handleSignOut() {
    try {
      setSigningOut(true);

      await supabase.auth.signOut();

      router.replace("/login");
    } catch (err) {
      console.error(
        "School admin sign out error:",
        err
      );

      setSigningOut(false);
    }
  }

  /* =====================================================
     LOADING
  ===================================================== */

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="text-lg font-bold text-gray-900"
            >
              Sahaba Quest
            </Link>
          </div>
        </header>

        <main className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-green-700" />

            <p className="text-sm text-gray-600">
              Loading your school dashboard...
            </p>
          </div>
        </main>
      </div>
    );
  }

  /* =====================================================
     ERROR
  ===================================================== */

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <Link
              href="/"
              className="text-lg font-bold text-gray-900"
            >
              Sahaba Quest
            </Link>
          </div>
        </header>

        <main className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-xl font-bold text-red-600">
              !
            </div>

            <h1 className="text-xl font-bold text-gray-900">
              Unable to Load Dashboard
            </h1>

            <p className="mt-3 text-sm leading-6 text-gray-600">
              {error ||
                "We could not load your school information."}
            </p>

            <button
              type="button"
              onClick={loadDashboard}
              className="mt-6 rounded-xl bg-green-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
            >
              Try Again
            </button>
          </div>
        </main>
      </div>
    );
  }

  const {
    admin,
    school,
    subscription,
    statistics,
  } = data;

  const seatPercentage =
    statistics.seat_limit > 0
      ? Math.min(
          Math.round(
            (statistics.used_seats /
              statistics.seat_limit) *
              100
          ),
          100
        )
      : 0;

  /* =====================================================
     DASHBOARD
  ===================================================== */

  return (
    <div className="min-h-screen bg-gray-50">
      {/* =================================================
          HEADER
      ================================================= */}

      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-2"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-green-700 text-sm font-bold text-white">
              SQ
            </div>

            <div>
              <p className="text-sm font-bold leading-tight text-gray-900">
                Sahaba Quest
              </p>

              <p className="text-[11px] font-medium text-gray-500">
                Schools & Madrasas
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-gray-900">
                {school.school_name}
              </p>

              <p className="text-xs text-gray-500">
                {admin.email}
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              {signingOut
                ? "Signing out..."
                : "Sign out"}
            </button>
          </div>
        </div>
      </header>

      {/* =================================================
          MAIN
      ================================================= */}

      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* =================================================
            SCHOOL HEADER
        ================================================= */}

        <section className="mb-8">
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <div className="p-6 sm:p-8">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
                <div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      {formatSchoolType(
                        school.school_type
                      )}
                    </span>

                    <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {school.status ===
                      "active"
                        ? "Active"
                        : school.status}
                    </span>
                  </div>

                  <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
                    {school.school_name}
                  </h1>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
                    Manage your school&apos;s
                    students, classes, learning
                    activities and progress from
                    one place.
                  </p>
                </div>

                <div className="rounded-2xl bg-gray-50 px-5 py-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    School Code
                  </p>

                  <p className="mt-1 font-mono text-lg font-bold tracking-wider text-gray-900">
                    {school.school_code}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =================================================
            NAVIGATION
        ================================================= */}

        <section className="mb-8">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white p-2 shadow-sm sm:grid-cols-4 lg:grid-cols-8">
            <Link
              href="/schools/dashboard"
              className="rounded-xl bg-green-700 px-3 py-3 text-center text-xs font-semibold text-white"
            >
              Overview
            </Link>

            <Link
              href="/schools/students"
              className="rounded-xl px-3 py-3 text-center text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Students
            </Link>

            <Link
              href="/schools/classes"
              className="rounded-xl px-3 py-3 text-center text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Classes
            </Link>

            <Link
              href="/schools/challenges"
              className="rounded-xl px-3 py-3 text-center text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Challenges
            </Link>

            <Link
              href="/schools/leaderboard"
              className="rounded-xl px-3 py-3 text-center text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Leaderboard
            </Link>

            <Link
              href="/schools/reports"
              className="rounded-xl px-3 py-3 text-center text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Reports
            </Link>

            <Link
              href="/schools/subscription"
              className="rounded-xl px-3 py-3 text-center text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Subscription
            </Link>

            <Link
              href="/schools/settings"
              className="rounded-xl px-3 py-3 text-center text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              Settings
            </Link>
          </div>
        </section>

        {/* =================================================
            OVERVIEW STATS
        ================================================= */}

        <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Active Students
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {statistics.active_students.toLocaleString()}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
                👨‍🎓
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              {statistics.total_students} total
              student records
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Available Seats
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {statistics.remaining_seats.toLocaleString()}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
                🎟️
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              {statistics.used_seats} of{" "}
              {statistics.seat_limit} seats used
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Active Classes
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {statistics.total_classes.toLocaleString()}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
                🏫
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              Organize students by class
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Subscription
                </p>

                <p className="mt-2 text-xl font-bold text-gray-900">
                  {subscription
                    ? formatBillingInterval(
                        subscription.billing_interval
                      )
                    : "Inactive"}
                </p>
              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-50 text-xl">
                ✓
              </div>
            </div>

            <p className="mt-3 text-xs text-gray-500">
              {subscription
                ? `Ends ${formatDate(
                    subscription.current_period_end
                  )}`
                : "No active subscription"}
            </p>
          </div>
        </section>

        {/* =================================================
            SEAT USAGE + SUBSCRIPTION
        ================================================= */}

        <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* SEAT USAGE */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Student Capacity
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Your current student seat usage.
                </p>
              </div>

              <span className="text-sm font-bold text-gray-900">
                {seatPercentage}%
              </span>
            </div>

            <div className="mb-3 h-3 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-600 transition-all"
                style={{
                  width: `${seatPercentage}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {statistics.used_seats} seats used
              </span>

              <span className="font-semibold text-gray-900">
                {statistics.seat_limit} total
              </span>
            </div>

            {statistics.remaining_seats ===
              0 &&
              statistics.seat_limit > 0 && (
                <div className="mt-5 rounded-xl bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800">
                    All student seats are currently
                    occupied.
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Increase your student capacity
                    before adding more active
                    students.
                  </p>
                </div>
              )}
          </div>

          {/* SUBSCRIPTION */}

          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  Subscription
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Your current Schools & Madrasas
                  subscription.
                </p>
              </div>

              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                {subscription?.status ===
                "active"
                  ? "Active"
                  : "Inactive"}
              </span>
            </div>

            {subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Billing
                  </span>

                  <span className="text-sm font-semibold text-gray-900">
                    {formatBillingInterval(
                      subscription.billing_interval
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Seats
                  </span>

                  <span className="text-sm font-semibold text-gray-900">
                    {subscription.student_seat_limit.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Amount
                  </span>

                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(
                      subscription.total_amount,
                      subscription.currency
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">
                    Expires
                  </span>

                  <span className="text-sm font-semibold text-gray-900">
                    {formatDate(
                      subscription.current_period_end
                    )}
                  </span>
                </div>

                <Link
                  href="/schools/subscription"
                  className="block rounded-xl border border-green-700 px-4 py-3 text-center text-sm font-semibold text-green-700 transition hover:bg-green-50"
                >
                  Manage Subscription
                </Link>
              </div>
            ) : (
              <div className="rounded-xl bg-gray-50 p-5">
                <p className="text-sm text-gray-600">
                  Your school does not currently
                  have an active subscription.
                </p>

                <Link
                  href="/schools"
                  className="mt-4 inline-block rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-800"
                >
                  Renew Subscription
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* =================================================
            QUICK ACTIONS
        ================================================= */}

        <section className="mb-8">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-gray-900">
              School Management
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Manage your school&apos;s learning
              environment from here.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/schools/students"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-xl">
                👨‍🎓
              </div>

              <h3 className="font-bold text-gray-900">
                Students
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Add students, generate credentials
                and manage your student list.
              </p>
            </Link>

            <Link
              href="/schools/classes"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-xl">
                🏫
              </div>

              <h3 className="font-bold text-gray-900">
                Classes
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Create and organize the classes in
                your school.
              </p>
            </Link>

            <Link
              href="/schools/challenges"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-xl">
                ⚔️
              </div>

              <h3 className="font-bold text-gray-900">
                Challenges
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                Give students access to Sahaba Quest
                challenges.
              </p>
            </Link>

            <Link
              href="/schools/leaderboard"
              className="rounded-2xl bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-xl">
                🏆
              </div>

              <h3 className="font-bold text-gray-900">
                Leaderboard
              </h3>

              <p className="mt-2 text-sm leading-6 text-gray-600">
                View student and class performance
                rankings.
              </p>
            </Link>
          </div>
        </section>

        {/* =================================================
            SCHOOL INFORMATION
        ================================================= */}

        <section>
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                School Information
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Basic information associated with
                your school account.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  School Name
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {school.school_name}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  School Type
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatSchoolType(
                    school.school_type
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  School Code
                </p>

                <p className="mt-1 font-mono text-sm font-semibold text-gray-900">
                  {school.school_code}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Country
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {school.country}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Location
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {[
                    school.city,
                    school.state,
                  ]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Contact Phone
                </p>

                <p className="mt-1 text-sm font-medium text-gray-900">
                  {school.contact_phone ||
                    "—"}
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}