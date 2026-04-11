import type { FloorWorkspace, Rack } from '@wos/domain';
import React, { useMemo, useState, useEffect } from 'react';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import {
  useNavigationRackId,
  useNavigationActiveLevel,
  useSelectionLocationId,
  useSetLevel,
  useSelectLocation,
  useSetRack,
} from '../model/v2/v2-selectors';

/**
 * StorageNavigator — V2 navigator for storage mode, driven by real read data.
 *
 * V2 Integration:
 * - Reads navigation-store: rackId, activeLevel (display context)
 * - Writes navigation-store: setLevel (level tab clicks)
 *   ⚠️ TEMPORARY FALLBACK: also initialises rackId on mount via existing setRack()
 *     when rackId is null, using the first key of workspace.latestPublished.racks.
 *     This is NOT the intended rack-resolution model (should derive from selected cell
 *     or an explicit rack-picker). Deferred to a future PR.
 * - Reads selection-store: locationId (highlight selected item)
 *   ⚠️ TEMPORARY DEBT: locationId field holds a cellId (UUID) in V2 navigator context.
 *     The field's real semantics are resolved per-use in StorageInspectorV2.
 *     Must be cleaned up in a future PR.
 * - Writes selection-store: selectLocation(cellId) on location item clicks
 *
 * Real data sources (PR6):
 * - usePublishedCells(floorId) → cell list with rackId, level, cellCode
 * - useFloorLocationOccupancy(floorId) → occupancy map (cellId → containerId)
 * - workspace.latestPublished.racks → rack displayCode
 *
 * Local UI state:
 * - searchQuery: substring filter on cell code
 * - occupancyFilter: 'all' | 'empty-only'
 *
 * Non-goals:
 * - No inspector wiring beyond selectLocation
 * - No canvas highlight integration
 * - No legacy store bridge
 * - No task mode
 * - No rack-picker UI (deferred)
 */

interface StorageNavigatorProps {
  workspace: FloorWorkspace | null;
}

