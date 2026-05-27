import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { ManualShiftOrder, ManualShiftOrderSize } from '@wos/domain';
import { calculateSizeFromLineCount } from '@wos/domain';
import { usePatchManualShiftOrder } from '@/entities/manual-shift/api/mutations';

interface EditOrderSheetProps {
  order: ManualShiftOrder;
  onClose: () => void;
}

const SIZES: ManualShiftOrderSize[] = ['S', 'M', 'L', 'XL'];

/** Convert ISO string to datetime-local input value (YYYY-MM-DDTHH:MM) */
function isoToDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

/** Convert datetime-local input value to ISO string */
function datetimeLocalToIso(value: string): string | null {
  if (!value) return null;
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

export function EditOrderSheet({ order, onClose }: EditOrderSheetProps) {
  const [lineCountStr, setLineCountStr] = useState(
    order.lineCount != null ? String(order.lineCount) : ''
  );
  const [palletCountStr, setPalletCountStr] = useState(
    order.palletCount != null ? String(order.palletCount) : ''
  );
  const [startedAtLocal, setStartedAtLocal] = useState(
    isoToDatetimeLocal(order.startedAt)
  );
  const [finishedAtLocal, setFinishedAtLocal] = useState(
    isoToDatetimeLocal(order.finishedAt)
  );
  const [checkedAtLocal, setCheckedAtLocal] = useState(
    isoToDatetimeLocal(order.checkedAt)
  );
  const [manualSize, setManualSize] = useState<ManualShiftOrderSize | null>(null);

  const patchOrder = usePatchManualShiftOrder();

  const lineCount = lineCountStr ? parseInt(lineCountStr, 10) : null;
  const autoSize: ManualShiftOrderSize | null =
    lineCount != null && !isNaN(lineCount) && lineCount > 0
      ? calculateSizeFromLineCount(lineCount)
      : null;
  const effectiveSize = manualSize ?? autoSize ?? order.size;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const parsedLineCount =
      lineCountStr !== '' && !isNaN(parseInt(lineCountStr, 10)) && parseInt(lineCountStr, 10) > 0
        ? parseInt(lineCountStr, 10)
        : null;

    const parsedPalletCount =
      palletCountStr !== '' && !isNaN(parseFloat(palletCountStr))
        ? parseFloat(palletCountStr)
        : null;

    const parsedStartedAt = startedAtLocal ? datetimeLocalToIso(startedAtLocal) : null;
    const parsedFinishedAt = finishedAtLocal ? datetimeLocalToIso(finishedAtLocal) : null;
    const parsedCheckedAt = checkedAtLocal ? datetimeLocalToIso(checkedAtLocal) : null;

    patchOrder.mutate(
      {
        orderId: order.id,
        lineId: order.lineId,
        shiftId: order.shiftId,
        lineCount: parsedLineCount,
        palletCount: parsedPalletCount,
        startedAt: parsedStartedAt,
        finishedAt: parsedFinishedAt,
        checkedAt: parsedCheckedAt
      },
      { onSuccess: onClose }
    );
  }

  return (
    <div className="absolute inset-0 bg-white z-30 flex flex-col pb-16" dir="rtl">
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 bg-gray-50 shrink-0">
        <button
          onClick={onClose}
          className="p-2 -m-2 rounded-full active:bg-gray-200 transition-colors text-gray-500"
        >
          <ArrowRight size={24} />
        </button>
        <h2 className="font-bold text-xl flex-1 text-gray-900">עריכת הזמנה</h2>
        <span className="text-sm text-gray-500 font-medium truncate max-w-[140px]">
          {order.pointName ?? ''}
        </span>
      </header>

      <form
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 text-right"
      >
        {/* Line count + Size */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="font-bold text-gray-700">מספר שורות</label>
            <input
              type="number"
              min="1"
              className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-2xl text-center"
              placeholder="0"
              value={lineCountStr}
              onChange={(e) => {
                setManualSize(null);
                setLineCountStr(e.target.value.replace(/\D/g, ''));
              }}
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
              {SIZES.map((s) => (
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

        {/* Pallet count */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">מספר משטחים</label>
          <input
            type="number"
            min="0"
            step="0.5"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-2xl text-center"
            placeholder="0"
            value={palletCountStr}
            onChange={(e) => setPalletCountStr(e.target.value)}
          />
        </div>

        {/* Started at */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">זמן התחלת ליקוט</label>
          <p className="text-xs text-gray-400 -mt-1">
            ידנית, אם הליקוט החל לפני שהוקלד במערכת
          </p>
          <input
            type="datetime-local"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-base"
            value={startedAtLocal}
            onChange={(e) => setStartedAtLocal(e.target.value)}
            dir="ltr"
          />
          {startedAtLocal && (
            <button
              type="button"
              onClick={() => setStartedAtLocal('')}
              className="text-xs text-red-500 font-medium self-start"
            >
              נקה זמן התחלה
            </button>
          )}
        </div>

        {/* Finished at */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">זמן סיום הזמנה</label>
          <p className="text-xs text-gray-400 -mt-1">
            ידנית, אם הסיום חל לפני שהוקלד במערכת
          </p>
          <input
            type="datetime-local"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-base"
            value={finishedAtLocal}
            onChange={(e) => setFinishedAtLocal(e.target.value)}
            dir="ltr"
          />
          {finishedAtLocal && (
            <button
              type="button"
              onClick={() => setFinishedAtLocal('')}
              className="text-xs text-red-500 font-medium self-start"
            >
              נקה זמן סיום
            </button>
          )}
        </div>

        {/* Checked at */}
        <div className="flex flex-col gap-2">
          <label className="font-bold text-gray-700">זמן בדיקה</label>
          <p className="text-xs text-gray-400 -mt-1">
            ידנית, אם הבדיקה התבצעה לפני שהוקלדה במערכת
          </p>
          <input
            type="datetime-local"
            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 h-14 font-bold text-base"
            value={checkedAtLocal}
            onChange={(e) => setCheckedAtLocal(e.target.value)}
            dir="ltr"
          />
          {checkedAtLocal && (
            <button
              type="button"
              onClick={() => setCheckedAtLocal('')}
              className="text-xs text-red-500 font-medium self-start"
            >
              נקה זמן בדיקה
            </button>
          )}
        </div>

        <div className="pb-4 pt-2">
          <button
            type="submit"
            disabled={patchOrder.isPending}
            className="w-full bg-gray-900 text-white rounded-xl h-14 font-bold text-lg active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {patchOrder.isPending ? 'שומר...' : 'שמור שינויים'}
          </button>
        </div>
      </form>
    </div>
  );
}
