import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { sendEmail } from "@/lib/resend";

export const runtime = "nodejs";

type NotificationType =
  | "7_days"
  | "1_day"
  | "expired";

type SubscriptionRow = {
  id: string;
  user_id: string;
  current_period_end: string | null;
  status: string;
  plan: {
    plan_type: string;
    billing_interval: string;
    display_name: string;
  } | null;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(new Date(dateString));
}

function getPlanName(
  plan: SubscriptionRow["plan"]
): string {
  if (!plan) {
    return "Sahaba Quest Subscription";
  }

  if (plan.plan_type === "plus") {
    return "Individual Plus";
  }

  if (plan.plan_type === "family") {
    return "Family";
  }

  return (
    plan.display_name ||
    "Sahaba Quest Subscription"
  );
}

function buildEmailHtml({
  title,
  message,
  expiryDate,
  buttonText,
}: {
  title: string;
  message: string;
  expiryDate: string;
  buttonText: string;
}) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <title>${escapeHtml(title)}</title>
</head>

<body
  style="
    margin:0;
    padding:0;
    background:#f5f7f9;
    font-family:Arial,Helvetica,sans-serif;
    color:#1f2937;
  "
>
  <div
    style="
      max-width:620px;
      margin:40px auto;
      background:#ffffff;
      border-radius:16px;
      overflow:hidden;
      box-shadow:0 4px 20px rgba(0,0,0,0.06);
    "
  >

    <div
      style="
        padding:30px 32px;
        text-align:center;
        background:#111827;
        color:#ffffff;
      "
    >
      <h1
        style="
          margin:0;
          font-size:28px;
        "
      >
        Sahaba Quest
      </h1>

      <p
        style="
          margin:8px 0 0;
          opacity:0.85;
          font-size:14px;
        "
      >
        Learn. Play. Remember.
      </p>
    </div>

    <div style="padding:32px;">

      <h2
        style="
          margin-top:0;
          font-size:24px;
        "
      >
        ${escapeHtml(title)}
      </h2>

      <p>
        Assalamu Alaikum,
      </p>

      <p style="line-height:1.7;">
        ${escapeHtml(message)}
      </p>

      <div
        style="
          margin:24px 0;
          padding:20px;
          background:#f3f4f6;
          border-radius:12px;
        "
      >
        <strong>
          Subscription expiry
        </strong>

        <div
          style="
            margin-top:8px;
            font-size:16px;
          "
        >
          ${escapeHtml(expiryDate)}
        </div>
      </div>

      <div
        style="
          text-align:center;
          margin:30px 0;
        "
      >
        <a
          href="https://www.sahabaquest.com.ng/dashboard"
          style="
            display:inline-block;
            padding:13px 24px;
            background:#111827;
            color:#ffffff;
            text-decoration:none;
            border-radius:8px;
            font-weight:bold;
          "
        >
          ${escapeHtml(buttonText)}
        </a>
      </div>

      <p
        style="
          font-size:14px;
          line-height:1.6;
          color:#6b7280;
        "
      >
        Thank you for being part of Sahaba Quest.
        Continue your journey of learning about the
        lives, sacrifices and legacy of the Sahabah.
      </p>

    </div>

    <div
      style="
        padding:20px 32px;
        border-top:1px solid #e5e7eb;
        font-size:12px;
        color:#9ca3af;
        text-align:center;
      "
    >
      © ${new Date().getFullYear()} Sahaba Quest.
      All rights reserved.
    </div>

  </div>
