import "server-only";

type SendEmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
};

type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | string[];
  attachments?: SendEmailAttachment[];
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
  text,
  replyTo,
  attachments,
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
    const payload: Record<string, unknown> = {
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };

    if (text) {
      payload.text = text;
    }

    if (replyTo) {
      payload.reply_to = replyTo;
    }

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments.map(
        (attachment) => ({
          filename: attachment.filename,
          content: attachment.content,
          ...(attachment.contentType
            ? {
                content_type:
                  attachment.contentType,
              }
            : {}),
        })
      );
    }

    const response = await fetch(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      }
    );

    let data: any;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

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