import { useState } from 'react';
import type { ManualShiftOrder } from '@wos/domain';
import { ArrowRight, CheckCircle, Clock, Package, Pencil, User, XCircle } from 'lucide-react';
import {
  useDeleteManualShiftOrder,
  useUpdateManualShiftOrderStatus
} from '@/entities/manual-shift/api/mutations';
import { AssignPickerSheet } from './assign-picker-sheet';
import { DeleteConfirmSheet } from './delete-confirm-sheet';
import { EditOrderSheet } from './edit-order-sheet';
import { ErrorFlow } from './error-flow';
import { getElapsedFromIso, getOrderStatusColor, getOrderStatusLabel } from './order-utils';

interface OrderDetailProps {
  order: ManualShiftOrder;
  onClose: () => void;
  onDeleted: (order: ManualShiftOrder) => void;
}

export function OrderDetail({ order, onClose, onDeleted }: OrderDetailProps) {
  const [showErrorFlow, setShowErrorFlow] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const updateStatus = useUpdateManualShiftOrderStatus();
  const deleteOrder = useDeleteManualShiftOrder(order.id, {
    lineId: order.lineId,
    shiftId: order.shiftId
  });

  const statusLabel = getOrderStatusLabel(order.status);
  const statusColor = getOrderStatusColor(order.status);
  const elapsed = getElapsedFromIso(order.createdAt);

  function transition(status: ManualShiftOrder['status']) {
    updateStatus.mutate({ orderId: order.id, lineId: order.lineId, status });
  }

  function handleDelete(reason?: string) {
    deleteOrder.mutate(
      { reason },
      {
        onSuccess: (deletedOrder) => {
          setShowDeleteConfirm(false);
          onDeleted(deletedOrder);
        }
      }
    );
  }

  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col pb-16" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={onClose} className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors">
          <ArrowRight size={24} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-xl">{order.pointName ?? 'ללא נקודה'}</h2>
          {order.orderNumber && <p className="text-sm text-gray-500 mt-0.5">{order.orderNumber}</p>}
        </div>
        <button
          type="button"
          onClick={() => setShowEditOrder(true)}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500 shrink-0"
          aria-label="עריכה"
        >
          <Pencil size={20} />
        </button>
        <div className={`px-3 py-1.5 text-sm font-bold rounded-lg border shrink-0 ${statusColor}`}>
          {statusLabel}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-4 shadow-sm text-right">
          <div className="flex items-center gap-3">
            <Package className="text-gray-400 shrink-0" size={20} />
            <div className="flex flex-col">
              <span className="text-sm text-gray-500 font-medium">נקודה</span>
              <span className="font-bold text-lg">{order.pointName ?? 'ללא נקודה'}</span>
            </div>
          </div>
          <div className="h-px bg-gray-100" />

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <User className="text-gray-400 shrink-0" size={20} />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">מלקט</span>
                <span className="font-bold text-lg">{order.pickerName ?? 'ללא מלקט'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAssignPicker(true)}
              className="h-10 rounded-lg border border-gray-300 px-3 text-sm font-bold"
            >
              {order.pickerName ? 'שנה מלקט' : 'הקצה מלקט'}
            </button>
          </div>
          <div className="h-px bg-gray-100" />

          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Package className="text-gray-400 shrink-0" size={20} />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">גודל ושורות</span>
                <div className="flex items-center gap-2 font-bold text-lg">
                  {order.size !== 'unknown' && <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-sm">{order.size}</span>}
                  {order.lineCount != null ? <span>{order.lineCount} שורות</span> : <span className="text-gray-400">-</span>}
                </div>
              </div>
            </div>
            {elapsed && (
              <div className="flex flex-col items-end border-r border-gray-100 pr-5">
                <span className="text-sm text-gray-500 font-medium flex items-center gap-1">
                  זמן בשלב <Clock size={12} />
                </span>
                <span className="font-bold text-lg" dir="ltr">{elapsed}</span>
              </div>
            )}
          </div>

          {order.palletCount != null && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="flex items-center gap-3">
                <Package className="text-gray-400 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-medium">מספר משטחים</span>
                  <span className="font-bold text-lg">{order.palletCount}</span>
                </div>
              </div>
            </>
          )}

          {order.startedAt && (
            <>
              <div className="h-px bg-gray-100" />
              <div className="flex items-center gap-3">
                <Clock className="text-gray-400 shrink-0" size={20} />
                <div className="flex flex-col">
                  <span className="text-sm text-gray-500 font-medium">התחלת ליקוט</span>
                  <span className="font-bold text-lg" dir="ltr">
                    {new Date(order.startedAt).toLocaleTimeString('he-IL', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="shrink-0 border-t border-gray-200 bg-white p-4 flex flex-col gap-3">
        {order.status !== 'done' && (
          <>
            {order.status === 'queued' && (
              <button onClick={() => transition('picking')} disabled={updateStatus.isPending} className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg disabled:opacity-50">
                {updateStatus.isPending ? '...' : 'התחל ליקוט'}
              </button>
            )}
            {order.status === 'picking' && (
              <button onClick={() => transition('waiting_check')} disabled={updateStatus.isPending} className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg disabled:opacity-50">
                {updateStatus.isPending ? '...' : 'העבר לבדיקה'}
              </button>
            )}
            {order.status === 'waiting_check' && (
              <div className="flex gap-3">
                <button onClick={() => setShowErrorFlow(true)} disabled={updateStatus.isPending} className="w-1/2 bg-red-100 text-red-700 border border-red-200 rounded-xl h-14 font-bold text-lg flex items-center justify-center gap-2">
                  <XCircle size={24} /> תקלה
                </button>
                <button onClick={() => transition('done')} disabled={updateStatus.isPending} className="w-1/2 bg-green-500 text-white border border-green-600 rounded-xl h-14 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  <CheckCircle size={24} /> תקין
                </button>
              </div>
            )}
            {order.status === 'returned' && (
              <button onClick={() => transition('waiting_check')} disabled={updateStatus.isPending} className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg disabled:opacity-50">
                {updateStatus.isPending ? '...' : 'הכל תוקן, החזר לבדיקה'}
              </button>
            )}
          </>
        )}
        <button type="button" onClick={() => setShowDeleteConfirm(true)} disabled={deleteOrder.isPending} className="w-full h-12 rounded-xl border border-red-300 bg-red-50 text-red-700 font-bold disabled:opacity-50">
          {deleteOrder.isPending ? 'שומר...' : 'מחק נקודה'}
        </button>
      </footer>

      {showErrorFlow && (
        <ErrorFlow
          orderId={order.id}
          lineId={order.lineId}
          orderNumber={order.orderNumber}
          onClose={() => setShowErrorFlow(false)}
        />
      )}

      {showDeleteConfirm && (
        <DeleteConfirmSheet
          title="מחיקת נקודה"
          description="הנקודה תוסר מהרשימות הפעילות."
          confirmLabel="מחק נקודה"
          isPending={deleteOrder.isPending}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}

      {showAssignPicker && (
        <AssignPickerSheet
          order={order}
          onClose={() => setShowAssignPicker(false)}
        />
      )}

      {showEditOrder && (
        <EditOrderSheet
          order={order}
          onClose={() => setShowEditOrder(false)}
        />
      )}
    </div>
  );
}
