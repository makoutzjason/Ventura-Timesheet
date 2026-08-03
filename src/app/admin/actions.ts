"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendManagerApprovalReminder } from "@/lib/reminders";

type ActionState = { error: string } | { success: true } | null;

// Manual nudge for a timesheet stuck in "awaiting_manager" — from the
// dashboard's pending-approvals table. This just handles the admin-only
// auth check; the actual "mint token, send email, log event" work is
// src/lib/reminders.ts's sendManagerApprovalReminder, shared with the
// automated reminder cron (src/app/api/cron/reminders/route.ts) so there's
// one implementation, not two that can drift.
export async function sendManagerReminderAction(
  timesheetId: string,
  _prevState: ActionState,
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authorized." };

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await sendManagerApprovalReminder(admin, timesheetId, {
    type: "admin",
    id: user.id,
    label: profile.full_name ?? undefined,
  });
  if (error) return { error };

  revalidatePath("/admin");
  return { success: true };
}
