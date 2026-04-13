import type { FloorWorkspace, LocationStorageSnapshotRow, Rack, RackInspectorPayload } from '@wos/domain';
import React, { useState, useEffect } from 'react';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { useRackInspector } from '@/entities/rack/api/use-rack-inspector';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusActiveLevel,
} from '../model/v2/v2-selectors';

/**
 * StorageInspectorV2 — Read-only right surface for the V2 storage path.
 *
 * Panel modes (PR2):
 * - empty          — no rack, no cell selected
 * - rack-overview  — rack selected, no cell drilled in
 * - cell-overview  — cell selected; shows containers + inventory preview
 * - container-detail — local drill-down into one container; back → cell-overview
 *
 * State ownership:
 * - selectedRackId, selectedCellId, activeLevel → StorageFocusStore (global, spatial)
 * - selectedContainerId → local useState (panel-only, never escapes)
 *
 * Cell data path is fetched once at the top level and shared between
 * cell-overview and container-detail — no duplicate query orchestration.
 *
 * Read-only invariants (no mutations, no task triggers, no new global stores).
 *
 * Fields NOT available in current BFF responses — explicitly omitted:
 * - capacityMode, policy, retentionDays
 */

interface StorageInspectorV2Props {
  workspace: FloorWorkspace | null;
}

const INVENTORY_PREVIEW_LIMIT = 3;

// ── Panel mode model ───────────────────────────────────────────────────────────

type PanelMode =
  | { kind: 'empty' }
  | { kind: 'rack-overview'; rackId: string }
  | { kind: 'cell-overview'; cellId: string }
  | { kind: 'container-detail'; cellId: string; containerId: string };

/**
 * Derives the current panel mode from spatial focus state and local container selection.
 * Pure function — exported for isolated testing.
 *
 * Priority: container-detail > cell-overview > rack-overview > empty
 * containerId only activates when cellId is also set (it is local to the cell panel).
 */
export function resolvePanelMode(
  rackId: string | null,
  cellId: string | null,
  containerId: string | null
): PanelMode {
  if (cellId && containerId) return { kind: 'container-detail', cellId, containerId };
  if (cellId) return { kind: 'cell-overview', cellId };
  if (rackId) return { kind: 'rack-overview', rackId };
  return { kind: 'empty' };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Group snapshot rows by containerId. Returns array of { containerId, rows }. */
function groupByContainer(
  rows: LocationStorageSnapshotRow[]
): Array<{ containerId: string; rows: LocationStorageSnapshotRow[] }> {
  const map = new Map<string, LocationStorageSnapshotRow[]>();
  for (const row of rows) {
    const existing = map.get(row.containerId);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.containerId, [row]);
    }
  }
  return Array.from(map.entries()).map(([containerId, rows]) => ({ containerId, rows }));
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
    </div>
  );
}

function StatusBadge({ occupied }: { occupied: boolean }) {
  if (occupied) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-red-50 text-red-700 border-red-200">
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-500" />
        Occupied
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-green-50 text-green-700 border-green-200">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-green-500" />
      Empty
    </span>
  );
}

function InspectorFooter() {
  return (
    <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500 bg-gray-50">
      <p>
        <span className="font-medium">PR2:</span> Explicit panel modes — rack-overview, cell-overview, container-detail.
        {' '}Actions deferred to PR3+.
      </p>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
          <svg
            className="w-6 h-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700">No location selected</p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          Select a location from the navigator to view details
        </p>
      </div>
      <InspectorFooter />
    </div>
  );
}

// ── Loading state ──────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
        <p className="text-sm text-gray-400">Loading location…</p>
      </div>
      <InspectorFooter />
    </div>
  );
}

// ── Rack overview (rack selected, no cell drilled in) ─────────────────────────

function OccupancyBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 tabular-nums w-8 text-right">{pct}%</span>
    </div>
  );
}

