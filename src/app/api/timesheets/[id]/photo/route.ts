import { NextRequest, NextResponse } from "next/server";

// Bypass-path photo upload: stores the image in the private
// "timesheet-photos" Supabase Storage bucket and moves the timesheet to
// 'photo_submitted' for admin review.
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return NextResponse.json({ error: "not implemented", id }, { status: 501 });
}
