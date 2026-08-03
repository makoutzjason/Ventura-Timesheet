"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type ActionState = { error: string } | null;

export async function saveFacilityAction(
  facilityId: string | null,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const managerName = String(formData.get("managerName") ?? "").trim();
  const managerEmail = String(formData.get("managerEmail") ?? "").trim();
  const weekStartDay = Number(formData.get("weekStartDay") ?? 0);
  const timeZone = String(formData.get("timeZone") ?? "").trim();
  const skipManagerApproval = formData.get("skipManagerApproval") === "true";
  const active = formData.get("active") === "true";

  if (!name) return { error: "Facility name is required." };
  if (!managerEmail) return { error: "Manager email is required." };
  if (!Number.isInteger(weekStartDay) || weekStartDay < 0 || weekStartDay > 6) {
    return { error: "Invalid week start day." };
  }
  // Checked against the runtime's own IANA tzdata rather than a list we'd
  // have to maintain — covers every US zone (plus territories, plus
  // anywhere else) without hardcoding which ones count.
  if (!Intl.supportedValuesOf("timeZone").includes(timeZone)) {
    return { error: "Invalid time zone." };
  }

  // RLS already restricts writes to admins (facilities_admin_write policy) —
  // this action just supplies the same enforcement point for the UI.
  const supabase = await createClient();

  const values = {
    name,
    address: address || null,
    manager_name: managerName || null,
    manager_email: managerEmail,
    week_start_day: weekStartDay,
    time_zone: timeZone,
    skip_manager_approval: skipManagerApproval,
    active,
  };

  if (facilityId) {
    const { error } = await supabase.from("facilities").update(values).eq("id", facilityId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("facilities").insert(values);
    if (error) return { error: error.message };
  }

  revalidatePath("/admin/facilities");
  redirect("/admin/facilities");
}
