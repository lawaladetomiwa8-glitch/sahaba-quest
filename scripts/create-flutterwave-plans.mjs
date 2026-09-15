import fs from "fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile() {
  const envPath = ".env.local";

  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local was not found.");
  }

  const content = fs.readFileSync(envPath, "utf8");

  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed
      .slice(0, equalsIndex)
      .trim();

    const value = trimmed
      .slice(equalsIndex + 1)
      .trim();

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const flutterwaveSecretKey =
  process.env.FLUTTERWAVE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL is missing."
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY is missing."
  );
}

if (!flutterwaveSecretKey) {
  throw new Error(
    "FLUTTERWAVE_SECRET_KEY is missing."
  );
}

const supabase = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

function getFlutterwaveAmount(
  amount,
  currency
) {
  if (
    currency === "USD" ||
    currency === "GBP" ||
    currency === "EUR"
  ) {
    return Number(amount) / 100;
  }

  return Number(amount);
}

function getFlutterwaveInterval(
  billingInterval
) {
  if (billingInterval === "monthly") {
    return "monthly";
  }

  if (billingInterval === "annual") {
    return "yearly";
  }

  throw new Error(
    `Unsupported billing interval: ${billingInterval}`
  );
}

async function createFlutterwavePlan(plan) {
  const amount = getFlutterwaveAmount(
    plan.amount,
    plan.currency
  );

  const interval =
    getFlutterwaveInterval(
      plan.billing_interval
    );

  const planName =
    `Sahaba Quest ${plan.display_name} ${plan.billing_interval} ${plan.currency}`;

  console.log("");
  console.log(
    `Creating: ${planName}`
  );

  console.log(
    `Amount: ${amount} ${plan.currency}`
  );

  console.log(
    `Interval: ${interval}`
  );

  const response = await fetch(
    "https://api.flutterwave.com/v3/payment-plans",
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${flutterwaveSecretKey}`,

        "Content-Type":
          "application/json",
      },

      body: JSON.stringify({
        amount,
        name: planName,
        interval,
        currency: plan.currency,
      }),
    }
  );

  const result =
    await response.json();

  if (
    !response.ok ||
    result.status !== "success"
  ) {
    console.error(
      "Flutterwave response:",
      result
    );

    throw new Error(
      result.message ||
        `Could not create Flutterwave plan for ${planName}.`
    );
  }

  const flutterwavePlanId =
    result.data?.id;

  if (!flutterwavePlanId) {
    throw new Error(
      `Flutterwave did not return a plan ID for ${planName}.`
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from("subscription_plans")
    .update({
      flutterwave_plan_id:
        Number(flutterwavePlanId),
    })
    .eq("id", plan.id);

  if (updateError) {
    throw new Error(
      `Flutterwave plan was created but Supabase could not be updated: ${updateError.message}`
    );
  }

  console.log(
    `Created Flutterwave plan ID: ${flutterwavePlanId}`
  );

  console.log(
    `Saved to Supabase.`
  );
}

async function main() {
  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    " Sahaba Quest Flutterwave Plan Setup"
  );
  console.log(
    "=========================================="
  );
  console.log("");

  const {
    data: plans,
    error,
  } = await supabase
    .from("subscription_plans")
    .select(
      `
      id,
      plan_type,
      billing_interval,
      currency,
      amount,
      display_name,
      flutterwave_plan_id
      `
    )
    .eq("is_active", true)
    .order("plan_type")
    .order("billing_interval")
    .order("currency");

  if (error) {
    throw new Error(
      `Could not load subscription plans: ${error.message}`
    );
  }

  if (!plans || plans.length === 0) {
    throw new Error(
      "No active subscription plans were found."
    );
  }

  console.log(
    `Found ${plans.length} active subscription plans.`
  );

  for (const plan of plans) {
    if (plan.flutterwave_plan_id) {
      console.log("");
      console.log(
        `Skipping ${plan.display_name} ${plan.billing_interval} ${plan.currency}`
      );

      console.log(
        `Already connected to Flutterwave plan ${plan.flutterwave_plan_id}.`
      );

      continue;
    }

    try {
      await createFlutterwavePlan(
        plan
      );
    } catch (error) {
      console.error("");
      console.error(
        `Failed to create plan for ${plan.display_name} ${plan.billing_interval} ${plan.currency}`
      );

      console.error(
        error instanceof Error
          ? error.message
          : error
      );

      console.error("");
      console.error(
        "Stopping so we can inspect the problem before continuing."
      );

      process.exit(1);
    }
  }

  console.log("");
  console.log(
    "=========================================="
  );
  console.log(
    " Flutterwave plan setup completed."
  );
  console.log(
    "=========================================="
  );
  console.log("");
}

main().catch((error) => {
  console.error("");
  console.error(
    "Setup failed:"
  );

  console.error(
    error instanceof Error
      ? error.message
      : error
  );

  process.exit(1);
});