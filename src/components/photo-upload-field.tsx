"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type UploadedPhoto = { path: string; name: string };

// Uploads go straight from the browser to Supabase Storage using the
// traveler's own session (not through the Next.js server) — Vercel's
// request-size limits make routing a photo through a server action a bad
// fit, and the storage RLS policy (path must start with the traveler's own
// user id) already restricts this to their own files.
//
// Controlled (photos/onPhotosChange) rather than managing its own state, so
// the parent form can see the current photo count for its own submit-time
// validation (bypass facilities require at least one).
export function PhotoUploadField({
  travelerId,
  weekStartDate,
  photos,
  onPhotosChange,
}: {
  travelerId: string;
  weekStartDate: string;
  photos: UploadedPhoto[];
  onPhotosChange: (photos: UploadedPhoto[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    setError(null);
    const supabase = createClient();
    const uploaded: UploadedPhoto[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${travelerId}/${weekStartDate}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await supabase.storage.from("timesheet-photos").upload(path, file);
      if (uploadError) {
        setError(uploadError.message);
        continue;
      }
      uploaded.push({ path, name: file.name });
    }

    if (uploaded.length) onPhotosChange([...photos, ...uploaded]);
    setUploading(false);
    event.target.value = "";
  }

  function removePhoto(path: string) {
    onPhotosChange(photos.filter((photo) => photo.path !== path));
  }

  return (
    <div className="space-y-2">
      {photos.map((photo) => (
        <div key={photo.path} className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-2">
          <span className="truncate text-sm text-zinc-700">{photo.name}</span>
          <button type="button" onClick={() => removePhoto(photo.path)} className="text-xs text-red-600 underline">
            Remove
          </button>
          <input type="hidden" name="photoPaths" value={photo.path} />
        </div>
      ))}

      <label className="block">
        <span className="sr-only">Upload photo</span>
        <input
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={handleFilesSelected}
          disabled={uploading}
          className="block w-full text-sm text-zinc-700"
        />
      </label>
      {uploading && <p className="text-xs text-zinc-500">Uploading…</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
