import type { LineDetailOrderRow, PickerDetailOrderRow } from '@/entities/manual-shift/model/shift-selectors';
import type { ManualShiftOrderStatus } from '@wos/domain';

type DetailMode = 'line' | 'picker';

type DetailRow = LineDetailOrderRow | PickerDetailOrderRow;

interface DesktopDetailOrdersTableProps {
  mode: DetailMode;
  rows: DetailRow[];
  onSelectOrder?: (orderId: string) => void;
}

const STATUS_LABEL: Record<ManualShiftOrderStatus, string> = {
  queued: 'בתור',
  picking: 'בליקוט',
  waiting_check: 'ממתין בדיקה',
  returned: 'הוחזר',
  done: 'הסתיים'
};

const STATUS_CLASS: Record<ManualShiftOrderStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  picking: 'bg-blue-100 text-blue-800',
  waiting_check: 'bg-amber-100 text-amber-800',
  returned: 'bg-red-100 text-red-800',
  done: 'bg-green-100 text-green-800'
};

function formatAge(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}ש`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}ד`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}:${String(rem).padStart(2, '0')}`;
}

function renderPointCell(row: DetailRow) {
  return (
    <td className="px-3 py-2 max-w-[180px]">
      <p className="text-gray-800 truncate">{row.pointName ?? row.customerName ?? '—'}</p>
      {row.orderNumber && <p className="text-xs text-gray-400 font-mono">{row.orderNumber}</p>}
    </td>
  );
}

export function DesktopDetailOrdersTable({ mode, rows, onSelectOrder }: DesktopDetailOrdersTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 px-4">
        <p className="text-sm text-gray-400 text-center">אין הזמנות להצגה</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500 bg-gray-50">
            <th className="text-right font-medium px-3 py-2">סטטוס</th>
            {mode === 'picker' && <th className="text-right font-medium px-3 py-2">קו</th>}
            {mode === 'line' && <th className="text-right font-medium px-3 py-2">מלקט</th>}
            <th className="text-right font-medium px-3 py-2">נקודה</th>
            <th className="text-right font-medium px-3 py-2">גודל</th>
            <th className="text-right font-medium px-3 py-2">שורות</th>
            <th className="text-right font-medium px-3 py-2">משטחים</th>
            <th className="text-right font-medium px-3 py-2">גיל</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.orderId}
              className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
              onClick={() => onSelectOrder?.(row.orderId)}
              aria-label={`open-detail-order-${row.orderId}`}
              data-testid={`detail-order-row-${row.orderId}`}
            >
              <td className="px-3 py-2">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASS[row.status]}`}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </td>
              {mode === 'picker' && (
                <td className="px-3 py-2 text-gray-700">{'lineName' in row ? row.lineName ?? '—' : '—'}</td>
              )}
              {mode === 'line' && (
                <td className="px-3 py-2 text-gray-700">{'pickerName' in row ? row.pickerName ?? '—' : '—'}</td>
              )}
              {renderPointCell(row)}
              <td className="px-3 py-2 text-gray-700 text-center">{row.size ?? '—'}</td>
              <td className="px-3 py-2 text-gray-700 text-center">{row.lineCount ?? '—'}</td>
              <td className="px-3 py-2 text-gray-700 text-center">{row.palletCount ?? '—'}</td>
              <td className="px-3 py-2 text-gray-500 text-xs tabular-nums">{formatAge(row.ageSeconds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
