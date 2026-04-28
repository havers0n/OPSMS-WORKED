import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ordersQueryOptions } from '@/entities/order/api/queries';
import { getOrderStatusColor, getOrderStatusLabel } from '@/entities/order/lib/order-actions';
import { orderDetailPath } from '@/shared/config/routes';

/**
 * Order Preview (Read-only Summary)
 *
 * Lightweight preview panel for list contexts:
 * - Operations sidebar
 * - Wave detail sidebar
 * - Standalone orders list
 *
 * Shows:
 * - Order summary (number, status, wave context)
 * - Warnings/lifecycle info
 * - Compact lines summary
 * - Link to full Order workspace
 *
 * Not editable. For editing, user opens full Order page.
 */
export function OrderPreview({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const { data: allOrders = [], isLoading } = useQuery(ordersQueryOptions());

  const order = allOrders.find((o) => o.id === orderId);

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <RefreshCw className="h-4 w-4 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="p-4 text-center text-xs text-slate-500">
        Order not found
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-auto">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-medium text-slate-900">{order.externalNumber}</div>
            <div className="mt-1 flex items-center gap-2">
              <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getOrderStatusColor(order.status)}`}>
                {getOrderStatusLabel(order.status)}
              </span>
              {order.waveId && (
                <span className="inline-flex shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 bg-slate-100">
                  Wave: {order.waveName ?? 'unknown'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-slate-500">Lines</div>
            <div className="font-medium text-slate-900">{order.lineCount}</div>
          </div>
          <div>
            <div className="text-slate-500">Units</div>
            <div className="font-medium text-slate-900">{order.unitCount}</div>
          </div>
          <div>
            <div className="text-slate-500">Picked</div>
            <div className="font-medium text-slate-900">{order.pickedUnitCount}</div>
          </div>
        </div>
      </div>

      {/* Compact Lines Summary */}
      {order.lineCount > 0 ? (
        <div className="flex-1 border-b border-slate-100 px-4 py-3">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-600 mb-2">Lines</div>
          <div className="space-y-1 text-xs">
            {/* Placeholder: In a full implementation, fetch order detail to show line SKUs */}
            <div className="text-slate-600">
              {order.lineCount} line{order.lineCount !== 1 ? 's' : ''} in order
            </div>
            {order.unitCount > 0 && (
              <div className="text-slate-600">
                {order.pickedUnitCount} / {order.unitCount} units picked
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 border-b border-slate-100 px-4 py-3">
          <div className="text-xs text-slate-500">No lines added yet</div>
        </div>
      )}

      {/* Primary CTA: Open Full Order */}
      <div className="border-t border-slate-100 bg-slate-50 p-3">
        <button
          type="button"
          onClick={() => navigate(orderDetailPath(orderId))}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white hover:bg-cyan-500"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open full order
        </button>
      </div>

      {/* Close Button (optional, for embedded contexts) */}
      <div className="border-t border-slate-100 px-3 py-2">
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 py-1.5"
        >
          Close
        </button>
      </div>
    </div>
  );
}
