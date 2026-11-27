import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";

const AUTOMATION_KEY = "welcome_activation_v1";
const BATCH_SIZE = 50;
const MAX_ATTEMPTS = 5;

type AutomationStep =
  | "welcome"
  | "activation_24h"
  | "reengagement_72h";

type AuthUser = {
  id: string;
  email?: string;
  created_at: string;
  user_metadata?: Record<string, unknown>;
};

type ClaimedEmail = {
  id: string;
  user_id: string;
  automation_key: string;
  step_key: AutomationStep;
  scheduled_at: string;
  attempts: number;
};

type AutomationLog = {
  step_key: AutomationStep;
  status: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getDisplayName(user: AuthUser): string {
  const name = user.user_metadata?.display_name;

  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }

  return "there";
}

function buildEmail(step: AutomationStep, displayName: string) {
  const safeName = escapeHtml(displayName);

  const dashboardUrl =
    `${process.env.NEXT_PUBLIC_APP_URL || "https://www.sahabaquest.com.ng"}/dashboard`;

  const content = {
    welcome: {
      subject: "Welcome to Sahaba Quest — your journey begins!",
      title: "Welcome to Sahaba Quest!",
      message:
        "We're delighted to have you join us. Sahaba Quest is a place to explore the remarkable lives, sacrifices, wisdom and legacy of the Companions of the Prophet ﷺ through interactive learning.",
      button: "Begin Your Journey",
    },
    activation_24h: {
      subject: "Your Sahaba Quest journey is waiting",
      title: "Your journey is waiting!",
      message:
        "You created your Sahaba Quest account, but you haven't started your first quiz yet. Take a few minutes to discover something inspiring about the Sahaba and begin earning XP as you learn.",
      button: "Start Learning",
    },
    reengagement_72h: {
      subject: "There's more to discover on Sahaba Quest",
      title: "Come back and continue discovering",
      message:
        "Every companion's story carries lessons of faith, courage, sacrifice and character. Your learning journey is still waiting for you. Come back and take your first quiz!",
      button: "Continue My Journey",
    },
  }[step];

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(content.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <div style="max-width:620px;margin:30px auto;background:#ffffff;border-radius:14px;overflow:hidden;">
    <div style="padding:30px 24px;text-align:center;background:#0f766e;color:#ffffff;">
      <h1 style="margin:0;font-size:28px;">Sahaba Quest</h1>
      <p style="margin:8px 0 0;font-size:14px;">Learn. Play. Remember.</p>
    </div>

    <div style="padding:32px;">
      <h2 style="margin-top:0;">Assalamu Alaikum ${safeName},</h2>

      <h3 style="font-size:22px;">${escapeHtml(content.title)}</h3>

      <p style="font-size:16px;line-height:1.8;">
        ${escapeHtml(content.message)}
      </p>

      <div style="text-align:center;margin:30px 0;">
        <a href="${dashboardUrl}"
          style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:14px 26px;border-radius:8px;font-weight:bold;">
          ${escapeHtml(content.button)}
        </a>
      </div>

      <p style="font-size:14px;line-height:1.7;color:#6b7280;">
        May your learning increase your love, understanding and appreciation
        of the companions of the Messenger of Allah ﷺ.
      </p>
    </div>

    <div style="padding:20px;border-top:1px solid #e5e7eb;text-align:center;font-size:12px;color:#9ca3af;">
      © ${new Date().getFullYear()} Sahaba Quest. All rights reserved.
    </div>
  </div>
</body>
</html>`;

  const text = `${content.title}

Assalamu Alaikum ${displayName},

${content.message}

${content.button}: ${dashboardUrl}

Sahaba Quest — Learn. Play. Remember.`;

  return {
    subject: content.subject,
    html,
    text,
  };
}

function getStepSchedule(createdAt: string) {
  const signupTime = new Date(createdAt);

  return {
    welcome: signupTime,
    activation_24h: new Date(
      signupTime.getTime() + 24 * 60 * 60 * 1000
    ),
    reengagement_72h: new Date(
      signupTime.getTime() + 72 * 60 * 60 * 1000
    ),
  };
}

async function enrollUser(user: AuthUser) {
  const schedule = getStepSchedule(user.created_at);

  const rows = [
    {
      user_id: user.id,
      automation_key: AUTOMATION_KEY,
      step_key: "welcome",
      scheduled_at: schedule.welcome.toISOString(),
    },
    {
      user_id: user.id,
      automation_key: AUTOMATION_KEY,
      step_key: "activation_24h",
      scheduled_at: schedule.activation_24h.toISOString(),
    },
    {
      user_id: user.id,
      automation_key: AUTOMATION_KEY,
      step_key: "reengagement_72h",
      scheduled_at: schedule.reengagement_72h.toISOString(),
    },
  ];

  const { error } = await supabaseServer
    .from("email_automation_logs")
    .upsert(rows, {
      onConflict: "user_id,automation_key,step_key",
      ignoreDuplicates: true,
    });

  if (error) throw error;
}

async function getAllNewUsers(cutoff: Date): Promise<AuthUser[]> {
  const collected: AuthUser[] = [];
  const perPage = 1000;
  const maxPages = 100;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } =
      await supabaseServer.auth.admin.listUsers({
        page,
        perPage,
      });

    if (error) throw error;

    const users = (data.users || []) as AuthUser[];

    for (const user of users) {
      if (new Date(user.created_at) >= cutoff) {
        collected.push(user);
      }
    }

    if (users.length < perPage) {
      return collected;
    }
  }

  throw new Error(
    "User pagination safety limit reached. Enrollment aborted."
  );
}

async function hasGenuineActivity(userId: string): Promise<boolean> {
  const { data, error } = await supabaseServer
    .from("question_attempts")
    .select("id")
    .eq("user_id", userId)
    .not("selected_answer", "is", null)
    .limit(1);

  if (error) throw error;

  return (data?.length || 0) > 0;
}

async function getAutomationStatuses(
  userId: string
): Promise<Record<AutomationStep, string>> {
  const { data, error } = await supabaseServer
    .from("email_automation_logs")
    .select("step_key,status")
    .eq("user_id", userId)
    .eq("automation_key", AUTOMATION_KEY);

  if (error) throw error;

  const statuses: Record<AutomationStep, string> = {
    welcome: "missing",
    activation_24h: "missing",
    reengagement_72h: "missing",
  };

  for (const row of (data || []) as AutomationLog[]) {
    statuses[row.step_key] = row.status;
  }

  return statuses;
}

async function updateLog(
  id: string,
  values: Record<string, unknown>
) {
  const { error } = await supabaseServer
    .from("email_automation_logs")
    .update({
      ...values,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

async function releaseForLater(id: string) {
  await updateLog(id, {
    status: "pending",
    claimed_at: null,
  });
}

async function markSkipped(id: string, reason: string) {
  await updateLog(id, {
    status: "skipped",
    claimed_at: null,
    last_error: reason,
  });
}

async function markFailure(
  item: ClaimedEmail,
  error: string
) {
  const attempts = item.attempts + 1;

  await updateLog(item.id, {
    attempts,
    status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
    claimed_at: null,
    last_error: error.slice(0, 2000),
  });
}

async function cancelRemainingActivationEmails(userId: string) {
  const { error } = await supabaseServer
    .from("email_automation_logs")
    .update({
      status: "skipped",
      claimed_at: null,
      last_error:
        "Cancelled because the user submitted a quiz answer.",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("automation_key", AUTOMATION_KEY)
    .in("step_key", ["activation_24h", "reengagement_72h"])
    .in("status", ["pending", "processing"]);

  if (error) throw error;
}

async function processClaimedEmail(item: ClaimedEmail) {
  const { data, error } =
    await supabaseServer.auth.admin.getUserById(item.user_id);

  if (error || !data.user?.email) {
    await markFailure(
      item,
      error?.message || "User has no email address."
    );
    return "failed";
  }

  const user = data.user as AuthUser;

  // Genuine activity stops the entire activation sequence.
  if (
    item.step_key === "activation_24h" ||
    item.step_key === "reengagement_72h"
  ) {
    const active = await hasGenuineActivity(item.user_id);

    if (active) {
      await cancelRemainingActivationEmails(item.user_id);
      return "skipped";
    }
  }

  // Enforce the sequence.
  const statuses = await getAutomationStatuses(item.user_id);

  if (
    item.step_key === "activation_24h" &&
    statuses.welcome !== "sent"
  ) {
    await releaseForLater(item.id);
    return "deferred";
  }

  if (
    item.step_key === "reengagement_72h" &&
    statuses.activation_24h !== "sent"
  ) {
    await releaseForLater(item.id);
    return "deferred";
  }

  const email = buildEmail(
    item.step_key,
    getDisplayName(user)
  );

  const result = await sendEmail({
    to: user.email!,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });

  if (!result.success) {
    await markFailure(
      item,
      result.error || "Email sending failed."
    );
    return "failed";
  }

  await updateLog(item.id, {
    status: "sent",
    sent_at: new Date().toISOString(),
    resend_id: result.id || null,
    attempts: item.attempts + 1,
    claimed_at: null,
    last_error: null,
  });

  return "sent";
}

export async function GET(request: NextRequest) {
  try {
    // 1. Secure cron authentication.
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return NextResponse.json(
        { error: "Cron authentication is not configured." },
        { status: 500 }
      );
    }

    if (
      request.headers.get("authorization") !==
      `Bearer ${cronSecret}`
    ) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }

    // 2. Require an explicit enrollment cutoff.
    const cutoffValue = process.env.WELCOME_AUTOMATION_START_AT;

    if (!cutoffValue) {
      return NextResponse.json(
        {
          error:
            "WELCOME_AUTOMATION_START_AT is not configured.",
        },
        { status: 500 }
      );
    }

    const cutoff = new Date(cutoffValue);

    if (Number.isNaN(cutoff.getTime())) {
      return NextResponse.json(
        {
          error:
            "WELCOME_AUTOMATION_START_AT is not a valid date.",
        },
        { status: 500 }
      );
    }

    const dryRun =
      request.nextUrl.searchParams.get("dry_run") === "1";

    const now = new Date();

    // 3. Discover users after cutoff and enroll idempotently.
    const newUsers = await getAllNewUsers(cutoff);

    for (const user of newUsers) {
      await enrollUser(user);
    }

    // 4. Dry-run never claims or sends.
    if (dryRun) {
      const { count, error } = await supabaseServer
        .from("email_automation_logs")
        .select("*", { count: "exact", head: true })
        .eq("automation_key", AUTOMATION_KEY)
        .eq("status", "pending")
        .lte("scheduled_at", now.toISOString());

      if (error) throw error;

      return NextResponse.json({
        success: true,
        dry_run: true,
        users_found_after_cutoff: newUsers.length,
        pending_due_steps: count || 0,
        checked_at: now.toISOString(),
        message:
          "Dry run completed. No emails were claimed or sent.",
      });
    }

    // 5. Atomically claim due rows.
    const { data: claimed, error: claimError } =
      await supabaseServer.rpc(
        "claim_due_email_automations",
        { p_batch_size: BATCH_SIZE }
      );

    if (claimError) throw claimError;

    const batch = (claimed || []) as ClaimedEmail[];

    // 6. Process no more than one email step per user per run.
    const processedUsers = new Set<string>();

    const results = {
      sent: 0,
      skipped: 0,
      deferred: 0,
      failed: 0,
    };

    for (const item of batch) {
      if (processedUsers.has(item.user_id)) {
        await releaseForLater(item.id);
        results.deferred++;
        continue;
      }

      processedUsers.add(item.user_id);

      try {
        const result = await processClaimedEmail(item);

        if (result in results) {
          results[result as keyof typeof results]++;
        }
      } catch (error) {
        console.error(
          "Welcome automation step failed:",
          item.id,
          error
        );

        await markFailure(
          item,
          error instanceof Error
            ? error.message
            : "Unknown processing error."
        );

        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      dry_run: false,
      users_found_after_cutoff: newUsers.length,
      claimed: batch.length,
      results,
      checked_at: now.toISOString(),
    });
  } catch (error) {
    console.error("Welcome activation cron error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Welcome activation job failed.",
      },
      { status: 500 }
    );
  }
}