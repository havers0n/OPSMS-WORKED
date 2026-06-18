import type { LineHierarchySummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopLineSummaryCardProps {
  line: LineHierarchySummary;
  onClick?: (lineId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  open: 'bg-gray-300',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500'
};

export function DesktopLineSummaryCard({ line, onClick }: DesktopLineSummaryCardProps) {
  const sb = line.statusBreakdown;
  return (
    <button
      type="button"
      className="bg-white border border-gray-200 rounded-lg p-4 text-right w-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
      onClick={() => onClick?.(line.lineId)}
      data-testid={`line-summary-card-${line.lineId}`}
      aria-label={`קו ${line.lineName}`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[line.lineStatus] ?? 'bg-gray-300'}`}
          aria-hidden="true"
        />
        <p className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">{line.lineName}</p>
      </div>
      {line.distributionArea && (
        <p className="mb-2 text-xs text-gray-500">אזור הפצה: {line.distributionArea}</p>
      )}
      <div className="flex items-baseline gap-3 mb-2 text-xs text-gray-600">
        <span>{line.ordersCount} הזמנות</span>
        <span>{line.totalQuantity} יח'</span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
        {sb.queued > 0 && <span className="text-gray-500">{sb.queued} בתור</span>}
        {sb.picking > 0 && <span className="text-blue-700">{sb.picking} בליקוט</span>}
        {sb.waitingCheck > 0 && <span className="text-amber-700">{sb.waitingCheck} בדיקה</span>}
        {sb.returned > 0 && <span className="text-red-600">{sb.returned} הוחזר</span>}
        {sb.done > 0 && <span className="text-green-700">{sb.done} הושלם</span>}
      </div>
    </button>
  );
}
