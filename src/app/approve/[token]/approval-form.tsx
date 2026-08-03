"use client";

import { useActionState, useState } from "react";
import { actOnApprovalTokenAction } from "./actions";

export function ApprovalForm({ token }: { token: string }) {
  const [showFlagField, setShowFlagField] = useState(false);
  const boundAction = actOnApprovalTokenAction.bind(null, token);
  const [state, formAction, pending] = useActionState(boundAction, null);

  if (state && "success" in state) {
    return (
      <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
        {state.action === "approved"
          ? "Approved — thank you. This has been routed to payroll."
          : "Flagged. The traveler has been notified to correct and resubmit."}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      {state?.error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}

      <label className="block text-sm font-medium text-zinc-700">
        Your name
        <input
          type="text"
          name="managerName"
          required
          placeholder="For the signed timesheet record"
          className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
        />
      </label>

      {!showFlagField ? (
        <div className="flex gap-2">
          <button
            type="submit"
            name="intent"
            value="approve"
            disabled={pending}
            className="flex-1 rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => setShowFlagField(true)}
            className="flex-1 rounded-md border border-zinc-300 py-2.5 text-sm font-medium text-zinc-900"
          >
            Flag for correction
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-700">
            What needs to be corrected?
            <textarea
              name="flagReason"
              required
              rows={3}
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowFlagField(false)}
              className="flex-1 rounded-md border border-zinc-300 py-2.5 text-sm font-medium text-zinc-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              name="intent"
              value="flag"
              disabled={pending}
              className="flex-1 rounded-md bg-amber-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Submit flag
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
