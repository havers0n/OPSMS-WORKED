import type { LineSummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopLinePanelProps {
  lines: LineSummary[];
}

const STATUS_DOT: Record<string, string> = {
  open: 'bg-gray-300',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500'
};

function LineRow({ line }: { line: LineSummary }) {
  const donePercent = Math.min(100, line.donePercent);
  return (
    <div className="px-3 py-3 border-b border-gray-100">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[line.lineStatus] ?? 'bg-gray-300'}`}
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-gray-900 truncate flex-1 min-w-0">{line.lineName}</p>
        <span className="text-xs text-gray-500 shrink-0 tabular-nums">{line.done}/{line.totalOrders}</span>
      </div>
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
      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs mr-4">
        {line.picking > 0 && (
          <span className="text-blue-700">{line.picking} בליקוט</span>
        )}
        {line.waitingCheck > 0 && (
          <span className="text-amber-700">{line.waitingCheck} בדיקה</span>
        )}
        {line.returned > 0 && (
          <span className="text-red-600">{line.returned} הוחזר</span>
        )}
        {line.errorCount > 0 && (
          <span className="text-rose-600">{line.errorCount} תקלות</span>
        )}
      </div>
    </div>
  );
}

export function DesktopLinePanel({ lines }: DesktopLinePanelProps) {
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
        <LineRow key={line.lineId} line={line} />
      ))}
    </div>
  );
}
