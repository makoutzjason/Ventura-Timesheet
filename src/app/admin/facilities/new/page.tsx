import { FacilityForm } from "../facility-form";

export default function NewFacilityPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Add facility</h1>
      <FacilityForm
        facilityId={null}
        initialValues={{
          name: "",
          address: "",
          managerName: "",
          managerEmail: "",
          weekStartDay: 0,
          timeZone: "America/Denver",
          skipManagerApproval: false,
          active: true,
        }}
      />
    </div>
  );
}
