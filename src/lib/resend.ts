import "server-only";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
};

type SendEmailResult = {
  success: boolean;
  id?: string;
  error?: string;
};

export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey) {
    console.error(
      "RESEND_API_KEY is missing from environment variables."
    );

    return {
      success: false,
      error: "Resend API key is not configured.",
    };
  }

  if (!fromEmail) {
    console.error(
      "RESEND_FROM_EMAIL is missing from environment variables."
    );

    return {
      success: false,
      error: "Resend sender email is not configured.",
    };
  }

  try {
    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(
        "Resend email error:",
        data
      );

      return {
        success: false,
        error:
          data?.message ||
          data?.error ||
          "Resend failed to send the email.",
      };
    }

    return {
      success: true,
      id: data?.id,
    };
  } catch (error) {
    console.error(
      "Resend request failed:",
      error
    );

    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unknown email error.",
    };
  }
}