import type { PickerDetail } from '@/entities/manual-shift/model/shift-selectors';
import { DesktopDetailOrdersTable } from './desktop-detail-orders-table';

const UNASSIGNED_LABEL = 'לא משויך';

interface DesktopPickerDetailProps {
  detail: PickerDetail;
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

export function DesktopPickerDetail({ detail, onClose }: DesktopPickerDetailProps) {
  if (!detail.summary) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-600 mb-3">המלקט שנבחר אינו זמין יותר.</p>
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

  const picker = detail.summary;

  return (
    <div className="p-4 space-y-4" dir="rtl">
      <div>
        <p className="text-lg font-bold text-gray-900">{picker.pickerName ?? UNASSIGNED_LABEL}</p>
        <p className="text-sm text-gray-500 mt-0.5">ממוצע שורות להזמנה: {picker.avgLinesPerOrder ?? '—'}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Kpi label="הזמנות" value={picker.totalOrders} />
        <Kpi label="שורות" value={picker.totalLineCount} />
        <Kpi label="משטחים" value={picker.totalPalletCount} />
        <Kpi label="פעיל" value={picker.wipCount} />
        <Kpi label="בדיקה" value={picker.waitingCheck} />
        <Kpi label="הוחזר" value={picker.returned} />
        <Kpi label="הסתיים" value={picker.done} />
      </div>

      {detail.lineBreakdown.length > 0 && (
        <div className="border border-gray-200 rounded-lg p-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">פירוק לפי קווים</p>
          <div className="space-y-1.5">
            {detail.lineBreakdown.map((line) => (
              <div key={line.lineId} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-gray-800 truncate">{line.lineName}</span>
                <span className="text-gray-500 tabular-nums">{line.totalLineCount} שורות · {line.totalOrders} הזמנות</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DesktopDetailOrdersTable mode="picker" rows={detail.orders} />
    </div>
  );
}