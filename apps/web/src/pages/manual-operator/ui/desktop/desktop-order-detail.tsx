import type { OrderDetail } from '@/entities/manual-shift/model/shift-selectors';
import type { ManualShiftOrderStatus } from '@wos/domain';
import { formatDateTimeHe } from '@/shared/lib/format-date-time';

interface DesktopOrderDetailProps {
  detail: OrderDetail | null;
  onClose: () => void;
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

function Row({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-gray-100">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-gray-900 text-left break-all">{value ?? '—'}</span>
    </div>
  );
}

export function DesktopOrderDetail({ detail, onClose }: DesktopOrderDetailProps) {
  if (!detail) {
    return (
      <div className="p-4" dir="rtl">
        <p className="text-sm text-gray-600 mb-3">ההזמנה שנבחרה אינה זמינה יותר.</p>
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

  return (
    <div className="p-4 space-y-3" dir="rtl" data-testid="order-detail-view">
      <div className="flex items-center justify-between">
        <p className="text-lg font-bold text-gray-900">פרטי הזמנה</p>
        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_CLASS[detail.status]}`}>
          {STATUS_LABEL[detail.status]}
        </span>
      </div>

      <Row label="קו" value={detail.lineName ?? '—'} />
      <Row label="נקודה" value={detail.pointName} />
      <Row label="לקוח" value={detail.customerName} />
      <Row label="מספר הזמנה" value={detail.orderNumber} />
      <Row label="מלקט" value={detail.pickerName ?? 'לא משויך'} />
      <Row label="בודק" value={detail.checkerName} />
      <Row label="גודל" value={detail.size} />
      <Row label="שורות" value={detail.lineCount} />
      <Row label="משטחים" value={detail.palletCount} />
      <Row label="נוצרה" value={formatDateTimeHe(detail.createdAt)} />
      <Row label="התחלת ליקוט" value={formatDateTimeHe(detail.startedAt)} />
      <Row label="ממתין בדיקה" value={formatDateTimeHe(detail.waitingCheckAt)} />
      <Row label="נבדק" value={formatDateTimeHe(detail.checkedAt)} />
      <Row label="הסתיים" value={formatDateTimeHe(detail.finishedAt)} />
      <Row label="גיל סטטוס" value={formatAge(detail.ageSeconds)} />
    </div>
  );
}
