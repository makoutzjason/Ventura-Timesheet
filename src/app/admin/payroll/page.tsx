// Payroll queue ("/admin/payroll"): approved timesheets ready for export,
// with a per-timesheet "Download PDF" action and a "Mark paid" action.
export default function AdminPayrollPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-zinc-900">Payroll</h1>
      <p className="text-sm text-zinc-600">Approved timesheets ready for export will render here.</p>
    </div>
  );
}
