import type { CheckQueue, PickerWorkload } from '@/entities/manual-shift/model/shift-selectors';

const UNASSIGNED_LABEL = 'לא משויך';

interface DesktopPickerPanelProps {
  pickers: PickerWorkload[];
  checkQueue: CheckQueue;
  onSelectPicker?: (pickerKey: string) => void;
}

function formatWaitingAge(seconds: number | null): string {
  if (seconds === null) return '—';
  const m = Math.floor(seconds / 60);
  if (m < 1) return '< 1ד';
  if (m < 60) return `${m}ד`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}:${String(rem).padStart(2, '0')}`;
}

function formatHumanMinutes(minutes: number | null): string | null {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes}ד׳`;
  const h = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${h}ש׳` : `${h}ש׳ ${rem}ד׳`;
}

function PickerRow({
  picker,
  onSelectPicker
}: {
  picker: PickerWorkload;
  onSelectPicker?: (pickerKey: string) => void;
}) {
  const name = picker.pickerName ?? UNASSIGNED_LABEL;
  const timeLabel = formatHumanMinutes(picker.humanMinutes);
  return (
    <button
      type="button"
      className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 w-full text-right hover:bg-gray-50"
      onClick={() => onSelectPicker?.(picker.pickerKey)}
      aria-label={`פתח פרטי מלקט ${name}`}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {picker.totalLineCount} שורות
          {picker.wipCount > 0 && <span> · {picker.wipCount} פעיל</span>}
          {picker.done > 0 && <span> · {picker.done} הסתיימו</span>}
          {timeLabel !== null && <span> · ⏱ {timeLabel}</span>}
        </p>
      </div>
      {picker.waitingCheck > 0 && (
        <span className="shrink-0 text-xs bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
          {picker.waitingCheck}✓
        </span>
      )}
    </button>
  );
}

export function DesktopPickerPanel({ pickers, checkQueue, onSelectPicker }: DesktopPickerPanelProps) {
  return (
    <div>
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">מלקטים</p>
      </div>

      {checkQueue.count > 0 && (
        <div className="mx-3 mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 font-bold text-sm">{checkQueue.count} ממתינים לבדיקה</p>
          {checkQueue.oldestOrder && (
            <p className="text-amber-600 text-xs mt-0.5">
              זמן המתנה: {formatWaitingAge(checkQueue.oldestOrder.waitingSeconds)}
            </p>
          )}
        </div>
      )}

      {pickers.length === 0 ? (
        <div className="flex items-center justify-center h-24 px-4">
          <p className="text-sm text-gray-400 text-center">אין מלקטים פעילים</p>
        </div>
      ) : (
        <div className="mt-2">
          {pickers.map((picker) => (
            <PickerRow key={picker.pickerKey} picker={picker} onSelectPicker={onSelectPicker} />
          ))}
        </div>
      )}
    </div>
  );
}
