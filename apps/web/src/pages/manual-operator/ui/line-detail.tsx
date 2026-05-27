import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ClipboardList, Loader2, PlusCircle } from 'lucide-react';
import type { ManualShiftLineSummary, ManualShiftOrder, ManualShiftOrderSize } from '@wos/domain';
import {
  useCreateManualShiftOrder,
  useDeleteManualShiftLine,
  useRestoreManualShiftOrder
} from '@/entities/manual-shift/api/mutations';
import { lineOrdersQueryOptions } from '@/entities/manual-shift/api/queries';
import { BffRequestError } from '@/shared/api/bff/client';
import { AddOrderSheet } from './add-order-sheet';
import { BulkPasteSheet } from './bulk-paste-sheet';
import { DeleteConfirmSheet } from './delete-confirm-sheet';
import { OrderCard } from './order-card';
import { OrderDetail } from './order-detail';

interface LineDetailProps {
  summary: ManualShiftLineSummary;
  onBack: () => void;
}

type Overlay = 'line-delete' | 'order-detail' | 'add-order' | 'bulk-paste' | null;

const QUICK_SIZES: ManualShiftOrderSize[] = ['S', 'M', 'L', 'XL'];
const LINE_NOT_EMPTY_MESSAGE =
  'אי אפשר למחוק קו שיש בו נקודות. מחק או העבר את הנקודות קודם.';

export function LineDetail({ summary, onBack }: LineDetailProps) {
  const { line } = summary;
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [deletedOrder, setDeletedOrder] = useState<ManualShiftOrder | null>(null);
  const [lineMessage, setLineMessage] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery(lineOrdersQueryOptions(line.id));
  const createOrder = useCreateManualShiftOrder(line.id);
  const deleteLine = useDeleteManualShiftLine(line.id, { shiftId: line.shiftId });
  const restoreOrder = useRestoreManualShiftOrder(deletedOrder?.id ?? '', {
    lineId: line.id,
    shiftId: line.shiftId
  });

  const selectedOrder = orders.find(order => order.id === selectedOrderId) ?? null;

  function openOrder(orderId: string) {
    setSelectedOrderId(orderId);
    setOverlay('order-detail');
  }

  function closeOverlay() {
    setOverlay(null);
    setSelectedOrderId(null);
  }

  function quickAdd(size: ManualShiftOrderSize) {
    createOrder.mutate({ size, status: 'queued' });
  }

  function openLineDelete() {
    if (orders.length > 0) {
      setLineMessage(LINE_NOT_EMPTY_MESSAGE);
      return;
    }

    setLineMessage(null);
    setOverlay('line-delete');
  }

  async function handleLineDelete(reason?: string) {
    try {
      await deleteLine.mutateAsync({ reason });
      setOverlay(null);
      onBack();
    } catch (error) {
      if (
        error instanceof BffRequestError &&
        error.code === 'MANUAL_SHIFT_LINE_NOT_EMPTY'
      ) {
        setOverlay(null);
        setLineMessage(LINE_NOT_EMPTY_MESSAGE);
      }
    }
  }

  function handleOrderDeleted(order: ManualShiftOrder) {
    setDeletedOrder(order);
    setLineMessage(null);
    closeOverlay();
  }

  function handleUndoDelete() {
    if (!deletedOrder) {
      return;
    }

    restoreOrder.mutate(
      {},
      {
        onSuccess: () => {
          setDeletedOrder(null);
        }
      }
    );
  }

  return (
    <div className="absolute inset-0 bg-white z-10 flex flex-col" dir="rtl">
      <header className="flex items-center gap-3 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onBack}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors"
          aria-label="חזור לרשימת קווים"
        >
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-lg flex-1 truncate">{line.name}</h2>
        <button
          type="button"
          onClick={openLineDelete}
          className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg active:bg-red-100 transition-colors"
          aria-label="מחק קו"
        >
          מחק קו
        </button>
        <button
          onClick={() => setOverlay('bulk-paste')}
          className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors"
          aria-label="הוסף מרובה"
        >
          הוסף מרובה
        </button>
        <button
          onClick={() => setOverlay('add-order')}
          className="px-3 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg active:scale-95 transition-transform"
          aria-label="הוסף הזמנה"
        >
          + הזמנה
        </button>
      </header>

      {deletedOrder && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-amber-900">נקודה נמחקה</span>
          <button
            type="button"
            onClick={handleUndoDelete}
            disabled={restoreOrder.isPending}
            className="text-sm font-bold text-amber-800 underline disabled:opacity-50"
          >
            {restoreOrder.isPending ? 'שומר...' : 'בטל'}
          </button>
        </div>
      )}

      {lineMessage && (
        <div className="px-4 py-3 bg-red-50 border-b border-red-200 text-sm text-red-800">
          {lineMessage}
        </div>
      )}

      {!isLoading && (
        <div className="flex gap-2 px-4 py-2 bg-white border-b border-gray-100 shrink-0">
          {QUICK_SIZES.map(size => (
            <button
              key={size}
              onClick={() => quickAdd(size)}
              disabled={createOrder.isPending}
              aria-label={`הוסף גודל ${size}`}
              className="flex-1 h-10 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm active:bg-gray-200 transition-colors disabled:opacity-50"
            >
              +{size}
            </button>
          ))}
        </div>
      )}

      <main className="flex-1 overflow-y-auto relative">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={32} className="animate-spin text-gray-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-6" dir="rtl">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-3xl">
              📋
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-bold text-gray-700 text-lg">אין הזמנות בקו</p>
              <p className="text-gray-400 text-sm">הוסף הזמנה ידנית או הדבק מרשימה</p>
            </div>
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button
                onClick={() => setOverlay('add-order')}
                className="w-full bg-gray-900 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <PlusCircle size={22} />
                הוסף הזמנה
              </button>
              <button
                onClick={() => setOverlay('bulk-paste')}
                className="w-full bg-white border-2 border-gray-300 text-gray-700 rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
              >
                <ClipboardList size={22} />
                הדבק מרובה
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 pb-8 flex flex-col gap-3">
            {orders.map(order => (
              <OrderCard key={order.id} order={order} onSelect={openOrder} />
            ))}
          </div>
        )}
      </main>

      {overlay === 'order-detail' && selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={closeOverlay}
          onDeleted={handleOrderDeleted}
        />
      )}

      {overlay === 'add-order' && (
        <AddOrderSheet lineId={line.id} shiftId={line.shiftId} onClose={closeOverlay} />
      )}

      {overlay === 'bulk-paste' && <BulkPasteSheet lineId={line.id} onClose={closeOverlay} />}

      {overlay === 'line-delete' && (
        <DeleteConfirmSheet
          title="מחיקת קו"
          description="הקו יוסר מהרשימות הפעילות רק אם אין בו נקודות פעילות."
          confirmLabel="מחק קו"
          isPending={deleteLine.isPending}
          onClose={() => setOverlay(null)}
          onConfirm={handleLineDelete}
        />
      )}
    </div>
  );
}
