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
      <div className="relative w-full max-w-[430px] h-[100dvh] bg-white flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-lg text-gray-900">ЧЄЧ¦Ч•Ч’Ч” ЧћЧ§Ч“Ч™ЧћЧ” Ч—Ч•Ч“Ч©Ч™ЧЄ</h2>
            <p className="text-sm text-gray-500">Batch 2 preview only</p>
          </div>
          <button
            onClick={onClose}
            disabled={isBlocking}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 disabled:opacity-40"
            aria-label="ЧЎЧ’Ч•ЧЁ ЧЄЧ¦Ч•Ч’Ч” ЧћЧ§Ч“Ч™ЧћЧ” Ч—Ч•Ч“Ч©Ч™ЧЄ"
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
            <p className="font-medium text-gray-900">Ч‘Ч—ЧЁ Ч§Ч•Ч‘ЧҐ ЧђЧ§ЧЎЧњ Ч—Ч•Ч“Ч©Ч™</p>
            <p className="text-sm text-gray-500">ЧЄЧђЧЁЧ™Чљ Ч� Ч‘Ч—ЧЁ ЧћЧ”ЧћЧ©ЧћЧЁЧЄ: {selectedDate}</p>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isBlocking}
              aria-label="Ч‘Ч—ЧЁ Ч§Ч•Ч‘ЧҐ ЧђЧ§ЧЎЧњ Ч—Ч•Ч“Ч©Ч™"
              onChange={handleFileInputChange}
              className="w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
          </div>

          {previewMutation.isPending && (
            <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-700">
              <Loader2 size={16} className="animate-spin" />
              ЧћЧ� ЧЄЧ— ЧђЧЄ Ч”Ч§Ч•Ч‘ЧҐ Ч”Ч—Ч•Ч“Ч©Ч™...
            </div>
          )}

          {preview && (
            <div className="space-y-4">
              {blockingWarnings.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 flex gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <div>Ч™Ч© ЧђЧ–Ч”ЧЁЧ•ЧЄ Ч—Ч•ЧЎЧћЧ•ЧЄ. Apply Import ЧњЧђ Ч–ЧћЧ™Чџ Ч‘Ч‘ЧђЧҐЧі Ч”Ч–Ч”.</div>
                </div>
              )}

              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <p><span className="font-medium">Ч§Ч•Ч‘ЧҐ:</span> {preview.source.fileName}</p>
                <p><span className="font-medium">Ч’Ч™ЧњЧ™Ч•Чџ:</span> {preview.source.sheetName}</p>
                <p><span className="font-medium">ЧЄЧђЧЁЧ™Чљ Ч� Ч‘Ч—ЧЁ:</span> {preview.selectedDate.normalized}</p>
                <p><span className="font-medium">ЧЄЧђЧЁЧ™Чљ Ч’ЧњЧќ:</span> {preview.selectedDate.raw ?? 'ЧњЧђ Ч� ЧћЧ¦Чђ'}</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <p><span className="font-medium">ЧЎЧ”ЧґЧ› Ч©Ч•ЧЁЧ•ЧЄ:</span> {preview.dateSummary.totalRows}</p>
                <p><span className="font-medium">Ч©Ч•ЧЁЧ•ЧЄ ЧЄЧ•ЧђЧћЧ•ЧЄ:</span> {preview.dateSummary.matchingRows}</p>
                <p><span className="font-medium">Ч©Ч•ЧЁЧ•ЧЄ ЧћЧ“Ч•ЧњЧ’Ч•ЧЄ:</span> {preview.dateSummary.skippedOtherDateRows}</p>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="font-medium text-sm text-gray-900 mb-2">ЧЄЧђЧЁЧ™Ч›Ч™Чќ Ч–ЧћЧ™Ч� Ч™Чќ</p>
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
                <p className="font-medium text-sm text-gray-900 mb-2">ЧћЧ“Ч“Ч™Чќ</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>Ч§Ч•Ч•Ч™Чќ: {preview.totals.lines}</div>
                  <div>ЧўЧЁЧ›Ч™ Ч§Ч• Ч’Ч•ЧњЧћЧ™Ч™Чќ: {preview.totals.rawDistributionValues}</div>
                  <div>Ч� Ч§Ч•Ч“Ч•ЧЄ Ч� Ч’Ч–ЧЁЧ•ЧЄ: {preview.totals.derivedPoints}</div>
                  <div>ЧћЧЎЧ¤ЧЁЧ™ Ч”Ч–ЧћЧ� Ч” Ч™Ч™Ч—Ч•Ч“Ч™Ч™Чќ: {preview.totals.uniqueOrderNumbers}</div>
                  <div>Ч§Ч‘Ч•Ч¦Ч•ЧЄ Ч”Ч–ЧћЧ� Ч”: {preview.totals.orderGroups}</div>
                  <div>Ч©Ч•ЧЁЧ•ЧЄ SKU: {preview.totals.skuRows}</div>
                  <div>Ч§Ч‘Ч•Ч¦Ч•ЧЄ SKU ЧћЧђЧ•Ч’Ч“Ч•ЧЄ: {preview.totals.aggregatedSkuGroups}</div>
                  <div>SKU Ч™Ч™Ч—Ч•Ч“Ч™Ч™Чќ: {preview.totals.uniqueSkus}</div>
                  <div>Ч›ЧћЧ•ЧЄ Ч›Ч•ЧњЧњЧЄ: {preview.totals.totalQuantity}</div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-4">
                <p className="font-medium text-sm text-gray-900 mb-2">ЧђЧ� Ч•ЧћЧњЧ™Ч•ЧЄ</p>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                  <div>Ч›ЧћЧ•Ч™Ч•ЧЄ Ч©ЧњЧ™ЧњЧ™Ч•ЧЄ: {preview.anomalies.negativeQuantityRows}</div>
                  <div>ЧњЧђ-SO: {preview.anomalies.nonSoOrderRows}</div>
                  <div>ЧњЧњЧђ / Ч‘Ч§Ч•: {preview.anomalies.rowsWithoutDistributionSlash}</div>
                  <div>fallback ЧћЧњЧ§Ч•Ч—: {preview.anomalies.pointFallbackRows}</div>
                  <div>ЧђЧ™ЧЎЧ•ЧЈ: {preview.anomalies.pickupNoteRows}</div>
                  <div>Ч”Ч©ЧњЧћЧ”: {preview.anomalies.ashlamaNoteRows}</div>
                  <div>ЧЄЧђЧЁЧ™Ч›Ч™ Ч”Ч¤Ч¦Ч” ЧњЧђ ЧЄЧ§Ч™Ч� Ч™Чќ: {preview.anomalies.invalidDistributionDateRows.length}</div>
                  <div className="col-span-2">Ч©Ч“Ч•ЧЄ Ч—Ч•Ч‘Ч” Ч—ЧЎЧЁЧ™Чќ: {preview.anomalies.missingRequiredFields.length}</div>
                </div>
              </div>

              {preview.warnings.length > 0 && (
                <div className="space-y-2">
                  {preview.warnings.map((warning) => (
                    <div
                      key={`${warning.code}-${warning.severity}`}
                      className={`rounded-xl border p-3 text-sm ${severityClass(warning.severity)}`}
                    >
                      <div className="font-medium">{warning.message}</div>
                      {warning.count !== undefined && <div>Ч›ЧћЧ•ЧЄ: {warning.count}</div>}
                    </div>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 text-sm font-medium text-gray-900">
                  ЧЎЧ™Ч›Ч•Чќ ЧњЧ¤Ч™ Ч§Ч•
                </div>
                <div className="divide-y divide-gray-100">
                  {preview.lines.map((line) => (
                    <div key={line.lineName} className="p-4 text-sm space-y-1">
                      <p className="font-medium text-gray-900">{line.lineName}</p>
                      <p>Ч� Ч§Ч•Ч“Ч•ЧЄ: {line.points} | Ч”Ч–ЧћЧ� Ч•ЧЄ Ч™Ч™Ч—Ч•Ч“Ч™Ч•ЧЄ: {line.uniqueOrderNumbers} | Ч§Ч‘Ч•Ч¦Ч•ЧЄ Ч”Ч–ЧћЧ� Ч”: {line.orderGroups}</p>
                      <p>Ч©Ч•ЧЁЧ•ЧЄ Ч¤ЧЁЧ™Ч: {line.itemRows} | Ч§Ч‘Ч•Ч¦Ч•ЧЄ SKU ЧћЧђЧ•Ч’Ч“Ч•ЧЄ: {line.aggregatedSkuGroups} | SKU Ч™Ч™Ч—Ч•Ч“Ч™Ч™Чќ: {line.uniqueSkus}</p>
                      <p>Ч›ЧћЧ•ЧЄ Ч›Ч•ЧњЧњЧЄ: {line.totalQuantity}</p>
                      <p>Ч©Ч•ЧЁЧ•ЧЄ Ч©ЧњЧ™ЧњЧ™Ч•ЧЄ: {line.negativeQuantityRows} | ЧђЧ� Ч•ЧћЧњЧ™Ч•ЧЄ: {line.anomalyCount}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 space-y-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isBlocking}
            className="w-full min-h-12 rounded-xl border border-gray-300 text-gray-700 font-medium disabled:opacity-40"
          >
            ЧЎЧ’Ч•ЧЁ
          </button>
          {preview && (
            <button
              type="button"
              onClick={() => void handleApply()}
              disabled={!selectedFile || blockingWarnings.length > 0 || isBlocking}
              className="w-full min-h-12 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {applyMutation.isPending && <Loader2 size={16} className="animate-spin" />}
              {applyMutation.isPending ? 'Apply...' : 'Apply Import'}
            </button>
          )}
        </div>
      </div>

      {(previewErrorCode || applyErrorCode) && <span className="hidden">{previewErrorCode ?? applyErrorCode}</span>}
    </div>
  );
}
