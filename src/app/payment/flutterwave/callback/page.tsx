"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function FlutterwaveCallbackPage() {
  const searchParams =
    useSearchParams();

  const [status, setStatus] =
    useState<
      "verifying" |
      "success" |
      "failed"
    >("verifying");

  const [message, setMessage] =
    useState(
      "We are verifying your payment..."
    );

  const [planType, setPlanType] =
    useState("");

  useEffect(() => {
    async function verifyPayment() {
      const paymentStatus =
        searchParams.get(
          "status"
        );

      const txRef =
        searchParams.get(
          "tx_ref"
        );

      const transactionId =
        searchParams.get(
          "transaction_id"
        );

      if (
        !txRef ||
        !transactionId
      ) {
        setStatus("failed");

        setMessage(
          "We could not find the payment details needed to verify this transaction."
        );

        return;
      }

      if (
        paymentStatus !==
        "successful"
      ) {
        setStatus("failed");

        setMessage(
          "The payment was not completed successfully."
        );

        return;
      }

      try {
        const response =
          await fetch(
            "/api/payments/flutterwave/verify",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                tx_ref:
                  txRef,

                transaction_id:
                  transactionId,
              }),
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.error ||
              "Payment verification failed."
          );
        }

        setPlanType(
          result.plan_type ||
            ""
        );

        setStatus(
          "success"
        );

        setMessage(
          "Your payment has been verified successfully. Your Sahaba Quest subscription is now active."
        );
      } catch (error) {
        console.error(
          "Callback verification error:",
          error
        );

        setStatus(
          "failed"
        );

        setMessage(
          error instanceof Error
            ? error.message
            : "We could not verify your payment."
        );
      }
    }

    verifyPayment();
  }, [searchParams]);

  return (
    <main
      style={{
        minHeight: "100vh",

        display: "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        padding:
          "24px",

        background:
          "radial-gradient(circle at top left, rgba(204, 251, 241, 0.8), transparent 35%), var(--background)",
      }}
    >
      <div
        className="sq-card"
        style={{
          width:
            "100%",

          maxWidth:
            "560px",

          padding:
            "42px 30px",

          textAlign:
            "center",
        }}
      >
        {status ===
          "verifying" && (
          <>
            <div
              style={{
                width:
                  "56px",

                height:
                  "56px",

                margin:
                  "0 auto 24px",

                borderRadius:
                  "50%",

                border:
                  "4px solid var(--primary-light)",

                borderTopColor:
                  "var(--primary)",

                animation:
                  "spin 1s linear infinite",
              }}
            />

            <h1
              style={{
                margin:
                  0,

                fontSize:
                  "28px",

                fontWeight:
                  900,

                color:
                  "var(--primary-dark)",
              }}
            >
              Verifying payment
            </h1>

            <p
              style={{
                marginTop:
                  "14px",

                color:
                  "var(--muted)",

                lineHeight:
                  1.7,

                fontSize:
                  "14px",
              }}
            >
              {message}
            </p>
          </>
        )}

        {status ===
          "success" && (
          <>
            <div
              style={{
                width:
                  "64px",

                height:
                  "64px",

                margin:
                  "0 auto 24px",

                borderRadius:
                  "50%",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                background:
                  "var(--primary-light)",

                color:
                  "var(--primary)",

                fontSize:
                  "30px",

                fontWeight:
                  900,
              }}
            >
              ✓
            </div>

            <h1
              style={{
                margin:
                  0,

                fontSize:
                  "30px",

                fontWeight:
                  900,

                color:
                  "var(--primary-dark)",
              }}
            >
              Payment successful
            </h1>

            <p
              style={{
                marginTop:
                  "14px",

                color:
                  "var(--muted)",

                lineHeight:
                  1.7,

                fontSize:
                  "14px",
              }}
            >
              {message}
            </p>

            {planType && (
              <div
                style={{
                  marginTop:
                    "20px",

                  padding:
                    "12px 16px",

                  borderRadius:
                    "12px",

                  background:
                    "var(--primary-light)",

                  color:
                    "var(--primary-dark)",

                  fontSize:
                    "13px",

                  fontWeight:
                    800,

                  textTransform:
                    "capitalize",
                }}
              >
                {planType} plan activated
              </div>
            )}

            <div
              style={{
                display:
                  "flex",

                gap:
                  "12px",

                justifyContent:
                  "center",

                flexWrap:
                  "wrap",

                marginTop:
                  "28px",
              }}
            >
              <a
                href="/dashboard"
                className="sq-button-primary"
                style={{
                  minHeight:
                    "48px",

                  padding:
                    "0 22px",

                  display:
                    "inline-flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  textDecoration:
                    "none",
                }}
              >
                Go to Dashboard →
              </a>

              <a
                href="/"
                style={{
                  minHeight:
                    "48px",

                  padding:
                    "0 22px",

                  display:
                    "inline-flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  border:
                    "1px solid var(--border)",

                  borderRadius:
                    "12px",

                  textDecoration:
                    "none",

                  color:
                    "var(--primary-dark)",

                  fontSize:
                    "13px",

                  fontWeight:
                    800,

                  background:
                    "var(--white)",
                }}
              >
                Back Home
              </a>
            </div>
          </>
        )}

        {status ===
          "failed" && (
          <>
            <div
              style={{
                width:
                  "64px",

                height:
                  "64px",

                margin:
                  "0 auto 24px",

                borderRadius:
                  "50%",

                display:
                  "flex",

                alignItems:
                  "center",

                justifyContent:
                  "center",

                background:
                  "var(--danger-light)",

                color:
                  "var(--danger)",

                fontSize:
                  "28px",

                fontWeight:
                  900,
              }}
            >
              !
            </div>

            <h1
              style={{
                margin:
                  0,

                fontSize:
                  "28px",

                fontWeight:
                  900,
              }}
            >
              Payment verification issue
            </h1>

            <p
              style={{
                marginTop:
                  "14px",

                color:
                  "var(--muted)",

                lineHeight:
                  1.7,

                fontSize:
                  "14px",
              }}
            >
              {message}
            </p>

            <div
              style={{
                marginTop:
                  "28px",
              }}
            >
              <a
                href="/pricing"
                className="sq-button-primary"
                style={{
                  minHeight:
                    "48px",

                  padding:
                    "0 22px",

                  display:
                    "inline-flex",

                  alignItems:
                    "center",

                  justifyContent:
                    "center",

                  textDecoration:
                    "none",
                }}
              >
                Return to Pricing
              </a>
            </div>
          </>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </main>
  );
}