import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { shiftByIdQueryOptions, shiftOrdersQueryOptions } from '@/entities/manual-shift/api/queries';
import { AppendCurrentShiftHeader } from './append-current-shift-header';
import { AppendDemandSourcePicker } from './append-demand-source-picker';
import { SchemeBuilder } from './scheme-builder';

interface AppendCurrentShiftFlowProps {
  targetShiftId: string;
  batchId: string | null;
  draftId: string | null;
}

export function AppendCurrentShiftFlow({
  targetShiftId,
  batchId,
  draftId
}: AppendCurrentShiftFlowProps) {
  const { data: shiftData, isLoading: isShiftLoading, error: shiftError } = useQuery({
    ...shiftByIdQueryOptions(targetShiftId),
    enabled: !!targetShiftId
  });

  const targetShift = shiftData?.shift ?? null;

  const { data: ordersData } = useQuery({
    ...shiftOrdersQueryOptions(targetShiftId),
    enabled: !!targetShiftId && !!targetShift,
  });
  const shiftOrdersCount = ordersData?.length ?? 0;

  if (!targetShiftId) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">שגיאה: חסר מזהה משמרת יעד (targetShiftId)</p>
          <p className="mt-1">מסלול הוספה למשמרת קיימת דורש targetShiftId. יש להגיע ממסך העבודה.</p>
        </div>
      </div>
    );
  }

  if (shiftError) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">שגיאה בטעינת משמרת</p>
          <p className="mt-1">לא ניתן לטעון את פרטי המשמרת</p>
        </div>
      </div>
    );
  }

  if (!isShiftLoading && !targetShift) {
    return (
      <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
        <AlertCircle size={32} className="mx-auto text-amber-400 mb-2" />
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-bold">משמרת לא נמצאה</p>
          <p className="mt-1">המשמרת שנבחרה אינה קיימת או נסגרה. יש לחזור למסך העבודה.</p>
        </div>
      </div>
    );
  }

  if (!isShiftLoading && targetShift && targetShift.status !== 'active') {
    return (
      <div className="mx-auto max-w-lg py-20 text-center" dir="rtl">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold">משמרת סגורה</p>
          <p className="mt-1">לא ניתן להוסיף הזמנות למשמרת סגורה. יש לחזור למסך העבודה.</p>
        </div>
      </div>
    );
  }

  const showSourcePicker = !batchId || !draftId;

  if (isShiftLoading) {
    return (
      <div className="flex items-center justify-center py-20" dir="rtl">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <span className="text-sm text-gray-500 mr-2">טוען משמרת...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50" dir="rtl">
      <div className="border-b border-gray-200 bg-white px-4 py-3">
        <AppendCurrentShiftHeader
          targetShift={targetShift}
          isLoading={isShiftLoading}
          ordersCount={shiftOrdersCount}
        />
      </div>

      {showSourcePicker ? (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
            <AppendDemandSourcePicker targetShiftId={targetShiftId} />
          </div>
        </div>
      ) : (
        <SchemeBuilder
          mode="demand"
          batchId={batchId}
          draftId={draftId}
          targetShiftId={targetShiftId}
          intent="append-current-shift"
        />
      )}
    </div>
  );
}
