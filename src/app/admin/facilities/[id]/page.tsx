import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FacilityForm } from "../facility-form";

export default async function EditFacilityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: facility } = await supabase
    .from("facilities")
    .select("id, name, address, manager_name, manager_email, week_start_day, time_zone, skip_manager_approval, active")
    .eq("id", id)
    .maybeSingle();

  if (!facility) notFound();

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">{facility.name}</h1>
      <FacilityForm
        facilityId={facility.id}
        initialValues={{
          name: facility.name,
          address: facility.address ?? "",
          managerName: facility.manager_name ?? "",
          managerEmail: facility.manager_email,
          weekStartDay: facility.week_start_day,
          timeZone: facility.time_zone,
          skipManagerApproval: facility.skip_manager_approval,
          active: facility.active,
        }}
      />
    </div>
  );
}
