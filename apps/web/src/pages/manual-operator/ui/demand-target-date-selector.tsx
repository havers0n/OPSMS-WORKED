import { Loader2 } from 'lucide-react';
import type { ManualShiftSession } from '@wos/domain';

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
}

interface DemandTargetDateSelectorProps {
  targetDate: string | null;
  targetShift: ManualShiftSession | null;
  lineCount: number;
  isTargetShiftLoading: boolean;
  onSelectTargetDate: () => void;
  onCreateTargetShift: () => void;
  isCreatingShift: boolean;
  onNavigateToAppend: (shiftId: string) => void;
}

export function DemandTargetDateSelector({
  targetDate,
  targetShift,
  lineCount,
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

  const hasExistingLines = lineCount > 0;

  return (
    <div className="flex items-center gap-2" dir="rtl">
      <span className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
        תאריך עבודה: {formatDisplayDate(targetDate)}
      </span>
      <span className="text-xs text-gray-500">
        {hasExistingLines ? `${lineCount} קווים קיימים` : 'משמרת קיימת'}
      </span>
      <button
        type="button"
        onClick={() => onNavigateToAppend(targetShift.id)}
        className="px-1 py-0.5 text-[11px] font-normal text-gray-400 underline underline-offset-2 hover:text-gray-600 transition-colors"
      >
        בדוק התאמה למשמרת
      </button>
    </div>
  );
}
