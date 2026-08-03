"use client";

import { useActionState, useState } from "react";
import { reviewPhotoSubmissionAction } from "./admin-review-actions";
import { PhotoGallery } from "./photo-gallery";

export function AdminPhotoReview({ timesheetId, photoUrls }: { timesheetId: string; photoUrls: string[] }) {
  const [showFlagField, setShowFlagField] = useState(false);
  const boundAction = reviewPhotoSubmissionAction.bind(null, timesheetId);
  const [state, formAction, pending] = useActionState(boundAction, null);

  if (state && "success" in state) {
    return (
      <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
        {state.action === "approved" ? "Approved — routed to payroll." : "Flagged — the traveler has been notified."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <PhotoGallery photoUrls={photoUrls} title="Photo review" />

      <form action={formAction} className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
        {state?.error && <p className="rounded-md bg-red-50 p-2 text-sm text-red-700">{state.error}</p>}

        {!showFlagField ? (
          <div className="flex gap-2">
            <button
              type="submit"
              name="intent"
              value="approve"
              disabled={pending}
              className="flex-1 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setShowFlagField(true)}
              className="flex-1 rounded-md border border-zinc-300 py-2 text-sm font-medium text-zinc-900"
            >
              Flag for correction
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              name="flagReason"
              required
              rows={3}
              placeholder="What needs to be corrected?"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowFlagField(false)}
                className="flex-1 rounded-md border border-zinc-300 py-2 text-sm font-medium text-zinc-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                name="intent"
                value="flag"
                disabled={pending}
                className="flex-1 rounded-md bg-amber-600 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                Submit flag
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
