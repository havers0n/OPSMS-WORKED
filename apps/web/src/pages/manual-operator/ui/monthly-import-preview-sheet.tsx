import { useState, type ChangeEvent } from 'react';
import type { ManualShiftMonthlyApplyResponse, ManualShiftMonthlyPreview, ManualShiftMonthlyReplaceSafety } from '@wos/domain';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import {
  useApplyManualShiftMonthlyImport,
  usePreviewManualShiftMonthlyImport
} from '@/entities/manual-shift/api/mutations';
import { BffRequestError } from '@/shared/api/bff/client';
import { translate, translateBffError } from '@/shared/i18n';

interface MonthlyImportPreviewSheetProps {
  shiftId: string;
  selectedDate: string;
  hasExistingWork: boolean;
  replaceSafety: ManualShiftMonthlyReplaceSafety | null;
  onClose: () => void;
  onSuccess: (result: ManualShiftMonthlyApplyResponse) => void;
}

function severityClass(severity: 'info' | 'warning' | 'blocking') {
  if (severity === 'blocking') return 'border-red-200 bg-red-50 text-red-800';
  if (severity === 'warning') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-blue-200 bg-blue-50 text-blue-800';
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
  hasExistingWork,
  replaceSafety,
  onClose,
  onSuccess
}: MonthlyImportPreviewSheetProps) {
  const previewMutation = usePreviewManualShiftMonthlyImport(selectedDate);
  const applyMutation = useApplyManualShiftMonthlyImport(selectedDate);
  const [preview, setPreview] = useState<ManualShiftMonthlyPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmedReplace, setConfirmedReplace] = useState(false);

  const isBlocking = previewMutation.isPending || applyMutation.isPending;
  const blockingWarnings = preview?.warnings.filter((warning) => warning.severity === 'blocking') ?? [];
  const previewErrorCode =
    previewMutation.error instanceof BffRequestError ? previewMutation.error.code : null;
  const applyErrorCode = applyMutation.error instanceof BffRequestError ? applyMutation.error.code : null;

  const isReplaceBlocked = hasExistingWork && replaceSafety && !replaceSafety.canReplace;
  const applyMode: 'initial' | 'replace' = hasExistingWork ? 'replace' : 'initial';

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
    if (hasExistingWork && !confirmedReplace) return;
    setErrorMessage(null);
    try {
      const response = await applyMutation.mutateAsync({
        shiftId,
        file: selectedFile,
        mode: applyMode
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
            <h2 className="text-lg font-bold text-gray-900">ייבוא הזמנות לתאריך נבחר</h2>
            <p className="text-sm text-gray-500">תצוגה מקדימה לפי תאריך המשמרת שנבחרה</p>
          </div>
          <button
            onClick={onClose}
            disabled={isBlocking}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 disabled:opacity-40"
            aria-label="סגור ייבוא הזמנות לתאריך נבחר"
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

          {isReplaceBlocked && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-medium">{translate('monthlyImport.blocked')}</p>
              <p className="whitespace-pre-line text-xs">
                {replaceSafety ? formatBlockReasons(replaceSafety.blockReasons) : ''}
              </p>
            </div>
          )}

          {hasExistingWork && !isReplaceBlocked && !confirmedReplace && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-medium">{translate('monthlyImport.existingWork')}</p>
              <p>{translate('monthlyImport.replaceWarning')}</p>
            </div>
          )}

          <div className="space-y-2 rounded-xl border border-gray-200 p-4">
            <p className="font-medium text-gray-900">ייבוא הזמנות לתאריך נבחר</p>
            <p className="text-sm text-gray-500">תאריך המשמרת שנבחר: {selectedDate}</p>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isBlocking}
              aria-label="ייבוא הזמנות לתאריך נבחר"
              onChange={handleFileInputChange}
              className="w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
          </div>

          {previewMutation.isPending && (
            <div className="flex items-center gap-2 rounded-xl border border-gray-200 p-4 text-sm text-gray-700">
              <Loader2 size={16} className="animate-spin" />
              מחשב תצוגה מקדימה...
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
                <StatRow label="גיליונות בקובץ" value={preview.source.availableSheets.join(', ')} />
                {preview.source.availableSheets.length > 1 && (
                  <p className="text-xs text-amber-700">הקובץ כולל גיליונות נוספים שלא יובאו בפעולה זו</p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <p className="font-medium text-gray-900">סיכום תאריכים</p>
                <StatRow label="סה&quot;כ שורות" value={preview.dateSummary.totalRows} />
                <StatRow label="שורות תואמות" value={preview.dateSummary.matchingRows} />
                <StatRow label="שורות רגילות לייבוא" value={preview.dateSummary.normalRows} />
                <StatRow label="שורות מתאריך אחר שנדחו" value={preview.dateSummary.skippedOtherDateRows} />
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
                  <div>כמות כוללת באקסל: {preview.totals.rawTotalQuantity}</div>
                  <div>כמות חיובית (תיכנס לעבודה): {preview.totals.positiveTotalQuantity}</div>
                  <div>שורות חיוביות רגילות: {preview.dateSummary.normalRows}</div>
                  <div>שורות חיוביות (סה&quot;כ): {preview.totals.positiveQuantityRowsCount}</div>
                  <div>שורות שליליות שנדחו: {preview.totals.negativeQuantityRowsCount}</div>
                  <div>שורות אפס שנדחו: {preview.totals.zeroQuantityRowsCount}</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="mb-2 text-sm font-medium text-gray-900">חריגות</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>שורות שאינן SO: {preview.anomalies.nonSoOrderRows}</div>
                  <div>שורות ללא / בערך הפצה: {preview.anomalies.rowsWithoutDistributionSlash}</div>
                  <div>שורות fallback: {preview.anomalies.pointFallbackRows}</div>
                  <div>שורות special flow שנדחו: {preview.anomalies.specialFlowRowCount}</div>
                  <div>שורות עם תאריך הפצה לא תקין: {preview.anomalies.invalidDistributionDateRows.length}</div>
                  <div className="col-span-2">שדות חובה חסרים: {preview.anomalies.missingRequiredFields.length}</div>
                </div>
              </div>

              {preview.excludedRows.length > 0 && (
                <div className="rounded-xl border border-amber-200 p-4">
                  <p className="mb-2 text-sm font-medium text-amber-900">
                    שורות שלא יובאו ({preview.excludedRows.length})
                  </p>
                  <div className="max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700">
                    {preview.excludedRows.map((row) => (
                      <div key={row.sourceRowNumber} className="flex items-center gap-2">
                        <span className="shrink-0 rounded bg-amber-100 px-1 font-mono">
                          #{row.sourceRowNumber}
                        </span>
                        <span className="shrink-0 rounded bg-gray-100 px-1 text-amber-800">
                          {row.exclusionReason}
                        </span>
                        <span className="truncate">
                          {row.orderNumber ?? ''} {row.sku ?? ''} {row.customerName ?? ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
              onClick={() => {
                if (hasExistingWork && !confirmedReplace) {
                  setConfirmedReplace(true);
                  return;
                }
                void handleApply();
              }}
              disabled={!selectedFile || blockingWarnings.length > 0 || isBlocking || !!isReplaceBlocked}
              className="flex w-full min-h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 font-medium text-white disabled:opacity-40"
            >
              {applyMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {applyMutation.isPending
                ? 'מייבא...'
                : hasExistingWork
                  ? translate('monthlyImport.replaceAction')
                  : 'אשר ייבוא'}
            </button>
          )}
        </div>
      </div>

      {(previewErrorCode || applyErrorCode) && <span className="hidden">{previewErrorCode ?? applyErrorCode}</span>}
    </div>
  );
}
