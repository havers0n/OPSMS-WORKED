import { Loader2 } from 'lucide-react';
import type { ManualShiftSession } from '@wos/domain';

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(new Date(year, month - 1, day));
}

interface DemandTargetDateSelectorProps {
  targetDate: string | null;
  targetShift: ManualShiftSession | null;
  isTargetShiftLoading: boolean;
  onSelectTargetDate: () => void;
  onCreateTargetShift: () => void;
  isCreatingShift: boolean;
  onNavigateToAppend: (shiftId: string) => void;
}

export function DemandTargetDateSelector({
  targetDate,
  targetShift,
  isTargetShiftLoading,
  onSelectTargetDate,
  onCreateTargetShift,
  isCreatingShift,
  onNavigateToAppend,
}: DemandTargetDateSelectorProps) {
  if (!targetDate) {
    return (
      <div className="flex items-center gap-2" dir="rtl">
        <span className="text-xs text-gray-500">בחר תאריך עבודה</span>
        <button
          type="button"
          onClick={onSelectTargetDate}
          className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          aria-label="בחר תאריך עבודה"
        >
          בחר תאריך
        </button>
      </div>
    );
  }

  if (isTargetShiftLoading) {
    return (
      <div className="flex items-center gap-2" dir="rtl">
        <Loader2 size={14} className="animate-spin text-gray-400" />
        <span className="text-xs text-gray-500">{formatDisplayDate(targetDate)}</span>
      </div>
    );
  }

  if (!targetShift) {
    return (
      <div className="flex items-center gap-2" dir="rtl">
        <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
          תאריך עבודה: {formatDisplayDate(targetDate)}
        </span>
        <span className="text-xs text-red-600">אין משמרת לתאריך הזה</span>
        <button
          type="button"
          onClick={onCreateTargetShift}
          disabled={isCreatingShift}
          className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
          aria-label="פתח צור משמרת לתאריך"
        >
          {isCreatingShift ? 'פותח משמרת...' : 'פתח/צור משמרת לתאריך'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" dir="rtl">
      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        תאריך עבודה: {formatDisplayDate(targetDate)}
      </span>
      <span className="rounded border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
        משמרת פעילה נמצאה
      </span>
      {targetShift.name && (
        <span className="text-xs text-gray-500 truncate max-w-[120px]">
          {targetShift.name}
        </span>
      )}
      <button
        type="button"
        onClick={() => onNavigateToAppend(targetShift.id)}
        className="rounded-md border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
      >
        הוסף לקווים קיימים
      </button>
    </div>
  );
}
