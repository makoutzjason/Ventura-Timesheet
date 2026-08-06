import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { parseDateOnly, formatWeekLabel } from "@/lib/dates";
import { STATUS_LABELS } from "@/lib/timesheets";
import { TimesheetSummary } from "@/components/timesheet-summary";
import { AdminPhotoReview } from "./admin-photo-review";
import { PhotoGallery } from "./photo-gallery";

export default async function TimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS already scopes this to the signed-in traveler's own rows (or an
  // admin) — a stranger's id here just comes back empty, not someone else's data.
  const { data: timesheet, error: timesheetError } = await supabase
    .from("timesheets")
    .select(
      "id, week_start_date, week_end_date, status, flag_reason, guaranteed_hours, guaranteed_hours_reason, guaranteed_hours_note, facilities(name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (timesheetError) {
    console.error("[timesheets/[id]] query error:", timesheetError);
  }

  if (!timesheet) notFound();

  const { data: entries } = await supabase
    .from("timesheet_entries")
    .select(
      "work_date, time_in, time_out, lunch_out, lunch_in, no_lunch, short_hours_reason, notes, on_call_time_in, on_call_time_out, call_back_time_in, call_back_time_out, call_back_reason, mileage",
    )
    .eq("timesheet_id", id)
    .order("work_date", { ascending: true });

  const facility = timesheet.facilities as unknown as { name: string } | null;

  // Fetched for any bypass-facility submission regardless of status — not
  // just while status is "photo_submitted" — so an admin can still pull up
  // the photo on an already-approved or -flagged timesheet, not only in the
  // narrow window before they've acted on it.
  let photoReviewUrls: string[] | null = null;
  {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle()
      : { data: null };

    if (profile?.role === "admin") {
      const { data: photoRows } = await supabase
        .from("timesheet_photos")
        .select("storage_path")
        .eq("timesheet_id", id);

      if (photoRows?.length) {
        const urls = await Promise.all(
          photoRows.map(async (row) => {
            const { data } = await supabase.storage.from("timesheet-photos").createSignedUrl(row.storage_path, 3600);
            return data?.signedUrl ?? null;
          }),
        );
        photoReviewUrls = urls.filter((url): url is string => Boolean(url));
      }
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900">
          {formatWeekLabel(parseDateOnly(timesheet.week_start_date), parseDateOnly(timesheet.week_end_date))}
        </h1>
        <p className="text-sm text-zinc-600">{facility?.name}</p>
        <p className="mt-1 text-sm font-medium text-zinc-900">
          {STATUS_LABELS[timesheet.status] ?? timesheet.status}
        </p>
        {(timesheet.status === "approved" || timesheet.status === "paid") && (
          <Link
            href={`/api/pdf/${timesheet.id}`}
            target="_blank"
            className="mt-2 inline-block text-sm font-medium text-zinc-900 underline"
          >
            Download PDF
          </Link>
        )}
      </div>

      <TimesheetSummary
        entries={entries ?? []}
        guaranteedHours={timesheet.guaranteed_hours}
        guaranteedHoursReason={timesheet.guaranteed_hours_reason}
        guaranteedHoursNote={timesheet.guaranteed_hours_note}
      />

      {photoReviewUrls && photoReviewUrls.length > 0 && (
        timesheet.status === "photo_submitted" ? (
          <AdminPhotoReview timesheetId={id} photoUrls={photoReviewUrls} />
        ) : (
          <PhotoGallery photoUrls={photoReviewUrls} title="Uploaded photo" />
        )
      )}
    </div>
  );
}
