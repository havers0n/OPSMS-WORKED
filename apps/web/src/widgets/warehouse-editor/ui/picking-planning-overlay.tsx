import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  PackageCheck,
  RefreshCcw,
  Route
} from 'lucide-react';
import {
  previewPickingPlanFromOrders,
  previewPickingPlanFromWave
} from '@/entities/picking-planning/api/preview';
import { readDevPickingPlanningSourceFromSearch } from '@/entities/picking-planning/model/dev-source';
import {
  usePickingPlanningOverlayStore
} from '@/entities/picking-planning/model/overlay-store';
import {
  deriveDisplayedRouteSteps,
  findPackageById,
  getRouteStepId
} from '@/entities/picking-planning/model/route-steps';
import type {
  PickingPlanningOverlaySource,
  PlanningRouteStepDto,
  PlanningWarningDto
} from '@/entities/picking-planning/model/types';

export type PickingPlanningStepGeometryStatus = {
  status: 'resolved' | 'unresolved';
  reason?: string;
};

type PickingPlanningOverlayProps = {
  stepGeometryById?: Record<string, PickingPlanningStepGeometryStatus>;
};

function sourceLabel(source: PickingPlanningOverlaySource) {
  if (source.kind === 'orders') return `${source.orderIds.length} orders`;
  if (source.kind === 'wave') return `Wave ${source.waveId}`;
  return 'No source';
}

function formatNumber(value: number | undefined, suffix = '') {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return `${Number.isInteger(value) ? value : value.toFixed(1)}${suffix}`;
}

function groupWarnings(warnings: PlanningWarningDto[]) {
  return warnings.reduce<Record<PlanningWarningDto['severity'], PlanningWarningDto[]>>(
    (groups, warning) => {
      groups[warning.severity].push(warning);
      return groups;
    },
    { error: [], warning: [], info: [] }
  );
}

