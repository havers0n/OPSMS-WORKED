import { useQuery } from '@tanstack/react-query';
import { shiftByIdQueryOptions } from '@/entities/manual-shift/api/queries';
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
  const { data: shiftData, isLoading: isShiftLoading } = useQuery({
    ...shiftByIdQueryOptions(targetShiftId),
    enabled: !!targetShiftId
  });

  const targetShift = shiftData?.shift ?? null;
  const targetShiftLines = shiftData?.lines ?? [];

  const showSourcePicker = !batchId || !draftId;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6" dir="rtl">
      <AppendCurrentShiftHeader
        targetShift={targetShift}
        isLoading={isShiftLoading}
        ordersCount={targetShiftLines.length}
      />

      {showSourcePicker ? (
        <AppendDemandSourcePicker targetShiftId={targetShiftId} />
      ) : (
        <div className="border border-blue-100 rounded-2xl overflow-hidden">
          <SchemeBuilder
            mode="demand"
            batchId={batchId}
            draftId={draftId}
            targetShiftId={targetShiftId}
          />
        </div>
      )}
    </div>
  );
}
