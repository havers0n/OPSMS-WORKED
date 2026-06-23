import type { SourceOrder, SourceOrderItem, ItemAllocation } from './scheme-types';
import { getOrderBadgeStatus, getOrderProgress } from './order-list-utils';
import { Badge } from '@/shared/ui/badge';

const BADGE_CONFIG: Record<string, { tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger'; label: string }> = {
  not_loaded: { tone: 'neutral', label: 'לא נטען' },
  unassigned: { tone: 'neutral', label: 'לא שויך' },
  partial: { tone: 'warning', label: 'חלקי' },
  split: { tone: 'info', label: 'מפוצל' },
  assigned: { tone: 'success', label: 'שויך' },
};

export function OrderCard({
  order,
  orderItemMap,
  itemAllocations,
  onClick,
}: {
  order: SourceOrder;
  orderItemMap: Record<string, SourceOrderItem[]>;
  itemAllocations: ItemAllocation[];
  onClick: () => void;
}) {
  const badgeStatus = getOrderBadgeStatus(order.orderId, orderItemMap, itemAllocations);
  const badge = BADGE_CONFIG[badgeStatus];
  const progress = getOrderProgress(order.orderId, orderItemMap, itemAllocations);

  return (
    <div
      className="shrink-0 w-48 bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-400 transition-colors cursor-pointer flex flex-col gap-1"
      onClick={onClick}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] text-gray-500 font-bold truncate">{order.orderNumber}</span>
        <Badge tone={badge.tone} className="!text-[10px] !px-1.5 !py-0">{badge.label}</Badge>
      </div>

      <div className="font-semibold text-gray-900 text-xs truncate" title={order.customerName ?? ''}>
        {order.customerName}
      </div>

      {progress ? (
        <div className="text-[10px] text-gray-500 space-y-0.5">
          <div>כמות שויכה: {progress.allocatedQty}/{progress.totalQty}</div>
          <div>שורות שויכו: {progress.allocatedRows}/{progress.totalRows}</div>
        </div>
      ) : (
        <div className="text-[10px] text-gray-500">
          שורות משוער: {order.itemLinesCount}
        </div>
      )}

      {order.hasAshlama && <span className="text-[10px] text-amber-700 font-bold">אשלמה</span>}
      {order.hasCheckUnits && <span className="text-[10px] text-amber-700 font-bold">יחידות בדיקה</span>}

      <div className="text-[10px] text-gray-400 mt-auto pt-0.5 truncate">
        {order.sourceDeliveryLine?.lineGroupName ?? '—'}
      </div>
    </div>
  );
}
