import { useState } from 'react';
import type { ManualShiftOrder } from '@wos/domain';
import { ArrowRight, CheckCircle, Clock, Package, User, XCircle } from 'lucide-react';
import { getOrderStatusColor, getOrderStatusLabel, getElapsedFromIso } from './order-utils';
import { useUpdateManualShiftOrderStatus } from '@/entities/manual-shift/api/mutations';
import { ErrorFlow } from './error-flow';

interface OrderDetailProps {
  order: ManualShiftOrder;
  onClose: () => void;
}

export function OrderDetail({ order, onClose }: OrderDetailProps) {
  const [showErrorFlow, setShowErrorFlow] = useState(false);
  const updateStatus = useUpdateManualShiftOrderStatus();

  const statusLabel = getOrderStatusLabel(order.status);
  const statusColor = getOrderStatusColor(order.status);

  const timeRef =
    order.status === 'picking' && order.startedAt
      ? order.startedAt
      : (order.status === 'waiting_check' || order.status === 'returned') && order.waitingCheckAt
        ? order.waitingCheckAt
        : order.createdAt;
  const elapsed = getElapsedFromIso(timeRef);

  function transition(status: ManualShiftOrder['status']) {
    updateStatus.mutate({ orderId: order.id, lineId: order.lineId, status });
  }

  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col pb-16" dir="rtl">
      {/* Header */}
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors"
        >
          <ArrowRight size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-xl">{order.orderNumber ?? 'ללא מספר'}</h2>
        </div>
        <div className={`px-3 py-1.5 text-sm font-bold rounded-lg border shrink-0 ${statusColor}`}>
          {statusLabel}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        {/* Main Info Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm text-right">
          {order.pickerName && (
            <>
              <div className="flex items-center gap-3">
                <User className="text-gray-400 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-medium">עובד מלקט</span>
                  <span className="font-bold text-lg">{order.pickerName}</span>
                </div>
              </div>
              <div className="h-px bg-gray-100" />
            </>
          )}

          {order.customerName && (
            <>
              <div className="flex items-center gap-3">
                <User className="text-gray-400 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-medium">לקוח</span>
                  <span className="font-bold text-lg">{order.customerName}</span>
                </div>
              </div>
              <div className="h-px bg-gray-100" />
            </>
          )}

          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Package className="text-gray-400 shrink-0" size={20} />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">גודל ושורות</span>
                <div className="flex items-center gap-2 font-bold text-lg">
                  {order.size !== 'unknown' && (
                    <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-sm">
                      {order.size}
                    </span>
                  )}
                  {order.lineCount != null ? (
                    <span>{order.lineCount} שורות</span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </div>
              </div>
            </div>

            {elapsed && (
              <div className="flex flex-col items-end border-r border-gray-100 pr-5">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                  זמן בשלב <Clock size={12} />
                </span>
                <span className="font-bold text-lg" dir="ltr">
                  {elapsed}
                </span>
              </div>
            )}
          </div>

          {order.comment && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="flex flex-col gap-1">
                <span className="text-sm text-gray-500 font-medium">הערה</span>
                <span className="text-gray-800">{order.comment}</span>
              </div>
            </>
          )}
        </div>

        {/* Timestamps */}
        {(order.startedAt || order.waitingCheckAt || order.finishedAt) && (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex flex-col gap-2 text-right">
            {order.startedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">התחיל</span>
                <span className="font-medium text-gray-700">
                  {new Date(order.startedAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            {order.waitingCheckAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">הועבר לבדיקה</span>
                <span className="font-medium text-gray-700">
                  {new Date(order.waitingCheckAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
            {order.finishedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">הסתיים</span>
                <span className="font-medium text-gray-700">
                  {new Date(order.finishedAt).toLocaleTimeString('he-IL', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Action Footer — hidden for done orders */}
      {order.status !== 'done' && (
        <footer className="shrink-0 border-t border-gray-200 bg-white p-4 flex flex-col gap-3 shadow-[0_-4px_15px_rgba(0,0,0,0.05)]">
          {order.status === 'queued' && (
            <button
              onClick={() => transition('picking')}
              disabled={updateStatus.isPending}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center"
            >
              {updateStatus.isPending ? '...' : 'התחל ליקוט'}
            </button>
          )}

          {order.status === 'picking' && (
            <button
              onClick={() => transition('waiting_check')}
              disabled={updateStatus.isPending}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center"
            >
              {updateStatus.isPending ? '...' : 'העבר לבדיקה'}
            </button>
          )}

          {order.status === 'waiting_check' && (
            <div className="flex gap-3">
              <button
                onClick={() => setShowErrorFlow(true)}
                disabled={updateStatus.isPending}
                className="w-1/2 bg-red-100 text-red-700 border border-red-200 rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <XCircle size={24} />
                תקלה
              </button>
              <button
                onClick={() => transition('done')}
                disabled={updateStatus.isPending}
                className="w-1/2 bg-green-500 text-white border border-green-600 rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <CheckCircle size={24} />
                תקין
              </button>
            </div>
          )}

          {order.status === 'returned' && (
            <button
              onClick={() => transition('waiting_check')}
              disabled={updateStatus.isPending}
              className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center"
            >
              {updateStatus.isPending ? '...' : 'הכל תוקן, החזר לבדיקה'}
            </button>
          )}
        </footer>
      )}

      {/* Error flow overlay */}
      {showErrorFlow && (
        <ErrorFlow
          orderId={order.id}
          lineId={order.lineId}
          orderNumber={order.orderNumber}
          onClose={() => setShowErrorFlow(false)}
        />
      )}
    </div>
  );
}
