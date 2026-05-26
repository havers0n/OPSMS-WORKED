import type { ManualShiftOrder } from '@wos/domain';
import { AlertCircle, Clock, Package } from 'lucide-react';
import { getOrderStatusColor, getOrderStatusLabel, getElapsedFromIso } from './order-utils';

interface OrderCardProps {
  order: ManualShiftOrder;
  onSelect: (orderId: string) => void;
}

export function OrderCard({ order, onSelect }: OrderCardProps) {
  const isError = order.status === 'returned';
  const statusLabel = getOrderStatusLabel(order.status);
  const statusColor = getOrderStatusColor(order.status);

  const timeRef =
    order.status === 'picking' && order.startedAt
      ? order.startedAt
      : (order.status === 'waiting_check' || order.status === 'returned') && order.waitingCheckAt
        ? order.waitingCheckAt
        : order.createdAt;

  const elapsed = getElapsedFromIso(timeRef);

  return (
    <button
      onClick={() => onSelect(order.id)}
      className={`bg-white border text-right rounded-xl p-4 flex flex-col gap-3 active:bg-gray-50 transition-colors w-full ${
        isError
          ? 'border-red-300 shadow-[0_2px_10px_rgba(239,68,68,0.1)]'
          : 'border-gray-200 shadow-sm'
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg text-gray-900">
              {order.pointName ?? 'ללא נקודה'}
            </span>
            {isError && <AlertCircle size={18} className="text-red-500" strokeWidth={2.5} />}
          </div>
          {order.pickerName && (
            <span className="text-gray-600 font-medium text-sm">{order.pickerName}</span>
          )}
          {order.orderNumber && (
            <span className="text-gray-400 text-xs">{order.orderNumber}</span>
          )}
        </div>
        <div className={`px-2.5 py-1 text-sm font-bold rounded-md border shrink-0 ${statusColor}`}>
          {statusLabel}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
        {order.size !== 'unknown' && (
          <div className="flex items-center gap-1">
            <span className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-700 rounded text-[10px] font-bold">
              {order.size}
            </span>
            {order.lineCount != null && (
              <span className="flex items-center text-gray-500 gap-1">
                <Package size={14} />
                {order.lineCount}
              </span>
            )}
          </div>
        )}
        {order.palletCount != null && (
          <span className="text-gray-500 text-xs">{order.palletCount} משטחים</span>
        )}
        {order.size === 'unknown' && order.lineCount == null && (
          <span className="text-gray-400 text-xs">גודל לא ידוע</span>
        )}
        {elapsed && (
          <div className="flex items-center gap-1 text-gray-500 mr-auto">
            <span>{elapsed}</span>
            <Clock size={14} />
          </div>
        )}
      </div>
    </button>
  );
}
