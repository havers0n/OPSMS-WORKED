import type { ManualShiftLineSummary, ManualShiftMonthlyReplaceSafety } from '@wos/domain';
import { LineCard } from './line-card';
import { translate } from '@/shared/i18n';

interface LineListProps {
  lines: ManualShiftLineSummary[];
  onSelectLine: (summary: ManualShiftLineSummary) => void;
  canImport: boolean;
  canPreviewMonthly: boolean;
  canAddManual: boolean;
  canReImportMonthly: boolean;
  replaceSafety: ManualShiftMonthlyReplaceSafety | null;
  onImportExcel: () => void;
  onPreviewMonthly: () => void;
  onAddLineManually: () => void;
  showNoShiftHint: boolean;
}

function formatBlockReasons(reasons: string[]): string {
  const labelMap: Record<string, string> = {
    orders_started: translate('monthlyImport.blockReason.ordersStarted'),
    picker_assigned: translate('monthlyImport.blockReason.pickerAssigned'),
    checker_assigned: translate('monthlyImport.blockReason.checkerAssigned'),
    check_units_exist: translate('monthlyImport.blockReason.checkUnitsExist'),
    non_import_events_exist: translate('monthlyImport.blockReason.nonImportEventsExist')
  };
  return reasons.map((r) => labelMap[r] ?? r).join('\n');
}

export function LineList({
  lines,
  onSelectLine,
  canImport,
  canPreviewMonthly,
  canAddManual,
  canReImportMonthly,
  replaceSafety,
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
      {canReImportMonthly && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 space-y-2">
          <p className="font-medium">{translate('monthlyImport.existingWork')}</p>
          {replaceSafety && !replaceSafety.canReplace && (
            <>
              <p className="font-medium text-red-700">{translate('monthlyImport.blocked')}</p>
              <p className="whitespace-pre-line text-red-700 text-xs">
                {formatBlockReasons(replaceSafety.blockReasons)}
              </p>
            </>
          )}
          {replaceSafety?.canReplace !== false && (
            <button
              type="button"
              onClick={onPreviewMonthly}
              className="w-full bg-gray-900 text-white font-medium py-2.5 rounded-xl"
            >
              {translate('monthlyImport.replaceAction')}
            </button>
          )}
        </div>
      )}
      {lines.map(summary => (
        <LineCard key={summary.line.id} summary={summary} onSelect={onSelectLine} />
      ))}
    </div>
  );
}
