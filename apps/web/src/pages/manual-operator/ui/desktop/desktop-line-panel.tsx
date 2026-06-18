import type { LineHierarchySummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopLinePanelProps {
  lines: LineHierarchySummary[];
  selectedLineId?: string | null;
  onSelectLine?: (lineId: string) => void;
}

const STATUS_DOT: Record<string, string> = {
  open: 'bg-gray-300',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500'
};

function LineRow({
  line,
  isSelected,
  onSelectLine
}: {
  line: LineHierarchySummary;
  isSelected: boolean;
  onSelectLine?: (lineId: string) => void;
}) {
  const donePercent =
    line.ordersCount > 0 ? Math.min(100, Math.round((line.statusBreakdown.done / line.ordersCount) * 100)) : 0;

  return (
    <button
      type="button"
      className={`px-3 py-3 border-b border-gray-100 w-full text-right hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
      onClick={() => onSelectLine?.(line.lineId)}
      aria-label={`פתח פרטי קו ${line.lineName}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[line.lineStatus] ?? 'bg-gray-300'}`}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">{line.lineName}</p>
        <span className="text-xs text-gray-500 shrink-0 tabular-nums">
          {line.statusBreakdown.done}/{line.ordersCount}
        </span>
      </div>
      {line.distributionArea && (
        <p className="mb-1 text-xs text-gray-500 mr-4">אזור הפצה: {line.distributionArea}</p>
      )}
      <div
        className="h-1 bg-gray-100 rounded-full overflow-hidden mb-1.5 mr-4"
        role="progressbar"
        aria-valuenow={donePercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`התקדמות ${line.lineName}`}
      >
        <div className="h-full bg-green-500 rounded-full" style={{ width: `${donePercent}%` }} />
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-gray-500 mr-4 mb-1.5">
        <span>{line.ordersCount} הזמנות</span>
        <span>{line.totalQuantity} יח'</span>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs mr-4">
        {line.statusBreakdown.picking > 0 && <span className="text-blue-700">{line.statusBreakdown.picking} בליקוט</span>}
        {line.statusBreakdown.waitingCheck > 0 && (
          <span className="text-amber-700">{line.statusBreakdown.waitingCheck} בדיקה</span>
        )}
        {line.statusBreakdown.returned > 0 && <span className="text-red-600">{line.statusBreakdown.returned} הוחזר</span>}
        {line.statusBreakdown.queued > 0 && <span className="text-gray-500">{line.statusBreakdown.queued} בתור</span>}
      </div>
    </button>
  );
}

export function DesktopLinePanel({ lines, selectedLineId, onSelectLine }: DesktopLinePanelProps) {
  if (lines.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 px-4">
        <p className="text-sm text-gray-400 text-center">אין קווים פעילים</p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">קווים</p>
      </div>
      {lines.map((line) => (
        <LineRow
          key={line.lineId}
          line={line}
          isSelected={line.lineId === selectedLineId}
          onSelectLine={onSelectLine}
        />
      ))}
    </div>
  );
}
