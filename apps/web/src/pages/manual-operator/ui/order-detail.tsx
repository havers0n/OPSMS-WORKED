import { useState } from 'react';
import type { ManualShiftOrder } from '@wos/domain';
import { ArrowRight, CheckCircle, Clock, Package, Pencil, Trash2, User, XCircle } from 'lucide-react';
import {
  useDeleteManualShiftOrder,
  usePatchManualShiftOrder,
  useUpdateManualShiftOrderStatus
} from '@/entities/manual-shift/api/mutations';
import { AssignPickerSheet } from './assign-picker-sheet';
import { DeleteConfirmSheet } from './delete-confirm-sheet';
import { EditOrderSheet } from './edit-order-sheet';
import { ErrorFlow } from './error-flow';
import { ManualOrderCheckUnitsPanel } from './manual-order-check-units-panel';
import { OrderAshlamotSection } from './order-ashlamot-section';
import { getElapsedFromIso, getOrderStatusColor, getOrderStatusLabel } from './order-utils';

interface OrderDetailProps {
  order: ManualShiftOrder;
  onClose: () => void;
  onDeleted: (order: ManualShiftOrder) => void;
}

export function OrderDetail({ order, onClose, onDeleted }: OrderDetailProps) {
  const [showErrorFlow, setShowErrorFlow] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCompletePickingConfirm, setShowCompletePickingConfirm] = useState(false);
  const [declaredArrivedUnits, setDeclaredArrivedUnits] = useState<string>(
    order.palletCount != null ? String(order.palletCount) : ''
  );
  const [checkUnitsActiveCount, setCheckUnitsActiveCount] = useState<number | null>(null);
  const [checkUnitsCheckedCount, setCheckUnitsCheckedCount] = useState(0);
  const [checkUnitsBlockingReason, setCheckUnitsBlockingReason] = useState<string | null>(null);
  const [canCloseOrderFromCheckUnits, setCanCloseOrderFromCheckUnits] = useState(true);
  const [showAssignPicker, setShowAssignPicker] = useState(false);
  const [showEditOrder, setShowEditOrder] = useState(false);
  const updateStatus = useUpdateManualShiftOrderStatus();
  const patchOrder = usePatchManualShiftOrder();
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

  const isCheckActive =
    Boolean(order.waitingCheckAt) || order.status === 'waiting_check' || order.status === 'returned';
  const canInteractWithCheckUnits = isCheckActive && order.status !== 'done';

  function startCheck() {
    if (isCheckActive) return;
    patchOrder.mutate({
      orderId: order.id,
      lineId: order.lineId,
      shiftId: order.shiftId,
      waitingCheckAt: new Date().toISOString()
    });
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

  function handleConfirmCompletePicking() {
    const parsed = Number.parseInt(declaredArrivedUnits, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) return;

    patchOrder.mutate(
      {
        orderId: order.id,
        lineId: order.lineId,
        shiftId: order.shiftId,
        palletCount: parsed
      },
      {
        onSuccess: () => {
          transition('waiting_check');
          setShowCompletePickingConfirm(false);
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
          onClick={() => setShowDeleteConfirm(true)}
          disabled={deleteOrder.isPending}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-red-500 shrink-0"
          aria-label="מחיקה"
        >
          <Trash2 size={20} />
        </button>
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
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Package className="text-gray-400 shrink-0" size={20} />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">נקודה</span>
                <span className="font-bold text-lg">{order.pointName ?? 'ללא נקודה'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAssignPicker(true)}
              className="flex items-center gap-2"
            >
              <div className="flex flex-col items-end">
                <span className="text-sm text-gray-500 font-medium">מלקט</span>
                <span className="font-bold text-lg">{order.pickerName ?? 'ללא מלקט'}</span>
              </div>
              <User className="text-gray-400 shrink-0" size={20} />
            </button>
          </div>
          <div className="h-px bg-gray-100" />

          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Package className="text-gray-400 shrink-0" size={20} />
              <div className="flex flex-col">
                <span className="text-sm text-gray-500 font-medium">שורות ליקוט</span>
                <div className="flex items-center gap-2 font-bold text-lg">
                  {order.size !== 'unknown' && <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-sm">{order.size}</span>}
                  {order.lineCount != null ? <span>{order.lineCount} שורות</span> : <span className="text-gray-400">-</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-sm text-gray-500 font-medium">מס.משטחים</span>
              <span className="font-bold text-lg">
                {checkUnitsActiveCount ?? order.palletCount ?? '-'}
              </span>
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
        </div>

        <OrderAshlamotSection
          orderId={order.id}
          interactive
          canInteract={canInteractWithCheckUnits}
        />

        <ManualOrderCheckUnitsPanel
          orderId={order.id}
          interactive
          compact
          canInteract={canInteractWithCheckUnits}
          expectedUnitsCount={order.palletCount}
          disabledReason="התחל בדיקה כדי להתחיל לבדוק יחידות"
          onStateChange={(state) => {
            if (!state.isLoading) setCheckUnitsActiveCount(state.activeUnits);
            setCheckUnitsCheckedCount(state.checkedUnits);
            setCheckUnitsBlockingReason(state.blockingReason);
            setCanCloseOrderFromCheckUnits(state.canCloseOrder);
          }}
        />
        {order.status === 'picking' && isCheckActive && (
          <p className="text-sm text-amber-700">
            הבדיקה פעילה במקביל לליקוט. סגירה כתקין חסומה עד לסיום מפורש של הליקוט (העברה ל"ממתין לבדיקה").
          </p>
        )}
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
              <div className="flex gap-3">
                <button onClick={startCheck} disabled={patchOrder.isPending || isCheckActive} className="w-1/2 bg-blue-600 text-white rounded-xl h-14 font-bold text-lg disabled:opacity-50">
                  {patchOrder.isPending ? '...' : isCheckActive ? 'הבדיקה התחילה' : 'התחל בדיקה'}
                </button>
                <button
                  onClick={() => {
                    if (order.palletCount != null && order.palletCount > 0) {
                      transition('waiting_check');
                    } else {
                      setShowCompletePickingConfirm(true);
                    }
                  }}
                  disabled={updateStatus.isPending}
                  className="w-1/2 bg-amber-500 text-white rounded-xl h-14 font-bold text-lg disabled:opacity-50"
                >
                  {updateStatus.isPending ? '...' : 'סיים ליקוט'}
                </button>
              </div>
            )}
            {order.status === 'waiting_check' && (
              <div className="flex flex-col gap-2">
                {checkUnitsBlockingReason && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {checkUnitsBlockingReason}
                  </p>
                )}
                <div className="flex gap-3">
                <button onClick={() => setShowErrorFlow(true)} disabled={updateStatus.isPending} className="w-1/2 bg-red-100 text-red-700 border border-red-200 rounded-xl h-14 font-bold text-lg flex items-center justify-center gap-2">
                  <XCircle size={24} /> תקלה
                </button>
                <button onClick={() => transition('done')} disabled={updateStatus.isPending || !canCloseOrderFromCheckUnits} className="w-1/2 bg-green-500 text-white border border-green-600 rounded-xl h-14 font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50">
                  <CheckCircle size={24} /> סגור כתקין
                </button>
                </div>
              </div>
            )}
            {order.status === 'returned' && (
              <button onClick={() => transition('waiting_check')} disabled={updateStatus.isPending} className="w-full bg-blue-600 text-white rounded-xl h-14 font-bold text-lg disabled:opacity-50">
                {updateStatus.isPending ? '...' : 'הכל תוקן, החזר לבדיקה'}
              </button>
            )}
          </>
        )}
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

      {showCompletePickingConfirm && (
        <div className="absolute inset-0 z-30 bg-white flex flex-col pb-16" dir="rtl">
          <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
            <button
              onClick={() => setShowCompletePickingConfirm(false)}
              className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500"
              aria-label="סגור אישור סיום ליקוט"
            >
              <ArrowRight size={24} />
            </button>
            <h2 className="font-bold text-xl flex-1 text-gray-900">סיום ליקוט</h2>
          </header>

          <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-right">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm leading-6 text-amber-900">
                האם כל היחידות הגיעו לבדיקה? לאחר אישור ניתן יהיה לסגור את הבדיקה כתקינה אם כל היחידות נבדקו.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 flex flex-col gap-2">
              <p className="text-sm text-gray-700">כמה יחידות / משטחים הגיעו לבדיקה?</p>
              <p className="text-xs text-gray-500">משטחים קיימים: {checkUnitsActiveCount ?? '-'}</p>
              <p className="text-xs text-gray-500">נבדקו: {checkUnitsCheckedCount}</p>
              <label className="text-sm font-medium text-gray-700" htmlFor="declared-arrived-units">
                מספר יחידות / משטחים שהגיעו
              </label>
              <input
                id="declared-arrived-units"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={declaredArrivedUnits}
                onChange={(event) => setDeclaredArrivedUnits(event.target.value)}
                className="h-11 rounded-lg border border-gray-300 px-3 text-right"
              />
            </div>
          </main>
          <footer className="shrink-0 border-t border-gray-200 bg-white p-4 flex gap-3">
            <button
              type="button"
              onClick={() => setShowCompletePickingConfirm(false)}
              disabled={updateStatus.isPending || patchOrder.isPending}
              className="flex-1 h-14 rounded-xl border border-gray-300 font-bold text-gray-700 disabled:opacity-50"
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleConfirmCompletePicking}
              disabled={
                updateStatus.isPending ||
                patchOrder.isPending ||
                !Number.isInteger(Number.parseInt(declaredArrivedUnits, 10)) ||
                Number.parseInt(declaredArrivedUnits, 10) <= 0
              }
              className="flex-1 h-14 rounded-xl bg-amber-600 text-white font-bold disabled:opacity-50"
            >
              {updateStatus.isPending || patchOrder.isPending ? '...' : 'כן, כל היחידות הגיעו'}
            </button>
          </footer>
        </div>
      )}

      {showAssignPicker && <AssignPickerSheet order={order} onClose={() => setShowAssignPicker(false)} />}
      {showEditOrder && <EditOrderSheet order={order} onClose={() => setShowEditOrder(false)} />}
    </div>
  );
}
