import { useState, type ChangeEvent } from 'react';
import type { DemandImportDataSheetPreview, DemandImportDataSheetCreateResponse, RawDemandPlanningPreview } from '@wos/domain';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import {
  usePreviewDataSheetDemandImport,
  useCreateDataSheetDemandImport
} from '@/entities/demand/api/mutations';
import { useQuery } from '@tanstack/react-query';
import { demandPlanningPreviewQueryOptions } from '@/entities/demand/api/queries';
import { BffRequestError } from '@/shared/api/bff/client';
import { translateBffError } from '@/shared/i18n';

export function DatasheetImportPanel() {
  const previewMutation = usePreviewDataSheetDemandImport();
  const createMutation = useCreateDataSheetDemandImport();

  const [preview, setPreview] = useState<DemandImportDataSheetPreview | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [createResult, setCreateResult] = useState<DemandImportDataSheetCreateResponse | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const batchId = createResult?.batch?.id ?? '';
  const { data: planningPreview, isLoading: isLoadingPlanning } = useQuery({
    ...demandPlanningPreviewQueryOptions(batchId),
    enabled: !!batchId
  });

  const isBlocking = previewMutation.isPending || createMutation.isPending || isLoadingPlanning;

  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleSelectFile(file: File | null) {
    if (!file || isBlocking) return;
    setErrorMessage(null);
    setPreview(null);
    setSelectedFile(null);
    setCreateResult(null);
    try {
      const response = await previewMutation.mutateAsync(file);
      setPreview(response.preview);
      setSelectedFile(file);
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

  async function handleSave() {
    if (!selectedFile || isBlocking) return;
    setErrorMessage(null);
    try {
      const result = await createMutation.mutateAsync(selectedFile);
      setCreateResult(result);
      setSelectedFile(null);
      setPreview(null);
    } catch (error) {
      setErrorMessage(translateBffError(error));
    }
  }

  const previewErrorCode =
    previewMutation.error instanceof BffRequestError ? previewMutation.error.code : null;
  const createErrorCode =
    createMutation.error instanceof BffRequestError ? createMutation.error.code : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">הנתונים יישמרו לתכנון לפי אזור הפצה ולא ייכנסו עדיין למשמרת</p>

      {errorMessage && (
        <div className="whitespace-pre-line rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {!createResult && (
        <div className="rounded-xl border border-gray-200 p-4 space-y-2">
          <p className="font-medium text-gray-900">בחר קובץ ‎.xlsx</p>
          <p className="text-sm text-gray-500">גיליון DataSheet עם ביקוש גולמי</p>
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={isBlocking}
            aria-label="בחר קובץ DataSheet"
            onChange={handleFileInputChange}
            className="w-full text-sm text-gray-700 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white disabled:opacity-50"
          />
        </div>
      )}

      {previewMutation.isPending && (
        <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-700">
          <Loader2 size={16} className="animate-spin" />
          מנתח קובץ...
        </div>
      )}

      {preview && !createResult && (
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
            <p><span className="font-medium">קובץ מקור:</span> {preview.sourceFile}</p>
            <p><span className="font-medium">גיליון מקור:</span> {preview.sourceSheet}</p>
            <p><span className="font-medium">סה"כ שורות:</span> {preview.rowsCount}</p>
            <p><span className="font-medium">שורות גולמיות:</span> {preview.rawRowsCount}</p>
            {preview.warningRowsCount > 0 && (
              <p><span className="font-medium">שורות עם אזהרה:</span> {preview.warningRowsCount}</p>
            )}
            {preview.errorRowsCount > 0 && (
              <p><span className="font-medium">שורות שגיאה:</span> {preview.errorRowsCount}</p>
            )}
            {preview.specialFlowRowsCount > 0 && (
              <p><span className="font-medium">שורות Special Flow:</span> {preview.specialFlowRowsCount}</p>
            )}
            <p><span className="font-medium">אזורי הפצה:</span> {preview.distributionAreasCount}</p>
            <p><span className="font-medium">הזמנות ייחודיות:</span> {preview.distinctOrdersCount}</p>
            <p><span className="font-medium">SKU ייחודיים:</span> {preview.distinctSkuCount}</p>
          </div>

          {preview.distributionAreaSummary.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-gray-900"
                onClick={() => toggleSection('areas')}
              >
                <span>פילוח לפי אזור הפצה</span>
                {expandedSections['areas'] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {expandedSections['areas'] && (
                <div className="px-3 pb-3 space-y-2">
                  {preview.distributionAreaSummary.map((area) => (
                    <div key={area.distributionArea ?? '__missing__'} className="rounded-lg bg-gray-50 p-3 text-sm">
                      <p className="font-medium text-gray-900">{area.distributionArea ?? '(ללא אזור)'}</p>
                      <p className="text-xs text-gray-600">
                        שורות: {area.rowsCount} | הזמנות: {area.ordersCount} | SKU: {area.skuCount} | כמות: {area.totalQty}
                      </p>
                      {area.specialFlowRowsCount > 0 && (
                        <p className="text-xs text-amber-700">Special Flow: {area.specialFlowRowsCount}</p>
                      )}
                      {area.errorRowsCount > 0 && (
                        <p className="text-xs text-red-600">שגיאות: {area.errorRowsCount}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.productHandlingSummary.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-gray-900"
                onClick={() => toggleSection('handling')}
              >
                <span>פילוח לפי טיפול מוצר</span>
                {expandedSections['handling'] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {expandedSections['handling'] && (
                <div className="px-3 pb-3 space-y-1 text-sm">
                  {preview.productHandlingSummary.map((entry) => (
                    <div key={entry.productHandlingFlow} className="flex justify-between text-gray-700">
                      <span className="font-medium">{entry.productHandlingFlow}</span>
                      <span>{entry.rowsCount} שורות, {entry.totalQty} יח׳</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.specialFlowSummary.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-gray-900"
                onClick={() => toggleSection('specialFlows')}
              >
                <span>Special Flows</span>
                {expandedSections['specialFlows'] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {expandedSections['specialFlows'] && (
                <div className="px-3 pb-3 space-y-1 text-sm">
                  {preview.specialFlowSummary.map((entry) => (
                    <div key={entry.routeFlow} className="flex justify-between text-gray-700">
                      <span className="font-medium">{entry.routeFlow}</span>
                      <span>{entry.rowsCount} שורות, {entry.totalQty} יח׳</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.issues.length > 0 && (
            <div className="rounded-xl border border-red-200 overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-gray-900"
                onClick={() => toggleSection('issues')}
              >
                <span>בעיות ({preview.issues.length})</span>
                {expandedSections['issues'] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {expandedSections['issues'] && (
                <div className="px-3 pb-3 space-y-1 text-sm">
                  {preview.issues.map((issue, i) => (
                    <div key={i} className={`rounded-lg p-2 ${
                      issue.severity === 'error' ? 'bg-red-50 text-red-800' :
                      issue.severity === 'warning' ? 'bg-amber-50 text-amber-800' :
                      'bg-blue-50 text-blue-800'
                    }`}>
                      <p className="font-medium">{issue.message}</p>
                      <p className="text-xs">קוד: {issue.code} | כמות: {issue.count}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {preview.sampleRows.length > 0 && (
            <div className="rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-gray-900"
                onClick={() => toggleSection('samples')}
              >
                <span>שורות לדוגמה ({preview.sampleRows.length})</span>
                {expandedSections['samples'] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
              </button>
              {expandedSections['samples'] && (
                <div className="overflow-x-auto pb-3 px-3">
                  <table className="w-full text-xs text-gray-700 border-collapse">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-right p-1 font-medium">#</th>
                        <th className="text-right p-1 font-medium">הזמנה</th>
                        <th className="text-right p-1 font-medium">לקוח</th>
                        <th className="text-right p-1 font-medium">מק"ט</th>
                        <th className="text-right p-1 font-medium">תיאור</th>
                        <th className="text-right p-1 font-medium">כמות</th>
                        <th className="text-right p-1 font-medium">אזור הפצה</th>
                        <th className="text-right p-1 font-medium">סטטוס</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sampleRows.map((row, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="p-1">{row.sourceRowNumber}</td>
                          <td className="p-1">{row.orderNumber ?? '—'}</td>
                          <td className="p-1 max-w-[80px] truncate">{row.customerName ?? '—'}</td>
                          <td className="p-1">{row.sku ?? '—'}</td>
                          <td className="p-1 max-w-[100px] truncate">{row.description ?? '—'}</td>
                          <td className="p-1">{row.quantity ?? '—'}</td>
                          <td className="p-1 max-w-[80px] truncate">{row.distributionArea ?? '—'}</td>
                          <td className="p-1">{row.planningStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {createMutation.isPending && (
        <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-700">
          <Loader2 size={16} className="animate-spin" />
          שומר ביקוש גולמי...
        </div>
      )}

      {createResult && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm space-y-1">
          <p><span className="font-medium">Batch ID:</span> {createResult.batch.id}</p>
          <p><span className="font-medium">סטטוס:</span> {createResult.batch.status}</p>
          <p><span className="font-medium">שורות:</span> {createResult.batch.rowsCount}</p>
          <p className="text-xs text-amber-700 mt-1">לא בוצע שיוך למשמרת</p>
        </div>
      )}

      {preview && !createResult && (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isBlocking}
          className="w-full min-h-12 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {createMutation.isPending && <Loader2 size={16} className="animate-spin" />}
          {createMutation.isPending ? 'שומר...' : 'שמור ביקוש גולמי'}
        </button>
      )}

      {isLoadingPlanning && batchId && (
        <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-sm text-gray-700">
          <Loader2 size={16} className="animate-spin" />
          טוען תצוגת תכנון...
        </div>
      )}

      {planningPreview && (
        <DatasheetPlanningPreviewContent preview={planningPreview} />
      )}

      {(previewErrorCode || createErrorCode) && <span className="hidden">{previewErrorCode ?? createErrorCode}</span>}
    </div>
  );
}

function DatasheetPlanningPreviewContent({ preview }: { preview: RawDemandPlanningPreview }) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const summary = preview.summary;

  return (
    <div className="space-y-4" data-testid="planning-preview">
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 space-y-1">
        <p className="font-medium">תצוגת תכנון לפי אזורי הפצה</p>
        <p className="text-xs">קו ותאריך הפצה ייקבעו בשלב התכנון</p>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 text-sm space-y-1">
        <p className="font-medium text-gray-900">סיכום</p>
        <p><span className="font-medium">סה"כ שורות:</span> {summary.rowsCount}</p>
        <p><span className="font-medium">שורות רגילות:</span> {summary.normalRowsCount}</p>
        <p><span className="font-medium">Special Flow:</span> {summary.specialFlowRowsCount}</p>
        <p><span className="font-medium">שגיאות:</span> {summary.errorRowsCount}</p>
        <p><span className="font-medium">אזורי הפצה:</span> {summary.distributionAreasCount}</p>
        <p><span className="font-medium">הזמנות:</span> {summary.ordersCount}</p>
        <p><span className="font-medium">SKU ייחודיים:</span> {summary.skuCount}</p>
        <p><span className="font-medium">כמות כוללת:</span> {summary.totalQuantity}</p>
      </div>

      {preview.distributionAreas.map((area) => (
        <div key={area.distributionArea ?? '__missing__'} className="rounded-xl border border-gray-200 overflow-hidden">
          <button
            type="button"
            className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-gray-900"
            onClick={() => toggleSection(`area-${area.distributionArea ?? 'missing'}`)}
          >
            <span>{area.distributionArea ?? '(ללא אזור)'}</span>
            {expandedSections[`area-${area.distributionArea ?? 'missing'}`] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {expandedSections[`area-${area.distributionArea ?? 'missing'}`] && (
            <div className="px-3 pb-3 space-y-3">
              <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
                <p><span className="font-medium">שורות:</span> {area.rowsCount}</p>
                <p><span className="font-medium">הזמנות:</span> {area.ordersCount}</p>
                <p><span className="font-medium">SKU:</span> {area.skuCount}</p>
                <p><span className="font-medium">כמות כוללת:</span> {area.totalQuantity}</p>
                {area.specialFlowRowsCount > 0 && <p className="text-amber-700">Special Flow: {area.specialFlowRowsCount}</p>}
                {area.errorRowsCount > 0 && <p className="text-red-600">שגיאות: {area.errorRowsCount}</p>}
              </div>

              {area.orders.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">הזמנות</p>
                  <div className="space-y-1">
                    {area.orders.map((order, i) => (
                      <div key={i} className="rounded-lg border border-gray-100 p-2 text-xs">
                        <p><span className="font-medium">הזמנה:</span> {order.orderNumber ?? '—'}</p>
                        <p><span className="font-medium">לקוח:</span> {order.customerName ?? '—'}</p>
                        <p><span className="font-medium">שורות:</span> {order.rowsCount} | <span className="font-medium">SKU:</span> {order.skuCount}</p>
                        <p><span className="font-medium">כמות:</span> {order.totalQuantity}</p>
                        <p><span className="font-medium">טיפולים:</span> {order.productHandlingFlows.join(', ')}</p>
                        {order.issues.length > 0 && (
                          <div className="mt-1 space-y-0.5">
                            {order.issues.map((issue, j) => (
                              <p key={j} className={
                                issue.severity === 'error' ? 'text-red-600' :
                                issue.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'
                              }>{issue.message} ({issue.count})</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {area.productSummary.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">סיכום מוצרים</p>
                  <div className="space-y-1">
                    {area.productSummary.slice(0, 10).map((product, i) => (
                      <div key={i} className="flex justify-between text-xs text-gray-700">
                        <span className="font-medium">{product.sku ?? '—'}</span>
                        <span>{product.totalQuantity} יח׳</span>
                      </div>
                    ))}
                    {area.productSummary.length > 10 && (
                      <p className="text-xs text-gray-400">ועוד {area.productSummary.length - 10} מוצרים...</p>
                    )}
                  </div>
                </div>
              )}

              {area.issues.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">בעיות</p>
                  {area.issues.map((issue, i) => (
                    <div key={i} className={`rounded-lg p-2 text-xs mb-1 ${
                      issue.severity === 'error' ? 'bg-red-50 text-red-800' :
                      issue.severity === 'warning' ? 'bg-amber-50 text-amber-800' :
                      'bg-blue-50 text-blue-800'
                    }`}>
                      {issue.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {preview.specialFlows.length > 0 && (
        <div className="rounded-xl border border-amber-200 overflow-hidden">
          <button
            type="button"
            className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-amber-900"
            onClick={() => toggleSection('specialFlowsPlanning')}
          >
            <span>Special Flows ({preview.specialFlows.length})</span>
            {expandedSections['specialFlowsPlanning'] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {expandedSections['specialFlowsPlanning'] && (
            <div className="px-3 pb-3 space-y-2">
              {preview.specialFlows.map((flow) => (
                <div key={flow.routeFlow} className="rounded-lg border border-amber-100 bg-amber-50/50 p-3 text-sm">
                  <p className="font-medium text-amber-900">{flow.routeFlow}</p>
                  <p className="text-xs text-amber-800">
                    שורות: {flow.rowsCount} | הזמנות: {flow.ordersCount} | כמות: {flow.totalQuantity}
                  </p>
                  {flow.sampleRows.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {flow.sampleRows.map((sample, i) => (
                        <div key={i} className="text-xs text-gray-700 flex gap-2">
                          <span className="shrink-0 rounded bg-amber-100 px-1 font-mono">#{sample.sourceRowNumber}</span>
                          <span>{sample.orderNumber ?? '—'}</span>
                          <span className="truncate">{sample.sku ?? '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {preview.errors.length > 0 && (
        <div className="rounded-xl border border-red-200 overflow-hidden">
          <button
            type="button"
            className="w-full p-3 flex items-center justify-between text-right text-sm font-medium text-red-800"
            onClick={() => toggleSection('errors')}
          >
            <span>שגיאות ({preview.errors.length})</span>
            {expandedSections['errors'] ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          </button>
          {expandedSections['errors'] && (
            <div className="px-3 pb-3 space-y-1">
              {preview.errors.map((err, i) => (
                <div key={i} className="rounded-lg bg-red-50 p-2 text-xs text-red-800 space-y-0.5">
                  <p><span className="font-medium">שורה #{err.sourceRowNumber}</span></p>
                  <p>הזמנה: {err.orderNumber ?? '—'} | לקוח: {err.customerName ?? '—'} | SKU: {err.sku ?? '—'}</p>
                  <p>אזור: {err.distributionArea ?? '—'}</p>
                  {err.issues.map((issue, j) => (
                    <p key={j} className="text-red-600">{issue.message}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
