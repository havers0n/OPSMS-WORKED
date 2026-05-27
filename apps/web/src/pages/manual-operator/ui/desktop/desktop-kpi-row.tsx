import type { ShiftSummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopKpiRowProps {
  summary: ShiftSummary;
}

interface KpiChipProps {
  label: string;
  value: number;
  numClass: string;
  bgClass: string;
}

function KpiChip({ label, value, numClass, bgClass }: KpiChipProps) {
  return (
    <div className={`flex flex-col items-center px-4 py-2.5 rounded-lg min-w-[64px] ${bgClass}`}>
      <span className={`font-bold text-3xl leading-none tabular-nums ${numClass}`}>{value}</span>
      <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">{label}</span>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-10 bg-gray-200 shrink-0" aria-hidden="true" />;
}

export function DesktopKpiRow({ summary }: DesktopKpiRowProps) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto" role="region" aria-label="סיכום משמרת">
      <KpiChip label="סה״כ" value={summary.totalOrders} numClass="text-gray-900" bgClass="bg-gray-50" />
      <Divider />
      <KpiChip label="בתור" value={summary.queued} numClass="text-gray-600" bgClass="bg-gray-50" />
      <KpiChip label="בליקוט" value={summary.picking} numClass="text-blue-700" bgClass="bg-blue-50" />
      <Divider />
      <KpiChip
        label="בדיקה"
        value={summary.waitingCheck}
        numClass="text-amber-700"
        bgClass="bg-amber-50"
      />
      <KpiChip label="הוחזר" value={summary.returned} numClass="text-red-700" bgClass="bg-red-50" />
      <Divider />
      <KpiChip label="הסתיימו" value={summary.done} numClass="text-green-700" bgClass="bg-green-50" />
      <KpiChip label="תקלות" value={summary.errorsCount} numClass="text-rose-700" bgClass="bg-rose-50" />
    </div>
  );
}
