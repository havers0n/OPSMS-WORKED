import { useState, type ChangeEvent } from 'react';
import type { ManualShiftMonthlyApplyResponse, ManualShiftMonthlyPreview } from '@wos/domain';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import {
  useApplyManualShiftMonthlyImport,
  usePreviewManualShiftMonthlyImport
} from '@/entities/manual-shift/api/mutations';
import { BffRequestError } from '@/shared/api/bff/client';
import { translateBffError } from '@/shared/i18n';

interface MonthlyImportPreviewSheetProps {
  shiftId: string;
  selectedDate: string;
  onClose: () => void;
  onSuccess: (result: ManualShiftMonthlyApplyResponse) => void;
}

function severityClass(severity: 'info' | 'warning' | 'blocking') {
  if (severity === 'blocking') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-blue-200 bg-blue-50 text-blue-800';
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <p>
      <span className="font-medium">{label}:</span> {value}
    </p>
  );
}

export function MonthlyImportPreviewSheet({
  shiftId,
  selectedDate,
  onClose,
  onSuccess
}: MonthlyImportPreviewSheetProps) {
  const previewMutation = usePreviewManualShiftMonthlyImport(selectedDate);
  const applyMutation = useApplyManualShiftMonthlyImport(selectedDate);
  const [preview, setPreview] = useState<ManualShiftMonthlyPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isBlocking = previewMutation.isPending || applyMutation.isPending;
  const blockingWarnings = preview?.warnings.filter((warning) => warning.severity === 'blocking') ?? [];
  const previewErrorCode =
    previewMutation.error instanceof BffRequestError ? previewMutation.error.code : null;
  const applyErrorCode = applyMutation.error instanceof BffRequestError ? applyMutation.error.code : null;

  async function handleSelectFile(file: File | null) {
    if (!file) return;
    setErrorMessage(null);
    setPreview(null);
    setSelectedFile(file);
    try {
      const response = await previewMutation.mutateAsync(file);
      setPreview(response.preview);
    } catch (error) {
      setSelectedFile(null);
      setErrorMessage(translateBffError(error));
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    void handleSelectFile(file);
    input.value = '';
  }

  async function handleApply() {
    if (!selectedFile || !preview || blockingWarnings.length > 0) return;
    setErrorMessage(null);
    try {
      const response = await applyMutation.mutateAsync({
        shiftId,
        file: selectedFile
      });
      onSuccess(response);
      onClose();
    } catch (error) {
      setErrorMessage(translateBffError(error));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={isBlocking ? undefined : onClose} aria-hidden="true" />
      <div className="relative flex h-[100dvh] w-full max-w-[430px] flex-col bg-white">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">תצוגה מקדימה חודשית</h2>
            <p className="text-sm text-gray-500">ייבוא חודשי לפי תאריך המשמרת שנבחרה</p>
          </div>
          <button
            onClick={onClose}
            disabled={isBlocking}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 disabled:opacity-40"
            aria-label="סגור תצוגה מקדימה חודשית"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {errorMessage && (
            <div className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {errorMessage}
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-gray-200 p-4">
            <p className="font-medium text-gray-900">בחר קובץ אקסל חודשי</p>
            <p className="text-sm text-gray-500">תאריך המשמרת שנבחר: {selectedDate}</p>
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
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
              <Loader2 size={16} className="animate-spin" />
              מחשב תצוגה מקדימה חודשית...
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              {blockingWarnings.length > 0 && (
                <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>יש אזהרות שחוסמות את הייבוא. תקן את הקובץ לפני ההמשך.</div>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <StatRow label="קובץ" value={preview.source.fileName} />
                <StatRow label="גיליון" value={preview.source.sheetName} />
                <StatRow label="תאריך משמרת" value={preview.selectedDate.normalized} />
                <StatRow
                  label="תאריך בקובץ"
                  value={preview.selectedDate.raw ?? 'לא נמצא תאריך בקובץ'}
                />
              </div>

              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <p className="font-medium text-gray-900">סיכום תאריכים</p>
                <StatRow label="סה&quot;כ שורות" value={preview.dateSummary.totalRows} />
                <StatRow label="שורות תואמות" value={preview.dateSummary.matchingRows} />
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-2 text-sm font-medium text-gray-900">תאריכים זמינים בקובץ</p>
                <div className="space-y-1 text-sm text-gray-700">
                  {preview.dateSummary.availableDates.map((entry) => (
                    <div key={entry.normalized} className="flex items-center justify-between gap-3">
                      <span>
                        {entry.raw} ({entry.normalized})
                      </span>
                      <span>{entry.rows}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-2 text-sm font-medium text-gray-900">מדדים</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>קווים: {preview.totals.lines}</div>
                  <div>ערכי קו/הפצה: {preview.totals.rawDistributionValues}</div>
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
                <p className="mb-2 text-sm font-medium text-gray-900">אזהרות וחריגות</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>שורות עם כמות שלילית: {preview.anomalies.negativeQuantityRows}</div>
                  <div>שורות שאינן SO: {preview.anomalies.nonSoOrderRows}</div>
                  <div>שורות ללא / בערך הפצה: {preview.anomalies.rowsWithoutDistributionSlash}</div>
                  <div>שורות fallback: {preview.anomalies.pointFallbackRows}</div>
                  <div>שורות הערת איסוף: {preview.anomalies.pickupNoteRows}</div>
                  <div>שורות הערת השלמה: {preview.anomalies.ashlamaNoteRows}</div>
                  <div>שורות עם תאריך הפצה לא תקין: {preview.anomalies.invalidDistributionDateRows.length}</div>
                  <div className="col-span-2">שדות חובה חסרים: {preview.anomalies.missingRequiredFields.length}</div>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  {preview.warnings.map((warning) => (
                    <div
                      key={warning.code + '-' + warning.severity}
                      className={'rounded-xl border p-3 text-sm ' + severityClass(warning.severity)}
                    >
                      <div className="font-medium">{warning.message}</div>
                      {warning.count !== undefined && <div>כמות: {warning.count}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-gray-900">
                  פירוט לפי קו
                </div>
                <div className="divide-y divide-gray-100">
                  {preview.lines.map((line) => (
                    <div key={line.lineName} className="space-y-1 p-4 text-sm text-gray-700">
                      <p className="font-medium text-gray-900">{line.lineName}</p>
                      <p>
                        נקודות: {line.points} | מספרי הזמנה ייחודיים: {line.uniqueOrderNumbers} | קבוצות הזמנה:{' '}
                        {line.orderGroups}
                      </p>
                      <p>
                        שורות פריט: {line.itemRows} | קבוצות SKU מאוגדות: {line.aggregatedSkuGroups} | SKU ייחודיים:{' '}
                        {line.uniqueSkus}
                      </p>
                      <p>כמות כוללת: {line.totalQuantity}</p>
                      <p>שורות עם כמות שלילית: {line.negativeQuantityRows} | מספר חריגות: {line.anomalyCount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 space-y-3 border-t border-gray-200 bg-white p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isBlocking}
            className="w-full min-h-12 rounded-xl border border-gray-300 font-medium text-gray-700 disabled:opacity-40"
          >
            סגור
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={!selectedFile || blockingWarnings.length > 0 || isBlocking}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 font-medium text-white disabled:opacity-40"
            >
              {applyMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {applyMutation.isPending ? 'מייבא...' : 'אשר ייבוא'}
            </button>
          )}
        </div>
      </div>

      {(previewErrorCode || applyErrorCode) && <span className="hidden">{previewErrorCode ?? applyErrorCode}</span>}
    </div>
  );
}
