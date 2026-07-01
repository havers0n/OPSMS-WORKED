import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DemandExplorerOrder } from '@wos/domain';
import { DemandExplorerStatusBadge } from './demand-explorer-status-badge';
import { DemandExplorerItemsTable } from './demand-explorer-items-table';

export function DemandExplorerOrderCard({
  order,
  draftId,
}: {
  order: DemandExplorerOrder;
  draftId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <div className="p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-bold text-gray-700 truncate">
              {order.orderNumber}
            </span>
            <DemandExplorerStatusBadge status={order.status} />
          </div>
          <span className="text-[11px] text-gray-500 truncate">
            {order.distributionArea}
          </span>
        </div>

        <div className="text-xs font-medium text-gray-900 mb-1.5 truncate" title={order.customerName ?? ''}>
          {order.customerName ?? '—'}
        </div>

        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-600 mb-2">
          <span>שורות: <strong>{order.rowCount}</strong></span>
          <span>SKU: <strong>{order.skuCount}</strong></span>
          <span>כמות: <strong>{order.totalQuantity}</strong></span>
          <span>שויך: <strong>{order.assignedQuantity}</strong></span>
          <span>נותר: <strong>{order.remainingQuantity}</strong></span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {expanded ? 'סגור פרטים' : 'פתח פריטים'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          <DemandExplorerItemsTable draftId={draftId} orderId={order.orderId} />
        </div>
      )}
    </div>
  );
}
