import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ManualShiftOrder } from '@wos/domain';
import { useQuery } from '@tanstack/react-query';
import { usePatchManualShiftOrder } from '@/entities/manual-shift/api/mutations';
import { shiftWorkersQueryOptions } from '@/entities/manual-shift/api/queries';

interface AssignPickerSheetProps {
  order: ManualShiftOrder;
  onClose: () => void;
}

export function AssignPickerSheet({ order, onClose }: AssignPickerSheetProps) {
  const [freePickerName, setFreePickerName] = useState(order.pickerWorkerId ? '' : (order.pickerName ?? ''));
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(order.pickerWorkerId ?? null);
  const patchOrder = usePatchManualShiftOrder();
  const { data: workers = [] } = useQuery(shiftWorkersQueryOptions(order.shiftId));
  const activeWorkers = useMemo(() => workers.filter((worker) => worker.active), [workers]);

  const hasPicker = Boolean(order.pickerName);

  function saveWorker(workerId: string) {
    patchOrder.mutate(
      {
        orderId: order.id,
        lineId: order.lineId,
        shiftId: order.shiftId,
        pickerWorkerId: workerId
      },
      { onSuccess: onClose }
    );
  }

  function saveFreeText() {
    patchOrder.mutate(
      {
        orderId: order.id,
        lineId: order.lineId,
        shiftId: order.shiftId,
        pickerWorkerId: null,
        pickerName: freePickerName.trim() || null
      },
      { onSuccess: onClose }
    );
  }

  function clearPicker() {
    patchOrder.mutate(
      {
        orderId: order.id,
        lineId: order.lineId,
        shiftId: order.shiftId,
        pickerWorkerId: null,
        pickerName: null
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col pb-16" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={onClose} className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500">
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-xl flex-1">{hasPicker ? 'שנה מלקט' : 'הקצה מלקט'}</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
        {order.pickerName && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-500">מלקט נוכחי: </span>
            <span className="font-bold text-gray-900">{order.pickerName}</span>
          </div>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="font-bold text-gray-800">עובדים פעילים במשמרת</h3>
          {activeWorkers.length === 0 && (
            <p className="text-sm text-gray-500">אין עובדים פעילים כרגע.</p>
          )}
          <div className="flex flex-col gap-2">
            {activeWorkers.map((worker) => (
              <button
                key={worker.id}
                type="button"
                onClick={() => {
                  setSelectedWorkerId(worker.id);
                  saveWorker(worker.id);
                }}
                disabled={patchOrder.isPending}
                className={`h-12 rounded-xl border px-4 text-right font-bold disabled:opacity-50 ${
                  selectedWorkerId === worker.id
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-800'
                }`}
              >
                {worker.name}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="font-bold text-gray-800">שם חופשי</h3>
          <input
            type="text"
            value={freePickerName}
            onChange={(e) => setFreePickerName(e.target.value)}
            placeholder="שם המלקט"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-12"
          />
          <button
            type="button"
            onClick={saveFreeText}
            disabled={patchOrder.isPending}
            className="h-12 rounded-xl bg-gray-900 text-white font-bold disabled:opacity-50"
          >
            שמור שם חופשי
          </button>
        </section>

        <button
          type="button"
          onClick={clearPicker}
          disabled={patchOrder.isPending}
          className="h-12 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold disabled:opacity-50"
        >
          נקה מלקט
        </button>
      </main>
    </div>
  );
}

