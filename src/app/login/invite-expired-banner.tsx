"use client";

import { useActionState, useState } from "react";
import { resendSetPasswordLinkAction } from "./actions";

// Shown when /set-password redirected here because the invite/recovery link
// that got someone to this page was already used or had expired — see the
// comment in src/app/set-password/page.tsx. Lets them recover on their own
// instead of needing an admin to notice and re-invite them by hand.
export function InviteExpiredBanner() {
  const [state, formAction, pending] = useActionState(resendSetPasswordLinkAction, null);
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
      <p>
        That setup link didn&apos;t work — it may have already been opened once (e.g. on another
        device) or expired. Links like this only work a single time.
      </p>

      {state?.message ? (
        <p className="mt-2 font-medium">{state.message}</p>
      ) : showForm ? (
        <form action={formAction} className="mt-3 flex gap-2">
          <input
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="min-w-0 flex-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="shrink-0 rounded-md bg-amber-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send new link"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="mt-2 font-medium underline underline-offset-2"
        >
          Send me a new link
        </button>
      )}
    </div>
  );
}
