"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PaymentCallbackContent() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<"verifying" | "success" | "failed">(
    "verifying"
  );
  const [message, setMessage] = useState("Verifying your payment...");
  const [planType, setPlanType] = useState("");

  useEffect(() => {
    const verifyPayment = async () => {
      const paymentStatus = searchParams.get("status");
      const txRef = searchParams.get("tx_ref");
      const transactionId = searchParams.get("transaction_id");

      if (paymentStatus !== "successful" || !txRef || !transactionId) {
        setStatus("failed");
        setMessage("Payment was not completed successfully.");
        return;
      }

      try {
        const response = await fetch("/api/payments/flutterwave/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            tx_ref: txRef,
            transaction_id: transactionId,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          setStatus("failed");
          setMessage(data.error || "We could not verify your payment.");
          return;
        }

        setStatus("success");
        setPlanType(data.plan_type || "");
        setMessage("Your payment was verified successfully.");
      } catch (error) {
        console.error("Payment verification error:", error);

        setStatus("failed");
        setMessage(
          "Something went wrong while verifying your payment. Please contact support if you were charged."
        );
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
        {status === "verifying" && (
          <>
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

            <h1 className="text-2xl font-bold text-gray-900">
              Verifying Payment
            </h1>

            <p className="mt-3 text-gray-600">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">
              ✓
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Payment Successful
            </h1>

            <p className="mt-3 text-gray-600">{message}</p>

            {planType && (
              <p className="mt-2 text-sm font-medium text-gray-800">
                Your {planType} subscription is now active.
              </p>
            )}

            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              Go to Dashboard
            </Link>
          </>
        )}

        {status === "failed" && (
          <>
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl text-red-600">
              !
            </div>

            <h1 className="text-2xl font-bold text-gray-900">
              Payment Verification Failed
            </h1>

            <p className="mt-3 text-gray-600">{message}</p>

            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-black px-6 py-3 font-semibold text-white transition hover:bg-gray-800"
            >
              Return to Dashboard
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg text-center">
            <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-black" />

            <h1 className="text-2xl font-bold text-gray-900">
              Loading Payment
            </h1>

            <p className="mt-3 text-gray-600">
              Please wait while we prepare your payment verification.
            </p>
          </div>
        </main>
      }
    >
      <PaymentCallbackContent />
    </Suspense>
  );
}