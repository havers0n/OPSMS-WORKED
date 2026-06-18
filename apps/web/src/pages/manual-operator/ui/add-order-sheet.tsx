import { useState } from 'react';
import { ArrowRight, ChevronDown } from 'lucide-react';
import type { ManualShiftOrderSize, ManualShiftWorker } from '@wos/domain';
import { useQuery } from '@tanstack/react-query';
import { useCreateManualShiftOrder } from '@/entities/manual-shift/api/mutations';
import { shiftWorkersQueryOptions } from '@/entities/manual-shift/api/queries';

interface AddOrderSheetProps {
  lineId: string;
  shiftId: string;
  onClose: () => void;
}

const SIZES: ManualShiftOrderSize[] = ['S', 'M', 'L', 'XL'];

function calculateSize(lineCount: number): ManualShiftOrderSize {
  if (lineCount <= 3) return 'S';
  if (lineCount <= 8) return 'M';
  if (lineCount <= 20) return 'L';
  return 'XL';
}

export function AddOrderSheet({ lineId, shiftId, onClose }: AddOrderSheetProps) {
  const [pointName, setPointName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [pickerMode, setPickerMode] = useState<'worker' | 'free'>('worker');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [freePickerName, setFreePickerName] = useState('');
  const [lineCountStr, setLineCountStr] = useState('');
  const [palletCountStr, setPalletCountStr] = useState('');
  const [manualSize, setManualSize] = useState<ManualShiftOrderSize | null>(null);

  const { data: workers } = useQuery(shiftWorkersQueryOptions(shiftId));
  const activeWorkers = (workers ?? []).filter((w) => w.active);

  const createOrder = useCreateManualShiftOrder(lineId, shiftId);

  const lineCount = lineCountStr ? parseInt(lineCountStr, 10) : null;
  const autoSize: ManualShiftOrderSize | null =
    lineCount != null && !isNaN(lineCount) && lineCount > 0 ? calculateSize(lineCount) : null;
  const effectiveSize = manualSize ?? autoSize;

  const selectedWorker: ManualShiftWorker | null =
    activeWorkers.find((w) => w.id === selectedWorkerId) ?? null;

  const effectivePickerMode = activeWorkers.length === 0 ? 'free' : pickerMode;

  const resolvedPickerName =
    effectivePickerMode === 'worker'
      ? (selectedWorker?.name ?? null)
      : (freePickerName.trim() || null);

  const resolvedPickerWorkerId =
    effectivePickerMode === 'worker' ? selectedWorkerId : null;

  const canSubmit = pointName.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const palletRaw = palletCountStr !== '' ? parseFloat(palletCountStr) : null;
    const palletCount = palletRaw != null && !isNaN(palletRaw) ? palletRaw : null;
    createOrder.mutate(
      {
        pointName: pointName.trim(),
        orderNumber: orderNumber.trim() || null,
        pickerName: resolvedPickerName,
        pickerWorkerId: resolvedPickerWorkerId,
        lineCount: lineCount != null && !isNaN(lineCount) && lineCount > 0 ? lineCount : null,
        palletCount,
        size: effectiveSize ?? undefined,
        status: 'queued'
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="absolute inset-0 bg-white z-20 flex flex-col pb-16" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500"
        >
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-xl flex-1 text-gray-900">הזמנה חדשה</h2>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-right"
      >
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">נקודה</label>
          <input
            type="text"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg"
            placeholder="שם הנקודה"
            value={pointName}
            onChange={e => setPointName(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">קוד / מספר (אופציונלי)</label>
          <input
            type="text"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg"
            placeholder="קוד / מספר (אופציונלי)"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            dir="ltr"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="font-bold text-gray-700">מלקט</label>
            {activeWorkers.length > 0 && (
              <div className="flex gap-1 text-xs">
                <button
                  type="button"
                  onClick={() => setPickerMode('worker')}
                  className={`px-2 py-0.5 rounded-full font-medium transition-colors ${pickerMode === 'worker' ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                >
                  מרשימה
                </button>
                <button
                  type="button"
                  onClick={() => setPickerMode('free')}
                  className={`px-2 py-0.5 rounded-full font-medium transition-colors ${pickerMode === 'free' ? 'bg-gray-900 text-white' : 'text-gray-500'}`}
                >
                  חופשי
                </button>
              </div>
            )}
          </div>

          {(pickerMode === 'worker' && activeWorkers.length > 0) ? (
            <WorkerPicker
              workers={activeWorkers}
              selectedId={selectedWorkerId}
              onSelect={setSelectedWorkerId}
            />
          ) : (
            <input
              type="text"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg"
              placeholder="שם המלקט (אופציונלי)"
              value={freePickerName}
              onChange={e => setFreePickerName(e.target.value)}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-gray-700">מספר שורות</label>
            <input
              type="number"
              min="1"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-2xl text-center"
              placeholder="0"
              value={lineCountStr}
              onChange={e => setLineCountStr(e.target.value.replace(/\D/g, ''))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-bold text-gray-700 flex justify-between items-center">
              <span>גודל</span>
              {manualSize && (
                <button
                  type="button"
                  onClick={() => setManualSize(null)}
                  className="text-xs text-blue-600 font-medium"
                >
                  אוטומטי
                </button>
              )}
              {!manualSize && autoSize && (
                <span className="text-xs text-gray-400 font-normal">אוטומטי</span>
              )}
            </label>
            <div className="grid grid-cols-4 gap-1">
              {SIZES.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setManualSize(s === manualSize ? null : s)}
                  className={`h-14 rounded-xl font-bold text-lg transition-colors ${
                    effectiveSize === s
                      ? manualSize
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-900 text-white'
                      : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">מספר משטחים</label>
          <input
            type="number"
            min="0"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg text-center"
            placeholder="מספר משטחים (אופציונלי)"
            value={palletCountStr}
            onChange={e => setPalletCountStr(e.target.value)}
          />
        </div>

        <div className="pb-4">
          <button
            type="submit"
            disabled={createOrder.isPending || !canSubmit}
            className="w-full bg-gray-900 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {createOrder.isPending ? 'שומר...' : 'הוסף הזמנה'}
          </button>
        </div>
      </form>
    </div>
  );
}

function WorkerPicker({
  workers,
  selectedId,
  onSelect
}: {
  workers: ManualShiftWorker[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = workers.find((w) => w.id === selectedId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg flex items-center justify-between"
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected ? selected.name : 'בחר מלקט (אופציונלי)'}
        </span>
        <ChevronDown size={20} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
          <button
            type="button"
            onClick={() => { onSelect(null); setOpen(false); }}
            className="w-full text-right px-4 py-3 text-sm text-gray-400 hover:bg-gray-50 active:bg-gray-100 border-b border-gray-100"
          >
            ללא מלקט
          </button>
          {workers.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => { onSelect(w.id); setOpen(false); }}
              className={`w-full text-right px-4 py-3 font-bold text-base hover:bg-gray-50 active:bg-gray-100 ${
                w.id === selectedId ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
              }`}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
