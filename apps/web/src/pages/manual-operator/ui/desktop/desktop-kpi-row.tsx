import type { ShiftSummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopKpiRowProps {
  summary: ShiftSummary;
}

function KpiChip({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <span className={`inline-flex items-baseline gap-1 whitespace-nowrap ${muted ? 'opacity-40' : ''}`}>
      <span className="font-bold text-sm tabular-nums text-slate-900">{value}</span>
      <span className="text-xs text-slate-500">{label}</span>
    </span>
  );
}

function Separator() {
  return <span className="text-slate-300 mx-1 select-none" aria-hidden="true">|</span>;
}

export function DesktopKpiRow({ summary }: DesktopKpiRowProps) {
  const activeCount = summary.picking + summary.waitingCheck;

  return (
    <div className="flex items-center gap-0 overflow-x-auto" role="region" aria-label="סיכום משמרת">
      <KpiChip label="סה״כ" value={summary.totalOrders} />
      <Separator />
      <KpiChip label="בתור" value={summary.queued} />
      <Separator />
      <KpiChip label="פעיל" value={activeCount} />
      {summary.returned > 0 && (
        <>
          <Separator />
          <KpiChip label="הוחזר" value={summary.returned} />
        </>
      )}
      <Separator />
      <KpiChip label="הסתיימו" value={summary.done} muted={summary.done === 0} />
      <Separator />
      <KpiChip label="תקלות" value={summary.errorsCount} muted={summary.errorsCount === 0} />
      {summary.totalPalletCount > 0 && (
        <>
          <Separator />
          <KpiChip label="משטחים" value={summary.totalPalletCount} />
        </>
      )}
    </div>
  );
}
