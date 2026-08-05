import Link from "next/link";
import type { ArchiveYear } from "./archive";

// Plain nested <details>/<summary> — collapsible with zero client JS, so
// this stays a Server Component like the rest of the page. Defaults
// everything closed; there's no cap on how many years/weeks accumulate here
// over time, so rendering it all open by default would defeat the point of
// collapsing it.
export function ArchiveTree({ years }: { years: ArchiveYear[] }) {
  if (years.length === 0) {
    return <p className="text-sm text-zinc-500">Nothing in the archive yet.</p>;
  }

  return (
    <div className="space-y-1">
      {years.map((year) => (
        <details key={year.year} className="rounded-lg border border-zinc-200 bg-white">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-zinc-900">
            {year.year}
          </summary>
          <div className="space-y-1 border-t border-zinc-100 p-2">
            {year.months.map((month) => (
              <details key={month.monthKey} className="rounded-md border border-zinc-200">
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-zinc-900">
                  {month.label}
                </summary>
                <div className="space-y-1 border-t border-zinc-100 p-2">
                  {month.weeks.map((week) => (
                    <details key={week.weekKey} className="rounded-md border border-zinc-200">
                      <summary className="cursor-pointer select-none px-3 py-2 text-sm text-zinc-700">
                        {week.label}
                      </summary>
                      <div className="overflow-hidden border-t border-zinc-100">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-zinc-50 text-xs text-zinc-500">
                            <tr>
                              <th className="px-4 py-2">Traveler</th>
                              <th className="px-4 py-2">Facility</th>
                              <th className="px-4 py-2">Week</th>
                              <th className="px-4 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {week.rows.map((row) => (
                              <tr key={row.key} className="border-t border-zinc-100">
                                <td className="px-4 py-2">
                                  <Link href={row.travelerHref} className="font-medium text-zinc-900 underline">
                                    {row.travelerName}
                                  </Link>
                                </td>
                                <td className="px-4 py-2 text-zinc-600">{row.facilityName}</td>
                                <td className="px-4 py-2 text-zinc-600">{row.weekLabel}</td>
                                <td className="px-4 py-2 text-zinc-600">{row.statusLabel}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