function RackOverviewPanel({ rackId }: { rackId: string }) {
  const { data, isLoading, isError } = useRackInspector(rackId);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-gray-400">Loading rack…</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden">
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <p className="text-sm text-red-500">Failed to load rack data</p>
        </div>
        <InspectorFooter />
      </div>
    );
  }

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label={`Rack overview: ${data.displayCode}`}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="font-mono font-semibold text-gray-900">{data.displayCode}</span>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="capitalize">{data.kind}</span>
            <span className="text-gray-300">·</span>
            <span>{data.axis}</span>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        {/* Occupancy summary */}
        <SectionHeader title="Occupancy" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <OccupancyBar rate={data.occupancySummary.occupancyRate} />
          <div className="text-xs text-gray-500">
            {data.occupancySummary.occupiedCells} / {data.occupancySummary.totalCells} cells occupied
          </div>
        </div>

        {/* Levels breakdown */}
        <SectionHeader title="Levels" />
        <div className="px-4 py-3 space-y-1.5">
          {data.levels.map((level) => (
            <div key={level.levelOrdinal} className="flex justify-between items-center text-xs text-gray-700">
              <span className="font-medium">L{level.levelOrdinal}:</span>
              <span className="text-gray-500">
                {level.occupiedCells}/{level.totalCells}
              </span>
            </div>
          ))}
        </div>
      </div>

      <InspectorFooter />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function StorageInspectorV2({ workspace }: StorageInspectorV2Props) {
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;
  const floorId = workspace?.floorId ?? null;
  const { data: publishedCells = [] } = usePublishedCells(floorId);

  // Spatial focus — from StorageFocusStore, the single V2 runtime focus source.
  const cellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel() ?? 1;
  const rackDisplayCode = rackId ? (racks?.[rackId]?.displayCode ?? rackId) : '—';

  // Local container drill-down — panel-only state, never escapes this component.
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(null);

  // Reset local container selection whenever the cell focus changes or clears.
  useEffect(() => {
    setSelectedContainerId(null);
  }, [cellId]);

  // Cell data path — fetched once at top level, shared across cell-overview and container-detail.
  // These hooks are no-ops (disabled) when cellId / locationId is null.
  const { data: locationRef, isLoading: locationRefLoading } = useLocationByCell(cellId);
  const locationId = locationRef?.locationId ?? null;
  const { data: storageRows = [], isLoading: storageLoading } = useLocationStorage(locationId);

  const mode = resolvePanelMode(rackId, cellId, selectedContainerId);

  // ── empty ──────────────────────────────────────────────────────────────────
  if (mode.kind === 'empty') {
    return <EmptyState />;
  }

  // ── rack-overview ──────────────────────────────────────────────────────────
  if (mode.kind === 'rack-overview') {
    return <RackOverviewPanel rackId={mode.rackId} />;
  }

  // ── cell-overview / container-detail — shared cell data path ──────────────
  if (locationRefLoading || (locationId && storageLoading)) {
    return <LoadingState />;
  }

  const selectedCellAddress = publishedCells.find((cell) => cell.id === cellId)?.address.raw ?? null;
  // Breadcrumb: prefer real locationCode, then semantic cell address, then raw id.
  const locationCode = storageRows[0]?.locationCode ?? selectedCellAddress ?? cellId;
  const isOccupied = storageRows.length > 0;
  const containers = groupByContainer(storageRows);

  // ── container-detail ───────────────────────────────────────────────────────
  if (mode.kind === 'container-detail') {
    const containerRows = storageRows.filter((r) => r.containerId === mode.containerId);
    const first = containerRows[0];
    const displayCode = first ? (first.externalCode ?? first.systemCode) : mode.containerId;
    const items = containerRows.filter((r) => r.itemRef !== null || r.quantity !== null);

    return (
      <div
        className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
        role="complementary"
        aria-label={`Container detail: ${displayCode}`}
      >
        {/* Header with back */}
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <button
            onClick={() => setSelectedContainerId(null)}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 mb-2"
            aria-label="Back to cell overview"
          >
            ← Back
          </button>
          <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
            <span>{rackDisplayCode}</span>
            <span className="text-gray-300">/</span>
            <span>Level {activeLevel}</span>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SectionHeader title="Container" />
          <div className="px-4 py-3 border-b border-gray-200 space-y-1">
            <div className="font-mono text-sm font-semibold text-gray-900">{displayCode}</div>
            {first && (
              <>
                <div className="text-xs text-gray-500 capitalize">
                  Type: {first.containerType}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  Status: {first.containerStatus}
                </div>
              </>
            )}
          </div>

          <SectionHeader title="Inventory" />
          <div className="px-4 py-3">
            {items.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Empty container</p>
            ) : (
              <div className="space-y-1.5">
                {items.map((row, idx) => {
                  const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '—';
                  const qty = row.quantity ?? 0;
                  const uom = row.uom ?? '';
                  return (
                    <div
                      key={`${row.containerId}-${row.itemRef ?? idx}`}
                      className="flex items-baseline justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        {row.product?.sku && (
                          <span className="font-mono text-gray-500">{row.product.sku}</span>
                        )}
                        <span className="text-gray-600 ml-1.5 truncate">{label}</span>
                      </div>
                      <span className="font-medium text-gray-700 flex-shrink-0 tabular-nums">
                        {qty} {uom}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <InspectorFooter />
      </div>
    );
  }

  // ── cell-overview ──────────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label={`Location inspector: ${locationCode}`}
    >
      {/* Breadcrumb */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
          <span>{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span>Level {activeLevel}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Status Summary */}
        <SectionHeader title="Status" />
        <div className="px-4 py-3 border-b border-gray-200 space-y-2">
          <StatusBadge occupied={isOccupied} />
          {storageRows[0]?.locationType && (
            <div className="text-xs text-gray-600">
              <span className="text-gray-400">Type:</span>{' '}
              {storageRows[0].locationType.replace('_', ' ')}
            </div>
          )}
        </div>

        {/* Current Contents — containers are clickable to drill into container-detail */}
        <SectionHeader title="Current Contents" />
        <div className="px-4 py-3 border-b border-gray-200">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">None</p>
          ) : (
            <div className="space-y-2">
              {containers.map(({ containerId, rows }) => {
                const first = rows[0];
                const displayCode = first.externalCode ?? first.systemCode;
                return (
                  <button
                    key={containerId}
                    onClick={() => setSelectedContainerId(containerId)}
                    className="w-full text-left bg-gray-50 border border-gray-200 rounded px-3 py-2 space-y-1 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                    aria-label={`View container ${displayCode}`}
                  >
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Container
                    </div>
                    <div className="font-mono text-sm font-semibold text-gray-900">
                      {displayCode}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      Status: {first.containerStatus}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Inventory Preview */}
        <SectionHeader title="Inventory" />
        <div className="px-4 py-3">
          {!isOccupied ? (
            <p className="text-sm text-gray-400 italic">0 items</p>
          ) : (
            (() => {
              const allItems = storageRows.filter(
                (row) => row.itemRef !== null || row.quantity !== null
              );
              const preview = allItems.slice(0, INVENTORY_PREVIEW_LIMIT);
              const overflow = allItems.length - INVENTORY_PREVIEW_LIMIT;

              if (allItems.length === 0) {
                return <p className="text-sm text-gray-400 italic">0 items</p>;
              }

              return (
                <div className="space-y-1.5">
                  {preview.map((row, idx) => {
                    const label = row.product?.name ?? row.product?.sku ?? row.itemRef ?? '—';
                    const qty = row.quantity ?? 0;
                    const uom = row.uom ?? '';
                    return (
                      <div
                        key={`${row.containerId}-${row.itemRef ?? idx}`}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          {row.product?.sku && (
                            <span className="font-mono text-gray-500">{row.product.sku}</span>
                          )}
                          <span className="text-gray-600 ml-1.5 truncate">{label}</span>
                        </div>
                        <span className="font-medium text-gray-700 flex-shrink-0 tabular-nums">
                          {qty} {uom}
                        </span>
                      </div>
                    );
                  })}
                  {overflow > 0 && (
                    <p className="text-xs text-gray-400 pt-0.5">
                      +{overflow} more item{overflow > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              );
            })()
          )}
        </div>

        {/* Location Info section intentionally omitted:
            capacityMode, policy, retentionDays not available in current BFF responses. */}
      </div>

      <InspectorFooter />
    </div>
  );
}
