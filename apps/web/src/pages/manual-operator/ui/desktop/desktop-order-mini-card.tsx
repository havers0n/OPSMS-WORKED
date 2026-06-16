import type { HierarchyOrder } from '@/entities/manual-shift/model/shift-selectors';
import type { ManualShiftOrderStatus } from '@wos/domain';

interface DesktopOrderMiniCardProps {
  order: HierarchyOrder;
  onClick?: (orderId: string) => void;
}

const STATUS_LABEL: Record<ManualShiftOrderStatus, string> = {
  queued: 'בתור',
  picking: 'בליקוט',
  waiting_check: 'ממתין בדיקה',
  returned: 'הוחזר',
  done: 'הושלם'
};

const STATUS_CLASS: Record<ManualShiftOrderStatus, string> = {
  queued: 'bg-gray-100 text-gray-700',
  picking: 'bg-blue-100 text-blue-800',
  waiting_check: 'bg-amber-100 text-amber-800',
  returned: 'bg-red-100 text-red-800',
  done: 'bg-green-100 text-green-800'
};

export function DesktopOrderMiniCard({ order, onClick }: DesktopOrderMiniCardProps) {
  return (
    <button
      type="button"
      className="bg-white border border-gray-200 rounded-lg p-3 text-right w-full hover:bg-gray-50 hover:border-gray-300 transition-colors"
      onClick={() => onClick?.(order.orderId)}
      data-testid={`order-mini-card-${order.orderId}`}
      aria-label={`הזמנה ${order.orderNumber ?? order.orderId}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <p className="text-sm font-semibold text-gray-900 truncate flex-1 min-w-0">
          {order.orderNumber ?? order.orderId}
        </p>
        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_CLASS[order.status]}`}>
          {STATUS_LABEL[order.status]}
        </span>
      </div>
      <div className="flex items-baseline gap-3 text-xs text-gray-600">
        {order.pickerName && <span>מלקט: {order.pickerName}</span>}
        <span>{order.lineCount} שורות</span>
        <span>{order.totalQuantity} יח׳</span>
      </div>
    </button>
  );
}