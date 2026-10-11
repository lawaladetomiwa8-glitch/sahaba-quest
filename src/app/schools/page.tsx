"use client";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";
import { supabase } from "../../lib/supabase";
type SchoolType =
  | "school"
  | "madrasa"
  | "islamic_centre"
  | "other";
type BillingInterval = "monthly" | "termly";
type Currency = "NGN" | "USD" | "GBP" | "EUR";
const countryCodes = getCountries();

type CountryOption = {
  code: CountryCode;
  name: string;
  callingCode: string;
};
const pricing = {
  NGN: {
    symbol: "₦",
    name: "Nigerian Naira",
    monthly: 200,
    termly: 600,
  },
  USD: {
    symbol: "$",
    name: "US Dollar",
    monthly: 1,
    termly: 3,
  },
  GBP: {
    symbol: "£",
    name: "British Pound",
    monthly: 1,
    termly: 3,
  },
  EUR: {
    symbol: "€",
    name: "Euro",
    monthly: 1,
    termly: 3,
  },
} satisfies Record<
  Currency,
  {
    symbol: string;
    name: string;
    monthly: number;
    termly: number;
  }
>;
function formatAmount(currency: Currency, amount: number) {
  return new Intl.NumberFormat(
    currency === "NGN" ? "en-NG" : "en-US",
    {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "NGN" ? 0 : 2,
      maximumFractionDigits: currency === "NGN" ? 0 : 2,
    }
  ).format(amount);
}
export default function SchoolsPage() {
  // Do not calculate country labels during server rendering. ICU/Intl data can
  // differ between the server and browser, causing a hydration mismatch.
  const [countryOptions, setCountryOptions] = useState<CountryOption[]>([]);

  useEffect(() => {
    const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

    const options: CountryOption[] = countryCodes
      .map((code) => ({
        code,
        name: code === "FK" ? "Falkland Islands" : displayNames.of(code) || code,
        callingCode: getCountryCallingCode(code),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    setCountryOptions(options);
  }, []);

  const [step, setStep] = useState(1);
  const [schoolName, setSchoolName] = useState("");
  const [schoolType, setSchoolType] =
    useState<SchoolType>("school");
  const [country, setCountry] =
    useState<CountryCode>("NG");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [adminFullName, setAdminFullName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [studentSeats, setStudentSeats] = useState(10);
  const [billingInterval, setBillingInterval] =
    useState<BillingInterval>("monthly");
  const [currency, setCurrency] =
    useState<Currency>("NGN");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [schoolId, setSchoolId] = useState<string | null>(null);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationNotice, setVerificationNotice] = useState("");
  const currentPrice = useMemo(() => {
    return (
      pricing[currency][billingInterval] *
      studentSeats
    );
  }, [currency, billingInterval, studentSeats]);
  const selectedCountry = useMemo(() => {
    return countryOptions.find(
      (item) => item.code === country
    );
  }, [country, countryOptions]);
  function validateContactPhone() {
    const phone = contactPhone.trim();
    if (!phone) {
      return "Please enter the school's contact phone number.";
    }
    if (!/^[0-9+().\s-]+$/.test(phone)) {
      return "Please enter a valid phone number. Letters and invalid characters are not allowed.";
    }
    try {
      if (!isValidPhoneNumber(phone, country)) {
        return "Please enter a valid phone number for the selected country.";
      }
    } catch {
      return "Please enter a valid phone number.";
    }
    return "";
  }
  function validateStepOne() {
    if (!schoolName.trim()) {
      return "Please enter the school or madrasa name.";
    }
    if (!state.trim()) {
      return "Please enter the state.";
    }
    if (!city.trim()) {
      return "Please enter the city.";
    }
    const phoneError = validateContactPhone();
    if (phoneError) {
      return phoneError;
    }
    return "";
  }
  function validateStepTwo() {
    if (!adminFullName.trim()) {
      return "Please enter the administrator's full name.";
    }
    if (!adminEmail.trim()) {
      return "Please enter the administrator's email.";
    }
    if (!adminPassword) {
      return "Please create a password.";
    }
    if (adminPassword.length < 8) {
      return "Password must contain at least 8 characters.";
    }
    if (!/[A-Z]/.test(adminPassword)) {
      return "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(adminPassword)) {
      return "Password must contain at least one lowercase letter.";
    }
    if (!/\d/.test(adminPassword)) {
      return "Password must contain at least one number.";
    }
    if (!/[^A-Za-z0-9]/.test(adminPassword)) {
      return "Password must contain at least one special character.";
    }
    if (adminPassword !== confirmPassword) {
      return "The passwords do not match.";
    }
    return "";
  }
  function goToStepTwo() {
    setError("");
    const validationError = validateStepOne();
    if (validationError) {
      setError(validationError);
      return;
    }
    setStep(2);
  }
  async function handleAdminRegistration() {
    setError("");
    setSuccessMessage("");
    const validationError = validateStepTwo();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (loading) return;
    setLoading(true);
    try {
      const phoneError = validateContactPhone();
      if (phoneError) {
        setError(phoneError);
        setStep(1);
        return;
      }
      const response = await fetch("/api/schools/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          school_name: schoolName.trim(),
          school_type: schoolType,
          country,
          state: state.trim(),
          city: city.trim(),
          address: address.trim(),
          contact_phone: contactPhone.trim(),
          admin_full_name: adminFullName.trim(),
          admin_email: adminEmail.trim().toLowerCase(),
          admin_password: adminPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Unable to create the school.");
      }
      const createdSchoolId = result.school?.id;
      if (!createdSchoolId) {
        throw new Error("The server did not return the new school ID. Please contact support before trying registration again.");
      }
      // Store only the school ID and email; never store the password.
      window.localStorage.setItem("sahabaQuestPendingSchoolId", createdSchoolId);
      window.localStorage.setItem("sahabaQuestPendingSchoolEmail", adminEmail.trim().toLowerCase());
      setSchoolId(createdSchoolId);
      setVerificationNotice(
        `We've sent a confirmation email to ${adminEmail.trim().toLowerCase()}. Please open that email and click the confirmation link before choosing a plan.`
      );
      setShowVerificationModal(true);
    } catch (err) {
      console.error("School administrator registration error:", err);
      setError(err instanceof Error ? err.message : "Unable to complete school registration.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    let mounted = true;
    const completeVerificationReturn = async (session: any) => {
      if (!mounted || !session?.user?.email_confirmed_at) return;
      const url = new URL(window.location.href);
      if (url.searchParams.get("email_verification") !== "complete") return;
      const querySchoolId = url.searchParams.get("school_id");
      const storedSchoolId = window.localStorage.getItem("sahabaQuestPendingSchoolId");
      const resolvedSchoolId = querySchoolId || storedSchoolId;
      if (!resolvedSchoolId) {
        setError("Your email is verified, but we couldn't find the pending school registration. Please contact support rather than registering again.");
        return;
      }
      window.localStorage.setItem("sahabaQuestPendingSchoolId", resolvedSchoolId);
      setSchoolId(resolvedSchoolId);
      setShowVerificationModal(false);
      setVerificationNotice("");
      setError("");
      setSuccessMessage("Email verified successfully. You can now choose your school plan.");
      setStep(3);
      url.searchParams.delete("email_verification");
      url.searchParams.delete("school_id");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    };
    const resumeFromUrl = async () => {
      const url = new URL(window.location.href);
      if (url.searchParams.get("email_verification") !== "complete") return;
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!mounted) return;
      if (sessionError) {
        console.error("Could not restore session after email confirmation:", sessionError);
        setVerificationNotice("Your confirmation link returned to Sahaba Quest, but your session is still loading. Please wait and select “I've confirmed my email”.");
        setShowVerificationModal(true);
        return;
      }
      if (data.session?.user?.email_confirmed_at) {
        await completeVerificationReturn(data.session);
      } else {
        setVerificationNotice("If you've just clicked the confirmation link, your session may still be loading. Select “I've confirmed my email” to check again.");
        setShowVerificationModal(true);
      }
    };
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void completeVerificationReturn(session);
    });
    void resumeFromUrl();
    const url = new URL(window.location.href);
    const querySchoolId = url.searchParams.get("school_id");
    const storedSchoolId = window.localStorage.getItem("sahabaQuestPendingSchoolId");
    if (querySchoolId || storedSchoolId) {
      setSchoolId(querySchoolId || storedSchoolId);
    }
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);
  async function handleRegistration(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      const pendingSchoolId =
        schoolId || window.localStorage.getItem("sahabaQuestPendingSchoolId");
      if (!pendingSchoolId) {
        throw new Error("Your pending school registration could not be found. Please contact support rather than registering again.");
      }
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        throw new Error("Please confirm your email and sign in before proceeding to payment.");
      }
      const { data: userData, error: userError } = await supabase.auth.getUser(
        sessionData.session.access_token
      );
      if (userError || !userData.user?.email_confirmed_at) {
        throw new Error("Please verify your administrator email address before proceeding to payment.");
      }
      const paymentResponse = await fetch("/api/schools/payment/initialize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          school_id: pendingSchoolId,
          student_seat_limit: studentSeats,
          billing_interval: billingInterval,
          currency,
        }),
      });
      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(paymentData.error || "Unable to initialize payment.");
      }
      if (!paymentData.checkout_url) {
        throw new Error("Flutterwave did not return a checkout URL.");
      }
      window.location.href = paymentData.checkout_url;
    } catch (err) {
      console.error("School payment initialization error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  async function checkVerificationAndContinue() {
    setError("");
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      setError("We couldn't check your verification status. Please try again.");
      return;
    }
    if (!data.session?.user?.email_confirmed_at) {
      setVerificationNotice("We haven't detected a verified session yet. Please click the confirmation link in your email first. If you've already confirmed, refresh this page and try again.");
      return;
    }
    const url = new URL(window.location.href);
    const pendingId = url.searchParams.get("school_id") ||
      schoolId ||
      window.localStorage.getItem("sahabaQuestPendingSchoolId");
    if (!pendingId) {
      setError("Your email is verified, but the pending school registration could not be found. Please contact support rather than registering again.");
      return;
    }
    setSchoolId(pendingId);
    window.localStorage.setItem("sahabaQuestPendingSchoolId", pendingId);
    setShowVerificationModal(false);
    setVerificationNotice("");
    setSuccessMessage("Email verified successfully. You can now choose your school plan.");
    setStep(3);
    if (url.searchParams.has("email_verification")) {
      url.searchParams.delete("email_verification");
      url.searchParams.delete("school_id");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }
  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.75), transparent 32%), var(--background)",
      }}
    >
      <header className="sq-nav">
        <Link href="/" className="sq-logo">
          Sahaba Quest
        </Link>
        <Link
          href="/login"
          className="sq-button-secondary"
          style={{
            minHeight: "42px",
            padding: "0 16px",
            fontSize: "13px",
          }}
        >
          Sign In
        </Link>
      </header>
      <section className="sq-page">
        <div
          className="sq-container"
          style={{
            maxWidth: "1050px",
          }}
        >
          {/* HERO */}
          <div
            style={{
              textAlign: "center",
              marginBottom: "36px",
            }}
          >
            <span className="sq-badge">
              Schools & Madrasas
            </span>
            <h1
              className="sq-title"
              style={{
                marginTop: "18px",
                marginBottom: "14px",
              }}
            >
              Bring Sahaba Quest
              <br />
              to Your Students
            </h1>
            <p
              className="sq-subtitle"
              style={{
                maxWidth: "680px",
                margin: "0 auto",
              }}
            >
              Give your students a fun and meaningful
              way to learn about the Sahaba, build
              Islamic knowledge, earn XP and grow
              together as a school or madrasa.
            </p>
          </div>
          {/* QUICK ACCESS: students and school administrators */}
          <section
            aria-label="School and student access"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "16px",
              margin: "0 auto 34px",
              maxWidth: "1000px",
            }}
          >
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "22px",
                background: "var(--background)",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "10px" }} aria-hidden="true">🎓</div>
              <h2 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 800 }}>
                Already a student?
              </h2>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
                Sign in with the Student ID and PIN provided by your school.
              </p>
              <Link
                href="/schools/student-login"
                className="sq-button-secondary"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "0 14px", textDecoration: "none" }}
              >
                Student Login →
              </Link>
            </div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "22px",
                background: "var(--background)",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "10px" }} aria-hidden="true">🏫</div>
              <h2 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 800 }}>
                New school or madrasa?
              </h2>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
                Create your institution’s account, verify the administrator email, and choose a plan.
              </p>
              <a
                href="#school-registration"
                className="sq-button-primary"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "0 14px", textDecoration: "none" }}
              >
                Register School →
              </a>
            </div>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "22px",
                background: "var(--background)",
              }}
            >
              <div style={{ fontSize: "24px", marginBottom: "10px" }} aria-hidden="true">🔐</div>
              <h2 style={{ margin: "0 0 8px", fontSize: "17px", fontWeight: 800 }}>
                Already registered?
              </h2>
              <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: "13px", lineHeight: 1.6 }}>
                School and madrasa administrators can sign in with their account email and password.
              </p>
              <Link
                href="/login"
                className="sq-button-secondary"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minHeight: "42px", padding: "0 14px", textDecoration: "none" }}
              >
                Administrator Sign In →
              </Link>
            </div>
          </section>
          {/* STEP INDICATOR */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "10px",
              marginBottom: "28px",
              flexWrap: "wrap",
            }}
          >
            {[
              ["1", "School"],
              ["2", "Admin"],
              ["3", "Plan"],
            ].map(([number, label], index) => {
              const active = step === index + 1;
              const completed = step > index + 1;
              return (
                <div
                  key={number}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      width: "34px",
                      height: "34px",
                      borderRadius: "50%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 800,
                      fontSize: "13px",
                      background:
                        active || completed
                          ? "var(--primary)"
                          : "#eef2f1",
                      color:
                        active || completed
                          ? "white"
                          : "var(--muted)",
                    }}
                  >
                    {number}
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: 700,
                      color:
                        active
                          ? "var(--primary-dark)"
                          : "var(--muted)",
                    }}
                  >
                    {label}
                  </span>
                  {index < 2 && (
                    <div
                      style={{
                        width: "36px",
                        height: "1px",
                        background: "var(--border)",
                        margin: "0 4px",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <form
            id="school-registration"
            onSubmit={handleRegistration}
            className="sq-card"
            style={{
              maxWidth: "820px",
              margin: "0 auto",
              padding: "36px",
            }}
          >
            {/* ERROR */}
            {error && (
              <div
                style={{
                  marginBottom: "22px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  color: "#be123c",
                  fontSize: "14px",
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}
            {/* SUCCESS */}
            {successMessage && (
              <div
                style={{
                  marginBottom: "22px",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "#ecfdf5",
                  border: "1px solid #a7f3d0",
                  color: "#047857",
                  fontSize: "14px",
                }}
              >
                {successMessage}
              </div>
            )}
            {/* =================================================
                STEP 1 — SCHOOL INFORMATION
            ================================================= */}
            {step === 1 && (
              <>
                <div style={{ marginBottom: "28px" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "24px",
                      fontWeight: 850,
                      color: "var(--foreground)",
                    }}
                  >
                    Tell us about your school
                  </h2>
                  <p
                    style={{
                      marginTop: "8px",
                      marginBottom: 0,
                      color: "var(--muted)",
                      fontSize: "14px",
                    }}
                  >
                    Enter the basic information about
                    your school or madrasa.
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(2, minmax(0, 1fr))",
                    gap: "18px",
                  }}
                >
                  <Field
                    label="School / Madrasa Name"
                    required
                  >
                    <input
                      value={schoolName}
                      onChange={(e) =>
                        setSchoolName(e.target.value)
                      }
                      placeholder="e.g. Al-Hikmah Academy"
                      className="sq-input"
                    />
                  </Field>
                  <Field label="Type" required>
                    <select
                      value={schoolType}
                      onChange={(e) =>
                        setSchoolType(
                          e.target.value as SchoolType
                        )
                      }
                      className="sq-input"
                    >
                      <option value="school">
                        School
                      </option>
                      <option value="madrasa">
                        Madrasa
                      </option>
                      <option value="islamic_centre">
                        Islamic Centre
                      </option>
                      <option value="other">
                        Other
                      </option>
                    </select>
                  </Field>
                  <Field label="Country" required>
                    <select
                      value={country}
                      onChange={(e) =>
                        setCountry(
                          e.target.value as CountryCode
                        )
                      }
                      className="sq-input"
                    >
                      {countryOptions.map((item) => (
                        <option
                          key={item.code}
                          value={item.code}
                        >
                          {item.name} (+{item.callingCode})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="State" required>
                    <input
                      value={state}
                      onChange={(e) =>
                        setState(e.target.value)
                      }
                      placeholder="e.g. Lagos"
                      className="sq-input"
                    />
                  </Field>
                  <Field label="City" required>
                    <input
                      value={city}
                      onChange={(e) =>
                        setCity(e.target.value)
                      }
                      placeholder="e.g. Lagos"
                      className="sq-input"
                    />
                  </Field>
                  <Field
                    label="Contact Phone"
                    required
                    hint={`Enter a valid phone number for ${
                      selectedCountry?.name ||
                      "the selected country"
                    }.`}
                  >
                    <input
                      value={contactPhone}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (
                          /^[0-9+().\s-]*$/.test(
                            value
                          )
                        ) {
                          setContactPhone(value);
                        }
                      }}
                      placeholder={`+${getCountryCallingCode(
                        country
                      )} ...`}
                      className="sq-input"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                    />
                  </Field>
                  <div
                    style={{
                      gridColumn: "1 / -1",
                    }}
                  >
                    <Field label="Address">
                      <textarea
                        value={address}
                        onChange={(e) =>
                          setAddress(e.target.value)
                        }
                        placeholder="School address"
                        className="sq-input"
                        rows={3}
                        style={{
                          resize: "vertical",
                        }}
                      />
                    </Field>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "28px",
                  }}
                >
                  <button
                    type="button"
                    className="sq-button-primary"
                    onClick={goToStepTwo}
                  >
                    Continue →
                  </button>
                </div>
              </>
            )}
            {/* =================================================
                STEP 2 — ADMINISTRATOR
            ================================================= */}
            {step === 2 && (
              <>
                <div style={{ marginBottom: "28px" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "24px",
                      fontWeight: 850,
                      color: "var(--foreground)",
                    }}
                  >
                    Create your school account
                  </h2>
                  <p
                    style={{
                      marginTop: "8px",
                      marginBottom: 0,
                      color: "var(--muted)",
                      fontSize: "14px",
                    }}
                  >
                    This administrator will manage the
                    school's Sahaba Quest account.
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: "18px",
                  }}
                >
                  <Field
                    label="Administrator Full Name"
                    required
                  >
                    <input
                      value={adminFullName}
                      onChange={(e) =>
                        setAdminFullName(e.target.value)
                      }
                      placeholder="e.g. Ahmad Ibrahim"
                      className="sq-input"
                    />
                  </Field>
                  <Field
                    label="Administrator Email"
                    required
                  >
                    <input
                      value={adminEmail}
                      onChange={(e) =>
                        setAdminEmail(e.target.value)
                      }
                      placeholder="admin@example.com"
                      className="sq-input"
                      type="email"
                      autoComplete="email"
                    />
                  </Field>
                  <Field
                    label="Password"
                    required
                    hint="At least 8 characters with uppercase, lowercase, number and special character."
                  >
                    <input
                      value={adminPassword}
                      onChange={(e) =>
                        setAdminPassword(e.target.value)
                      }
                      placeholder="Create a secure password"
                      className="sq-input"
                      type="password"
                      autoComplete="new-password"
                    />
                  </Field>
                  <Field
                    label="Confirm Password"
                    required
                  >
                    <input
                      value={confirmPassword}
                      onChange={(e) =>
                        setConfirmPassword(e.target.value)
                      }
                      placeholder="Repeat your password"
                      className="sq-input"
                      type="password"
                      autoComplete="new-password"
                    />
                  </Field>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginTop: "28px",
                  }}
                >
                  <button
                    type="button"
                    className="sq-button-secondary"
                    onClick={() => {
                      setError("");
                      setStep(1);
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="sq-button-primary"
                    onClick={handleAdminRegistration}
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Create account & verify email →"}
                  </button>
                </div>
              </>
            )}
            {/* =================================================
                STEP 3 — PLAN
            ================================================= */}
            {step === 3 && (
              <>
                <div style={{ marginBottom: "28px" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "24px",
                      fontWeight: 850,
                      color: "var(--foreground)",
                    }}
                  >
                    Choose your plan
                  </h2>
                  <p
                    style={{
                      marginTop: "8px",
                      marginBottom: 0,
                      color: "var(--muted)",
                      fontSize: "14px",
                    }}
                  >
                    Select the number of students,
                    billing interval and currency.
                  </p>
                </div>
                <div
                  style={{
                    display: "grid",
                    gap: "18px",
                  }}
                >
                  <Field
                    label="Number of Student Seats"
                    required
                    hint="Each active student uses one seat."
                  >
                    <input
                      value={studentSeats}
                      onChange={(e) => {
                        const value =
                          Number(e.target.value);
                        if (
                          Number.isInteger(value) &&
                          value >= 1 &&
                          value <= 100000
                        ) {
                          setStudentSeats(value);
                        } else if (
                          e.target.value === ""
                        ) {
                          setStudentSeats(0);
                        }
                      }}
                      min={1}
                      max={100000}
                      type="number"
                      className="sq-input"
                    />
                  </Field>
                  <Field
                    label="Billing Interval"
                    required
                  >
                    <select
                      value={billingInterval}
                      onChange={(e) =>
                        setBillingInterval(
                          e.target
                            .value as BillingInterval
                        )
                      }
                      className="sq-input"
                    >
                      <option value="monthly">
                        Monthly —{" "}
                        {formatAmount(
                          currency,
                          pricing[currency].monthly
                        )}{" "}
                        per student
                      </option>
                      <option value="termly">
                        Termly —{" "}
                        {formatAmount(
                          currency,
                          pricing[currency].termly
                        )}{" "}
                        per student
                      </option>
                    </select>
                  </Field>
                  <Field label="Currency" required>
                    <select
                      value={currency}
                      onChange={(e) =>
                        setCurrency(
                          e.target.value as Currency
                        )
                      }
                      className="sq-input"
                    >
                      <option value="NGN">
                        ₦ Nigerian Naira
                      </option>
                      <option value="USD">
                        $ US Dollar
                      </option>
                      <option value="GBP">
                        £ British Pound
                      </option>
                      <option value="EUR">
                        € Euro
                      </option>
                    </select>
                  </Field>
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "22px",
                      borderRadius: "16px",
                      background:
                        "rgba(204, 251, 241, 0.45)",
                      border:
                        "1px solid rgba(15, 118, 110, 0.15)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        alignItems: "center",
                        gap: "20px",
                        flexWrap: "wrap",
                      }}
                    >
                      <div>
                        <div
                          style={{
                            fontSize: "13px",
                            color: "var(--muted)",
                            marginBottom: "6px",
                          }}
                        >
                          Total
                        </div>
                        <div
                          style={{
                            fontSize: "30px",
                            fontWeight: 850,
                            color:
                              "var(--primary-dark)",
                          }}
                        >
                          {formatAmount(
                            currency,
                            currentPrice
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          fontSize: "13px",
                          color: "var(--muted)",
                          textAlign: "right",
                        }}
                      >
                        {studentSeats} student
                        {studentSeats === 1
                          ? ""
                          : "s"} ×{" "}
                        {formatAmount(
                          currency,
                          pricing[currency][
                            billingInterval
                          ]
                        )}{" "}
                        per student
                        <br />
                        {billingInterval ===
                        "monthly"
                          ? "per month"
                          : "per term"}
                      </div>
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "12px",
                    marginTop: "28px",
                  }}
                >
                  <button
                    type="button"
                    className="sq-button-secondary"
                    onClick={() => {
                      setError("");
                      setStep(2);
                    }}
                    disabled={loading}
                  >
                    ← Back
                  </button>
                  <button
                    type="submit"
                    className="sq-button-primary"
                    disabled={
                      loading || studentSeats < 1
                    }
                  >
                    {loading
                      ? "Preparing payment..."
                      : `Pay ${formatAmount(
                          currency,
                          currentPrice
                        )}`}
                  </button>
                </div>
              </>
            )}
          </form>
        </div>
      </section>
      {showVerificationModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="school-email-verification-title"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
            background: "rgba(15, 23, 42, 0.62)",
          }}
        >
          <div
            className="sq-card"
            style={{
              width: "100%",
              maxWidth: "520px",
              padding: "30px",
              background: "var(--background)",
              boxShadow: "0 24px 80px rgba(0,0,0,0.25)",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "54px",
                height: "54px",
                display: "grid",
                placeItems: "center",
                marginBottom: "18px",
                borderRadius: "50%",
                background: "rgba(13, 148, 136, 0.12)",
                color: "var(--primary-dark)",
                fontSize: "26px",
              }}
            >
              ✉
            </div>
            <h2
              id="school-email-verification-title"
              style={{ margin: "0 0 12px", fontSize: "24px", fontWeight: 850 }}
            >
              Verify your email address
            </h2>
            <p style={{ margin: "0 0 12px", lineHeight: 1.7, color: "var(--muted)" }}>
              {verificationNotice || `We've sent a confirmation email to ${adminEmail.trim().toLowerCase()}. Please open the email and click the confirmation link before choosing a plan.`}
            </p>
            <p style={{ margin: "0 0 22px", lineHeight: 1.7, color: "var(--muted)", fontSize: "13px" }}>
              Check your spam or junk folder if you don't see it. After confirmation, Sahaba Quest will return you to Step 3. Your school registration will not be submitted again.
            </p>
            <button
              type="button"
              className="sq-button-primary"
              onClick={checkVerificationAndContinue}
              style={{ width: "100%", marginBottom: "12px" }}
            >
              I've confirmed my email
            </button>
            <button
              type="button"
              className="sq-button-secondary"
              onClick={() => {
                setShowVerificationModal(false);
                setSuccessMessage("Your school registration is saved. Use the confirmation link in your email to return and continue.");
              }}
              style={{ width: "100%" }}
            >
              I'll verify later
            </button>
          </div>
        </div>
      )}
</main>
  );
}
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "7px",
      }}
    >
      <label
        style={{
          fontSize: "13px",
          fontWeight: 750,
          color: "var(--foreground)",
        }}
      >
        {label}
        {required && (
          <span
            style={{
              color: "#dc2626",
              marginLeft: "4px",
            }}
          >
            *
          </span>
        )}
      </label>
      {children}
      {hint && (
        <span
          style={{
            fontSize: "12px",
            color: "var(--muted)",
            lineHeight: 1.45,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
