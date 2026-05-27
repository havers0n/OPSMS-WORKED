import type { ShiftSummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopKpiRowProps {
  summary: ShiftSummary;
}

function KpiChip({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="flex flex-col items-center px-3 py-1 rounded-lg bg-gray-50 min-w-[52px]">
      <span className={`font-bold text-lg leading-none ${className}`}>{value}</span>
      <span className="text-[10px] text-gray-500 mt-0.5 whitespace-nowrap">{label}</span>
    </div>
  );
}

export function DesktopKpiRow({ summary }: DesktopKpiRowProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto" role="region" aria-label="סיכום משמרת">
      <KpiChip label="סה״כ" value={summary.totalOrders} className="text-gray-900" />
      <KpiChip label="בתור" value={summary.queued} className="text-gray-600" />
      <KpiChip label="בליקוט" value={summary.picking} className="text-blue-700" />
      <KpiChip label="ממתין" value={summary.waitingCheck} className="text-amber-700" />
      <KpiChip label="הוחזר" value={summary.returned} className="text-red-700" />
      <KpiChip label="הסתיים" value={summary.done} className="text-green-700" />
      <KpiChip label="תקלות" value={summary.errorsCount} className="text-rose-700" />
    </div>
  );
}
