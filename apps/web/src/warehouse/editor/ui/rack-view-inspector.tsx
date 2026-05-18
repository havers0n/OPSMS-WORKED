import type { FloorWorkspace } from '@wos/domain';
import type { OperationsCellStatus } from '@wos/domain';
import type { ReactNode } from 'react';
import { AlertTriangle, Boxes, Box, ClipboardList, Package, X } from 'lucide-react';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorOperationsCells } from '@/entities/location/api/use-floor-operations-cells';
import {
  useEditorSelection
} from '@/warehouse/editor/model/editor-selectors';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import {
  buildRackViewSummary,
  getRackViewStatusRows,
  type RackViewSummary
} from './rack-view-inspector-logic';

type RackViewInspectorProps = {
  workspace: FloorWorkspace | null;
  onClose: () => void;
};

const statusPresentation: Record<OperationsCellStatus, { label: string; className: string }> = {
  empty: {
    label: 'Empty',
    className: 'border-slate-200 bg-slate-50 text-slate-500'
  },
  stocked: {
    label: 'Stocked',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700'
  },
  pick_active: {
    label: 'Pick active',
    className: 'border-sky-200 bg-sky-50 text-sky-700'
  },
  reserved: {
    label: 'Reserved',
    className: 'border-violet-200 bg-violet-50 text-violet-700'
  },
  quarantined: {
    label: 'Quarantined',
    className: 'border-amber-200 bg-amber-50 text-amber-700'
  }
};

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function SummaryMetric({
  label,
  value,
  tone = 'default'
}: {
  label: string;
  value: string | number;
  tone?: 'default' | 'attention';
}) {
  return (
    <div className="rounded-md border border-[var(--border-muted)] bg-white px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
        {label}
      </div>
      <div
        className={
          tone === 'attention'
            ? 'mt-1 text-lg font-semibold text-amber-700'
            : 'mt-1 text-lg font-semibold text-slate-800'
        }
      >
        {value}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)]">
      <div className="flex items-center gap-2 border-b border-[var(--border-muted)] px-3 py-2.5">
        <span className="text-[var(--accent)]">{icon}</span>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {title}
        </div>
      </div>
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

function StatusBreakdown({ summary }: { summary: RackViewSummary }) {
  const rows = getRackViewStatusRows(summary);

  return (
    <div className="space-y-3">
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">Utilization</span>
          <span className="font-semibold text-slate-800">{summary.utilizationPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-[var(--accent)]"
            style={{ width: `${summary.utilizationPercent}%` }}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {rows.map((row) => {
          const presentation = statusPresentation[row.status];
          return (
            <span
              key={row.status}
              className={`rounded-full border px-2 py-1 text-[11px] font-medium ${presentation.className}`}
            >
              {presentation.label} {row.count}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function RackViewInspector({ workspace, onClose }: RackViewInspectorProps) {
  const selection = useEditorSelection();
  const layout = useWorkspaceLayout(workspace);
  const rackId = selection.type === 'rack' ? selection.rackIds[0] ?? null : null;
  const rack = rackId && layout ? layout.racks[rackId] ?? null : null;
  const floorId = workspace?.floorId ?? layout?.floorId ?? null;
  const {
    data: publishedCells = [],
    isLoading: publishedCellsLoading,
    isError: publishedCellsIsError
  } = usePublishedCells(floorId);
  const {
    data: operationsCells = [],
    isLoading: operationsCellsLoading,
    isError: operationsCellsIsError
  } = useFloorOperationsCells(floorId);
  const summary = rack
    ? buildRackViewSummary({
      rack,
      publishedCells,
      operationsCells
    })
    : null;
  const dataIsLoading = publishedCellsLoading || operationsCellsLoading;
  const dataHasError = publishedCellsIsError || operationsCellsIsError;

  if (!rack) {
    return (
      <aside
        className="flex h-full w-full flex-col"
        style={{ background: 'var(--surface-primary)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            View
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-400">
          Select a rack to inspect.
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: 'var(--surface-primary)' }}
      data-testid="rack-view-inspector"
    >
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <div className="flex min-w-0 items-center gap-2">
          <Box className="h-4 w-4 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              View
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold text-slate-800">
              Rack {rack.displayCode}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {dataIsLoading ? (
          <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Loading rack runtime...
          </div>
        ) : null}

        {dataHasError ? (
          <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Runtime data could not be loaded. Structural context is still shown.
          </div>
        ) : null}

        {summary ? (
          <>
            <SectionCard title="Operational snapshot" icon={<ClipboardList className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-2">
                <SummaryMetric label="Cells" value={summary.cellCount} />
                <SummaryMetric label="Occupied" value={summary.occupiedCellCount} />
                <SummaryMetric label="Containers" value={summary.containerCount} />
                <SummaryMetric
                  label="Work cells"
                  value={summary.activeWorkCellCount}
                  tone={summary.activeWorkCellCount > 0 ? 'attention' : 'default'}
                />
              </div>
              <div className="mt-3">
                <StatusBreakdown summary={summary} />
              </div>
            </SectionCard>

            <SectionCard title="Current containers" icon={<Boxes className="h-4 w-4" />}>
              {summary.containers.length > 0 ? (
                <div className="divide-y divide-[var(--border-muted)]">
                  {summary.containers.slice(0, 5).map((container) => (
                    <div key={container.containerId} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {container.displayCode}
                          </div>
                          <div className="mt-0.5 text-xs capitalize text-slate-500">
                            {container.containerType} / {container.containerStatus}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-slate-500">
                          <div>{container.itemCount} items</div>
                          <div>{formatNumber(container.totalQuantity)} units</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">No containers in this rack.</div>
              )}
            </SectionCard>

            <SectionCard title="Inventory summary" icon={<Package className="h-4 w-4" />}>
              {summary.inventoryItems.length > 0 ? (
                <div className="divide-y divide-[var(--border-muted)]">
                  {summary.inventoryItems.slice(0, 5).map((item) => (
                    <div key={item.key} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-800">
                            {item.title}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-slate-500">
                            {item.meta ?? 'No SKU'} / {item.containerCount} containers
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs font-semibold text-slate-700">
                          {formatNumber(item.totalQuantity)} {item.uom}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">No inventory in this rack.</div>
              )}
            </SectionCard>

            <SectionCard title="Rack context" icon={<Box className="h-4 w-4" />}>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-slate-400">Type</div>
                  <div className="mt-0.5 font-semibold capitalize text-slate-700">
                    {rack.kind}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Axis</div>
                  <div className="mt-0.5 font-semibold capitalize text-slate-700">
                    {rack.axis}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Faces</div>
                  <div className="mt-0.5 font-semibold text-slate-700">
                    {summary.structure.enabledFaceCount}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Slots</div>
                  <div className="mt-0.5 font-semibold text-slate-700">
                    {summary.structure.slotCount}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Length</div>
                  <div className="mt-0.5 font-semibold text-slate-700">
                    {formatNumber(rack.totalLength)}m
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Rotation</div>
                  <div className="mt-0.5 font-semibold text-slate-700">
                    {rack.rotationDeg}deg
                  </div>
                </div>
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </aside>
  );
}