function RouteStepRow({
  index,
  isFirst,
  isLast,
  onMove,
  onSelect,
  selected,
  status,
  step
}: {
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
  onSelect: () => void;
  selected: boolean;
  status: PickingPlanningStepGeometryStatus | undefined;
  step: PlanningRouteStepDto;
}) {
  const isUnresolved = status?.status === 'unresolved';

  return (
    <div
      className="grid grid-cols-[auto_1fr_auto] gap-2 rounded-lg border px-2 py-2 text-xs"
      style={{
        background: selected ? 'rgba(219,234,254,0.84)' : 'rgba(255,255,255,0.74)',
        borderColor: isUnresolved
          ? 'rgba(245,158,11,0.52)'
          : selected
            ? 'rgba(37,99,235,0.48)'
            : 'rgba(148,163,184,0.35)'
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold"
        style={{
          background: isUnresolved ? 'rgba(254,243,199,0.9)' : 'rgba(37,99,235,0.1)',
          color: isUnresolved ? '#92400e' : 'var(--accent)'
        }}
      >
        {index + 1}
      </button>
      <button type="button" onClick={onSelect} className="min-w-0 text-left">
        <div className="truncate font-semibold text-slate-800">
          {step.skuId} · {formatNumber(step.qtyToPick)}
        </div>
        <div className="truncate text-[11px] text-slate-500">
          Task {step.taskId} · Location {step.fromLocationId}
        </div>
        <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-slate-500">
          <span>{step.allocations.length} allocations</span>
          {step.handlingInstruction && <span>{step.handlingInstruction}</span>}
          {isUnresolved && (
            <span className="font-semibold text-amber-700">
              canvas-unresolved{status?.reason ? `: ${status.reason}` : ''}
            </span>
          )}
        </div>
      </button>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          title={`Move ${step.taskId} up`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={isLast}
          title={`Move ${step.taskId} down`}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-35"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function PickingPlanningOverlay({
  stepGeometryById = {}
}: PickingPlanningOverlayProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    activePackageId,
    errorMessage,
    isLoading,
    preview,
    reorderedStepIdsByPackageId,
    resetReorder,
    reorderPackageSteps,
    selectedStepId,
    setActivePackageId,
    setPreview,
    setSelectedStepId,
    setSource,
    source
  } = usePickingPlanningOverlayStore();

  useEffect(() => {
    if (source.kind !== 'none') return;
    if (typeof window === 'undefined') return;

    const seeded = readDevPickingPlanningSourceFromSearch(
      window.location.search,
      import.meta.env.MODE
    );
    if (seeded.kind !== 'none') {
      setSource(seeded);
    }
  }, [setSource, source.kind]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      if (source.kind === 'none') {
        return;
      }

      usePickingPlanningOverlayStore.setState({
        isLoading: true,
        errorMessage: null
      });

      try {
        const nextPreview =
          source.kind === 'orders'
            ? await previewPickingPlanFromOrders({ orderIds: source.orderIds })
            : await previewPickingPlanFromWave({ waveId: source.waveId });
        if (!cancelled) {
          setPreview(nextPreview);
        }
      } catch (error) {
        if (!cancelled) {
          usePickingPlanningOverlayStore.setState({
            isLoading: false,
            errorMessage:
              error instanceof Error
                ? error.message
                : 'Failed to load picking planning preview.'
          });
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [setPreview, source]);

  const activePackage = useMemo(
    () => findPackageById(preview?.packages ?? [], activePackageId),
    [activePackageId, preview?.packages]
  );
  const displayedSteps = useMemo(
    () =>
      activePackage
        ? deriveDisplayedRouteSteps(
            activePackage.route.steps,
            reorderedStepIdsByPackageId[activePackage.workPackage.id]
          )
        : [],
    [activePackage, reorderedStepIdsByPackageId]
  );
  const displayedStepIds = useMemo(
    () => displayedSteps.map(getRouteStepId),
    [displayedSteps]
  );
  const warningGroups = useMemo(
    () => groupWarnings(preview?.warningDetails ?? []),
    [preview?.warningDetails]
  );

  if (isCollapsed) {
    return (
      <div className="pointer-events-none absolute left-4 top-4 z-30">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          data-testid="picking-planning-overlay-expand"
          className="pointer-events-auto inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-semibold shadow-md backdrop-blur"
          style={{
            background: 'rgba(255,255,255,0.9)',
            borderColor: 'rgba(37,99,235,0.42)',
            color: 'var(--accent)'
          }}
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Picking plan
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-30 max-h-[calc(100%-32px)] w-[min(620px,calc(100%-32px))]">
      <section
        data-testid="picking-planning-overlay"
        className="pointer-events-auto max-h-[calc(100vh-48px)] overflow-hidden rounded-xl border p-3 shadow-[0_16px_40px_rgba(15,23,42,0.18)] backdrop-blur-md"
        style={{
          background: 'rgba(248,250,252,0.9)',
          borderColor: 'rgba(37,99,235,0.36)'
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div
              className="text-[11px] font-semibold uppercase"
              style={{ color: 'var(--accent)' }}
            >
              View / Picking plan
            </div>
            <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Route className="h-4 w-4" />
              Read-only planning preview
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {sourceLabel(source)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            title="Collapse picking plan"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/70 hover:text-slate-700"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3 max-h-[calc(100vh-142px)] overflow-y-auto pr-1">
          {source.kind === 'none' && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 p-4 text-sm text-slate-600">
              No picking planning source selected.
            </div>
          )}

          {isLoading && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-800">
              Loading picking planning preview...
            </div>
          )}

          {errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50/80 p-4 text-sm text-red-700">
              {errorMessage}
            </div>
          )}

          {!isLoading && !errorMessage && preview && (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2">
                {[
                  ['Packages', preview.summary.packageCount],
                  ['Steps', preview.summary.routeStepCount],
                  ['Tasks', preview.summary.taskCount],
                  ['Warnings', preview.summary.warningCount]
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border bg-white/75 px-2 py-2"
                    style={{ borderColor: 'rgba(148,163,184,0.35)' }}
                  >
                    <div className="text-[10px] uppercase text-slate-500">
                      {label}
                    </div>
                    <div className="text-sm font-semibold text-slate-800">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border bg-white/75 px-3 py-2 text-xs text-slate-700">
                <div className="font-semibold text-slate-800">
                  {preview.strategy.name} · {preview.strategy.method}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  Route mode {preview.strategy.routePriorityMode}; split{' '}
                  {preview.summary.wasSplit ? preview.summary.splitReason : 'not required'}
                </div>
              </div>

              {preview.coverage && (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border bg-white/75 px-2 py-2">
                    <div className="text-[10px] uppercase text-slate-500">
                      Coverage
                    </div>
                    <div className="font-semibold text-slate-800">
                      {formatNumber(preview.coverage.planningCoveragePct, '%')}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-white/75 px-2 py-2">
                    <div className="text-[10px] uppercase text-slate-500">
                      Planned lines
                    </div>
                    <div className="font-semibold text-slate-800">
                      {preview.coverage.plannedLineCount}/{preview.coverage.orderLineCount}
                    </div>
                  </div>
                  <div className="rounded-lg border bg-white/75 px-2 py-2">
                    <div className="text-[10px] uppercase text-slate-500">
                      Unresolved
                    </div>
                    <div className="font-semibold text-slate-800">
                      {preview.unresolvedSummary?.total ?? preview.coverage.unresolvedLineCount}
                    </div>
                  </div>
                </div>
              )}

              {preview.unresolvedSummary &&
                preview.unresolvedSummary.total > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/75 px-3 py-2 text-xs text-amber-800">
                    <div className="font-semibold">Unresolved summary</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(preview.unresolvedSummary.byReason).map(
                        ([reason, count]) => (
                          <span key={reason}>
                            {reason}: {count}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

              {preview.warningDetails.length > 0 && (
                <div className="space-y-1.5">
                  {(['error', 'warning', 'info'] as const).map((severity) =>
                    warningGroups[severity].length > 0 ? (
                      <div
                        key={severity}
                        className="rounded-lg border bg-white/75 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-1 font-semibold capitalize text-slate-800">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          {severity} warnings
                        </div>
                        <div className="mt-1 space-y-1 text-[11px] text-slate-600">
                          {warningGroups[severity].map((warning) => (
                            <div key={`${warning.code}:${warning.message}`}>
                              <span className="font-semibold">{warning.code}</span>
                              {': '}
                              {warning.message}
                              {warning.source ? ` (${warning.source})` : ''}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-1.5">
                {preview.packages.map((pkg) => {
                  const isActive = pkg.workPackage.id === activePackageId;
                  return (
                    <button
                      key={pkg.workPackage.id}
                      type="button"
                      onClick={() => setActivePackageId(pkg.workPackage.id)}
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold"
                      style={{
                        background: isActive ? 'rgba(219,234,254,0.9)' : 'rgba(255,255,255,0.75)',
                        borderColor: isActive
                          ? 'rgba(37,99,235,0.5)'
                          : 'rgba(148,163,184,0.35)',
                        color: isActive ? 'var(--accent)' : '#475569'
                      }}
                    >
                      <PackageCheck className="h-3.5 w-3.5" />
                      {pkg.workPackage.code ?? pkg.workPackage.id}
                    </button>
                  );
                })}
              </div>

              {activePackage && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-800">
                      Route steps · {activePackage.route.metadata.mode}
                    </div>
                    <button
                      type="button"
                      onClick={() => resetReorder(activePackage.workPackage.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:bg-white/75"
                    >
                      <RefreshCcw className="h-3 w-3" />
                      Reset
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {displayedSteps.map((step, index) => {
                      const stepId = getRouteStepId(step);
                      return (
                        <RouteStepRow
                          key={stepId}
                          index={index}
                          isFirst={index === 0}
                          isLast={index === displayedSteps.length - 1}
                          onMove={(direction) =>
                            reorderPackageSteps(
                              activePackage.workPackage.id,
                              displayedStepIds,
                              stepId,
                              direction
                            )
                          }
                          onSelect={() => setSelectedStepId(stepId)}
                          selected={selectedStepId === stepId}
                          status={stepGeometryById[stepId]}
                          step={step}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
