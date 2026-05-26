import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, AlertTriangle, Clock, Package, Loader2, ClipboardCheck } from 'lucide-react';
import type { ManualShiftOrder, ManualShiftLineSummary } from '@wos/domain';
import { shiftOrdersQueryOptions, manualShiftKeys } from '@/entities/manual-shift/api/queries';
import { useUpdateManualShiftOrderStatus } from '@/entities/manual-shift/api/mutations';
import { ErrorFlow } from './error-flow';
import { getElapsedFromIso } from './order-utils';

interface CheckTabProps {
  shiftId: string;
  lines: ManualShiftLineSummary[];
}

export function CheckTab({ shiftId, lines }: CheckTabProps) {
  const [errorFlowOrder, setErrorFlowOrder] = useState<ManualShiftOrder | null>(null);
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery(shiftOrdersQueryOptions(shiftId));
  const updateStatus = useUpdateManualShiftOrderStatus();

  const waitingOrders = orders.filter(o => o.status === 'waiting_check');
  const lineNameMap = new Map(lines.map(ls => [ls.line.id, ls.line.name]));

  function invalidateSummaries() {
    void queryClient.invalidateQueries({ queryKey: manualShiftKeys.shiftOrders(shiftId) });
    void queryClient.invalidateQueries({ queryKey: manualShiftKeys.peopleSummary(shiftId) });
    void queryClient.invalidateQueries({ queryKey: manualShiftKeys.daySummary(shiftId) });
    void queryClient.invalidateQueries({ queryKey: manualShiftKeys.today() });
  }

  function handleOK(order: ManualShiftOrder) {
    updateStatus.mutate(
      { orderId: order.id, lineId: order.lineId, status: 'done' },
      { onSuccess: invalidateSummaries }
    );
  }

  function handleErrorFlowClose() {
    setErrorFlowOrder(null);
    invalidateSummaries();
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    );
  }

  if (waitingOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-8 text-center gap-4">
        <ClipboardCheck size={48} className="text-green-400" />
        <p className="font-bold text-xl text-gray-700">אין נקודות לבדיקה</p>
        <p className="text-gray-400 text-sm">כל ההזמנות נבדקו</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col relative">
      <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 shrink-0">
        <p className="font-bold text-amber-800 text-base">
          {waitingOrders.length} נקודות ממתינות לבדיקה
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4">
        {waitingOrders.map(order => (
          <CheckOrderCard
            key={order.id}
            order={order}
            lineName={lineNameMap.get(order.lineId)}
            onOK={() => handleOK(order)}
            onError={() => setErrorFlowOrder(order)}
            isPending={updateStatus.isPending && updateStatus.variables?.orderId === order.id}
          />
        ))}
      </div>

      {errorFlowOrder && (
        <ErrorFlow
          orderId={errorFlowOrder.id}
          lineId={errorFlowOrder.lineId}
          orderNumber={errorFlowOrder.orderNumber}
          onClose={handleErrorFlowClose}
        />
      )}
    </div>
  );
}

interface CheckOrderCardProps {
  order: ManualShiftOrder;
  lineName: string | undefined;
  onOK: () => void;
  onError: () => void;
  isPending: boolean;
}

function CheckOrderCard({ order, lineName, onOK, onError, isPending }: CheckOrderCardProps) {
  const elapsed = getElapsedFromIso(order.waitingCheckAt ?? order.createdAt);

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-4 flex flex-col gap-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-start gap-2">
          <span className="font-bold text-xl text-gray-900">
            {order.pointName ?? 'ללא נקודה'}
          </span>
          {elapsed && (
            <div className="flex items-center gap-1 text-amber-600 text-sm shrink-0">
              <Clock size={14} />
              <span>{elapsed}</span>
            </div>
          )}
        </div>
        {lineName && <span className="text-sm text-gray-500">קו: {lineName}</span>}
        {order.pickerName && (
          <span className="text-gray-700 font-medium text-sm">מלקט: {order.pickerName}</span>
        )}
        {order.orderNumber && (
          <span className="text-gray-400 text-xs font-mono">{order.orderNumber}</span>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
        {order.size !== 'unknown' && (
          <span className="w-6 h-6 flex items-center justify-center bg-gray-200 text-gray-700 rounded text-xs font-bold">
            {order.size}
          </span>
        )}
        {order.lineCount != null && (
          <span className="flex items-center gap-1 text-gray-600">
            <Package size={14} />
            {order.lineCount} שורות
          </span>
        )}
        {order.palletCount != null && (
          <span className="text-gray-500 text-xs">{order.palletCount} משטחים</span>
        )}
        {order.size === 'unknown' && order.lineCount == null && (
          <span className="text-gray-400 text-xs">גודל לא ידוע</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onError}
          disabled={isPending}
          className="h-14 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <AlertTriangle size={20} />
          תקלה
        </button>
        <button
          onClick={onOK}
          disabled={isPending}
          className="h-14 rounded-xl bg-green-600 text-white font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          <CheckCircle size={20} />
          {isPending ? '...' : 'תקין'}
        </button>
      </div>
    </div>
  );
}
