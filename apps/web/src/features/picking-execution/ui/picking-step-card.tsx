import type { PlanningRouteStepDto } from '@/entities/picking-planning/model/types';
import { formatPickInstruction } from '../model/pick-instruction-format';
import { ProductPickPhoto } from './product-pick-photo';
import { PickingProgress } from './picking-progress';

function resolveProductLabel(step: PlanningRouteStepDto) {
  return step.productName ?? step.displayCode ?? step.barcode ?? step.skuId;
}

export function PickingStepCard({
  step,
  progressCurrent,
  progressTotal,
  onConfirm,
  onWhereIsIt
}: {
  step: PlanningRouteStepDto;
  progressCurrent: number;
  progressTotal: number;
  onConfirm: () => void;
  onWhereIsIt: () => void;
}) {
  const pickInstruction = formatPickInstruction({
    qtyEach: step.qtyEach,
    packagingLevels: step.packagingLevels
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-white/90 p-3" data-testid="picking-step-card">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">Current pick</div>
        <PickingProgress current={progressCurrent} total={progressTotal} />
      </div>

      <div className="flex gap-3">
        <ProductPickPhoto
          productImageUrl={step.productImageUrl}
          productName={resolveProductLabel(step)}
        />

        <div className="min-w-0 flex-1 space-y-1 text-xs text-slate-700">
          <div className="truncate text-sm font-semibold text-slate-900" data-testid="picking-step-product-name">
            {resolveProductLabel(step)}
          </div>
          <div data-testid="picking-step-display-code">SKU: {step.displayCode ?? step.skuId}</div>
          {step.barcode && <div data-testid="picking-step-barcode">Barcode: {step.barcode}</div>}
          <div data-testid="picking-step-instruction">Pick: {pickInstruction.instruction}</div>
          <div data-testid="picking-step-qty-each">Total: {step.qtyEach ?? step.qtyToPick} each</div>
          <div data-testid="picking-step-address">Location: {step.addressLabel ?? step.fromLocationId}</div>
          {pickInstruction.degraded && (
            <div className="text-[11px] font-semibold text-amber-700">Packaging degraded to safe display</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
          data-testid="picking-step-confirm"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={onWhereIsIt}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          data-testid="picking-step-where-is-it"
        >
          Where is it?
        </button>
      </div>
    </div>
  );
}
