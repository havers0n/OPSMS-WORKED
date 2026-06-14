import type { ManualShiftLineSummary } from '@wos/domain';
import { LineCard } from './line-card';

interface LineListProps {
  lines: ManualShiftLineSummary[];
  onSelectLine: (summary: ManualShiftLineSummary) => void;
  canImport: boolean;
  canPreviewMonthly: boolean;
  canAddManual: boolean;
  onImportExcel: () => void;
  onPreviewMonthly: () => void;
  onAddLineManually: () => void;
  showNoShiftHint: boolean;
}

export function LineList({
  lines,
  onSelectLine,
  canImport,
  canPreviewMonthly,
  canAddManual,
  onImportExcel,
  onPreviewMonthly,
  onAddLineManually,
  showNoShiftHint
}: LineListProps) {
  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-8 text-center gap-3" dir="rtl">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-2xl">
          -
        </div>
        <p className="text-gray-700 font-medium">אין קווים בתור</p>
        {showNoShiftHint ? (
          <p className="text-gray-500 text-sm">צור או פתח משמרת לפני ייבוא קובץ האקסל.</p>
        ) : (
          <div className="w-full max-w-xs flex flex-col gap-2">
            {canPreviewMonthly && (
              <button
                type="button"
                onClick={onPreviewMonthly}
                className="w-full bg-gray-900 text-white font-medium py-3 rounded-xl"
              >
                תצוגה מקדימה חודשית
              </button>
            )}
            {canImport && (
              <button
                type="button"
                onClick={onImportExcel}
                className="w-full border border-gray-300 text-gray-800 font-medium py-3 rounded-xl"
              >
                ייבוא יומי קיים
              </button>
            )}
            {canAddManual && (
              <button
                type="button"
                onClick={onAddLineManually}
                className="w-full border border-gray-300 text-gray-800 font-medium py-3 rounded-xl"
              >
                הוסף קו ידנית
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 pb-8 flex flex-col gap-3" dir="rtl">
      {lines.map(summary => (
        <LineCard key={summary.line.id} summary={summary} onSelect={onSelectLine} />
      ))}
    </div>
  );
}
