import { useMemo, useState, type ChangeEvent } from 'react';
import type { DailyManualShiftImportPreview } from '@wos/domain';
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import {
  useApplyManualShiftExcelImport,
  usePreviewManualShiftExcelImport
} from '@/entities/manual-shift/api/mutations';
import { BffRequestError } from '@/shared/api/bff/client';
import { translateBffError } from '@/shared/i18n';

interface ImportExcelSheetProps {
  shiftId: string;
  selectedDate: string;
  onClose: () => void;
  onSuccess: (result: { linesCreated: number; ordersCreated: number }) => void;
}

export function ImportExcelSheet({ shiftId, selectedDate, onClose, onSuccess }: ImportExcelSheetProps) {
  const previewMutation = usePreviewManualShiftExcelImport();
  const applyMutation = useApplyManualShiftExcelImport(selectedDate);
  const [expandedLines, setExpandedLines] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<DailyManualShiftImportPreview | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDateMismatch = !!preview && preview.importDate !== selectedDate;
  const isBlocking = previewMutation.isPending || applyMutation.isPending;
  const canConfirm = !!preview && !isDateMismatch && !isBlocking;

  const mismatchMessage = useMemo(() => {
    if (!preview || !isDateMismatch) return null;
    return `קובץ האקסל הוא לתאריך ${preview.importDate}.\nהמשמרת שנבחרה היא ${selectedDate}.\nבחר את התאריך המתאים לפני הייבוא.`;
  }, [preview, isDateMismatch, selectedDate]);

  async function handleSelectFile(file: File | null) {
    if (!file || applyMutation.isPending) return;
    setErrorMessage(null);
    setPreview(null);
    setExpandedLines({});
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
    // Allow selecting the same file again on mobile browsers.
    input.value = '';
  }

  async function handleConfirm() {
    if (!preview || !canConfirm) return;
    setErrorMessage(null);
    try {
      const response = await applyMutation.mutateAsync({ shiftId, preview });
      onSuccess({ linesCreated: response.linesCreated, ordersCreated: response.ordersCreated });
    } catch (error) {
      setErrorMessage(translateBffError(error));
    }
  }

  function toggleLine(name: string) {
    setExpandedLines((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  const previewErrorCode =
    previewMutation.error instanceof BffRequestError ? previewMutation.error.code : null;
  const applyErrorCode = applyMutation.error instanceof BffRequestError ? applyMutation.error.code : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" dir="rtl">
      <div className="absolute inset-0 bg-black/40" onClick={isBlocking ? undefined : onClose} aria-hidden="true" />
      <div className="relative w-full max-w-[430px] h-[100dvh] bg-white flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="font-bold text-lg text-gray-900">ייבוא קווים מאקסל</h2>
          <button
            onClick={onClose}
            disabled={isBlocking}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 disabled:opacity-40"
            aria-label="סגור ייבוא אקסל"
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

          {mismatchMessage && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-sm p-3 whitespace-pre-line">
              {mismatchMessage}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="font-medium text-gray-900">בחר קובץ ‎.xlsx</p>
            <p className="text-sm text-gray-500">גודל מרבי: 20MB</p>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={isBlocking}
              aria-label="בחר קובץ אקסל"
              onChange={handleFileInputChange}
              className="w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
            />
          </div>

          {previewMutation.isPending && (
            <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-700">
              <Loader2 size={16} className="animate-spin" />
              מעלה ומנתח את הקובץ...
            </div>
          )}

          {preview && (
            <div className="space-y-3">
              <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
                <p><span className="font-medium">קובץ:</span> {preview.fileName}</p>
                <p><span className="font-medium">תאריך באקסל:</span> {preview.importDate}</p>
                <p><span className="font-medium">תאריך משמרת נבחר:</span> {selectedDate}</p>
                <p><span className="font-medium">קווים:</span> {preview.lineCount}</p>
                <p><span className="font-medium">הזמנות:</span> {preview.orderCount}</p>
              </div>

              <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
                {preview.lines.map((line) => {
                  const isExpanded = !!expandedLines[line.name];
                  return (
                    <div key={line.name}>
                      <button
                        type="button"
                        className="w-full p-3 flex items-center justify-between text-right"
                        onClick={() => toggleLine(line.name)}
                      >
                        <span className="font-medium text-gray-900">{line.name} - {line.orders.length} הזמנות</span>
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </button>
                      {isExpanded && (
                        <div className="pb-3 px-3 text-sm text-gray-600 flex flex-col gap-1">
                          {line.orders.map((order) => (
                            <div key={`${line.name}-${order.pointName}`}>{order.pointName}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isBlocking}
            className="flex-1 min-h-12 rounded-xl border border-gray-300 text-gray-700 font-medium disabled:opacity-40"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={!canConfirm}
            className="flex-1 min-h-12 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {applyMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {applyMutation.isPending ? 'מייבא...' : 'אשר ייבוא'}
          </button>
        </div>
      </div>

      {(previewErrorCode || applyErrorCode) && <span className="hidden">{previewErrorCode ?? applyErrorCode}</span>}
    </div>
  );
}
