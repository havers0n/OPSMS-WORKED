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
  return (
    <div className="flex items-start gap-2.5 px-3 py-3 border-b border-gray-100">
      <span
        className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[line.lineStatus] ?? 'bg-gray-300'}`}
        aria-hidden="true"
      />
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{line.lineName}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {line.wipCount > 0 && <span>{line.wipCount} פעיל · </span>}
          {line.done}/{line.totalOrders} הסתיימו
          {line.errorCount > 0 && (
            <span className="text-red-600 mr-1"> · {line.errorCount} תקלות</span>
          )}
        </p>
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
