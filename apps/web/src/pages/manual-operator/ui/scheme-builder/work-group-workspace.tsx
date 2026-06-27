import { useState, useMemo, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Plus } from 'lucide-react';
import type { SourceOrder, SourceOrderItem, SchemeBuilderCapabilities } from './scheme-types';
import { useSchemeBuilderStore } from './scheme-store';
import { PlanningLineSection } from './planning-line-section';
import { DeliveryPointLineCreateModal } from './delivery-point-line-create-modal';
import { getVisiblePlanningLines } from './scheme-display-utils';
import { useCreateLine } from '@/entities/manual-shift/api/mutations';
import { usePatchManualShiftOrder } from '@/entities/manual-shift/api/mutations';

export function WorkGroupWorkspace({
  selectedAreaName,
  orderItemMap,
  onStartAssign,
  capabilities,
  orderNumberMap,
  sourceOrders,
  isShiftMode,
  shiftId,
}: {
  selectedAreaName: string;
  orderItemMap: Record<string, SourceOrderItem[]>;
  onStartAssign: (workGroupId: string) => void;
  capabilities: SchemeBuilderCapabilities;
  orderNumberMap: Record<string, string | null>;
  sourceOrders: SourceOrder[];
  isShiftMode: boolean;
  shiftId: string | null;
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [dpCreateStatus, setDpCreateStatus] = useState<'idle' | 'creating' | 'success' | 'partial' | 'error'>('idle');
  const [dpCreateMessage, setDpCreateMessage] = useState<string | null>(null);

  const getPlanningLinesByArea = useSchemeBuilderStore((s) => s.getPlanningLinesByArea);
  const createPlanningLine = useSchemeBuilderStore((s) => s.createPlanningLine);

  const areaOrders = useMemo(() => {
    return sourceOrders.filter((o) => o.areaName === selectedAreaName);
  }, [sourceOrders, selectedAreaName]);

  const areaLines = getVisiblePlanningLines(
    getPlanningLinesByArea(selectedAreaName),
  );

  const createLineMutation = useCreateLine(shiftId ?? '');
  const patchOrderMutation = usePatchManualShiftOrder();

  const handleCreate = (name: string) => {
    createPlanningLine(selectedAreaName, name);
  };

  const handleCreateWithDeliveryPoint = useCallback(async (name: string, _deliveryPointId: string, orderIds: string[]) => {
    if (!shiftId) return;
    setDpCreateStatus('creating');
    setDpCreateMessage(null);

    try {
      const newLine = await createLineMutation.mutateAsync({ name, sortOrder: 0 });

      const results = await Promise.allSettled(
        orderIds.map((orderId) =>
          patchOrderMutation.mutateAsync({
            orderId,
            lineId: newLine.id,
            shiftId,
          })
        )
      );

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      const failed = results.filter((r) => r.status === 'rejected').length;

      if (failed === 0) {
        setDpCreateStatus('success');
        setDpCreateMessage(`הקו נוצר וכל ${succeeded} ההזמנות שויכו`);
      } else if (succeeded > 0) {
        setDpCreateStatus('partial');
        setDpCreateMessage(`הקו נוצר, ${succeeded} הזמנות שויכו, ${failed} נכשלו`);
      } else {
        setDpCreateStatus('error');
        setDpCreateMessage('יצירת הקו נכשלה');
      }

      setShowCreateModal(false);
    } catch {
      setDpCreateStatus('error');
      setDpCreateMessage('יצירת הקו נכשלה');
    }
  }, [shiftId, createLineMutation, patchOrderMutation]);

  const statusBanner = useMemo(() => {
    if (dpCreateStatus === 'idle') return null;
    if (dpCreateStatus === 'creating') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          <Loader2 size={16} className="animate-spin" />
          יוצר קו ומשייך הזמנות...
        </div>
      );
    }
    if (dpCreateStatus === 'success') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800">
          <CheckCircle2 size={16} />
          {dpCreateMessage}
        </div>
      );
    }
    if (dpCreateStatus === 'partial') {
      return (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          <AlertCircle size={16} />
          {dpCreateMessage}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
        <AlertCircle size={16} />
        {dpCreateMessage}
      </div>
    );
  }, [dpCreateStatus, dpCreateMessage]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-bold text-gray-900">קווי עבודה</h2>
        {capabilities.canCreatePlanningLines && (
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            קו עבודה
          </button>
        )}
      </div>

      {statusBanner}

      {dpCreateStatus !== 'creating' && (areaLines.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-lg p-4 text-center">
          <p className="text-sm text-gray-500 mb-2">
            {capabilities.canCreatePlanningLines ? 'יש ליצור קווי עבודה ולשייך אליהן קבוצות עבודה ושורות מוצר.' : 'אין קבוצות עבודה בתצוגה זו'}
          </p>
          {capabilities.canCreatePlanningLines && (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              צור קו עבודה
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
            {areaLines.map((pl) => (
              <PlanningLineSection
                key={pl.id}
                planningLine={pl}
                orderItemMap={orderItemMap}
                onStartAssign={onStartAssign}
                capabilities={capabilities}
                orderNumberMap={orderNumberMap}
              />
            ))}
        </div>
      ))}

      <DeliveryPointLineCreateModal
        isOpen={showCreateModal && dpCreateStatus !== 'creating'}
        onClose={() => {
          setShowCreateModal(false);
          if (dpCreateStatus === 'success' || dpCreateStatus === 'partial' || dpCreateStatus === 'error') {
            setDpCreateStatus('idle');
            setDpCreateMessage(null);
          }
        }}
        onCreate={handleCreate}
        sourceOrders={areaOrders}
        isShiftMode={isShiftMode}
        onCreateWithDeliveryPoint={handleCreateWithDeliveryPoint}
      />
    </div>
  );
}