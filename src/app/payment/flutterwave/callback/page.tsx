"use client";

import {
  Suspense,
  useEffect,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type VerificationResult = {
  success?: boolean;
  already_processed?: boolean;
  subscription_id?: string;
  plan_type?: string;
  billing_interval?: string;
  currency?: string;
  current_period_end?: string;
  error?: string;
};

function FlutterwaveCallbackContent() {
  const searchParams = useSearchParams();

  const txRef = searchParams.get("tx_ref");
  const transactionId =
    searchParams.get("transaction_id");

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState(
    "Verifying your payment..."
  );
  const [result, setResult] =
    useState<VerificationResult | null>(null);

  useEffect(() => {
    /*
     * We intentionally do NOT require:
     *
     * status === "successful"
     *
     * Flutterwave can return a completed payment with
     * status values such as "completed".
     *
     * The server-side verification determines whether
     * the payment is actually valid.
     */

    if (!txRef || !transactionId) {
      setLoading(false);
      setSuccess(false);
      setMessage(
        "Payment information is incomplete. We could not verify this transaction."
      );
      return;
    }

    const verifyPayment = async () => {
      try {
        setLoading(true);
        setMessage("Verifying your payment...");

        const response = await fetch(
          "/api/payments/flutterwave/verify",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              tx_ref: txRef,
              transaction_id: transactionId,
            }),
          }
        );

        const data =
          (await response.json()) as VerificationResult;

        setResult(data);

        if (!response.ok || !data.success) {
          setSuccess(false);
          setMessage(
            data.error ||
              "Payment could not be verified."
          );
          return;
        }

        setSuccess(true);
        setMessage(
          "Your payment was verified successfully."
        );
      } catch (error) {
        console.error(
          "Flutterwave callback verification error:",
          error
        );

        setSuccess(false);
        setMessage(
          "We could not verify your payment at this time."
        );
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [txRef, transactionId]);

  return (
    <main className="sq-page">
      <div className="sq-container">
        <div
          className="sq-card"
          style={{
            maxWidth: "600px",
            margin: "60px auto",
            textAlign: "center",
          }}
        >
          {loading ? (
            <>
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: "20px",
                }}
              >
                ⏳
              </div>

              <h1>Verifying Payment</h1>

              <p
                style={{
                  marginTop: "12px",
                  opacity: 0.8,
                }}
              >
                Please wait while we confirm your
                payment with Flutterwave.
              </p>
            </>
          ) : success ? (
            <>
              <div
                style={{
                  fontSize: "56px",
                  marginBottom: "16px",
                }}
              >
                ✅
              </div>

              <h1>Payment Successful!</h1>

              <p
                style={{
                  marginTop: "12px",
                  opacity: 0.85,
                }}
              >
                Your payment has been verified and
                your subscription is now active.
              </p>

              {result?.plan_type && (
                <div
                  className="sq-stat"
                  style={{
                    marginTop: "24px",
                    padding: "18px",
                  }}
                >
                  <strong>
                    {result.plan_type === "plus"
                      ? "Individual Plus"
                      : result.plan_type}
                  </strong>

                  {result.billing_interval && (
                    <div
                      style={{
                        marginTop: "6px",
                      }}
                    >
                      Billing:{" "}
                      {result.billing_interval}
                    </div>
                  )}
                </div>
              )}

              <div
                style={{
                  marginTop: "28px",
                }}
              >
                <Link
                  href="/dashboard"
                  className="sq-button-primary"
                >
                  Go to Dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <div
                style={{
                  fontSize: "56px",
                  marginBottom: "16px",
                }}
              >
                ⚠️
              </div>

              <h1>Payment Verification Failed</h1>

              <p
                style={{
                  marginTop: "12px",
                  opacity: 0.85,
                }}
              >
                {message}
              </p>

              <p
                style={{
                  marginTop: "12px",
                  fontSize: "14px",
                  opacity: 0.7,
                }}
              >
                If your bank or Flutterwave shows the
                payment as successful, please check your
                dashboard before attempting another
                payment.
              </p>

              <div
                style={{
                  marginTop: "28px",
                }}
              >
                <Link
                  href="/dashboard"
                  className="sq-button-secondary"
                >
                  Go to Dashboard
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function LoadingFallback() {
  return (
    <main className="sq-page">
      <div className="sq-container">
        <div
          className="sq-card"
          style={{
            maxWidth: "600px",
            margin: "60px auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "48px",
              marginBottom: "20px",
            }}
          >
            ⏳
          </div>

          <h1>Loading Payment</h1>

          <p
            style={{
              marginTop: "12px",
              opacity: 0.8,
            }}
          >
            Please wait...
          </p>
        </div>
      </div>
    </main>
  );
}

export default function FlutterwaveCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <FlutterwaveCallbackContent />
    </Suspense>
  );
}