</body>
</html>
`;
}

async function sendSubscriptionEmail(
  subscription: SubscriptionRow,
  email: string,
  notificationType: NotificationType
) {
  if (!subscription.current_period_end) {
    return {
      success: false,
      error: "Subscription has no expiry date.",
    };
  }

  const planName = getPlanName(
    subscription.plan
  );

  const expiryDate = formatDate(
    subscription.current_period_end
  );

  let subject: string;
  let title: string;
  let message: string;
  let buttonText = "Open Sahaba Quest";

  if (notificationType === "7_days") {
    subject =
      "Your Sahaba Quest subscription expires in 7 days";

    title =
      "Your subscription expires in 7 days";

    message =
      `Your ${planName} subscription is scheduled to expire in approximately 7 days. Renew before it expires to continue enjoying your premium Sahaba Quest features and content.`;

  } else if (notificationType === "1_day") {
    subject =
      "Your Sahaba Quest subscription expires tomorrow";

    title =
      "Your subscription expires tomorrow";

    message =
      `Your ${planName} subscription is scheduled to expire tomorrow. If you would like to continue using your premium Sahaba Quest features and content, please renew before it expires.`;

  } else {
    subject =
      "Your Sahaba Quest subscription has expired";

    title =
      "Your subscription has expired";

    message =
      `Your ${planName} subscription has expired. Your account has returned to the Free plan. You can renew your subscription at any time to regain access to premium features and content.`;

    buttonText = "Renew Subscription";
  }

  const html = buildEmailHtml({
    title,
    message,
    expiryDate,
    buttonText,
  });

  return sendEmail({
    to: email,
    subject,
    html,
  });
}

async function getUserEmail(
  userId: string
): Promise<string | null> {
  const {
    data,
    error,
  } =
    await supabaseServer.auth.admin.getUserById(
      userId
    );

  if (error) {
    console.error(
      `Could not retrieve email for user ${userId}:`,
      error
    );

    return null;
  }

  return data.user?.email || null;
}

async function alreadySent(
  subscriptionId: string,
  notificationType: NotificationType
): Promise<boolean> {
  const {
    data,
    error,
  } = await supabaseServer
    .from("subscription_email_notifications")
    .select("id")
    .eq(
      "subscription_id",
      subscriptionId
    )
    .eq(
      "notification_type",
      notificationType
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function recordSent(
  subscriptionId: string,
  userId: string,
  notificationType: NotificationType
): Promise<boolean> {
  const {
    error,
  } = await supabaseServer
    .from(
      "subscription_email_notifications"
    )
    .insert({
      subscription_id: subscriptionId,
      user_id: userId,
      notification_type: notificationType,
    });

  if (error) {
    /*
     * Another cron request may have inserted
     * the same notification at almost the
     * same time.
     *
     * The database unique constraint protects us.
     */
    if (error.code === "23505") {
      return false;
    }

    throw error;
  }

  return true;
}

export async function GET(
  request: NextRequest
) {
  try {
    /*
     * ---------------------------------------------------------
     * 1. Protect the endpoint.
     * ---------------------------------------------------------
     */

    const cronSecret =
      process.env.CRON_SECRET;

    if (cronSecret) {
      const authorization =
        request.headers.get(
          "authorization"
        );

      if (
        authorization !==
        `Bearer ${cronSecret}`
      ) {
        return NextResponse.json(
          {
            error: "Unauthorized",
          },
          {
            status: 401,
          }
        );
      }
    }

    /*
     * ---------------------------------------------------------
     * 2. Current time.
     * ---------------------------------------------------------
     */

    const now = new Date();

    const sevenDaysFromNow =
      new Date(
        now.getTime() +
          7 * 24 * 60 * 60 * 1000
      );

    const eightDaysFromNow =
      new Date(
        now.getTime() +
          8 * 24 * 60 * 60 * 1000
      );

    const oneDayFromNow =
      new Date(
        now.getTime() +
          24 * 60 * 60 * 1000
      );

    const twoDaysFromNow =
      new Date(
        now.getTime() +
          2 * 24 * 60 * 60 * 1000
      );

    /*
     * ---------------------------------------------------------
     * 3. Find subscriptions approximately 7 days
     *    from expiry.
     *
     *    We use a 24-hour window because Vercel runs
     *    this job once every hour.
     * ---------------------------------------------------------
     */

    const {
      data: sevenDaySubscriptions,
      error: sevenDayError,
    } =
      await supabaseServer
        .from("subscriptions")
        .select(
          `
          id,
          user_id,
          current_period_end,
          status,
          plan:subscription_plans(
            plan_type,
            billing_interval,
            display_name
          )
        `
        )
        .eq("status", "active")
        .gte(
          "current_period_end",
          sevenDaysFromNow.toISOString()
        )
        .lt(
          "current_period_end",
          eightDaysFromNow.toISOString()
        );

    if (sevenDayError) {
      throw sevenDayError;
    }

    let sevenDaySent = 0;

    for (
      const subscription of
        (sevenDaySubscriptions ||
          []) as unknown as SubscriptionRow[]
    ) {
      if (
        await alreadySent(
          subscription.id,
          "7_days"
        )
      ) {
        continue;
      }

      const email =
        await getUserEmail(
          subscription.user_id
        );

      if (!email) {
        continue;
      }

      const result =
        await sendSubscriptionEmail(
          subscription,
          email,
          "7_days"
        );

      if (!result.success) {
        console.error(
          "7-day subscription email failed:",
          result.error
        );

        continue;
      }

      if (
        await recordSent(
          subscription.id,
          subscription.user_id,
          "7_days"
        )
      ) {
        sevenDaySent++;
      }
    }

    /*
     * ---------------------------------------------------------
     * 4. Find subscriptions approximately 1 day
     *    from expiry.
     * ---------------------------------------------------------
     */

    const {
      data: oneDaySubscriptions,
      error: oneDayError,
    } =
      await supabaseServer
        .from("subscriptions")
        .select(
          `
          id,
          user_id,
          current_period_end,
          status,
          plan:subscription_plans(
            plan_type,
            billing_interval,
            display_name
          )
        `
        )
        .eq("status", "active")
        .gte(
          "current_period_end",
          oneDayFromNow.toISOString()
        )
        .lt(
          "current_period_end",
          twoDaysFromNow.toISOString()
        );

    if (oneDayError) {
      throw oneDayError;
    }

    let oneDaySent = 0;

    for (
      const subscription of
        (oneDaySubscriptions ||
          []) as unknown as SubscriptionRow[]
    ) {
      if (
        await alreadySent(
          subscription.id,
          "1_day"
        )
      ) {
        continue;
      }

      const email =
        await getUserEmail(
          subscription.user_id
        );

      if (!email) {
        continue;
      }

      const result =
        await sendSubscriptionEmail(
          subscription,
          email,
          "1_day"
        );

      if (!result.success) {
        console.error(
          "1-day subscription email failed:",
          result.error
        );

        continue;
      }

      if (
        await recordSent(
          subscription.id,
          subscription.user_id,
          "1_day"
        )
      ) {
        oneDaySent++;
      }
    }

    /*
     * ---------------------------------------------------------
     * 5. Find subscriptions that expired recently.
     *
     *    The separate Supabase cron is responsible for
     *    changing the subscription status to "expired".
     * ---------------------------------------------------------
     */

    const yesterday =
      new Date(
        now.getTime() -
          24 * 60 * 60 * 1000
      );

    const {
      data: expiredSubscriptions,
      error: expiredError,
    } =
      await supabaseServer
        .from("subscriptions")
        .select(
          `
          id,
          user_id,
          current_period_end,
          status,
          plan:subscription_plans(
            plan_type,
            billing_interval,
            display_name
          )
        `
        )
        .eq("status", "expired")
        .gte(
          "current_period_end",
          yesterday.toISOString()
        )
        .lte(
          "current_period_end",
          now.toISOString()
        );

    if (expiredError) {
      throw expiredError;
    }

    let expiredSent = 0;

    for (
      const subscription of
        (expiredSubscriptions ||
          []) as unknown as SubscriptionRow[]
    ) {
      if (
        await alreadySent(
          subscription.id,
          "expired"
        )
      ) {
        continue;
      }

      const email =
        await getUserEmail(
          subscription.user_id
        );

      if (!email) {
        continue;
      }

      const result =
        await sendSubscriptionEmail(
          subscription,
          email,
          "expired"
        );

      if (!result.success) {
        console.error(
          "Expiry email failed:",
          result.error
        );

        continue;
      }

      if (
        await recordSent(
          subscription.id,
          subscription.user_id,
          "expired"
        )
      ) {
        expiredSent++;
      }
    }

    /*
     * ---------------------------------------------------------
     * 6. Return job result.
     * ---------------------------------------------------------
     */

    return NextResponse.json({
      success: true,
      notifications: {
        seven_days: sevenDaySent,
        one_day: oneDaySent,
        expired: expiredSent,
      },
      checked_at:
        now.toISOString(),
    });

  } catch (error) {
    console.error(
      "Subscription notification cron error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Subscription notification job failed.",
      },
      {
        status: 500,
      }
    );
  }
}