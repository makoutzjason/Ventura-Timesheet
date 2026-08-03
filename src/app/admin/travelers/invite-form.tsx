"use client";

import { useActionState } from "react";
import { inviteTravelerAction } from "./actions";

export function InviteTravelerForm({ facilities }: { facilities: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(inviteTravelerAction, null);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      {state?.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}

      <label className="block text-sm font-medium text-zinc-700">
        Email
        <input type="email" name="email" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
        <span className="mt-1 block text-xs text-zinc-500">
          Sends an invite email (via Supabase) so they can set their own password.
        </span>
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Full name
        <input type="text" name="fullName" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Facility
        <select name="facilityId" required className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
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
        <input type="text" name="employeeId" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Discipline
        <input type="text" name="discipline" placeholder="e.g. RN" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>

      <label className="block text-sm font-medium text-zinc-700">
        Recruiter name
        <input type="text" name="recruiterName" className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm" />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Inviting…" : "Send invite"}
      </button>
    </form>
  );
}
