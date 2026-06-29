import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Loader2, Upload, XCircle, AlertCircle } from 'lucide-react';
import { demandImportAvailableBatchesQueryOptions } from '@/entities/demand/api/queries';
import { useCreateDemandPlanningDraft } from '@/entities/demand/api/mutations';
import { saveDemandLastContext } from '@/entities/demand/lib/last-context';
import { useState } from 'react';

interface AppendDemandSourcePickerProps {
  targetShiftId: string;
}

export function AppendDemandSourcePicker({ targetShiftId }: AppendDemandSourcePickerProps) {
  const navigate = useNavigate();
  const createDraftMutation = useCreateDemandPlanningDraft();
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  const { data: availableData, isLoading, error } = useQuery({
    ...demandImportAvailableBatchesQueryOptions()
  });

  function handleSelectBatch(batchId: string) {
    if (selectedBatchId) return;
    setSelectedBatchId(batchId);
    createDraftMutation.mutate(
      { batchId, scope: 'remaining' },
      {
        onSuccess: (result) => {
          const url = `/operator/manual/lines?mode=demand&intent=append-current-shift&targetShiftId=${targetShiftId}&batchId=${batchId}&draftId=${result.draft.id}`;
          saveDemandLastContext({
            mode: 'demand',
            batchId,
            draftId: result.draft.id,
            url,
            savedAt: new Date().toISOString()
          });
          navigate(url);
        },
        onError: () => {
          setSelectedBatchId(null);
        }
      }
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16" dir="rtl">
        <Loader2 size={24} className="animate-spin text-gray-400 ml-2" />
        <span className="text-sm text-gray-500">טוען ביקושים זמינים...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center" dir="rtl">
        <AlertCircle size={32} className="mx-auto text-red-400 mb-2" />
        <p className="text-sm font-medium text-red-800">שגיאה בטעינת ביקושים זמינים</p>
        <p className="text-xs text-red-600 mt-1">נסה שוב מאוחר יותר</p>
      </div>
    );
  }

  const batches = availableData?.batches ?? [];
  const planableBatches = batches.filter((b) => b.canPlan);
  const consumedBatches = batches.filter((b) => !b.canPlan);

  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-8 text-center" dir="rtl">
        <Upload size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-base font-medium text-gray-700">אין ביקוש זמין להוספה למשמרת</p>
        <p className="text-sm text-gray-500 mt-1">לא נמצאו קבצי DataSheet מיובאים עם ביקוש שטרם תוכנן.</p>
        <button
          type="button"
          onClick={() => navigate('/operator/manual/import')}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Upload size={16} />
          ייבא DataSheet חדש
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <p className="font-semibold text-gray-900">בחר ביקוש שכבר נטען</p>
        <p className="text-sm text-gray-500">בחר מקור ביקוש שכבר יובא למערכת. ההזמנות החדשות יתווספו למשמרת הנוכחית.</p>
      </div>

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
  );
}
