import Link from "next/link";

// A <th> that's a link toggling sort/dir for one column — clicking an
// already-active column flips direction, clicking a different one switches
// to it ascending. Resets to page 1 implicitly (page isn't in `params`
// here on purpose — a re-sort invalidates whatever page you were on).
export function SortableHeader({
  pathname,
  params,
  column,
  label,
  currentSort,
  currentDir,
}: {
  pathname: string;
  params: Record<string, string | undefined>;
  column: string;
  label: string;
  currentSort: string;
  currentDir: "asc" | "desc";
}) {
  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  search.set("sort", column);
  search.set("dir", nextDir);

  return (
    <th className="px-4 py-2">
      <Link href={`${pathname}?${search.toString()}`} className="flex items-center gap-1 hover:text-zinc-900">
        {label}
        {isActive && <span aria-hidden>{currentDir === "asc" ? "▲" : "▼"}</span>}
      </Link>
    </th>
  );
}
