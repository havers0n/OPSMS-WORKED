import { useState, type ChangeEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { BondedSnapshotDraft } from '@wos/domain';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { useUploadBondedExcel, usePublishBondedSnapshot } from '@/entities/bonded/api/mutations';
import { bondedSnapshotsQueryOptions } from '@/entities/bonded/api/queries';
import { BffRequestError } from '@/shared/api/bff/client';
import { translateBffError } from '@/shared/i18n';

interface BondedImportPanelProps {
  shiftId?: string | null;
  selectedDate?: string | null;
}

function getTodayDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function BondedImportPanel({ shiftId, selectedDate }: BondedImportPanelProps) {
  const uploadMutation = useUploadBondedExcel();
  const publishMutation = usePublishBondedSnapshot();

  const { data: snapshots = [], isLoading: isLoadingSnapshots } = useQuery(bondedSnapshotsQueryOptions());

  const [planningDate, setPlanningDate] = useState(selectedDate ?? getTodayDate());
  const [draft, setDraft] = useState<BondedSnapshotDraft | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [pivotFound, setPivotFound] = useState(false);
  const [uploadErrorMessage, setUploadErrorMessage] = useState<string | null>(null);
  const [publishErrorMessage, setPublishErrorMessage] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<{ id: string; rowCount: number } | null>(null);
  const [expandedRows, setExpandedRows] = useState(false);
  const [viewingSnapshotId, setViewingSnapshotId] = useState<string | null>(null);

  const isBlocking = uploadMutation.isPending || publishMutation.isPending;
  const canPublish = !!draft && !!planningDate && !isBlocking && !publishResult;

  async function handleSelectFile(file: File | null) {
    if (!file || isBlocking) return;
    setUploadErrorMessage(null);
    setPublishErrorMessage(null);
    setDraft(null);
    setUploadFileName(null);
    setPivotFound(false);
    setPublishResult(null);
    try {
      const response = await uploadMutation.mutateAsync(file);
      setDraft(response.draft);
      setUploadFileName(response.fileName);
      setPivotFound(response.pivotSheetFound);
    } catch (error) {
      setUploadErrorMessage(translateBffError(error));
    }
  }

  function handleFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0] ?? null;
    void handleSelectFile(file);
    input.value = '';
  }

  async function handlePublish() {
    if (!draft || !planningDate || isBlocking) return;
    setPublishErrorMessage(null);
    try {
      const result = await publishMutation.mutateAsync({
        draft,
        planningDate,
        fileName: uploadFileName,
        shiftId: shiftId ?? null
      });
      setPublishResult({ id: result.id, rowCount: result.rowCount });
    } catch (error) {
      setPublishErrorMessage(translateBffError(error));
    }
  }

  function formatDateTime(iso: string): string {
    try {
      return new Intl.DateTimeFormat('he-IL', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }

  const uploadErrorCode =
    uploadMutation.error instanceof BffRequestError ? uploadMutation.error.code : null;
  const publishErrorCode =
    publishMutation.error instanceof BffRequestError ? publishMutation.error.code : null;

  return (
    <>
      <div className="space-y-4">
        <p className="text-sm text-gray-500">העלאת קובץ בונדד, בדיקת נתונים ופרסום לתאריך עבודה</p>

        {uploadErrorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 whitespace-pre-line">
            {uploadErrorMessage}
          </div>
        )}

        {publishErrorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800 whitespace-pre-line">
            {publishErrorMessage}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 p-4 space-y-2">
          <label htmlFor="bonded-planning-date" className="font-medium text-gray-900">
            תאריך עבודה
          </label>
          <p className="text-xs text-gray-500">קובץ הבונדד אינו כולל תאריך. יש לבחור לאיזה תאריך עבודה ה-Snapshot ישויך.</p>
          <input
            id="bonded-planning-date"
            type="date"
            value={planningDate}
            onChange={(event) => setPlanningDate(event.target.value)}
            disabled={isBlocking}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:opacity-50"
          />
        </div>

        <div className="rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="font-medium text-gray-900">בחר קובץ ‎.xlsx</p>
          <p className="text-sm text-gray-500">גודל מרבי: 20MB</p>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={isBlocking}
            aria-label="בחר קובץ בונדד"
            onChange={handleFileInputChange}
            className="w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          />
        </div>

        {uploadMutation.isPending && (
          <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-700">
            <Loader2 size={16} className="animate-spin" />
            מעלה ומנתח את הקובץ...
          </div>
        )}

        {draft && (
          <div className="space-y-3">
            <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
              <p><span className="font-medium">קובץ:</span> {uploadFileName}</p>
              <p><span className="font-medium">גיליון מקור:</span> {draft.sourceSheetName}</p>
              <p><span className="font-medium">שורות:</span> {draft.rowCount}</p>
              <p><span className="font-medium">שורות עם SKU:</span> {draft.diagnostics.populatedRows}</p>
              {draft.diagnostics.duplicateSkuGroups > 0 && (
                <p><span className="font-medium">מועמדים כפולים:</span> {draft.diagnostics.duplicateSkuGroups}</p>
              )}
              {draft.diagnostics.missingSkuRows > 0 && (
                <p><span className="font-medium">שורות ללא SKU:</span> {draft.diagnostics.missingSkuRows}</p>
              )}
              {draft.diagnostics.negativeBalanceRows > 0 && (
                <p><span className="font-medium">מאזן שלילי:</span> {draft.diagnostics.negativeBalanceRows}</p>
              )}
              {pivotFound && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 mt-2">
                  PIVOT! זוהה ונוטרל מהתצוגה
                </div>
              )}
              {draft.diagnostics.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {draft.diagnostics.warnings.map((warning, index) => (
                    <p key={index} className="text-xs text-amber-700">{warning}</p>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-gray-900"
                onClick={() => setExpandedRows(!expandedRows)}
              >
                <span>תצוגה מקדימה של שורות</span>
                {expandedRows ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {expandedRows && (
                <div className="overflow-x-auto pb-3 px-3">
                  <table className="w-full text-xs text-gray-700 border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-right p-1 font-medium">פריט</th>
                        <th className="text-right p-1 font-medium">גוש</th>
                        <th className="text-right p-1 font-medium">תיאור</th>
                        <th className="text-right p-1 font-medium">משוחרר</th>
                        <th className="text-right p-1 font-medium">נמשך</th>
                        <th className="text-right p-1 font-medium">יתרה</th>
                        <th className="text-right p-1 font-medium">זמין</th>
                        <th className="text-right p-1 font-medium">הערות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.rows.slice(0, 20).map((row) => (
                        <tr key={row.rowNumber} className="border-b border-gray-100">
                          <td className="p-1">{row.sku || '—'}</td>
                          <td className="p-1">{row.block || '—'}</td>
                          <td className="p-1 max-w-[120px] truncate">{row.description || '—'}</td>
                          <td className="p-1">{row.releasedQty}</td>
                          <td className="p-1">{row.totalPulledQty}</td>
                          <td className="p-1">{row.releasedBalanceQty}</td>
                          <td className="p-1">{row.availableQty}</td>
                          <td className="p-1 max-w-[80px] truncate">{row.notes || '—'}</td>
                        </tr>
                      ))}
                      {draft.rows.length > 20 && (
                        <tr>
                          <td colSpan={8} className="p-2 text-center text-gray-400 text-xs">
                            ועוד {draft.rows.length - 20} שורות...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {publishResult && (
          <div className="rounded-xl border border-green-200 bg-green-50 text-green-800 text-sm p-3 space-y-1">
            <p><span className="font-medium">Snapshot ID:</span> {publishResult.id}</p>
            <p><span className="font-medium">סטטוס:</span> completed</p>
            <p><span className="font-medium">שורות:</span> {publishResult.rowCount}</p>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 p-4 space-y-2">
          <h3 className="font-medium text-gray-900">Snapshots אחרונים</h3>
          {isLoadingSnapshots ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              טוען...
            </div>
          ) : snapshots.length === 0 ? (
            <p className="text-sm text-gray-500">אין Snapshots עדיין</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {snapshots.map((snapshot) => (
                <div key={snapshot.id}>
                  <button
                    type="button"
                    onClick={() => setViewingSnapshotId(viewingSnapshotId === snapshot.id ? null : snapshot.id)}
                    className="w-full text-right p-2 rounded-lg hover:bg-gray-50 text-sm space-y-0.5"
                  >
                    <p><span className="font-medium">תאריך עבודה:</span> {snapshot.planningDate}</p>
                    <p><span className="font-medium">קובץ:</span> {snapshot.fileName || '—'}</p>
                    <p><span className="font-medium">הועלה:</span> {formatDateTime(snapshot.importedAt)}</p>
                    <p><span className="font-medium">שורות:</span> {snapshot.rowCount}</p>
                    <p><span className="font-medium">סטטוס:</span> {snapshot.status}</p>
                    {snapshot.diagnostics.warnings.length > 0 && (
                      <p className="text-xs text-amber-600">{snapshot.diagnostics.warnings.length} אזהרות</p>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={!canPublish}
          className="w-full min-h-12 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {publishMutation.isPending && <Loader2 size={16} className="animate-spin" />}
          {publishMutation.isPending ? 'מפרסם...' : publishResult ? 'פורסם' : 'פרסם לתאריך עבודה'}
        </button>
      </div>

      {(uploadErrorCode || publishErrorCode) && <span className="hidden">{uploadErrorCode ?? publishErrorCode}</span>}
    </>
  );
}
