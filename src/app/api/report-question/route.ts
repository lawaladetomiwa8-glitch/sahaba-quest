import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

function clean(value: FormDataEntryValue | null, maxLength: number) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function textBlock(label: string, value: string) {
  return `<div style="margin:0 0 18px"><div style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#08766d;margin-bottom:5px">${label}</div><div style="font-size:14px;line-height:1.65;color:#294d49;white-space:pre-wrap">${escapeHtml(value || "Not provided")}</div></div>`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();

    // Simple honeypot to reduce accidental/basic bot submissions.
    const website = clean(formData.get("website"), 200);
    if (website) {
      return NextResponse.json({ success: true });
    }

    const name = clean(formData.get("name"), 120);
    const email = clean(formData.get("email"), 200);
    const level = clean(formData.get("level"), 50);
    const questionId = clean(formData.get("questionId"), 200);
    const question = clean(formData.get("question"), 5000);
    const selectedAnswer = clean(formData.get("selectedAnswer"), 1000);
    const systemAnswer = clean(formData.get("systemAnswer"), 1000);
    const explanation = clean(formData.get("explanation"), 5000);

    if (!name || !email || !question || !selectedAnswer || !systemAnswer || !explanation) {
      return NextResponse.json(
        {
          success: false,
          message: "Please complete all required fields before submitting the report.",
        },
        { status: 400 }
      );
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json(
        {
          success: false,
          message: "Please enter a valid email address.",
        },
        { status: 400 }
      );
    }

    const screenshot = formData.get("screenshot");
    let attachment:
      | { filename: string; content: string; content_type: string }
      | undefined;

    if (screenshot instanceof File && screenshot.size > 0) {
      if (!ALLOWED_IMAGE_TYPES.has(screenshot.type)) {
        return NextResponse.json(
          {
            success: false,
            message: "The screenshot must be a PNG, JPG or WebP image.",
          },
          { status: 400 }
        );
      }

      if (screenshot.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json(
          {
            success: false,
            message: "The screenshot is too large. Please keep it under 5 MB.",
          },
          { status: 400 }
        );
      }

      const bytes = await screenshot.arrayBuffer();
      const base64 = Buffer.from(bytes).toString("base64");
      const safeFilename = screenshot.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);

      attachment = {
        filename: safeFilename || "question-screenshot",
        content: base64,
        content_type: screenshot.type,
      };
    }

    const apiKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL;

    if (!apiKey || !fromEmail) {
      console.error("Question report email is not configured: missing RESEND_API_KEY or RESEND_FROM_EMAIL.");
      return NextResponse.json(
        {
          success: false,
          message: "The reporting service is temporarily unavailable. Please try again later.",
        },
        { status: 500 }
      );
    }

    const attachmentBlock = attachment
      ? `<p style="margin:20px 0 0;padding:12px 14px;border-radius:10px;background:#edfafa;color:#17675f;font-size:13px">A screenshot was attached to this report.</p>`
      : `<p style="margin:20px 0 0;padding:12px 14px;border-radius:10px;background:#f5f8f7;color:#5c716e;font-size:13px">No screenshot was attached.</p>`;

    const html = `
      <div style="margin:0;background:#f3f8f7;padding:30px 15px;font-family:Arial,Helvetica,sans-serif;color:#294d49">
        <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #dcebe8;border-radius:18px;overflow:hidden">
          <div style="padding:24px 26px;background:linear-gradient(135deg,#073d3a,#0d6861);color:#ffffff">
            <div style="font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#bff5ed">SAHABA QUEST</div>
            <h1 style="margin:7px 0 0;font-size:24px;line-height:1.2">Question Error Report</h1>
          </div>
          <div style="padding:26px">
            ${textBlock("Player name", name)}
            ${textBlock("Player email", email)}
            ${textBlock("Level", level || "Not provided")}
            ${textBlock("Question ID", questionId || "Not provided")}
            ${textBlock("Question", question)}
            ${textBlock("Answer selected by player", selectedAnswer)}
            ${textBlock("Answer marked correct by system", systemAnswer)}
            ${textBlock("Player's explanation", explanation)}
            ${attachmentBlock}
          </div>
        </div>
      </div>
    `;

    const payload: Record<string, unknown> = {
      from: fromEmail,
      to: ["info@sahabaquest.com.ng"],
      reply_to: email,
      subject: `Sahaba Quest – Question Error Report${level ? ` – Level ${level}` : ""}`,
      html,
    };

    if (attachment) {
      payload.attachments = [attachment];
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text();
      console.error("Resend question report failed:", errorText);

      return NextResponse.json(
        {
          success: false,
          message: "We could not send your report right now. Please try again shortly.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Question report error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong while submitting your report. Please try again.",
      },
      { status: 500 }
    );
  }
}