export function StorageNavigator({ workspace }: StorageNavigatorProps) {
  const floorId = workspace?.floorId ?? null;
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;

  // V2 store — read
  const rackId = useNavigationRackId();
  const activeLevel = useNavigationActiveLevel() ?? 1;
  const selectedCellId = useSelectionLocationId(); // ⚠️ holds cellId in V2 context

  // V2 store — write
  const setLevel = useSetLevel();
  const setRack = useSetRack();
  const selectLocation = useSelectLocation();

  // ⚠️ TEMPORARY FALLBACK: initialize rackId to first rack in workspace when unset.
  // Intended model: derive from selected cell or explicit rack-picker. Deferred.
  useEffect(() => {
    const rackKeys = racks ? Object.keys(racks) : [];
    if (!rackId && rackKeys.length > 0) {
      setRack(rackKeys[0]);
    }
  }, [rackId, racks, setRack]);

  // Real data
  const { data: publishedCells = [], isLoading: cellsLoading } = usePublishedCells(floorId);
  const { data: occupancyRows = [], isLoading: occupancyLoading } = useFloorLocationOccupancy(floorId);

  // Build occupancy lookup: cellId → LocationOccupancyRow (first match per cellId)
  const occupancyByCellId = useMemo(() => {
    const map = new Map<string, (typeof occupancyRows)[number]>();
    for (const row of occupancyRows) {
      if (row.cellId && !map.has(row.cellId)) {
        map.set(row.cellId, row);
      }
    }
    return map;
  }, [occupancyRows]);

  // Derive available levels from cells for the current rack
  const availableLevels = useMemo(() => {
    const levels = new Set<number>();
    for (const cell of publishedCells) {
      if (cell.rackId === rackId) {
        levels.add(cell.address.parts.level);
      }
    }
    return Array.from(levels).sort((a, b) => a - b);
  }, [publishedCells, rackId]);

  // Cells for current rack + level
  const cellsForLevel = useMemo(() => {
    if (!rackId) return [];
    return publishedCells.filter(
      (cell) =>
        cell.rackId === rackId &&
        cell.address.parts.level === activeLevel &&
        cell.status === 'active'
    );
  }, [publishedCells, rackId, activeLevel]);

  // Local UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'empty-only'>('all');

  // Visible cells after filters
  const visibleCells = useMemo(() => {
    return cellsForLevel
      .filter((cell) => {
        if (occupancyFilter === 'empty-only') {
          return !occupancyByCellId.has(cell.id);
        }
        return true;
      })
      .filter((cell) => {
        if (searchQuery.trim() === '') return true;
        return cell.address.raw.toLowerCase().includes(searchQuery.trim().toLowerCase());
      });
  }, [cellsForLevel, occupancyFilter, searchQuery, occupancyByCellId]);

  const filtersActive = occupancyFilter !== 'all' || searchQuery.trim() !== '';

  // Rack display
  const rackDisplayCode = rackId ? (racks?.[rackId]?.displayCode ?? rackId) : '—';

  const isLoading = cellsLoading || occupancyLoading;
  const noRackContext = !rackId && !isLoading;

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200 w-80 overflow-hidden">
      {/* Header: Rack Context Display */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="text-sm font-semibold text-gray-700">
          Current:{' '}
          <span className="text-gray-900">
            {isLoading ? '…' : rackDisplayCode}
          </span>
        </div>
      </div>

      {/* Level Tabs */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
        <div className="flex gap-2 items-center">
          <span className="text-xs font-medium text-gray-600">Level:</span>
          <div className="flex gap-2">
            {(availableLevels.length > 0 ? availableLevels : [1, 2, 3]).map((level) => (
              <button
                key={level}
                className={`px-3 py-1 text-sm font-medium rounded border transition-colors ${
                  activeLevel === level
                    ? 'bg-blue-100 border-blue-400 text-blue-900'
                    : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                }`}
                onClick={() => setLevel(level)}
              >
                {level}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded px-2 py-1">
          <input
            type="text"
            placeholder="Find location..."
            className="flex-1 bg-transparent text-sm outline-none placeholder-gray-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="text-gray-400">🔍</span>
        </div>

        <div className="flex gap-2">
          <button
            className={`flex-1 px-2 py-1.5 text-xs font-medium border rounded transition-colors ${
              occupancyFilter === 'empty-only'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setOccupancyFilter('empty-only')}
          >
            🟢 Empty Only
          </button>
          <button
            className={`flex-1 px-2 py-1.5 text-xs font-medium border rounded transition-colors ${
              occupancyFilter === 'all'
                ? 'bg-blue-100 border-blue-400 text-blue-900'
                : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
            }`}
            onClick={() => setOccupancyFilter('all')}
          >
            All
          </button>
        </div>
      </div>

      {/* Location List (Scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {noRackContext ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No rack context available
          </div>
        ) : isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            Loading locations…
          </div>
        ) : cellsForLevel.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No locations for level {activeLevel}
          </div>
        ) : visibleCells.length === 0 && filtersActive ? (
          <div className="px-4 py-8 text-center text-sm text-gray-500">
            No locations match current filters
          </div>
        ) : (
          <div>
            {/* Level Header */}
            <div className="sticky top-0 px-4 py-2 bg-gray-100 border-b border-gray-200">
              <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                Level {activeLevel} ({visibleCells.length} locations)
              </h3>
            </div>

            {/* Location Items */}
            <div className="divide-y divide-gray-200">
              {visibleCells.map((cell) => {
                const occupancyRow = occupancyByCellId.get(cell.id);
                const isOccupied = Boolean(occupancyRow);
                const isSelected = selectedCellId === cell.id;
                const containerCode = occupancyRow?.externalCode ?? occupancyRow?.containerId ?? null;

                return (
                  <div
                    key={cell.id}
                    className={`px-4 py-2 text-sm flex items-center gap-2 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border-l-2 border-blue-400'
                        : 'hover:bg-gray-50'
                    }`}
                    title={
                      isSelected
                        ? `Selected: ${cell.address.raw}`
                        : `Location ${cell.address.raw} — ${isOccupied ? 'occupied' : 'empty'}`
                    }
                    onClick={() => selectLocation(cell.id)}
                  >
                    {/* Status Icon */}
                    <span className="text-base flex-shrink-0">
                      {isOccupied ? '🔴' : '🟢'}
                    </span>

                    {/* Cell address (human-readable, e.g. "01-A.02.01") */}
                    <span className="font-mono font-medium text-gray-900 flex-1">
                      {cell.address.raw}
                    </span>

                    {/* Container code (if occupied) */}
                    {containerCode && (
                      <span className="text-xs text-gray-600 flex-shrink-0">
                        {containerCode}
                      </span>
                    )}

                    {/* Selection indicator */}
                    {isSelected && (
                      <span className="text-xs text-blue-600 font-semibold flex-shrink-0">←</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Implementation Status */}
      <div className="px-4 py-2 border-t border-gray-200 flex-shrink-0 text-xs text-gray-500 bg-gray-50">
        <p>
          <span className="font-medium">PR6:</span> Real data — published cells + floor occupancy.
          {' '}⚠️ Rack init is a temporary fallback; rack-picker deferred.
        </p>
      </div>
    </div>
  );
}
