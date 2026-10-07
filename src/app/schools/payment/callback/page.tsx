"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type VerificationResult = {
  success: boolean;
  error?: string;
  school_id?: string;
  school_subscription_id?: string;
  school_status?: string;
  already_processed?: boolean;
  current_period_end?: string;
  student_seat_limit?: number;
};

function SchoolPaymentCallbackContent() {
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<
    "verifying" | "success" | "failed"
  >("verifying");

  const [message, setMessage] = useState(
    "Verifying your school payment..."
  );

  const [result, setResult] =
    useState<VerificationResult | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      const txRef = searchParams.get("tx_ref");

      const transactionId =
        searchParams.get("transaction_id");

      const paymentStatus =
        searchParams.get("status");

      // -------------------------------------------------------
      // 1. Make sure Flutterwave returned the required values
      // -------------------------------------------------------

      if (!txRef || !transactionId) {
        setStatus("failed");

        setMessage(
          "We could not find the payment transaction details."
        );

        return;
      }

      // -------------------------------------------------------
      // 2. Check the redirect status
      //
      // This is only an early check.
      // The server still verifies the transaction directly
      // with Flutterwave.
      // -------------------------------------------------------

      if (
        paymentStatus &&
        paymentStatus !== "successful"
      ) {
        setStatus("failed");

        setMessage(
          "The school payment was not completed successfully."
        );

        return;
      }

      try {
        // -----------------------------------------------------
        // 3. Send transaction details to our server
        // -----------------------------------------------------

        const response = await fetch(
          "/api/schools/payment/verify",
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json",
            },

            body: JSON.stringify({
              tx_ref: txRef,

              transaction_id:
                transactionId,
            }),
          }
        );

        const data =
          (await response.json()) as VerificationResult;

        setResult(data);

        // -----------------------------------------------------
        // 4. Handle verification failure
        // -----------------------------------------------------

        if (!response.ok || !data.success) {
          setStatus("failed");

          setMessage(
            data.error ||
              "We could not verify your payment."
          );

          return;
        }

        // -----------------------------------------------------
        // 5. Payment successfully verified
        // -----------------------------------------------------

        setStatus("success");

        setMessage(
          "Your school payment has been verified successfully."
        );
      } catch (error) {
        console.error(
          "School payment verification request failed:",
          error
        );

        setStatus("failed");

        setMessage(
          "Something went wrong while verifying your payment."
        );
      }
    };

    verifyPayment();
  }, [searchParams]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border bg-card p-8 text-center shadow-sm">

          {/* =================================================
              VERIFYING
          ================================================= */}

          {status === "verifying" && (
            <>
              <div className="mx-auto mb-6 h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />

              <h1 className="text-2xl font-bold">
                Verifying Payment
              </h1>

              <p className="mt-3 text-muted-foreground">
                {message}
              </p>
            </>
          )}

          {/* =================================================
              SUCCESS
          ================================================= */}

          {status === "success" && (
            <>
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-2xl">
                ✓
              </div>

              <h1 className="text-2xl font-bold">
                Payment Successful
              </h1>

              <p className="mt-3 text-muted-foreground">
                {message}
              </p>

              {/* Student seat information */}

              {result?.student_seat_limit !==
                undefined && (
                <div className="mt-6 rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">
                    Student seats purchased
                  </p>

                  <p className="mt-1 text-2xl font-bold">
                    {result.student_seat_limit}
                  </p>
                </div>
              )}

              {/* Subscription information */}

              {result?.current_period_end && (
                <div className="mt-4 rounded-xl border p-4">
                  <p className="text-sm text-muted-foreground">
                    Subscription active until
                  </p>

                  <p className="mt-1 font-semibold">
                    {new Date(
                      result.current_period_end
                    ).toLocaleDateString(
                      undefined,
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </p>
                </div>
              )}

              <p className="mt-6 text-sm text-muted-foreground">
                Your School & Madrasas account is now
                active.
              </p>

              {result?.already_processed && (
                <p className="mt-2 text-xs text-muted-foreground">
                  This payment had already been processed.
                </p>
              )}
            </>
          )}

          {/* =================================================
              FAILED
          ================================================= */}

          {status === "failed" && (
            <>
              <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
                !
              </div>

              <h1 className="text-2xl font-bold">
                Payment Verification Failed
              </h1>

              <p className="mt-3 text-muted-foreground">
                {message}
              </p>

              <button
                type="button"
                onClick={() => {
                  window.location.href =
                    "/schools";
                }}
                className="mt-6 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground"
              >
                Return to Schools & Madrasas
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function SchoolPaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-6 bg-background">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />

            <p className="text-muted-foreground">
              Loading payment verification...
            </p>
          </div>
        </main>
      }
    >
      <SchoolPaymentCallbackContent />
    </Suspense>
  );
}