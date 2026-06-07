import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
  Package,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Container, ContainerType, PickStepDetail, PickTaskDetail } from '@wos/domain';
import {
  containerListQueryOptions,
  containerTypesQueryOptions
} from '@/entities/container/api/queries';
import { orderQueryOptions } from '@/entities/order/api/queries';
import { useAllocatePickSteps, useExecutePickStep, useSkipPickStep } from '@/entities/pick-task/api/mutations';
import { pickTaskDetailQueryOptions } from '@/entities/pick-task/api/queries';
import {
  findNextPendingStep,
  getPickStepStatusColor,
  getPickStepStatusLabel,
  getPickTaskStatusColor,
  getPickTaskStatusLabel
} from '@/entities/pick-task/lib/pick-task-actions';
import { useCreateContainer } from '@/features/container-create/api/mutations';
import { ProductPickPhoto } from '@/features/picking-execution/ui/product-pick-photo';
import { routes, waveDetailPath, warehouseViewPath } from '@/shared/config/routes';
import { useBarcodeScan } from '@/shared/lib/use-barcode-scan';
import { getWorkerSafeMutationErrorMessage } from '@/entities/pick-task/lib/worker-safe-error';

type PickTaskProgressBuckets = {
  picked: number;
  partial: number;
  skipped: number;
  exception: number;
  blocked: number;
  remaining: number;
};

function getPickTaskProgressBuckets(steps: PickStepDetail[]): PickTaskProgressBuckets {
  return steps.reduce<PickTaskProgressBuckets>(
    (acc, step) => {
      if (step.status === 'pending') {
        acc.remaining += 1;
      } else if (step.status === 'picked') {
        acc.picked += 1;
      } else if (step.status === 'partial') {
        acc.partial += 1;
      } else if (step.status === 'skipped') {
        acc.skipped += 1;
      } else if (step.status === 'exception') {
        acc.exception += 1;
      } else if (step.status === 'needs_replenishment') {
        acc.blocked += 1;
      }
      return acc;
    },
    { picked: 0, partial: 0, skipped: 0, exception: 0, blocked: 0, remaining: 0 }
  );
}

function isAllocatedStep(step: PickStepDetail): boolean {
  return !(step.status === 'pending' && step.sourceLocationId === null && step.sourceCellId === null);
}

function isActionableGuidedStep(step: PickStepDetail): boolean {
  return step.status === 'pending';
}

function getGuidedActionableSteps(
  steps: PickStepDetail[],
  pendingCanonicalReconciliationStepIds: ReadonlySet<string>
): PickStepDetail[] {
  return steps.filter(
    (step) =>
      isActionableGuidedStep(step) && !pendingCanonicalReconciliationStepIds.has(step.id)
  );
}

function findFirstActionableGuidedStep(
  steps: PickStepDetail[],
  pendingCanonicalReconciliationStepIds: ReadonlySet<string>
): PickStepDetail | null {
  return getGuidedActionableSteps(steps, pendingCanonicalReconciliationStepIds)[0] ?? null;
}

function findNextActionableGuidedStep(
  steps: PickStepDetail[],
  currentStepId: string,
  pendingCanonicalReconciliationStepIds: ReadonlySet<string>,
  excludedStepId?: string
): PickStepDetail | null {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  if (currentIndex < 0) {
    return findFirstActionableGuidedStep(
      excludedStepId ? steps.filter((step) => step.id !== excludedStepId) : steps,
      pendingCanonicalReconciliationStepIds
    );
  }

  for (let index = currentIndex + 1; index < steps.length; index += 1) {
    const step = steps[index];
    if (
      step.id !== excludedStepId &&
      isActionableGuidedStep(step) &&
      !pendingCanonicalReconciliationStepIds.has(step.id)
    ) {
      return step;
    }
  }

  return null;
}

function findPreviousActionableGuidedStep(
  steps: PickStepDetail[],
  currentStepId: string,
  pendingCanonicalReconciliationStepIds: ReadonlySet<string>
): PickStepDetail | null {
  const currentIndex = steps.findIndex((step) => step.id === currentStepId);
  if (currentIndex < 0) return null;

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (
      isActionableGuidedStep(step) &&
      !pendingCanonicalReconciliationStepIds.has(step.id)
    ) {
      return step;
    }
  }

  return null;
}

// ── Container setup (choose existing OR create new) ───────────────────────────

