import { useState, type ChangeEvent } from 'react';
import type { ManualShiftMonthlyPreview } from '@wos/domain';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { usePreviewManualShiftMonthlyImport } from '@/entities/manual-shift/api/mutations';
import { BffRequestError } from '@/shared/api/bff/client';
import { translateBffError } from '@/shared/i18n';

interface MonthlyImportPreviewSheetProps {
  selectedDate: string;
  onClose: () => void;
}

function severityClass(severity: 'info' | 'warning' | 'blocking') {
  if (severity === 'blocking') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-blue-200 bg-blue-50 text-blue-800';
}

export function MonthlyImportPreviewSheet({ selectedDate, onClose }: MonthlyImportPreviewSheetProps) {
  const previewMutation = usePreviewManualShiftMonthlyImport(selectedDate);
  const [preview, setPreview] = useState<ManualShiftMonthlyPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBlocking = previewMutation.isPending;
  const blockingWarnings = preview?.warnings.filter((warning) => warning.severity === 'blocking') ?? [];
  const previewErrorCode =
    previewMutation.error instanceof BffRequestError ? previewMutation.error.code : null;

  async function handleSelectFile(file: File | null) {
    if (!file) return;
    setErrorMessage(null);
    setPreview(null);
    try {
      const response = await previewMutation.mutateAsync(file);
      setPreview(response.preview);
    } catch (error) {
      setErrorMessage(translateBffError(error));
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    void handleSelectFile(file);
    input.value = '';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={isBlocking ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[430px] h-[100dvh] bg-white flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-gray-900">תצוגה מקדימה חודשית</h2>
            <p className="text-sm text-gray-500">Batch 2 preview only</p>
          </div>
          <button
            onClick={onClose}
            disabled={isBlocking}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 disabled:opacity-40"
            aria-label="סגור תצוגה מקדימה חודשית"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMessage && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm p-3 whitespace-pre-line">
              {errorMessage}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="font-medium text-gray-900">בחר קובץ אקסל חודשי</p>
            <p className="text-sm text-gray-500">תאריך נבחר מהמשמרת: {selectedDate}</p>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isBlocking}
              aria-label="בחר קובץ אקסל חודשי"
              onChange={handleFileInputChange}
              className="w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
          </div>

          {previewMutation.isPending && (
            <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-700">
              <Loader2 size={16} className="animate-spin" />
              מנתח את הקובץ החודשי...
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              {blockingWarnings.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>יש אזהרות חוסמות. Apply Import לא זמין בבאץ׳ הזה.</div>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <p><span className="font-medium">קובץ:</span> {preview.source.fileName}</p>
                <p><span className="font-medium">גיליון:</span> {preview.source.sheetName}</p>
                <p><span className="font-medium">תאריך נבחר:</span> {preview.selectedDate.normalized}</p>
                <p><span className="font-medium">תאריך גלם:</span> {preview.selectedDate.raw ?? 'לא נמצא'}</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <p><span className="font-medium">סה״כ שורות:</span> {preview.dateSummary.totalRows}</p>
                <p><span className="font-medium">שורות תואמות:</span> {preview.dateSummary.matchingRows}</p>
                <p><span className="font-medium">שורות מדולגות:</span> {preview.dateSummary.skippedOtherDateRows}</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="font-medium text-sm text-gray-900 mb-2">תאריכים זמינים</p>
                <div className="space-y-1 text-sm text-gray-700">
                  {preview.dateSummary.availableDates.map((entry) => (
                    <div key={entry.normalized} className="flex items-center justify-between gap-3">
                      <span>{entry.raw} ({entry.normalized})</span>
                      <span>{entry.rows}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="font-medium text-sm text-gray-900 mb-2">מדדים</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>קווים: {preview.totals.lines}</div>
                  <div>ערכי קו גולמיים: {preview.totals.rawDistributionValues}</div>
                  <div>נקודות נגזרות: {preview.totals.derivedPoints}</div>
                  <div>מספרי הזמנה ייחודיים: {preview.totals.uniqueOrderNumbers}</div>
                  <div>קבוצות הזמנה: {preview.totals.orderGroups}</div>
                  <div>שורות SKU: {preview.totals.skuRows}</div>
                  <div>קבוצות SKU מאוגדות: {preview.totals.aggregatedSkuGroups}</div>
                  <div>SKU ייחודיים: {preview.totals.uniqueSkus}</div>
                  <div>כמות כוללת: {preview.totals.totalQuantity}</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="font-medium text-sm text-gray-900 mb-2">אנומליות</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>כמויות שליליות: {preview.anomalies.negativeQuantityRows}</div>
                  <div>לא-SO: {preview.anomalies.nonSoOrderRows}</div>
                  <div>ללא / בקו: {preview.anomalies.rowsWithoutDistributionSlash}</div>
                  <div>fallback מלקוח: {preview.anomalies.pointFallbackRows}</div>
                  <div>איסוף: {preview.anomalies.pickupNoteRows}</div>
                  <div>השלמה: {preview.anomalies.ashlamaNoteRows}</div>
                  <div>תאריכי הפצה לא תקינים: {preview.anomalies.invalidDistributionDateRows.length}</div>
                  <div className="col-span-2">שדות חובה חסרים: {preview.anomalies.missingRequiredFields.length}</div>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  {preview.warnings.map((warning) => (
                    <div key={`${warning.code}-${warning.severity}`} className={`rounded-xl border p-3 text-sm ${severityClass(warning.severity)}`}>
                      <div className="font-medium">{warning.message}</div>
                      {warning.count !== undefined && <div>כמות: {warning.count}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 text-sm font-medium text-gray-900">
                  סיכום לפי קו
                </div>
                <div className="divide-y divide-gray-100">
                  {preview.lines.map((line) => (
                    <div key={line.lineName} className="p-4 text-sm space-y-1">
                      <p className="font-medium text-gray-900">{line.lineName}</p>
                      <p>נקודות: {line.points} | הזמנות ייחודיות: {line.uniqueOrderNumbers} | קבוצות הזמנה: {line.orderGroups}</p>
                      <p>שורות פריט: {line.itemRows} | קבוצות SKU מאוגדות: {line.aggregatedSkuGroups} | SKU ייחודיים: {line.uniqueSkus}</p>
                      <p>כמות כוללת: {line.totalQuantity}</p>
                      <p>שורות שליליות: {line.negativeQuantityRows} | אנומליות: {line.anomalyCount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isBlocking}
            className="w-full min-h-12 rounded-xl border border-gray-300 text-gray-700 font-medium disabled:opacity-40"
          >
            סגור
          </button>
        </div>
      </div>

      {previewErrorCode && <span className="hidden">{previewErrorCode}</span>}
    </div>
  );
}
