import type { ActiveOrder, ActiveOrderStatus, LineSummary } from '@/entities/manual-shift/model/shift-selectors';

interface DesktopOrdersPanelProps {
  orders: ActiveOrder[];
  lineSummaries: LineSummary[];
}

const STATUS_LABEL: Record<ActiveOrderStatus, string> = {
  queued: 'בתור',
  picking: 'בליקוט',
  waiting_check: 'ממתין בדיקה',
  returned: 'הוחזר'
};

const STATUS_CLASS: Record<ActiveOrderStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  picking: 'bg-blue-100 text-blue-800',
  waiting_check: 'bg-amber-100 text-amber-800',
  returned: 'bg-red-100 text-red-800'
};

function formatAge(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}ס`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}ד`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}:${String(rem).padStart(2, '0')}`;
}

export function DesktopOrdersPanel({ orders, lineSummaries }: DesktopOrdersPanelProps) {
  const lineNameMap = new Map(lineSummaries.map((l) => [l.lineId, l.lineName]));

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 px-4">
        <p className="text-sm text-gray-400">אין הזמנות פעילות</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 sticky top-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          הזמנות פעילות ({orders.length})
        </p>
      </div>
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="border-b border-gray-100 text-xs text-gray-500">
            <th className="text-right font-medium px-3 py-2">מספר</th>
            <th className="text-right font-medium px-3 py-2">נקודה</th>
            <th className="text-right font-medium px-3 py-2">קו</th>
            <th className="text-right font-medium px-3 py-2">מלקט</th>
            <th className="text-right font-medium px-3 py-2">שורות</th>
            <th className="text-right font-medium px-3 py-2">סטטוס</th>
            <th className="text-right font-medium px-3 py-2">גיל</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.orderId} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">
                {order.orderNumber ?? '—'}
              </td>
              <td className="px-3 py-2 text-gray-800 max-w-[120px] truncate">
                {order.pointName ?? order.customerName ?? '—'}
              </td>
              <td className="px-3 py-2 text-gray-600 text-xs">
                {lineNameMap.get(order.lineId) ?? '—'}
              </td>
              <td className="px-3 py-2 text-gray-700">{order.pickerName ?? '—'}</td>
              <td className="px-3 py-2 text-gray-700 text-center">{order.lineCount ?? '—'}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CLASS[order.status]}`}
                >
                  {STATUS_LABEL[order.status]}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-500 text-xs tabular-nums">
                {formatAge(order.ageSeconds)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
