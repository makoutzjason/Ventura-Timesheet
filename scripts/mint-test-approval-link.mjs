// Dev-only utility: mints a real approval_tokens row the same way the app
// does when it emails a facility manager, and prints the raw link — useful
// for testing the /approve/[token] flow before Resend is configured for
// real delivery. Not part of the shipped app; nothing imports this file.
//
// Usage:
//   node scripts/mint-test-approval-link.mjs [timesheetId]
// With no argument, targets the most recently submitted timesheet that's
// still awaiting manager approval.

import { readFileSync } from "node:fs";
import { randomBytes, createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const content = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match) process.env[match[1]] ??= match[2].trim();
  }
}

loadEnvLocal();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

async function main() {
  let timesheetId = process.argv[2];

  if (!timesheetId) {
    const { data, error } = await supabase
      .from("timesheets")
      .select("id, week_start_date")
      .eq("status", "awaiting_manager")
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      console.error(
        "No timesheet with status 'awaiting_manager' found. Submit one from the traveler " +
          "account first, or pass a timesheet id explicitly.",
      );
      process.exit(1);
    }

    timesheetId = data.id;
    console.log(`Using most recent awaiting_manager timesheet (week of ${data.week_start_date}): ${timesheetId}`);
  }

  // Same scheme as src/lib/tokens.ts: random token, only its hash stored.
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from("approval_tokens").insert({
    timesheet_id: timesheetId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) throw insertError;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  console.log(`\nApproval link (valid 7 days, single use):\n${appUrl}/approve/${token}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
