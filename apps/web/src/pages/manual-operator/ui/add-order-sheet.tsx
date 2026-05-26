import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ManualShiftOrderSize } from '@wos/domain';
import { useCreateManualShiftOrder } from '@/entities/manual-shift/api/mutations';

interface AddOrderSheetProps {
  lineId: string;
  onClose: () => void;
}

const SIZES: ManualShiftOrderSize[] = ['S', 'M', 'L', 'XL'];

function calculateSize(lineCount: number): ManualShiftOrderSize {
  if (lineCount <= 3) return 'S';
  if (lineCount <= 8) return 'M';
  if (lineCount <= 20) return 'L';
  return 'XL';
}

export function AddOrderSheet({ lineId, onClose }: AddOrderSheetProps) {
  const [pointName, setPointName] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [pickerName, setPickerName] = useState('');
  const [lineCountStr, setLineCountStr] = useState('');
  const [palletCountStr, setPalletCountStr] = useState('');
  const [manualSize, setManualSize] = useState<ManualShiftOrderSize | null>(null);

  const createOrder = useCreateManualShiftOrder(lineId);

  const lineCount = lineCountStr ? parseInt(lineCountStr, 10) : null;
  const autoSize: ManualShiftOrderSize | null =
    lineCount != null && !isNaN(lineCount) && lineCount > 0 ? calculateSize(lineCount) : null;
  const effectiveSize = manualSize ?? autoSize;

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
        pickerName: pickerName.trim() || null,
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
          <label className="font-bold text-gray-700">מלקט</label>
          <input
            type="text"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-lg"
            placeholder="שם המלקט (אופציונלי)"
            value={pickerName}
            onChange={e => setPickerName(e.target.value)}
          />
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
