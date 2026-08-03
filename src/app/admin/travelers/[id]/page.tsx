import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditTravelerForm } from "../edit-form";

export default async function EditTravelerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: traveler } = await supabase
    .from("travelers")
    .select("id, facility_id, employee_id, discipline, recruiter_name, active, profiles(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!traveler) notFound();

  const { data: facilities } = await supabase.from("facilities").select("id, name").order("name", { ascending: true });

  const profile = traveler.profiles as unknown as { full_name: string } | null;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">{profile?.full_name ?? "Traveler"}</h1>
      <EditTravelerForm
        travelerId={traveler.id}
        facilities={facilities ?? []}
        initialValues={{
          fullName: profile?.full_name ?? "",
          facilityId: traveler.facility_id ?? "",
          employeeId: traveler.employee_id ?? "",
          discipline: traveler.discipline ?? "",
          recruiterName: traveler.recruiter_name ?? "",
          active: traveler.active,
        }}
      />
    </div>
  );
}
