export function PhotoGallery({ photoUrls, title }: { photoUrls: string[]; title: string }) {
  return (
    <div className="space-y-2 rounded-lg border border-zinc-200 bg-white p-3">
      <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
      <div className="grid grid-cols-2 gap-2">
        {photoUrls.map((url) => (
          <a key={url} href={url} target="_blank" rel="noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element -- private, expiring signed URLs; not a next/image candidate */}
            <img src={url} alt="Clock-in/out record" className="w-full rounded-md border border-zinc-200" />
          </a>
        ))}
      </div>
    </div>
  );
}
