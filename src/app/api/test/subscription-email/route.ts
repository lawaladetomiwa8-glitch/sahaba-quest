import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";

export async function GET() {
  // Safety: this test route only works locally.
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json(
      {
        success: false,
        error: "This test route is only available in development.",
      },
      { status: 403 }
    );
  }

  const testEmail = "lawaladetomiwa8@gmail.com";

  const expiryDate = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  );

  const formattedExpiryDate = expiryDate.toLocaleDateString(
    "en-NG",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );

  const result = await sendEmail({
    to: testEmail,
    subject: "Sahaba Quest — Subscription Email Test",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <title>Sahaba Quest Email Test</title>
        </head>

        <body
          style="
            margin: 0;
            padding: 0;
            background-color: #f5f7f5;
            font-family: Arial, Helvetica, sans-serif;
          "
        >
          <div
            style="
              max-width: 600px;
              margin: 40px auto;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            "
          >
            <div
              style="
                padding: 28px;
                background: #123524;
                color: #ffffff;
                text-align: center;
              "
            >
              <h1 style="margin: 0; font-size: 26px;">
                Sahaba Quest
              </h1>

              <p style="margin: 8px 0 0; opacity: 0.9;">
                Subscription Notification Test
              </p>
            </div>

            <div style="padding: 32px;">
              <h2 style="color: #123524; margin-top: 0;">
                Email System Test Successful
              </h2>

              <p style="color: #444; line-height: 1.7;">
                Assalamu Alaikum,
              </p>

              <p style="color: #444; line-height: 1.7;">
                This is a test email from the Sahaba Quest
                subscription notification system.
              </p>

              <div
                style="
                  margin: 24px 0;
                  padding: 18px;
                  background: #f1f7f3;
                  border-left: 4px solid #123524;
                  border-radius: 6px;
                "
              >
                <p style="margin: 0 0 8px; color: #555;">
                  <strong>Sample expiry date:</strong>
                  ${formattedExpiryDate}
                </p>

                <p style="margin: 0; color: #555;">
                  <strong>Notification type:</strong>
                  7-day reminder
                </p>
              </div>

              <p style="color: #444; line-height: 1.7;">
                If you received this email, the Resend integration
                is working correctly.
              </p>

              <p style="color: #444; line-height: 1.7;">
                Jazakallahu Khayran.
              </p>
            </div>

            <div
              style="
                padding: 20px;
                background: #f5f7f5;
                text-align: center;
                color: #777;
                font-size: 13px;
              "
            >
              Sahaba Quest<br />
              Islamic Learning Through Knowledge &amp; Play
            </div>
          </div>
        </body>
      </html>
    `,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Test subscription email sent successfully.",
    recipient: testEmail,
    resend_id: result.id,
  });
}