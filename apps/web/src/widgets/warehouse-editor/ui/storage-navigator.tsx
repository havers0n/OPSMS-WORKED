import type { FloorWorkspace, Rack } from '@wos/domain';
import React, { useMemo, useState, useEffect } from 'react';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusActiveLevel,
  useStorageFocusSelectCell,
  useStorageFocusSelectRack,
  useStorageFocusSetActiveLevel,
} from '../model/v2/v2-selectors';

/**
 * StorageNavigator — V2 navigator for storage mode.
 *
 * PR7: Reads and writes exclusively via StorageFocusStore.
 * The old navigation-store + selection-store are no longer used here.
 *
 * Focus store as secondary writer:
 * - Level tab click     → setActiveLevel(level)
 * - Location item click → selectCell({ cellId, rackId, level })
 *
 * Focus store reads:
 * - selectedCellId   — for highlighting the selected item in the list
 * - selectedRackId   — for filtering cells and displaying the rack header
 * - activeLevel      — for level tab highlight and list filtering
 *
 * ⚠️ TEMPORARY FALLBACK (same as PR6): when selectedRackId is null and racks
 * are loaded, the navigator auto-initialises the focus store with the first rack
 * via selectRack(). This is NOT the intended rack-resolution model (should derive
 * from an explicit rack-picker or initial URL/session state). Deferred.
 *
 * Real data sources (PR6, unchanged):
 * - usePublishedCells(floorId) → cell list with rackId, level, cellCode
 * - useFloorLocationOccupancy(floorId) → occupancy map (cellId → containerId)
 * - workspace.latestPublished.racks → rack displayCode
 */

interface StorageNavigatorProps {
  workspace: FloorWorkspace | null;
}

export function StorageNavigator({ workspace }: StorageNavigatorProps) {
  const floorId = workspace?.floorId ?? null;
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;

  // ── Focus store — read ──────────────────────────────────────────────────────
  const selectedCellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel() ?? 1;

  // ── Focus store — write ─────────────────────────────────────────────────────
  const selectCell = useStorageFocusSelectCell();
  const selectRack = useStorageFocusSelectRack();
  const setActiveLevel = useStorageFocusSetActiveLevel();

  // ── Real data ───────────────────────────────────────────────────────────────
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

  // ⚠️ TEMPORARY FALLBACK: initialise rackId from first rack when none is selected.
  // Intended model: derive from an explicit rack-picker or session state. Deferred.
  useEffect(() => {
    if (!rackId && racks) {
      const rackKeys = Object.keys(racks);
      if (rackKeys.length > 0) {
        selectRack({ rackId: rackKeys[0] });
      }
    }
  }, [rackId, racks, selectRack]);

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

  // Rack display — rackId is the focus store's selectedRackId (always coherent)
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
                onClick={() => setActiveLevel(level)}
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
                    onClick={() => {
                      selectCell({
                        cellId: cell.id,
                        rackId: cell.rackId,
                        level: cell.address.parts.level,
                      });
                    }}
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
          <span className="font-medium">PR7:</span> Focus via StorageFocusStore — canvas + navigator are coherent.
          {' '}⚠️ Rack-picker deferred.
        </p>
      </div>
    </div>
  );
}
