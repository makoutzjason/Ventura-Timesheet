"use client";

import { useActionState } from "react";
import { sendManagerReminderAction } from "./actions";

// Only ever rendered for rows already filtered to status === "awaiting_manager"
// (see getPendingApprovals) — there's nothing to remind about otherwise, so
// this component doesn't re-check status itself, the caller controls that
// by which rows it renders it into.
export function SendReminderButton({ timesheetId }: { timesheetId: string }) {
  const boundAction = sendManagerReminderAction.bind(null, timesheetId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  if (state && "success" in state) {
    return <span className="text-xs font-medium text-emerald-700">Reminder sent</span>;
  }

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-900 whitespace-nowrap disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send reminder"}
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
