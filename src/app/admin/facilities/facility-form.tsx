"use client";

import { useActionState } from "react";
import { saveFacilityAction } from "./actions";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Pulled from the runtime's own IANA tzdata rather than a hardcoded array —
// this is every zone the runtime knows about, so it covers any US zone (or
// any zone at all) without us maintaining a list that'll go stale.
const TIME_ZONES = Intl.supportedValuesOf("timeZone");

export type FacilityFormValues = {
  name: string;
  address: string;
  managerName: string;
  managerEmail: string;
  weekStartDay: number;
  timeZone: string;
  skipManagerApproval: boolean;
  active: boolean;
};

export function FacilityForm({
  facilityId,
  initialValues,
}: {
  facilityId: string | null;
  initialValues: FacilityFormValues;
}) {
  const boundAction = saveFacilityAction.bind(null, facilityId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {state?.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}

      <label className="block text-sm font-medium text-zinc-700">
        Facility name
        <input
          type="text"
          name="name"
          required
          defaultValue={initialValues.name}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Address
        <input
          type="text"
          name="address"
          defaultValue={initialValues.address}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Manager name
        <input
          type="text"
          name="managerName"
          defaultValue={initialValues.managerName}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Manager email
        <input
          type="email"
          name="managerEmail"
          required
          defaultValue={initialValues.managerEmail}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-xs text-zinc-500">
          Where the approval-request email goes for each submitted timesheet.
        </span>
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Week starts on
        <select
          name="weekStartDay"
          defaultValue={initialValues.weekStartDay}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {WEEKDAYS.map((label, value) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Time zone
        <select
          name="timeZone"
          required
          defaultValue={initialValues.timeZone}
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        >
          {TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-zinc-500">
          The facility&apos;s physical location, not the traveler&apos;s home address — this is
          what determines their local time for week boundaries and reminders.
        </span>
      </label>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input type="checkbox" name="skipManagerApproval" value="true" defaultChecked={initialValues.skipManagerApproval} />
        Skip manager email approval (photo-upload bypass)
      </label>
      <p className="-mt-2 text-xs text-zinc-500">
        When on, travelers upload a photo of their signed/clock-in record instead of a manager
        email going out — you review and approve it directly in the admin panel.
      </p>

      <label className="flex items-center gap-2 text-sm font-medium text-zinc-700">
        <input type="checkbox" name="active" value="true" defaultChecked={initialValues.active} />
        Active
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {facilityId ? "Save changes" : "Create facility"}
      </button>
    </form>
  );
}
