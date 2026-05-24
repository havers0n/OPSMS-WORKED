import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  List,
  MapPin,
  Package,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useCallback, useState } from 'react';
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
  getPickTaskStatusLabel,
  isTerminalStep
} from '@/entities/pick-task/lib/pick-task-actions';
import { useCreateContainer } from '@/features/container-create/api/mutations';
import { ProductPickPhoto } from '@/features/picking-execution/ui/product-pick-photo';
import { routes, waveDetailPath, warehouseViewPath } from '@/shared/config/routes';
import { useBarcodeScan } from '@/shared/lib/use-barcode-scan';

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
  const [createError, setCreateError] = useState<string | null>(null);
  const create = useCreateContainer();

  const active = containers.filter((c) => c.status === 'active');

  const typeById = new Map(containerTypes.map((t) => [t.id, t]));

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const externalCode = code.trim();
    if (!typeId) return;
    setCreateError(null);
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
        },
        onError: (err) => {
          setCreateError(err instanceof Error ? err.message : 'Creation failed. Try again.');
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

              {createError && (
                <div className="text-xs text-red-600">{createError}</div>
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
  taskId,
  taskNumber,
  isWavePick,
  onExecuted
}: {
  step: PickStepDetail;
  pickContainerId: string;
  taskId: string;
  taskNumber: string;
  isWavePick: boolean;
  onExecuted: () => void;
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
      const norm = (s: string) => s.toLowerCase().replace(/[\s\-]/g, '');
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
      { onSuccess: onExecuted }
    );
  }

  function handleSkipConfirm() {
    skip.mutate(
      { stepId: step.id },
      { onSuccess: onExecuted }
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {/* Product */}
      <div
        className={`flex gap-4 p-5 transition-colors duration-300 ${
          scanState === 'match'
            ? 'bg-emerald-50'
            : scanState === 'mismatch'
              ? 'bg-red-50'
              : ''
        }`}
      >
        <ProductPickPhoto productImageUrl={step.imageUrl} productName={step.itemName} />
        <div className="min-w-0 flex-1">
          {/* Order badge — only shown for wave tasks */}
          {isWavePick && step.orderNumber && (
            <div className="mb-1.5 inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
              {step.orderNumber}
            </div>
          )}
          <div className="text-lg font-bold leading-snug text-slate-900">{step.itemName}</div>
          <div className="mt-0.5 text-sm text-slate-500">{step.sku}</div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-cyan-50 px-3 py-1.5 text-sm font-semibold text-cyan-700">
            <Package className="h-3.5 w-3.5" />
            Pick {step.qtyRequired}
          </div>
        </div>
      </div>

      {/* ── Scan feedback (optional — only visible after a scan) ── */}
      {scanState === 'match' && (
        <div className="flex items-center gap-2 border-t border-emerald-200 bg-emerald-50 px-5 py-2.5">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">
            Product verified — confirm to pick
          </span>
        </div>
      )}
      {scanState === 'mismatch' && (
        <div className="flex items-start gap-2 border-t border-red-200 bg-red-50 px-5 py-2.5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
          <div>
            <div className="text-sm font-medium text-red-800">Wrong item scanned</div>
            {lastScanned && (
              <div className="mt-0.5 font-mono text-xs text-red-600">{lastScanned}</div>
            )}
          </div>
        </div>
      )}

      {/* Source location + container */}
      <div className="grid grid-cols-2 gap-px border-t border-slate-100 bg-slate-100">
        <div className="bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3 w-3" />
            Pick from
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
              step.sourceCellAddress ??
              step.sourceLocationCode ?? (
                <span className="italic text-slate-400">Not allocated</span>
              )
            )}
          </div>
        </div>
        <div className="bg-white p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Package className="h-3 w-3" />
            Container
          </div>
          <div className="text-sm font-medium text-slate-900">
            {step.sourceContainerCode ?? (
              <span className="italic text-slate-400">Not set</span>
            )}
          </div>
        </div>
      </div>

      {/* Qty input (hidden during partial confirm) */}
      {!partialConfirm && (
        <div className="border-t border-slate-100 p-5">
          <div className="mb-3 text-xs font-medium text-slate-700">
            Quantity to pick{' '}
            <span className="font-normal text-slate-400">(required: {step.qtyRequired})</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleQtyChange(String(Math.max(1, Number(qtyActual) - 1)))}
              disabled={parsedQty <= 1 || isBusy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-xl font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-30"
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
              className="h-11 flex-1 rounded-xl border border-slate-300 text-center text-lg font-semibold outline-none focus:border-cyan-500 disabled:bg-slate-100"
            />
            <button
              type="button"
              onClick={() =>
                handleQtyChange(String(Math.min(step.qtyRequired, Number(qtyActual) + 1)))
              }
              disabled={parsedQty >= step.qtyRequired || isBusy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-xl font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-30"
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
              {execute.error instanceof Error
                ? execute.error.message
                : 'Execution failed. Try again.'}
            </div>
          )}
        </div>
      )}

      {/* ── Partial confirmation screen ── */}
      {partialConfirm && (
        <div className="border-t border-amber-200 bg-amber-50 p-5">
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
              className="flex-1 rounded-xl border border-amber-300 bg-white py-2.5 text-sm font-medium text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            >
              Go back
            </button>
            <button
              type="button"
              disabled={isBusy}
              onClick={handleConfirmClick}
              className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
            >
              {execute.isPending ? 'Confirming…' : 'Confirm partial'}
            </button>
          </div>
        </div>
      )}

      {/* ── Confirm button (normal flow) ── */}
      {!partialConfirm && (
        <div className="border-t border-slate-100 px-5 pb-5">
          <button
            type="button"
            disabled={!isValidQty || isBusy}
            onClick={handleConfirmClick}
            className="w-full rounded-xl bg-cyan-600 py-3.5 text-base font-semibold text-white transition hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-50"
          >
            {execute.isPending ? 'Confirming…' : 'Confirm pick'}
          </button>
        </div>
      )}

      {/* ── Skip step section ── */}
      {!partialConfirm && (
        <div className="border-t border-slate-100 px-5 pb-5">
          {!skipConfirm ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setSkipConfirm(true)}
              className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            >
              Skip step
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
                  {skip.error instanceof Error
                    ? skip.error.message
                    : 'Skip failed. Try again.'}
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
    const done = isTerminalStep(step.status) ? 1 : 0;
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
  pickContainerId,
  taskId,
  taskNumber
}: {
  task: PickTaskDetail;
  pickContainerId: string;
  taskId: string;
  taskNumber: string;
}) {
  const steps = task.steps;
  const isWavePick = task.sourceType === 'wave';

  // Start at first pending step; fall back to 0
  const [activeIndex, setActiveIndex] = useState<number>(() => {
    const firstPending = steps.findIndex((s: PickStepDetail) => s.status === 'pending');
    return firstPending >= 0 ? firstPending : 0;
  });

  const safeIndex = Math.min(activeIndex, Math.max(0, steps.length - 1));
  const step = steps[safeIndex];
  const isFirstStep = safeIndex === 0;
  const isLastStep = safeIndex === steps.length - 1;

  function handleExecuted() {
    if (!isLastStep) {
      setActiveIndex((i) => i + 1);
    }
  }

  if (!step) return null;

  return (
    <div className="space-y-4">
      {/* Wave order summary — only for wave tasks */}
      {isWavePick && <WaveOrderSummary steps={steps} />}

      {/* Step navigation row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={isFirstStep}
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Previous step"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Step progress dots */}
        <div className="flex flex-1 items-center justify-center gap-1.5 overflow-x-hidden">
          {steps.map((s: PickStepDetail, i: number) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveIndex(i)}
              aria-label={`Go to step ${i + 1}: ${s.itemName}${s.orderNumber ? ` (${s.orderNumber})` : ''}`}
              className={`shrink-0 rounded-full transition-all ${
                i === safeIndex
                  ? 'h-2.5 w-2.5 bg-cyan-600'
                  : s.status === 'picked' || s.status === 'partial'
                    ? 'h-2 w-2 bg-emerald-400 hover:bg-emerald-500'
                    : s.status === 'needs_replenishment'
                      ? 'h-2 w-2 bg-amber-400 hover:bg-amber-500'
                      : s.status === 'skipped' || s.status === 'exception'
                        ? 'h-2 w-2 bg-slate-400 hover:bg-slate-500'
                        : 'h-2 w-2 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          disabled={isLastStep}
          onClick={() => setActiveIndex((i) => Math.min(steps.length - 1, i + 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-30"
          aria-label="Next step"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Step counter label */}
      <div className="text-center text-xs text-slate-500">
        Step{' '}
        <span className="font-semibold text-slate-900">{safeIndex + 1}</span>
        {' '}of{' '}
        <span className="font-semibold text-slate-900">{steps.length}</span>
        {step.status !== 'pending' && (
          <span
            className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-medium ${getPickStepStatusColor(step.status)}`}
          >
            {getPickStepStatusLabel(step.status)}
          </span>
        )}
      </div>

      {/* Active step — key forces remount on step change, resetting local form state */}
      <GuidedStepCard
        key={step.id}
        step={step}
        pickContainerId={pickContainerId}
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
              {execute.error instanceof Error ? execute.error.message : 'Execution failed. Try again.'}
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
  const isClean = task.status === 'completed';

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-5 ${
        isClean
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-orange-200 bg-orange-50'
      }`}
    >
      <CheckCircle2
        className={`mt-0.5 h-5 w-5 shrink-0 ${isClean ? 'text-emerald-600' : 'text-orange-500'}`}
      />
      <div>
        <div className={`font-semibold ${isClean ? 'text-emerald-900' : 'text-orange-900'}`}>
          {isClean
            ? `Task complete — all ${task.totalSteps} step${task.totalSteps !== 1 ? 's' : ''} picked`
            : 'Task complete with exceptions'}
        </div>
        {!isClean && (
          <div className="mt-0.5 text-sm text-orange-800">
            Some steps had exceptions or partial picks. Review with your supervisor.
          </div>
        )}
        {task.completedAt && (
          <div className={`mt-1 text-xs ${isClean ? 'text-emerald-700' : 'text-orange-700'}`}>
            Completed {new Date(task.completedAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ── All-blocked banner ────────────────────────────────────────────────────────

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

  const pct =
    task.totalSteps > 0
      ? Math.round((task.completedSteps / task.totalSteps) * 100)
      : 0;

  const isTerminalTask =
    task.status === 'completed' || task.status === 'completed_with_exceptions';

  const nextPendingStep: PickStepDetail | null = findNextPendingStep<PickStepDetail>(task.steps as PickStepDetail[]);

  const pendingSteps = task.steps.filter((s: PickStepDetail) => s.status === 'pending');
  const allRemainingBlocked =
    !isTerminalTask &&
    pendingSteps.length === 0 &&
    task.steps.some((s: PickStepDetail) => s.status === 'needs_replenishment');

  const hasUnallocatedSteps =
    !isTerminalTask &&
    task.steps.some(
      (s: PickStepDetail) =>
        s.status === 'pending' &&
        s.sourceLocationId === null &&
        s.sourceCellId === null
    );

  // Guided mode only makes sense when there are steps and a container is selected
  const canUseGuidedMode = !isTerminalTask && Boolean(pickContainer) && task.steps.length > 0;

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
            <div className="text-2xl font-bold text-slate-900">
              {task.completedSteps}
              <span className="text-lg font-normal text-slate-400">/{task.totalSteps}</span>
            </div>
            <div className="text-xs text-slate-500">steps complete</div>
            <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Allocate steps banner ── */}
        {hasUnallocatedSteps && (
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-slate-900">Steps not yet allocated</div>
              <div className="mt-0.5 text-xs text-slate-500">
                Run allocation to assign pick locations from the warehouse.
              </div>
              {allocate.isError && (
                <div className="mt-1 text-xs text-red-600">
                  {allocate.error instanceof Error
                    ? allocate.error.message
                    : 'Allocation failed. Try again.'}
                </div>
              )}
              {allocate.isSuccess && (
                <div className="mt-1 text-xs text-emerald-700">
                  Allocated {allocate.data.allocated} step
                  {allocate.data.allocated !== 1 ? 's' : ''}
                  {allocate.data.needsReplenishment > 0
                    ? ` · ${allocate.data.needsReplenishment} need replenishment`
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

        {/* ── Completion banner ── */}
        {isTerminalTask && <TaskCompleteBanner task={task} />}

        {/* ── All-blocked banner ── */}
        {allRemainingBlocked && <AllBlockedBanner />}

        {/* ── Container setup ── */}
        {!isTerminalTask && !pickContainer && (
          <PickContainerSetup
            containers={containers}
            containerTypes={containerTypes}
            onSelect={(id, label, typeLabel) => setPickContainer({ id, label, typeLabel })}
          />
        )}

        {/* ── Container chip + view toggle + steps ── */}
        {!isTerminalTask && pickContainer && task.steps.length > 0 && (
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

            {/* Mode toggle (only when there are steps to navigate) */}
            {task.steps.length > 0 && (
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">
                  Steps{' '}
                  <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                    {task.steps.length}
                  </span>
                </div>
                <ViewModeToggle mode={viewMode} onChange={setViewMode} />
              </div>
            )}

            {/* ── Guided mode ── */}
            {viewMode === 'guided' && canUseGuidedMode && (
              <GuidedPickExecution
                task={task}
                pickContainerId={pickContainer.id}
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

        {/* ── Steps list when no container selected (read-only preview) ── */}
        {!isTerminalTask && !pickContainer && task.steps.length > 0 && (
          <section>
            <div className="mb-3 text-sm font-semibold text-slate-900">
              Steps{' '}
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                {task.steps.length}
              </span>
            </div>
            <div className="space-y-3">
              {task.steps.map((step: PickStepDetail) => (
                <StepCard
                  key={step.id}
                  step={step}
                  isActive={false}
                  pickContainerId=""
                  taskId={task.id}
                  taskNumber={task.taskNumber}
                  onExecuted={() => {}}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Terminal task steps (list, read-only) ── */}
        {isTerminalTask && task.steps.length > 0 && (
          <section>
            <div className="mb-3 text-sm font-semibold text-slate-900">
              Steps{' '}
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                {task.steps.length}
              </span>
            </div>
            <div className="space-y-3">
              {task.steps.map((step: PickStepDetail) => (
                <StepCard
                  key={step.id}
                  step={step}
                  isActive={false}
                  pickContainerId=""
                  taskId={task.id}
                  taskNumber={task.taskNumber}
                  onExecuted={() => {}}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Empty steps ── */}
        {task.steps.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500">
            No steps have been allocated to this task yet.
          </div>
        )}

      </div>
    </div>
  );
}
