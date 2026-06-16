import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { OrderDetail } from '@/entities/manual-shift/model/shift-selectors';
import type { ManualShiftOrderStatus } from '@wos/domain';
import { orderDetailQueryOptions } from '@/entities/manual-shift/api/queries';
import { formatDateTimeHe } from '@/shared/lib/format-date-time';
import { getElapsedFromIso } from '../order-utils';
import { OrderItemsSection } from '../order-items-section';

interface DesktopOrderDetailProps {
  detail: OrderDetail | null;
  onClose: () => void;
}

const MISSING_VALUE = '—';

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

function formatAge(status: ManualShiftOrderStatus, seconds: number | null): string {
  if (status === 'returned') return MISSING_VALUE;
  if (seconds === null) return MISSING_VALUE;
  if (seconds < 60) return `${seconds}ש`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}ד`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}:${String(rem).padStart(2, '0')}`;
}

function diffMinutes(from: string | null, to: string | null): string {
  if (!from || !to) return MISSING_VALUE;
  const mins = Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60000);
  if (mins < 0) return MISSING_VALUE;
  if (mins < 60) return `${mins}ד`;
  const h = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${h}:${String(rem).padStart(2, '0')}`;
}

function Row({
  label,
  value,
  valueDir
}: {
  label: string;
  value: string | number | null;
  valueDir?: 'ltr' | 'rtl';
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span dir={valueDir} className="text-sm font-medium text-gray-900 text-left break-all">
        {value ?? MISSING_VALUE}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <h3 className="mb-1 text-xs font-semibold text-gray-700">{title}</h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

export function DesktopOrderDetail({ detail, onClose }: DesktopOrderDetailProps) {
  if (!detail) {
    return (
      <div className="p-4" dir="rtl">
        <p className="mb-3 text-sm text-gray-600">ההזמנה שנבחרה אינה זמינה יותר.</p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-gray-900 px-3 py-2 text-sm text-white"
        >
          סגור
        </button>
      </div>
    );
  }

  const parallelCheckElapsed =
    detail.status === 'picking' && detail.checkStartedAt ? getElapsedFromIso(detail.checkStartedAt) : null;
  const { data: orderDetail, isLoading: isOrderDetailLoading } = useQuery(orderDetailQueryOptions(detail.orderId));
  const hasItemRows = (orderDetail?.items?.length ?? 0) > 0;
  const lineCountDisplay = orderDetail?.lineCount ?? detail.lineCount;
  const totalQuantity = orderDetail?.totalQuantity ?? 0;

  return (
    <div className="space-y-3 p-4" dir="rtl" data-testid="order-detail-view">
      <header className="space-y-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-semibold text-gray-900">
            {detail.pointName ?? detail.customerName ?? MISSING_VALUE}
          </p>
          <span
            className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLASS[detail.status]}`}
          >
            {STATUS_LABEL[detail.status]}
          </span>
        </div>
        {detail.orderNumber && <p className="text-xs text-gray-500">{detail.orderNumber}</p>}
        <p className="text-sm text-gray-700">{detail.lineName ?? MISSING_VALUE}</p>
      </header>

      <Section title="פרטי הזמנה">
        <Row label="קו" value={detail.lineName ?? MISSING_VALUE} />
        <Row label="נקודה" value={detail.pointName ?? MISSING_VALUE} />
        <Row label="לקוח" value={detail.customerName ?? MISSING_VALUE} />
        <Row label="מספר הזמנה" value={detail.orderNumber ?? MISSING_VALUE} />
        <Row label="סטטוס" value={STATUS_LABEL[detail.status]} />
      </Section>

      <Section title="עבודה">
        <Row label="מלקט" value={detail.pickerName ?? MISSING_VALUE} />
        <Row label="בודק" value={detail.checkerName ?? MISSING_VALUE} />
        <Row label="גודל" value={detail.size ?? MISSING_VALUE} />
        {!hasItemRows && !isOrderDetailLoading ? (
          <Row label="שורות" value={lineCountDisplay ?? MISSING_VALUE} />
        ) : (
          <Row label="פריטים" value={orderDetail?.items?.length ?? MISSING_VALUE} />
        )}
        <Row label="משטחים" value={detail.palletCount ?? MISSING_VALUE} />
        <Row label="גיל סטטוס" value={formatAge(detail.status, detail.ageSeconds)} />
      </Section>

      <OrderItemsSection items={orderDetail?.items ?? []} totalQuantity={totalQuantity} />

      <Section title="זמנים">
        <Row label="נוצרה" value={formatDateTimeHe(detail.createdAt)} valueDir="ltr" />
        <Row label="התחלת ליקוט" value={formatDateTimeHe(detail.startedAt)} valueDir="ltr" />
        <Row label="הבדיקה התחילה" value={formatDateTimeHe(detail.checkStartedAt)} valueDir="ltr" />
        <Row label="ממתין בדיקה" value={formatDateTimeHe(detail.waitingCheckAt)} valueDir="ltr" />
        <Row label="נבדק" value={formatDateTimeHe(detail.checkedAt)} valueDir="ltr" />
        <Row label="הסתיים" value={formatDateTimeHe(detail.finishedAt)} valueDir="ltr" />
      </Section>

      {parallelCheckElapsed && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <p className="text-xs font-semibold text-amber-800">בדיקה במקביל · <span dir="ltr">{parallelCheckElapsed}</span></p>
        </section>
      )}

      <Section title="משכי שלבים">
        <Row label="זמן ליקוט" value={diffMinutes(detail.startedAt, detail.waitingCheckAt)} />
        <Row label="המתנה לבדיקה" value={diffMinutes(detail.waitingCheckAt, detail.checkedAt)} />
        <Row label="זמן אריזה" value={diffMinutes(detail.checkedAt, detail.finishedAt)} />
      </Section>
    </div>
  );
}
