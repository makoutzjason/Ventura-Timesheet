import { z } from "zod";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const timeOrEmpty = z.union([z.string().regex(TIME_PATTERN), z.literal("")]);

export const SHORT_HOURS_REASONS = ["cancelled", "volunteered_to_leave", "sick", "personal"] as const;

// Mirrors the paper form's four sections for a single day: Regular Hours
// (with its Lunch-Out/Lunch-In/"NO Lunch"/short-hours-reason/comments),
// On-Call, Call-Back, and Mileage.
export const dayEntrySchema = z
  .object({
    workDate: z.string(),
    timeIn: timeOrEmpty,
    timeOut: timeOrEmpty,
    lunchOut: timeOrEmpty,
    lunchIn: timeOrEmpty,
    noLunch: z.boolean(),
    shortHoursReason: z.union([z.enum(SHORT_HOURS_REASONS), z.literal("")]),
    comments: z.string().max(500),
    onCallTimeIn: timeOrEmpty,
    onCallTimeOut: timeOrEmpty,
    callBackTimeIn: timeOrEmpty,
    callBackTimeOut: timeOrEmpty,
    callBackReason: z.string().max(500),
    mileage: z.coerce.number().min(0).max(9999),
  })
  .refine((entry) => Boolean(entry.timeIn) === Boolean(entry.timeOut), {
    message: "Enter both a time in and time out, or leave both blank for a day off.",
    path: ["timeOut"],
  })
  .refine((entry) => Boolean(entry.lunchOut) === Boolean(entry.lunchIn), {
    message: "Enter both a lunch-out and lunch-in time, or leave both blank.",
    path: ["lunchIn"],
  })
  .refine((entry) => !(entry.noLunch && (entry.lunchOut || entry.lunchIn)), {
    message: 'Can\'t check "No lunch" and also enter lunch times for the same day.',
    path: ["noLunch"],
  })
  .refine((entry) => Boolean(entry.onCallTimeIn) === Boolean(entry.onCallTimeOut), {
    message: "Enter both an on-call time in and time out, or leave both blank.",
    path: ["onCallTimeOut"],
  })
  .refine((entry) => Boolean(entry.callBackTimeIn) === Boolean(entry.callBackTimeOut), {
    message: "Enter both a call-back time in and time out, or leave both blank.",
    path: ["callBackTimeOut"],
  });

export const timesheetSubmissionSchema = z.object({
  days: z.array(dayEntrySchema).length(7),
  guaranteedHoursNote: z.string().max(1000),
});

export type DayEntryInput = z.infer<typeof dayEntrySchema>;
export type TimesheetSubmissionInput = z.infer<typeof timesheetSubmissionSchema>;
