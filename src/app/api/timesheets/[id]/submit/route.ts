import { NextRequest, NextResponse } from "next/server";

// Traveler submits (or resubmits) a timesheet. On success this will:
// facility.skip_manager_approval === false -> generate an approval token,
// email the facility manager, set status = 'awaiting_manager'.
// facility.skip_manager_approval === true  -> set status = 'awaiting_photo'.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json({ error: "not implemented", id }, { status: 501 });
}
