import { Badge } from '@/shared/ui/badge';
import type { LineSchemeOrder } from './line-scheme-types';
import { statusBadgeConfig, backendStatusBadgeConfig } from './line-scheme-status-badge';

export function OrderCard({
  order,
  onOpenItems,
  onAssignAll,
  onUnassign,
}: {
  order: LineSchemeOrder;
  onOpenItems: () => void;
  onAssignAll: () => void;
  onUnassign: () => void;
}) {
  const badge = statusBadgeConfig(order.assignmentStatus);
  const backendLabel = backendStatusBadgeConfig(order.backendStatus).label;

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-white shadow-sm hover:border-blue-400 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <span className="font-mono text-sm text-gray-600 font-bold">{order.orderNumber}</span>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <div className="font-semibold text-gray-900 mb-2 truncate text-sm" title={order.customerName ?? ''}>
        {order.customerName}
      </div>
      <div className="text-xs text-gray-500 flex justify-between mb-1">
        <span>כמות {order.totalQuantity}</span>
        <span>סטטוס ביצוע: {backendLabel}</span>
      </div>
      <div className="text-xs text-gray-500 mb-3 border-b border-gray-100 pb-3">
        <span>{order.lineCount} שורות</span>
        {order.hasAshlama && <span className="mr-2 text-amber-700 font-bold">אשלמה</span>}
        {order.hasCheckUnits && <span className="mr-2 text-amber-700 font-bold">יחידות בדיקה</span>}
      </div>
      {order.assignmentStatus === 'split' && (
        <div className="text-xs text-blue-700 bg-blue-50 p-2 mb-3 rounded border border-blue-100">
          שיוכים שונים
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onOpenItems}
          className="flex-1 py-1.5 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          פתח פריטים
        </button>
        {order.assignmentStatus === 'unassigned' ? (
          <button
            type="button"
            onClick={onAssignAll}
            className="flex-1 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            שייך
          </button>
        ) : (
          <button
            type="button"
            onClick={onUnassign}
            className="flex-1 py-1.5 text-xs font-medium rounded-md border border-red-300 bg-white text-red-700 hover:bg-red-50 transition-colors"
          >
            בטל שיוך
          </button>
        )}
      </div>
    </div>
  );
}
