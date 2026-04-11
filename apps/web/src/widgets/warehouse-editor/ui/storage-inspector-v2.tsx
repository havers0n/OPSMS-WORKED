import type { FloorWorkspace, LocationStorageSnapshotRow, Rack } from '@wos/domain';
import React from 'react';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusActiveLevel,
} from '../model/v2/v2-selectors';

/**
 * StorageInspectorV2 — Read-only right surface for the V2 storage path.
 *
 * V2 Integration (PR7):
 * - Reads StorageFocusStore: selectedCellId (was: selection-store.locationId)
 *   The PR6 semantic ambiguity (locationId holding a cellId) is resolved — the
 *   focus store field is correctly named selectedCellId.
 * - Reads StorageFocusStore: selectedRackId, activeLevel (breadcrumb context)
 * - Derives real locationId via useLocationByCell(cellId) — 1 GET per unique cellId, cached
 * - Fetches container + inventory via useLocationStorage(locationId)
 *
 * Real data sources (PR6):
 * - useLocationByCell → LocationReference (resolves cellId to locationId)
 * - useLocationStorage → LocationStorageSnapshotRow[] (container + inventory)
 *
 * Read-only invariants:
 * - No action buttons
 * - No mutations, no task triggers
 * - No local state that duplicates selection-store
 * - No legacy store reads or bridges
 *
 * Fields NOT available in current BFF responses — explicitly omitted (not shown as "unknown"):
 * - capacityMode
 * - policy
 * - retentionDays
 * (Location Info section removed until backend provides these)
 *
 * Non-goals (deferred to PR7+):
 * - No action buttons (Place, Move, Edit Inventory)
 * - No task mode wiring
 * - No canvas highlight integration
 */

interface StorageInspectorV2Props {
  workspace: FloorWorkspace | null;
}

const INVENTORY_PREVIEW_LIMIT = 3;

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
        <span className="font-medium">PR7:</span> Focus via StorageFocusStore — breadcrumb is coherent with canvas.
        {' '}Actions deferred to PR8+.
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

// ── Main component ─────────────────────────────────────────────────────────────

export function StorageInspectorV2({ workspace }: StorageInspectorV2Props) {
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;
  const floorId = workspace?.floorId ?? null;
  const { data: publishedCells = [] } = usePublishedCells(floorId);

  // PR7: reads from StorageFocusStore — the single V2 runtime focus source.
  const cellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel() ?? 1;
  const rackDisplayCode = rackId ? (racks?.[rackId]?.displayCode ?? rackId) : '—';

  // Step 1: resolve cellId → locationId
  const { data: locationRef, isLoading: locationRefLoading } = useLocationByCell(cellId);
  const locationId = locationRef?.locationId ?? null;

  // Step 2: fetch storage snapshot by locationId
  const { data: storageRows = [], isLoading: storageLoading } = useLocationStorage(locationId);

  if (!cellId) {
    return <EmptyState />;
  }

  if (locationRefLoading || (locationId && storageLoading)) {
    return <LoadingState />;
  }

  const selectedCellAddress = publishedCells.find((cell) => cell.id === cellId)?.address.raw ?? null;
  // Derive breadcrumb location code: prefer real locationCode, then semantic cell code, then raw id.
  const locationCode = storageRows[0]?.locationCode ?? selectedCellAddress ?? cellId;
  const isOccupied = storageRows.length > 0;
  const containers = groupByContainer(storageRows);

  return (
    <div
      className="flex flex-col h-full bg-white border-l border-gray-200 w-96 overflow-hidden"
      role="complementary"
      aria-label={`Location inspector: ${locationCode}`}
    >
      {/* ── Breadcrumb ──────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="text-xs text-gray-500 flex items-center gap-1 flex-wrap leading-relaxed">
          <span>{rackDisplayCode}</span>
          <span className="text-gray-300">/</span>
          <span>Level {activeLevel}</span>
          <span className="text-gray-300">/</span>
          <span className="font-mono text-gray-900 font-medium">{locationCode}</span>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
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

        {/* Current Contents */}
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
                  <div
                    key={containerId}
                    className="bg-gray-50 border border-gray-200 rounded px-3 py-2 space-y-1"
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
                  </div>
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
              // Flatten inventory items across all containers
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
            capacityMode, policy, retentionDays are not available in current BFF responses.
            Will be added once the backend exposes location metadata. */}

      </div>

      <InspectorFooter />
    </div>
  );
}