function PickContainerSetup({
  containers,
  containerTypes,
  onSelect
}: {
  containers: Container[];
  containerTypes: ContainerType[];
  onSelect: (id: string, label: string, typeLabel: string | null) => void;
}) {
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const pickableTypes = containerTypes.filter((ct) => ct.supportsPicking);
  const [typeId, setTypeId] = useState(pickableTypes[0]?.id ?? '');
  const [code, setCode] = useState('');
  const create = useCreateContainer();

  const active = containers.filter((c) => c.status === 'active');

  const typeById = new Map(containerTypes.map((t) => [t.id, t]));

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    const externalCode = code.trim();
    if (!typeId) return;
    create.mutate(
      {
        containerTypeId: typeId,
        externalCode: externalCode.length > 0 ? externalCode : undefined,
        operationalRole: 'pick'
      },
      {
        onSuccess: (result) => {
          const selectedType = pickableTypes.find((t) => t.id === typeId);
          onSelect(result.containerId, result.systemCode, selectedType?.description ?? null);
        }
      }
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-4 text-sm font-semibold text-slate-900">Pick container</div>

      {/* Tab toggle */}
      <div className="mb-4 flex rounded-xl border border-slate-200 p-0.5">
        {(['existing', 'new'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-medium transition ${
              tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'existing' ? 'Choose existing' : 'Create new'}
          </button>
        ))}
      </div>

      {/* ── Choose existing ── */}
      {tab === 'existing' && (
        <>
          {active.length === 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              No active containers available. Switch to "Create new" to make one.
            </div>
          ) : (
            <div className="space-y-2">
              {active.map((c) => {
                const type = typeById.get(c.containerTypeId);
                const label = c.systemCode;
                const secondary = c.externalCode;
                const typeLabel = type?.description ?? null;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c.id, label, typeLabel)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm transition hover:border-cyan-300 hover:bg-cyan-50"
                  >
                    <Package className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">{label}</div>
                      {(secondary || type) && (
                        <div className="text-xs text-slate-500">
                          {secondary ? secondary : null}
                          {secondary && type ? ' · ' : null}
                          {type ? `${type.code} · ${type.description}` : null}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Create new ── */}
      {tab === 'new' && (
        <form className="space-y-3" onSubmit={handleCreate}>
          {pickableTypes.length === 0 ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              No pick-capable container types configured. Add types first.
            </div>
          ) : (
            <>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Container type <span className="text-red-500">*</span>
                </label>
                <select
                  value={typeId}
                  onChange={(e) => setTypeId(e.target.value)}
                  required
                  className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-cyan-500"
                >
                  {pickableTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code} — {t.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  External code <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Optional operator code, e.g. TOTE-42"
                  className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                />
                <div className="mt-1 text-xs text-slate-500">
                  A system code will be assigned automatically.
                </div>
              </div>

              {create.isError && (
                <div className="text-xs text-red-600">
                  {getWorkerSafeMutationErrorMessage(
                    create.error,
                    'Unable to create a pick container. Try again.'
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!typeId || create.isPending}
                className="w-full rounded-xl bg-cyan-600 py-2.5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {create.isPending ? 'Creating…' : 'Create & select'}
              </button>
            </>
          )}
        </form>
      )}
    </div>
  );
}

// ── Guided step card (one step, full focus) ───────────────────────────────────

function GuidedStepCard({
  step,
  pickContainerId,
  pickContainerLabel,
  pickContainerTypeLabel,
  taskId,
  taskNumber,
  isWavePick,
  onExecuted
}: {
  step: PickStepDetail;
  pickContainerId: string;
  pickContainerLabel: string;
  pickContainerTypeLabel: string | null;
  taskId: string;
  taskNumber: string;
  isWavePick: boolean;
  onExecuted: (stepId: string) => void;
}) {
  // All state resets on remount — parent uses key={step.id}
  const [qtyActual, setQtyActual] = useState(String(step.qtyRequired));
  const [partialConfirm, setPartialConfirm] = useState(false);
  const [skipConfirm, setSkipConfirm] = useState(false);
  const [scanState, setScanState] = useState<'idle' | 'match' | 'mismatch'>('idle');
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const execute = useExecutePickStep();
  const skip = useSkipPickStep();

  const isBusy = execute.isPending || skip.isPending;

  // ── Barcode scan handler (optional — works even without a scanner) ──
  const handleScan = useCallback(
    (barcode: string) => {
      setLastScanned(barcode);
      // Normalise both sides: lowercase, strip dashes/spaces
      const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');
      const matches = norm(barcode) === norm(step.sku);
      setScanState(matches ? 'match' : 'mismatch');
      // Auto-dismiss after 3 s
      setTimeout(() => setScanState('idle'), 3000);
    },
    [step.sku]
  );

  useBarcodeScan(handleScan);

  const parsedQty = Number(qtyActual);
  const isValidQty =
    Number.isFinite(parsedQty) &&
    Number.isInteger(parsedQty) &&
    parsedQty >= 1 &&
    parsedQty <= step.qtyRequired;
  const isUnderPick = isValidQty && parsedQty < step.qtyRequired;
  const isBlocked = step.status === 'needs_replenishment';
  const isPicked =
    step.status === 'picked' ||
    step.status === 'partial' ||
    step.status === 'skipped' ||
    step.status === 'exception';

  function handleConfirmClick() {
    if (!isValidQty) return;
    // Partial pick: require explicit two-step confirmation
    if (isUnderPick && !partialConfirm) {
      setPartialConfirm(true);
      setSkipConfirm(false);
      return;
    }
    execute.mutate(
      { stepId: step.id, qtyActual: parsedQty, pickContainerId },
      { onSuccess: () => onExecuted(step.id) }
    );
  }

  function handleSkipConfirm() {
    skip.mutate(
      { stepId: step.id },
      { onSuccess: () => onExecuted(step.id) }
    );
  }

  function handleQtyChange(value: string) {
    setQtyActual(value);
    setPartialConfirm(false); // reset confirmation if qty changes
  }

  // ── Already completed / skipped ──
  if (isPicked) {
    const isSkipped = step.status === 'skipped';
    return (
      <div
        className={`flex flex-col items-center gap-4 rounded-2xl border p-10 text-center ${
          isSkipped
            ? 'border-slate-200 bg-slate-50'
            : 'border-emerald-200 bg-emerald-50'
        }`}
      >
        <CheckCircle2
          className={`h-12 w-12 ${isSkipped ? 'text-slate-400' : 'text-emerald-500'}`}
        />
        <div>
          <div
            className={`text-lg font-semibold ${
              isSkipped ? 'text-slate-700' : 'text-emerald-900'
            }`}
          >
            {step.itemName}
          </div>
          <div className={`mt-1 text-sm ${isSkipped ? 'text-slate-500' : 'text-emerald-700'}`}>
            {isSkipped ? 'Step was skipped' : `${step.qtyPicked} of ${step.qtyRequired} picked`}
          </div>
          <span
            className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getPickStepStatusColor(step.status)}`}
          >
            {getPickStepStatusLabel(step.status)}
          </span>
        </div>
      </div>
    );
  }

  // ── Blocked (needs replenishment) ──
  if (isBlocked) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-10 text-center">
        <AlertCircle className="h-12 w-12 text-amber-500" />
        <div>
          <div className="text-lg font-semibold text-amber-900">{step.itemName}</div>
          <div className="mt-1 text-sm text-amber-800">This step needs replenishment.</div>
          <div className="mt-0.5 text-sm text-amber-700">
            Notify your supervisor — no action required from you.
          </div>
        </div>
      </div>
    );
  }

  // ── Pending: full pick UI ──
  return (
    <div
      className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
      data-testid="guided-pick-step-card"
    >
      <div className="border-b border-cyan-200 bg-gradient-to-br from-cyan-600 via-cyan-500 to-sky-500 p-5 text-white sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
          Source location
        </div>
        <div className="mt-2 flex items-start gap-3">
          <MapPin className="mt-1 h-5 w-5 shrink-0 text-cyan-100" />
          <div className="min-w-0">
            {step.sourceCellAddress && step.sourceCellId && step.sourceFloorId ? (
              <Link
                to={warehouseViewPath({
                  floorId: step.sourceFloorId,
                  cellId: step.sourceCellId,
                  returnTaskId: taskId,
                  returnTaskNumber: taskNumber
                })}
                className="text-3xl font-black tracking-tight text-white underline decoration-cyan-200 underline-offset-4 sm:text-4xl"
              >
                {step.sourceCellAddress}
              </Link>
            ) : (
              <div className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                {step.sourceCellAddress ?? step.sourceLocationCode ?? 'Not allocated'}
              </div>
            )}
            <div className="mt-2 text-sm text-cyan-50">
              Go to this location before confirming the pick.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-6">
        <div
          className={`rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-colors duration-300 ${
            scanState === 'match'
              ? 'border-emerald-200 bg-emerald-50'
              : scanState === 'mismatch'
                ? 'border-red-200 bg-red-50'
                : ''
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0">
              <ProductPickPhoto productImageUrl={step.imageUrl} productName={step.itemName} />
            </div>
            <div className="min-w-0 flex-1">
              {isWavePick && step.orderNumber && (
                <div className="mb-2 inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  {step.orderNumber}
                </div>
              )}
              <div className="text-2xl font-bold leading-tight text-slate-950">
                {step.itemName}
              </div>
              <div className="mt-2 text-sm font-medium uppercase tracking-wide text-slate-500">
                SKU
              </div>
              <div className="font-mono text-base text-slate-700">{step.sku}</div>
            </div>
          </div>

          <div className="mt-4 rounded-2xl bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Required quantity
            </div>
            <div className="mt-2 flex items-end gap-2">
              <span className="text-4xl font-black text-slate-950">{step.qtyRequired}</span>
              <span className="pb-1 text-sm font-medium text-slate-500">units</span>
            </div>
          </div>
        </div>

      {/* ── Scan feedback (optional — only visible after a scan) ── */}
      {scanState === 'match' && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">
            Product verified — confirm to pick
          </span>
        </div>
      )}
      {scanState === 'mismatch' && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <div className="text-sm font-medium text-red-800">Wrong item scanned</div>
            {lastScanned && (
              <div className="mt-0.5 font-mono text-xs text-red-600">{lastScanned}</div>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
            <Package className="h-3.5 w-3.5" />
            Source container
          </div>
          <div className="text-sm font-semibold text-slate-900">
            {step.sourceContainerCode ?? <span className="italic text-slate-400">Not set</span>}
          </div>
        </div>
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-cyan-700">
            <Package className="h-3.5 w-3.5" />
            Destination container
          </div>
          <div className="text-sm font-semibold text-cyan-950">{pickContainerLabel}</div>
          {pickContainerTypeLabel && (
            <div className="mt-0.5 text-xs text-cyan-700">{pickContainerTypeLabel}</div>
          )}
        </div>
      </div>

      {!partialConfirm && (
        <div>
          <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Picked quantity
          </div>
          <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 p-3">
            <button
              type="button"
              onClick={() => handleQtyChange(String(Math.max(1, Number(qtyActual) - 1)))}
              disabled={parsedQty <= 1 || isBusy}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-2xl font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-30"
              aria-label="Decrease picked quantity"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={step.qtyRequired}
              value={qtyActual}
              onChange={(e) => handleQtyChange(e.target.value)}
              disabled={isBusy}
              className="h-16 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-center text-3xl font-black text-slate-950 outline-none focus:border-cyan-500 disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() =>
                handleQtyChange(String(Math.min(step.qtyRequired, Number(qtyActual) + 1)))
              }
              disabled={parsedQty >= step.qtyRequired || isBusy}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-2xl font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-30"
              aria-label="Increase picked quantity"
            >
              +
            </button>
          </div>

          {isUnderPick && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Less than required — confirming will record a partial pick exception.
            </div>
          )}

          {execute.isError && (
            <div className="mt-3 text-xs text-red-600">
              {getWorkerSafeMutationErrorMessage(
                execute.error,
                'Unable to confirm this pick. Try again.'
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Partial confirmation screen ── */}
      {partialConfirm && (
        <div
          className="sticky bottom-0 border-t border-amber-200 bg-amber-50/95 p-5 backdrop-blur"
          data-testid="guided-pick-sticky-actions"
        >
          <div className="mb-4 flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <div className="text-sm font-semibold text-amber-900">Confirm partial pick</div>
              <div className="mt-0.5 text-sm text-amber-800">
                You are picking{' '}
                <span className="font-semibold">{parsedQty}</span>
                {' '}of{' '}
                <span className="font-semibold">{step.qtyRequired}</span>{' '}
                required. This will be recorded as a partial pick exception.
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPartialConfirm(false)}
              disabled={isBusy}
              className="flex-1 rounded-2xl border border-amber-300 bg-white py-3 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Go back
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleConfirmClick}
              className="flex-1 rounded-2xl bg-amber-600 py-3 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              {execute.isPending ? 'Confirming…' : 'Confirm partial'}
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm button (normal flow) ── */}
      {!partialConfirm && (
        <div
          className="sticky bottom-0 border-t border-slate-200 bg-white/95 px-5 pb-5 pt-4 backdrop-blur"
          data-testid="guided-pick-sticky-actions"
        >
          <button
            type="button"
            disabled={!isValidQty || isBusy}
            onClick={handleConfirmClick}
            className="w-full rounded-2xl bg-cyan-600 py-4 text-base font-semibold text-white transition hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50"
          >
            {execute.isPending ? 'Confirming…' : 'Confirm pick'}
          </button>
        </div>
      )}

      {/* ── Skip step section ── */}
      {!partialConfirm && (
        <div className="px-5 pb-5">
          {!skipConfirm ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setSkipConfirm(true)}
              className="w-full rounded-2xl border border-slate-200 py-3 text-sm font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              Problem / skip step
            </button>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-3 text-sm font-semibold text-red-900">
                Skip this step?
              </div>
              <div className="mb-4 text-xs text-red-700">
                The step will be marked as skipped. This can't be undone from this screen.
              </div>
              {skip.isError && (
                <div className="mb-3 text-xs text-red-600">
                  {getWorkerSafeMutationErrorMessage(
                    skip.error,
                    'Unable to skip this step. Try again.'
                  )}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSkipConfirm(false)}
                  disabled={isBusy}
                  className="flex-1 rounded-xl border border-red-200 bg-white py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSkipConfirm}
                  disabled={isBusy}
                  className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                >
                  {skip.isPending ? 'Skipping…' : 'Confirm skip'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// ── Wave order summary ────────────────────────────────────────────────────────

function WaveOrderSummary({ steps }: { steps: PickStepDetail[] }) {
  // Group by orderId to build per-order progress
  type OrderGroup = { orderNumber: string | null; total: number; done: number };
  const orderGroups = new Map<string, OrderGroup>();

  for (const step of steps) {
    if (!step.orderId) continue;
    const existing = orderGroups.get(step.orderId);
    const done =
      step.status === 'picked' ||
      step.status === 'partial' ||
      step.status === 'skipped' ||
      step.status === 'exception'
        ? 1
        : 0;
    if (existing) {
      existing.total++;
      existing.done += done;
    } else {
      orderGroups.set(step.orderId, {
        orderNumber: step.orderNumber ?? null,
        total: 1,
        done
      });
    }
  }

  if (orderGroups.size === 0) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 p-3">
      <div className="mb-2 text-xs font-semibold text-violet-800">
        Wave pick — {orderGroups.size} order{orderGroups.size !== 1 ? 's' : ''}
      </div>
      <div className="flex flex-wrap gap-2">
        {[...orderGroups.entries()].map(([orderId, group]) => {
          const isComplete = group.done === group.total;
          return (
            <div
              key={orderId}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
                isComplete
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-violet-200 bg-white text-violet-700'
              }`}
            >
              <span>{group.orderNumber ?? `…${orderId.slice(-6)}`}</span>
              <span
                className={`font-normal ${
                  isComplete ? 'text-emerald-500' : 'text-violet-400'
                }`}
              >
                {group.done}/{group.total}
              </span>
              {isComplete && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Guided pick execution (navigation + step card) ────────────────────────────

function GuidedPickExecution({
  task,
  pickContainer,
  taskId,
  taskNumber
}: {
  task: PickTaskDetail;
  pickContainer: PickContainer;
  taskId: string;
  taskNumber: string;
}) {
  const steps = task.steps;
  const isWavePick = task.sourceType === 'wave';
  const [pendingCanonicalReconciliationStepIds, setPendingCanonicalReconciliationStepIds] =
    useState<Set<string>>(() => new Set());
  const actionableSteps = getGuidedActionableSteps(
    steps,
    pendingCanonicalReconciliationStepIds
  );
  const [activeStepId, setActiveStepId] = useState<string | null>(
    () => findFirstActionableGuidedStep(steps, new Set())?.id ?? null
  );

  useEffect(() => {
    setPendingCanonicalReconciliationStepIds(new Set());
    setActiveStepId(findFirstActionableGuidedStep(steps, new Set())?.id ?? null);
  }, [taskId]);

  useEffect(() => {
    setPendingCanonicalReconciliationStepIds((current) => {
      if (current.size === 0) return current;

      const next = new Set<string>();
      for (const stepId of current) {
        const canonicalStep = steps.find((step) => step.id === stepId);
        if (canonicalStep && canonicalStep.status === 'pending') {
          next.add(stepId);
        }
      }

      return next.size === current.size &&
        [...next].every((stepId) => current.has(stepId))
        ? current
        : next;
    });
  }, [steps]);

  useEffect(() => {
    const firstActionableStep = actionableSteps[0] ?? null;
    if (!firstActionableStep) {
      if (activeStepId !== null) {
        setActiveStepId(null);
      }
      return;
    }

    if (!activeStepId || !actionableSteps.some((step) => step.id === activeStepId)) {
      setActiveStepId(firstActionableStep.id);
    }
  }, [actionableSteps, activeStepId]);

  if (actionableSteps.length === 0) {
    return <GuidedExecutionUpdatingState />;
  }

  const step =
    (activeStepId
      ? actionableSteps.find((actionableStep) => actionableStep.id === activeStepId)
      : null) ??
    actionableSteps[0] ??
    null;

  if (!step) return null;

  const activeStepIndex = actionableSteps.findIndex(
    (actionableStep) => actionableStep.id === step.id
  );
  const previousActionableStep = findPreviousActionableGuidedStep(
    steps,
    step.id,
    pendingCanonicalReconciliationStepIds
  );
  const nextActionableStep = findNextActionableGuidedStep(
    steps,
    step.id,
    pendingCanonicalReconciliationStepIds
  );

  function handleExecuted(stepId: string) {
    const nextPendingCanonicalReconciliationStepIds = new Set(
      pendingCanonicalReconciliationStepIds
    );
    nextPendingCanonicalReconciliationStepIds.add(stepId);
    setPendingCanonicalReconciliationStepIds(nextPendingCanonicalReconciliationStepIds);
    const nextStep = findNextActionableGuidedStep(
      steps,
      stepId,
      nextPendingCanonicalReconciliationStepIds,
      stepId
    );
    setActiveStepId(nextStep?.id ?? null);
  }

  return (
    <div className="space-y-4">
      {/* Wave order summary — only for wave tasks */}
      {isWavePick && <WaveOrderSummary steps={steps} />}

      {/* Step navigation row */}
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
        <button
          type="button"
          disabled={!previousActionableStep}
          onClick={() => previousActionableStep && setActiveStepId(previousActionableStep.id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:opacity-30"
          aria-label="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Current step
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {activeStepIndex + 1} of {actionableSteps.length}
          </div>
          <div className="mt-1 flex items-center justify-center gap-1.5 overflow-x-hidden">
            {actionableSteps.map((actionableStep) => (
            <button
              key={actionableStep.id}
              type="button"
              onClick={() => setActiveStepId(actionableStep.id)}
              aria-label={`Go to step ${actionableStep.sequenceNo}: ${actionableStep.itemName}${actionableStep.orderNumber ? ` (${actionableStep.orderNumber})` : ''}`}
              className={`shrink-0 rounded-full transition-all ${
                actionableStep.id === step.id
                  ? 'h-2.5 w-6 bg-cyan-600'
                  : 'h-2 w-2 bg-slate-300 hover:bg-slate-400'
              }`}
            />
          ))}
          </div>
        </div>

        <button
          type="button"
          disabled={!nextActionableStep}
          onClick={() => nextActionableStep && setActiveStepId(nextActionableStep.id)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition hover:border-slate-300 hover:text-slate-600 disabled:opacity-30"
          aria-label="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
        <ChevronDown className="h-3.5 w-3.5" />
        Manual step navigation is optional. Guided execution stays on actionable pending steps.
      </div>

      {/* Active step — key forces remount on step change, resetting local form state */}
        <GuidedStepCard
          key={step.id}
          step={step}
          pickContainerId={pickContainer.id}
          pickContainerLabel={pickContainer.label}
          pickContainerTypeLabel={pickContainer.typeLabel}
          taskId={taskId}
          taskNumber={taskNumber}
          isWavePick={isWavePick}
        onExecuted={handleExecuted}
      />
    </div>
  );
}

// ── List-mode step card ───────────────────────────────────────────────────────

function StepCard({
  step,
  isActive,
  pickContainerId,
  taskId,
  taskNumber,
  onExecuted
}: {
  step: PickStepDetail;
  isActive: boolean;
  pickContainerId: string;
  taskId: string;
  taskNumber: string;
  onExecuted: () => void;
}) {
  const [qtyActual, setQtyActual] = useState(String(step.qtyRequired));
  const execute = useExecutePickStep();

  const parsedQty = Number(qtyActual);
  const isValidQty = Number.isInteger(parsedQty) && parsedQty >= 1 && parsedQty <= step.qtyRequired;
  const isUnderPick = isValidQty && parsedQty < step.qtyRequired;
  const isBlocked = step.status === 'needs_replenishment';

  function handleConfirm() {
    if (!isValidQty) return;
    execute.mutate(
      { stepId: step.id, qtyActual: parsedQty, pickContainerId },
      { onSuccess: onExecuted }
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition ${
        isActive
          ? 'border-cyan-300 shadow-sm'
          : isBlocked
            ? 'border-amber-200 bg-amber-50/30'
            : 'border-slate-200'
      }`}
    >
      {/* ── Card header (always visible) ── */}
      <div className="flex items-center gap-4 p-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-500">
          {step.sequenceNo}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{step.itemName}</span>
            <span className="text-xs text-slate-500">{step.sku}</span>
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            {step.status === 'pending'
              ? `Required: ${step.qtyRequired}`
              : `${step.qtyPicked} / ${step.qtyRequired} picked`}
          </div>
        </div>

        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${getPickStepStatusColor(step.status)}`}
        >
          {getPickStepStatusLabel(step.status)}
        </span>
      </div>

      {/* ── Active step: execution controls ── */}
      {isActive && !isBlocked && (
        <div className="border-t border-slate-100 p-4">
          {/* Source location */}
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin className="h-3 w-3" />
                Source
              </div>
              <div className="text-sm font-medium text-slate-900">
                {step.sourceCellAddress && step.sourceCellId && step.sourceFloorId ? (
                  <Link
                    to={warehouseViewPath({
                      floorId: step.sourceFloorId,
                      cellId: step.sourceCellId,
                      returnTaskId: taskId,
                      returnTaskNumber: taskNumber
                    })}
                    className="text-cyan-700 underline-offset-2 hover:underline"
                  >
                    {step.sourceCellAddress}
                  </Link>
                ) : (
                  step.sourceCellAddress ?? step.sourceLocationCode ?? (
                    <span className="italic text-slate-400">Not allocated</span>
                  )
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Package className="h-3 w-3" />
                Container
              </div>
              <div className="text-sm font-medium text-slate-900">
                {step.sourceContainerCode ?? (
                  <span className="italic text-slate-400">Not allocated</span>
                )}
              </div>
            </div>
          </div>

          {/* Qty input row */}
          <div className="flex items-center gap-3">
            <label className="flex-1">
              <div className="mb-1 text-xs font-medium text-slate-700">
                Qty to pick{' '}
                <span className="font-normal text-slate-400">(required: {step.qtyRequired})</span>
              </div>
              <input
                type="number"
                min={1}
                max={step.qtyRequired}
                value={qtyActual}
                onChange={(e) => setQtyActual(e.target.value)}
                disabled={execute.isPending}
                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500 disabled:bg-slate-100"
              />
            </label>
            <div className="pt-5">
              <button
                type="button"
                disabled={!isValidQty || execute.isPending}
                onClick={handleConfirm}
                className="h-10 rounded-xl bg-cyan-600 px-5 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {execute.isPending ? 'Confirming…' : 'Confirm'}
              </button>
            </div>
          </div>

          {/* Under-pick warning */}
          {isUnderPick && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Quantity is less than required — will be recorded as a partial pick.
            </div>
          )}

          {/* Mutation error */}
          {execute.isError && (
            <div className="mt-3 text-xs text-red-600">
              {getWorkerSafeMutationErrorMessage(
                execute.error,
                'Unable to confirm this pick. Try again.'
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Blocked step: replenishment notice ── */}
      {isBlocked && (
        <div className="border-t border-amber-200 px-4 py-3">
          <div className="flex items-start gap-2 text-xs text-amber-800">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This step needs replenishment. Notify your supervisor — no action required from you.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Task complete banner ──────────────────────────────────────────────────────

function TaskCompleteBanner({ task }: { task: PickTaskDetail }) {
  const progress = getPickTaskProgressBuckets(task.steps);
  const isTerminal = task.status === 'completed' || task.status === 'completed_with_exceptions';
  const actionableSteps = progress.remaining;
  const title = isTerminal
    ? task.status === 'completed'
      ? 'Task complete'
      : 'Task complete with exceptions'
    : actionableSteps === 0
      ? 'No actionable steps remain'
      : 'Task progress';
  const details =
    progress.blocked > 0
      ? `${progress.blocked} step${progress.blocked !== 1 ? 's' : ''} still need replenishment.`
      : actionableSteps === 0
        ? 'No remaining pick actions are available for this task.'
        : null;

  return (
    <div
      className={`rounded-2xl border p-5 ${
        isTerminal
          ? 'border-emerald-200 bg-emerald-50'
          : actionableSteps === 0
            ? 'border-orange-200 bg-orange-50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          className={`mt-0.5 h-5 w-5 shrink-0 ${
            isTerminal
              ? 'text-emerald-600'
              : actionableSteps === 0
                ? 'text-orange-500'
                : 'text-slate-500'
          }`}
        />
        <div className="min-w-0">
          <div
            className={`font-semibold ${
              isTerminal
                ? 'text-emerald-900'
                : actionableSteps === 0
                  ? 'text-orange-900'
                  : 'text-slate-900'
            }`}
          >
            {title}
          </div>
          {details && (
            <div className={`mt-0.5 text-sm ${isTerminal ? 'text-emerald-700' : 'text-slate-600'}`}>
              {details}
            </div>
          )}
          {task.completedAt && (
            <div className={`mt-1 text-xs ${isTerminal ? 'text-emerald-700' : 'text-slate-500'}`}>
              Completed {new Date(task.completedAt).toLocaleString()}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800">
          <div className="font-medium">Picked</div>
          <div className="mt-0.5 text-lg font-semibold">{progress.picked}</div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-orange-800">
          <div className="font-medium">Partial</div>
          <div className="mt-0.5 text-lg font-semibold">{progress.partial}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
          <div className="font-medium">Skipped</div>
          <div className="mt-0.5 text-lg font-semibold">{progress.skipped}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-800">
          <div className="font-medium">Exception</div>
          <div className="mt-0.5 text-lg font-semibold">{progress.exception}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          <div className="font-medium">Blocked</div>
          <div className="mt-0.5 text-lg font-semibold">{progress.blocked}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-700">
          <div className="font-medium">Remaining</div>
          <div className="mt-0.5 text-lg font-semibold">{progress.remaining}</div>
        </div>
      </div>
    </div>
  );
}

function AllBlockedBanner() {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div>
        <div className="font-semibold text-amber-900">All remaining steps need replenishment</div>
        <div className="mt-0.5 text-sm text-amber-800">
          Contact your supervisor to unblock this task.
        </div>
      </div>
    </div>
  );
}

// ── View mode toggle ──────────────────────────────────────────────────────────

type ViewMode = 'guided' | 'list';

function ViewModeToggle({
  mode,
  onChange
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">View:</span>
      <div className="flex rounded-lg border border-slate-200 p-0.5">
        <button
          type="button"
          onClick={() => onChange('guided')}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            mode === 'guided'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          Guided
        </button>
        <button
          type="button"
          onClick={() => onChange('list')}
          className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition ${
            mode === 'list'
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <List className="h-3 w-3" />
          List
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type PickContainer = { id: string; label: string; typeLabel: string | null };

function GuidedExecutionUpdatingState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-6 text-center">
      <div className="text-sm font-medium text-slate-900">Updating task...</div>
      <div className="mt-1 text-xs text-slate-500">
        Waiting for the latest task state before showing the next step.
      </div>
    </div>
  );
}

export function PickTaskPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [pickContainer, setPickContainer] = useState<PickContainer | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('guided');

  const queryOrder = searchParams.get('order');
  const queryWave = searchParams.get('wave');

  const { data: task, isLoading: taskLoading } = useQuery(
    pickTaskDetailQueryOptions(taskId ?? null)
  );

  const preTaskOrderId =
    queryOrder ?? (task?.sourceType === 'order' ? task.sourceId : null);
  const { data: orderDetail } = useQuery(orderQueryOptions(preTaskOrderId));
  const { data: containers = [], isLoading: containersLoading } = useQuery(
    containerListQueryOptions({ operationalRole: 'pick' })
  );
  const { data: containerTypes = [], isLoading: typesLoading } = useQuery(
    containerTypesQueryOptions()
  );
  const allocate = useAllocatePickSteps();

  // ── Loading ──
  if (taskLoading || containersLoading || typesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  // ── Not found ──
  if (!task) {
    const notFoundBackPath =
      queryWave && queryOrder
        ? `${waveDetailPath(queryWave)}?order=${queryOrder}`
        : queryWave
          ? waveDetailPath(queryWave)
          : queryOrder
            ? `${routes.operations}?order=${queryOrder}`
            : routes.operations;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
        <div className="text-sm">Pick task not found.</div>
        <Link to={notFoundBackPath} className="text-sm text-cyan-600 hover:underline">
          Back to Operations
        </Link>
      </div>
    );
  }

  // ── Derive origin context ──
  const effectiveOrderId =
    queryOrder ?? (task.sourceType === 'order' ? task.sourceId : null);
  const effectiveWaveId =
    queryWave ?? (task.sourceType === 'wave' ? task.sourceId : null);
  const orderLabel =
    orderDetail?.externalNumber ?? (effectiveOrderId ? effectiveOrderId.slice(-8) : '—');

  // ── Back target ──
  const backPath =
    effectiveWaveId && effectiveOrderId
      ? `${waveDetailPath(effectiveWaveId)}?order=${effectiveOrderId}`
      : effectiveWaveId
        ? waveDetailPath(effectiveWaveId)
        : effectiveOrderId
          ? `${routes.operations}?order=${effectiveOrderId}`
          : routes.operations;
  const backLabel = effectiveWaveId ? 'Wave' : 'Operations';

  const isTerminalTask =
    task.status === 'completed' || task.status === 'completed_with_exceptions';
  const progress = getPickTaskProgressBuckets(task.steps);
  const progressDone = progress.picked + progress.partial + progress.skipped + progress.exception;
  const progressPct = task.steps.length > 0 ? Math.round((progressDone / task.steps.length) * 100) : 0;
  const allocationRequired =
    !isTerminalTask &&
    (task.steps.length === 0 ||
      task.steps.some((step: PickStepDetail) => step.status === 'pending' && !isAllocatedStep(step)));
  const showBlockedState = !allocationRequired && progress.remaining === 0 && progress.blocked > 0;
  const showCompletionSummary = !allocationRequired && progress.remaining === 0 && progress.blocked === 0;
  const nextPendingStep = findNextPendingStep(task.steps);
  const canUseGuidedMode = !showCompletionSummary && Boolean(pickContainer) && progress.remaining > 0;
  const showContainerSelection = !allocationRequired && !showCompletionSummary && !showBlockedState && !pickContainer;
  const showGuidedExecution = !showCompletionSummary && !showBlockedState && Boolean(pickContainer) && progress.remaining > 0;

  return (
    <div className="flex h-full w-full flex-col overflow-auto">
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">

        {/* ── Back link ── */}
        <Link
          to={backPath}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>

        {/* ── Task header ── */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">Order</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{orderLabel}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${getPickTaskStatusColor(task.status)}`}
              >
                {getPickTaskStatusLabel(task.status)}
              </span>
              {effectiveWaveId && (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  Wave pick
                </span>
              )}
            </div>
            <div className="mt-1.5 font-mono text-xs text-slate-400">{task.taskNumber}</div>
          </div>

        {/* Progress */}
        <div className="text-right">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-left text-xs text-slate-500">
            <div>
              <span className="font-medium text-slate-900">Picked</span> {progress.picked}
            </div>
            <div>
              <span className="font-medium text-slate-900">Partial</span> {progress.partial}
            </div>
            <div>
              <span className="font-medium text-slate-900">Skipped</span> {progress.skipped}
            </div>
            <div>
              <span className="font-medium text-slate-900">Exception</span> {progress.exception}
            </div>
            <div>
              <span className="font-medium text-slate-900">Blocked</span> {progress.blocked}
            </div>
            <div>
              <span className="font-medium text-slate-900">Remaining</span> {progress.remaining}
            </div>
          </div>
          <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${
                progressPct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'
              }`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
        </div>

        {/* ── Allocate steps banner ── */}
        {allocationRequired && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Steps not yet allocated</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Run allocation to assign pick locations from the warehouse.
              </div>
              {allocate.isError && (
                <div className="mt-1 text-xs text-red-600">
                  {getWorkerSafeMutationErrorMessage(
                    allocate.error,
                    'Unable to allocate steps. Try again.'
                  )}
                </div>
              )}
              {allocate.isSuccess && (
                <div className="mt-1 text-xs text-emerald-700">
                  Allocated {allocate.data.allocated} step
                  {allocate.data.allocated !== 1 ? 's' : ''}
                  {allocate.data.needsReplenishment > 0
                    ? ` · ${allocate.data.needsReplenishment} blocked for replenishment`
                    : ''}
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={allocate.isPending}
              onClick={() => allocate.mutate(task.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5" />
              {allocate.isPending ? 'Allocating…' : 'Allocate steps'}
            </button>
          </div>
        )}

        {/* ── Completion summary ── */}
        {showCompletionSummary && <TaskCompleteBanner task={task} />}

        {/* ── Blocked / unresolved state ── */}
        {showBlockedState && <AllBlockedBanner />}

        {/* ── Container setup ── */}
        {showContainerSelection && (
          <PickContainerSetup
            containers={containers}
            containerTypes={containerTypes}
            onSelect={(id, label, typeLabel) => setPickContainer({ id, label, typeLabel })}
          />
        )}

        {/* ── Container chip + guided execution ── */}
        {showGuidedExecution && pickContainer && (
          <section className="space-y-4">
            {/* Container chip */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <Package className="h-4 w-4 text-slate-400" />
                <div>
                  <span className="text-slate-500">Picking into: </span>
                  <span className="font-medium text-slate-900">{pickContainer.label}</span>
                  {pickContainer.typeLabel && (
                    <span className="ml-1 text-slate-500">· {pickContainer.typeLabel}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickContainer(null)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Change
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                Steps{' '}
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                  {task.steps.length}
                </span>
              </div>
              <ViewModeToggle mode={viewMode} onChange={setViewMode} />
            </div>

            {/* ── Guided mode ── */}
            {viewMode === 'guided' && canUseGuidedMode && (
              <GuidedPickExecution
                task={task}
                pickContainer={pickContainer}
                taskId={task.id}
                taskNumber={task.taskNumber}
              />
            )}

            {/* ── List mode ── */}
            {viewMode === 'list' && (
              <div className="space-y-3">
                {task.steps.map((step: PickStepDetail) => {
                  const isActive = Boolean(pickContainer) && nextPendingStep?.id === step.id;
                  return (
                    <StepCard
                      key={step.id}
                      step={step}
                      isActive={isActive}
                      pickContainerId={pickContainer.id}
                      taskId={task.id}
                      taskNumber={task.taskNumber}
                      onExecuted={() => {
                        // Invalidation handled by useExecutePickStep onSuccess.
                      }}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
