import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, Calendar, Plus, ExternalLink, XCircle, Upload, AlertCircle } from 'lucide-react';
import { shiftByDateQueryOptions } from '@/entities/manual-shift/api/queries';
import { useCreateShift } from '@/entities/manual-shift/api/mutations';
import { demandImportAvailableBatchesQueryOptions } from '@/entities/demand/api/queries';
import { useCreateDemandPlanningDraft } from '@/entities/demand/api/mutations';
import { saveDemandLastContext } from '@/entities/demand/lib/last-context';
import { ShiftDatePicker } from './shift-date-picker';

function getTodayDateIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function generateShiftName(dateStr?: string): string {
  const date = dateStr
    ? new Date(Number(dateStr.slice(0, 4)), Number(dateStr.slice(5, 7)) - 1, Number(dateStr.slice(8, 10)))
    : new Date();
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(year, month - 1, day));
}

export function PlanForDateFlow() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const todayDate = getTodayDateIsrael();
  const targetMaxDate = addDays(todayDate, 90);

  const targetDate = searchParams.get('targetDate');

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const createShift = useCreateShift();
  const createDraftMutation = useCreateDemandPlanningDraft();

  const { data: shiftData, isLoading: isShiftLoading } = useQuery({
    ...shiftByDateQueryOptions(targetDate ?? ''),
    enabled: !!targetDate,
  });
  const targetShift = shiftData?.shift ?? null;

  const { data: availableData, isLoading: isBatchesLoading } = useQuery({
    ...demandImportAvailableBatchesQueryOptions(),
    enabled: !!targetDate && !!targetShift,
  });

  const handleSelectDate = useCallback((date: string) => {
    setShowDatePicker(false);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('targetDate', date);
      next.delete('targetShiftId');
      next.delete('batchId');
      next.delete('draftId');
      return next;
    });
  }, [setSearchParams]);

  const handleCreateShift = useCallback(() => {
    if (!targetDate) return;
    createShift.mutate(
      { name: generateShiftName(targetDate), date: targetDate }
    );
  }, [targetDate, createShift]);

  const handleSelectBatch = useCallback((id: string) => {
    if (!targetShift || selectedBatchId) return;
    setSelectedBatchId(id);
    createDraftMutation.mutate(
      { batchId: id, scope: 'remaining' },
      {
        onSuccess: (result) => {
          const targetDateStr = targetDate ?? '';
          const url = `/operator/manual/lines?mode=demand&intent=plan-for-date&targetDate=${targetDateStr}&targetShiftId=${targetShift.id}&batchId=${id}&draftId=${result.draft.id}`;
          saveDemandLastContext({
            mode: 'demand',
            batchId: id,
            draftId: result.draft.id,
            url,
            targetDate: targetDate ?? undefined,
            savedAt: new Date().toISOString()
          });
          navigate(url);
        },
        onError: () => {
          setSelectedBatchId(null);
        }
      }
    );
  }, [targetShift, targetDate, selectedBatchId, createDraftMutation, navigate]);

  const batches = availableData?.batches ?? [];
  const planableBatches = batches.filter((b) => b.canPlan);
  const consumedBatches = batches.filter((b) => !b.canPlan);

  return (
    <div className="flex-1 flex flex-col bg-gray-50" dir="rtl">

      <div className="border-b border-gray-200 bg-white px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">תכנון עבודה לתאריך</h1>
        <p className="text-xs text-gray-500 mt-1">בחר תאריך עבודה כדי ליצור או לערוך משמרת</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">

          {/* Step 1: Date Selection */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-blue-600 shrink-0" />
              <h2 className="text-sm font-semibold text-gray-800">שלב 1: בחר תאריך עבודה</h2>
            </div>

            {!targetDate ? (
              <button
                type="button"
                onClick={() => setShowDatePicker(true)}
                className="w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-center hover:border-blue-400 hover:bg-blue-100 transition-colors"
                data-testid="plan-for-date-pick-date"
              >
                <Calendar size={32} className="mx-auto text-blue-400 mb-2" />
                <p className="font-semibold text-blue-800">בחר תאריך</p>
                <p className="text-xs text-blue-600 mt-1">בחר את תאריך המשמרת לתכנון</p>
              </button>
            ) : (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-900">{formatDisplayDate(targetDate)}</span>
                    <button
                      type="button"
                      onClick={() => setShowDatePicker(true)}
                      className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800"
                    >
                      שנה תאריך
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Shift Status */}
          {targetDate && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <h2 className="text-sm font-semibold text-gray-800">שלב 2: משמרת</h2>
              </div>

              {isShiftLoading || createShift.isPending ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Loader2 size={16} className="animate-spin" />
                  טוען משמרת...
                </div>
              ) : targetShift ? (
                <div className={`rounded-xl border p-4 ${targetShift.status === 'active' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${targetShift.status === 'active' ? 'text-green-900' : 'text-red-900'}`}>משמרת: {targetShift.name}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${targetShift.status === 'active' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'}`}>
                      {targetShift.status === 'active' ? 'פעילה' : 'סגורה'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">מספר מזהה: {targetShift.id}</p>
                  {targetShift.status !== 'active' && (
                    <p className="text-xs text-red-700 mt-2">לא ניתן לתכנן עבודה למשמרת סגורה.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-3">
                  <p className="text-sm text-amber-800">אין משמרת לתאריך {formatDisplayDate(targetDate)}</p>
                  <button
                    type="button"
                    onClick={handleCreateShift}
                    disabled={createShift.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    data-testid="plan-for-date-create-shift"
                  >
                    {createShift.isPending ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Plus size={16} />
                    )}
                    צור משמרת
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Step 3: Source Picker (only for active shifts) */}
          {targetDate && targetShift && targetShift.status === 'active' && (
            <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ExternalLink size={18} className="text-blue-600 shrink-0" />
                <h2 className="text-sm font-semibold text-gray-800">שלב 3: בחר מקור ביקוש</h2>
              </div>

              {isBatchesLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <Loader2 size={16} className="animate-spin" />
                  טוען ביקושים זמינים...
                </div>
              ) : batches.length === 0 ? (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center" data-testid="plan-for-date-no-batches">
                  <Upload size={32} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-medium text-gray-700">אין ביקוש זמין</p>
                  <p className="text-xs text-gray-500 mt-1">לא נמצאו קבצי DataSheet מיובאים עם ביקוש שטרם תוכנן.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/operator/manual/import')}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                  >
                    <Upload size={14} />
                    ייבא DataSheet חדש
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">בחר מקור ביקוש שכבר יובא למערכת.</p>

                  {planableBatches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">ביקוש זמין ({planableBatches.length})</p>
                      {planableBatches.map((batch) => (
                        <button
                          key={batch.id}
                          type="button"
                          onClick={() => handleSelectBatch(batch.id)}
                          disabled={selectedBatchId === batch.id && createDraftMutation.isPending}
                          className="w-full text-right rounded-xl border border-blue-200 bg-white p-4 hover:border-blue-400 hover:shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                          data-testid={`plan-for-date-batch-${batch.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{batch.sourceFile}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{batch.sourceSheet}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                  נותרו {batch.remainingRows} שורות
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                                  כמות: {batch.remainingQuantity}
                                </span>
                                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                                  סה"כ: {batch.totalRows} שורות
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0">
                              {selectedBatchId === batch.id && createDraftMutation.isPending ? (
                                <Loader2 size={20} className="animate-spin text-blue-600" />
                              ) : (
                                <ExternalLink size={20} className="text-blue-500" />
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {consumedBatches.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">ביקוש ממוצה ({consumedBatches.length})</p>
                      {consumedBatches.map((batch) => (
                        <div
                          key={batch.id}
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4 opacity-60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-600 truncate">{batch.sourceFile}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{batch.sourceSheet}</p>
                              <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500 mt-2">
                                <XCircle size={12} />
                                כל הביקוש מוצה
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs text-gray-400 mb-2">רוצה לייבא קובץ ביקוש חדש?</p>
                    <button
                      type="button"
                      onClick={() => navigate('/operator/manual/import')}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Upload size={14} />
                      ייבא DataSheet חדש
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>

      {showDatePicker && (
        <ShiftDatePicker
          selectedDate={targetDate ?? todayDate}
          todayDate={todayDate}
          maxSelectableDate={targetMaxDate}
          onSelect={handleSelectDate}
          onClose={() => setShowDatePicker(false)}
        />
      )}
    </div>
  );
}
