import type { LineDetail } from '@/entities/manual-shift/model/shift-selectors';
import { DesktopDetailOrdersTable } from './desktop-detail-orders-table';

interface DesktopLineDetailProps {
  detail: LineDetail;
  onClose: () => void;
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
      <p className="text-xl font-bold text-gray-900 tabular-nums leading-none">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export function DesktopLineDetail({ detail, onClose }: DesktopLineDetailProps) {
  if (!detail.summary) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-3">הקו שנבחר אינו זמין יותר.</p>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-2 rounded-lg bg-gray-900 text-white text-sm"
        >
          סגור
        </button>
      </div>
    );
  }

  const line = detail.summary;
  const donePercent = Math.min(100, line.donePercent);

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div>
        <p className="text-lg font-bold text-gray-900">{line.lineName}</p>
        <p className="text-sm text-gray-500 mt-0.5">{line.done}/{line.totalOrders} הושלמו</p>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-2" role="progressbar" aria-valuenow={donePercent} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-green-500 rounded-full" style={{ width: `${donePercent}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Kpi label="הזמנות" value={line.totalOrders} />
        <Kpi label="שורות" value={line.totalLineCount} />
        <Kpi label="משטחים" value={line.totalPalletCount} />
        <Kpi label="בתור" value={line.queued} />
        <Kpi label="בליקוט" value={line.picking} />
        <Kpi label="בדיקה" value={line.waitingCheck} />
        <Kpi label="הוחזר" value={line.returned} />
        <Kpi label="הסתיים" value={line.done} />
        <Kpi label="תקלות" value={line.errorCount} />
      </div>

      <DesktopDetailOrdersTable mode="line" rows={detail.orders} />
    </div>
  );
}