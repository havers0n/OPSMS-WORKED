import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, CheckCircle2, MapPin, Package, RefreshCw, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import type { Container, ContainerType, PickStepDetail, PickTaskDetail } from '@wos/domain';
import {
  containerListQueryOptions,
  containerTypesQueryOptions
} from '@/entities/container/api/queries';
import { orderQueryOptions } from '@/entities/order/api/queries';
import { useAllocatePickSteps, useExecutePickStep } from '@/entities/pick-task/api/mutations';
import { pickTaskDetailQueryOptions } from '@/entities/pick-task/api/queries';
import {
  findNextPendingStep,
  getPickStepStatusColor,
  getPickStepStatusLabel,
  getPickTaskStatusColor,
  getPickTaskStatusLabel
} from '@/entities/pick-task/lib/pick-task-actions';
import { useCreateContainer } from '@/features/container-create/api/mutations';
import { routes, waveDetailPath, warehouseViewPath } from '@/shared/config/routes';

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

  // Build lookup map — data is already in memory, no extra fetch
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

// ── Step card ─────────────────────────────────────────────────────────────────

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
                  step.sourceCellAddress ?? step.sourceLocationCode ?? <span className="italic text-slate-400">Not allocated</span>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                <Package className="h-3 w-3" />
                Container
              </div>
              <div className="text-sm font-medium text-slate-900">
                {step.sourceContainerCode ?? <span className="italic text-slate-400">Not allocated</span>}
              </div>
            </div>
          </div>

          {/* Qty input row */}
          <div className="flex items-center gap-3">
            <label className="flex-1">
              <div className="mb-1 text-xs font-medium text-slate-700">
                Qty to pick <span className="font-normal text-slate-400">(required: {step.qtyRequired})</span>
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

// ── Blocked-only state banner ─────────────────────────────────────────────────

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

// ── Main page ─────────────────────────────────────────────────────────────────

type PickContainer = { id: string; label: string; typeLabel: string | null };

export function PickTaskPage() {
  const { id: taskId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const [pickContainer, setPickContainer] = useState<PickContainer | null>(null);

  // Origin context passed by the order drawer when navigating here
  const queryOrder = searchParams.get('order');
  const queryWave = searchParams.get('wave');

  const { data: task, isLoading: taskLoading } = useQuery(
    pickTaskDetailQueryOptions(taskId ?? null)
  );

  // Resolve orderId as early as possible so the order query fires immediately.
  // queryOrder covers normal navigation (cache hit); task?.sourceId covers direct open.
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
      queryWave && queryOrder ? `${waveDetailPath(queryWave)}?order=${queryOrder}`
      : queryWave ? waveDetailPath(queryWave)
      : queryOrder ? `${routes.operations}?order=${queryOrder}`
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
  // URL params take priority; fall back to task.sourceType/sourceId
  const effectiveOrderId =
    queryOrder ?? (task.sourceType === 'order' ? task.sourceId : null);
  const effectiveWaveId =
    queryWave ?? (task.sourceType === 'wave' ? task.sourceId : null);
  // Human-readable label from fetched order (cache hit in normal flow; one fetch on direct open)
  const orderLabel = orderDetail?.externalNumber ?? (effectiveOrderId ? effectiveOrderId.slice(-8) : '—');

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

  const pct = task.totalSteps > 0
    ? Math.round((task.completedSteps / task.totalSteps) * 100)
    : 0;

  const isTerminalTask =
    task.status === 'completed' || task.status === 'completed_with_exceptions';

  const nextPendingStep = findNextPendingStep(task.steps);

  const pendingSteps = task.steps.filter((s) => s.status === 'pending');
  const allRemainingBlocked =
    !isTerminalTask &&
    pendingSteps.length === 0 &&
    task.steps.some((s) => s.status === 'needs_replenishment');

  // Show "Allocate steps" when any pending step has no source location yet
  const hasUnallocatedSteps =
    !isTerminalTask &&
    task.steps.some((s) => s.status === 'pending' && s.sourceLocationId === null && s.sourceCellId === null);

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
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {orderLabel}
            </div>
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
            <div className="mt-1.5 font-mono text-xs text-slate-400">
              {task.taskNumber}
            </div>
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
                  {allocate.error instanceof Error ? allocate.error.message : 'Allocation failed. Try again.'}
                </div>
              )}
              {allocate.isSuccess && (
                <div className="mt-1 text-xs text-emerald-700">
                  Allocated {allocate.data.allocated} step{allocate.data.allocated !== 1 ? 's' : ''}
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

        {/* ── Completion banner (terminal task) ── */}
        {isTerminalTask && <TaskCompleteBanner task={task} />}

        {/* ── All-blocked banner ── */}
        {allRemainingBlocked && <AllBlockedBanner />}

        {/* ── Container setup (shown when no container chosen and task not done) ── */}
        {!isTerminalTask && !pickContainer && (
          <PickContainerSetup
            containers={containers}
            containerTypes={containerTypes}
            onSelect={(id, label, typeLabel) => setPickContainer({ id, label, typeLabel })}
          />
        )}

        {/* ── Selected container chip ── */}
        {pickContainer && !isTerminalTask && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-slate-400" />
              <div>
                <div className="text-slate-500">Picking into container:</div>
                <div className="font-medium text-slate-900">{pickContainer.label}</div>
                {pickContainer.typeLabel && (
                  <div className="text-slate-500">{pickContainer.typeLabel}</div>
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
        )}

        {/* ── Steps list ── */}
        {task.steps.length > 0 && (
          <section>
            <div className="mb-3 text-sm font-semibold text-slate-900">
              Steps{' '}
              <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
                {task.steps.length}
              </span>
            </div>

            <div className="space-y-3">
              {task.steps.map((step) => {
                const isActive =
                  !isTerminalTask &&
                  Boolean(pickContainer) &&
                  nextPendingStep?.id === step.id;

                return (
                  <StepCard
                    key={step.id}
                    step={step}
                    isActive={isActive}
                    pickContainerId={pickContainer?.id ?? ''}
                    taskId={task.id}
                    taskNumber={task.taskNumber}
                    onExecuted={() => {
                      // Invalidation handled by useExecutePickStep onSuccess.
                    }}
                  />
                );
              })}
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
