import Link from "next/link";

// Plain links carrying the page param forward, same zero-client-JS pattern
// as every other filter in this admin panel. Preserves whatever other
// params (q, sort, dir) the caller passes in `params`.
export function PaginationControls({
  pathname,
  params,
  page,
  totalPages,
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  page: number;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (targetPage: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (targetPage > 1) search.set("page", String(targetPage));
    const qs = search.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  return (
    <div className="flex items-center justify-between text-sm text-zinc-600">
      <span>
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={hrefFor(page - 1)} className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-900">
            Previous
          </Link>
        ) : (
          <span className="rounded-md border border-zinc-200 px-3 py-1.5 font-medium text-zinc-400">Previous</span>
        )}
        {page < totalPages ? (
          <Link href={hrefFor(page + 1)} className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium text-zinc-900">
            Next
          </Link>
        ) : (
          <span className="rounded-md border border-zinc-200 px-3 py-1.5 font-medium text-zinc-400">Next</span>
        )}
      </div>
    </div>
  );
}
