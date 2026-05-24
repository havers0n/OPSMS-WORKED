import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  previewPickingPlanFromOrders,
  previewPickingPlanFromWave
} from '@/entities/picking-planning/api/preview';
import { findPackageById } from '@/entities/picking-planning/model/route-steps';
import { PickingRunPanel } from '@/features/picking-execution/ui/picking-run-panel';
import { routes, warehouseViewPath } from '@/shared/config/routes';

export function PickingRunPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId')?.trim() ?? '';
  const waveId = searchParams.get('waveId')?.trim() ?? '';
  const hasOrder = orderId.length > 0;
  const hasWave = waveId.length > 0;

  const source = hasOrder
    ? { kind: 'orders' as const, orderIds: [orderId] }
    : hasWave
      ? { kind: 'wave' as const, waveId }
      : null;

  const previewQuery = useQuery({
    queryKey: ['picking-run-preview', hasOrder ? orderId : null, hasWave ? waveId : null],
    enabled: Boolean(source),
    queryFn: async () => {
      if (!source) throw new Error('No source provided');
      return source.kind === 'orders'
        ? previewPickingPlanFromOrders({ orderIds: source.orderIds })
        : previewPickingPlanFromWave({ waveId: source.waveId });
    }
  });

  const activePackage = useMemo(() => {
    const preview = previewQuery.data;
    if (!preview || preview.packages.length === 0) return null;
    return findPackageById(preview.packages, preview.packages[0]?.workPackage.id ?? null);
  }, [previewQuery.data]);

  if (!source) {
    return (
      <div className="p-6 text-sm text-red-700" data-testid="picking-run-no-id">
        Missing picker run identifier. Provide orderId or waveId.
      </div>
    );
  }

  if (previewQuery.isLoading) {
    return <div className="p-6 text-sm text-slate-600" data-testid="picking-run-loading">Loading picking run...</div>;
  }

  if (previewQuery.isError) {
    return (
      <div className="p-6 text-sm text-red-700" data-testid="picking-run-error">
        Failed to load picking run: {previewQuery.error instanceof Error ? previewQuery.error.message : 'Unknown error'}
      </div>
    );
  }

  if (!activePackage) {
    return (
      <div className="p-6 text-sm text-slate-600" data-testid="picking-run-empty">
        No picking tasks are available for this source.
      </div>
    );
  }

  const sourceLabel = hasOrder ? `Order ${orderId}` : `Wave ${waveId}`;

  return (
    <div className="p-6">
      <h1 className="mb-1 text-lg font-semibold text-slate-900">Picker run</h1>
      <div className="mb-4 text-xs text-slate-500" data-testid="picking-run-source">{sourceLabel}</div>
      <PickingRunPanel
        packageId={activePackage.workPackage.id}
        displayedSteps={activePackage.route.steps}
        onFocusCell={(cellId) => {
          // TODO: include floorId when preview route steps expose it for floor-aware deep-linking.
          if (cellId) {
            navigate(warehouseViewPath({ cellId }));
            return;
          }
          navigate(routes.warehouseView);
        }}
      />
    </div>
  );
}
