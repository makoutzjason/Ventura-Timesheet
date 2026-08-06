"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionState = { error: string } | null;

// Creating a traveler means creating a real Supabase Auth account, which
// only the service-role client can do — that's a privileged operation with
// no RLS boundary of its own, so this action re-checks the caller is an
// admin itself rather than trusting that only the (already-guarded) admin
// panel UI ever calls it.
export async function inviteTravelerAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const facilityId = String(formData.get("facilityId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const discipline = String(formData.get("discipline") ?? "").trim();
  const recruiterName = String(formData.get("recruiterName") ?? "").trim();
  const guaranteedHoursRaw = String(formData.get("guaranteedHours") ?? "").trim();
  const guaranteedHours = guaranteedHoursRaw ? Number(guaranteedHoursRaw) : null;

  if (!email) return { error: "Email is required." };
  if (!fullName) return { error: "Full name is required." };
  if (!facilityId) return { error: "Select a facility." };
  if (guaranteedHours !== null && (Number.isNaN(guaranteedHours) || guaranteedHours < 0)) {
    return { error: "Guaranteed hours must be a positive number." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin") return { error: "Not authorized." };

  const admin = createAdminClient();
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/set-password`,
  });

  if (inviteError || !invited.user) {
    return { error: inviteError?.message ?? "Could not invite traveler." };
  }

  // The profiles row already exists (handle_new_user trigger fired on
  // insert into auth.users) — travelers has no such trigger since not every
  // profile is a traveler, so this row has to be created explicitly.
  const { error: travelerError } = await admin.from("travelers").insert({
    id: invited.user.id,
    facility_id: facilityId,
    employee_id: employeeId || null,
    discipline: discipline || null,
    recruiter_name: recruiterName || null,
    guaranteed_hours: guaranteedHours,
  });

  if (travelerError) {
    return { error: `Invited, but failed to set up the traveler record: ${travelerError.message}` };
  }

  revalidatePath("/admin/travelers");
  redirect("/admin/travelers");
}

// Editing doesn't touch auth at all, so this can use the regular RLS-scoped
// client — travelers_admin_write and profiles_update_own_or_admin already
// restrict this to admins at the database level.
export async function updateTravelerAction(
  travelerId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const facilityId = String(formData.get("facilityId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "").trim();
  const discipline = String(formData.get("discipline") ?? "").trim();
  const recruiterName = String(formData.get("recruiterName") ?? "").trim();
  const active = formData.get("active") === "true";
  const guaranteedHoursRaw = String(formData.get("guaranteedHours") ?? "").trim();
  const guaranteedHours = guaranteedHoursRaw ? Number(guaranteedHoursRaw) : null;

  if (!fullName) return { error: "Full name is required." };
  if (!facilityId) return { error: "Select a facility." };
  if (guaranteedHours !== null && (Number.isNaN(guaranteedHours) || guaranteedHours < 0)) {
    return { error: "Guaranteed hours must be a positive number." };
  }

  const supabase = await createClient();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", travelerId);
  if (profileError) return { error: profileError.message };

  const { error: travelerError } = await supabase
    .from("travelers")
    .update({
      facility_id: facilityId,
      employee_id: employeeId || null,
      discipline: discipline || null,
      recruiter_name: recruiterName || null,
      guaranteed_hours: guaranteedHours,
      active,
    })
    .eq("id", travelerId);
  if (travelerError) return { error: travelerError.message };

  revalidatePath("/admin/travelers");
  redirect("/admin/travelers");
}
