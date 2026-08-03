import { createClient } from "@/lib/supabase/server";
import { InviteTravelerForm } from "../invite-form";

export default async function NewTravelerPage() {
  const supabase = await createClient();
  const { data: facilities } = await supabase
    .from("facilities")
    .select("id, name")
    .eq("active", true)
    .order("name", { ascending: true });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Invite traveler</h1>
      <InviteTravelerForm facilities={facilities ?? []} />
    </div>
  );
}
