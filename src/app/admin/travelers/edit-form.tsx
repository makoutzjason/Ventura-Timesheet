"use client";

import { useActionState } from "react";
import { updateTravelerAction } from "./actions";

export type TravelerEditValues = {
  fullName: string;
  facilityId: string;
  employeeId: string;
  discipline: string;
  recruiterName: string;
  active: boolean;
};

export function EditTravelerForm({
  travelerId,
  facilities,
  initialValues,
}: {
  travelerId: string;
  facilities: { id: string; name: string }[];
  initialValues: TravelerEditValues;
}) {
  const boundAction = updateTravelerAction.bind(null, travelerId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {state?.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}

      <label className="block text-sm font-medium text-zinc-700">
        Full name
        <input
          type="text"
          name="fullName"
          required
          defaultValue={initialValues.fullName}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Facility
        <select
          name="facilityId"
          required
          defaultValue={initialValues.facilityId}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          <option value="">Select a facility…</option>
          {facilities.map((facility) => (
            <option key={facility.id} value={facility.id}>
              {facility.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Employee ID
        <input
          type="text"
          name="employeeId"
          defaultValue={initialValues.employeeId}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Discipline
        <input
          type="text"
          name="discipline"
          defaultValue={initialValues.discipline}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Recruiter name
        <input
          type="text"
          name="recruiterName"
          defaultValue={initialValues.recruiterName}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input type="checkbox" name="active" value="true" defaultChecked={initialValues.active} />
        Active
      </label>
      <p className="-mt-2 text-xs text-zinc-500">
        Deactivating blocks them from signing in to submit or view timesheets — it doesn&apos;t
        delete their account or history.
      </p>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Save changes
      </button>
    </form>
  );
}
