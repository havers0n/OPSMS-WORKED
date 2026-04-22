import type { FloorWorkspace, Rack } from '@wos/domain';
import React, { useMemo, useState } from 'react';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { collectRackPublishedSemanticLevels } from '@/widgets/warehouse-editor/model/storage-level-mapping';
import {
  useStorageFocusSelectedCellId,
  useStorageFocusSelectedRackId,
  useStorageFocusActiveLevel,
  useStorageFocusSelectCell,
  useStorageFocusSetActiveLevel,
} from '../model/v2/v2-selectors';

interface StorageNavigatorProps {
  workspace: FloorWorkspace | null;
}

export function StorageNavigator({ workspace }: StorageNavigatorProps) {
  const floorId = workspace?.floorId ?? null;
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;

  const selectedCellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel();

  const selectCell = useStorageFocusSelectCell();
  const setActiveLevel = useStorageFocusSetActiveLevel();

  const { data: publishedCells = [], isLoading: cellsLoading } = usePublishedCells(floorId);
  const { data: occupancyRows = [], isLoading: occupancyLoading } = useFloorLocationOccupancy(floorId);

  const occupancyByCellId = useMemo(() => {
    const map = new Map<string, (typeof occupancyRows)[number]>();
    for (const row of occupancyRows) {
      if (row.cellId && !map.has(row.cellId)) {
        map.set(row.cellId, row);
      }
    }
    return map;
  }, [occupancyRows]);

  const availableLevels = useMemo(() => {
    return collectRackPublishedSemanticLevels(publishedCells, rackId);
  }, [publishedCells, rackId]);

  const cellsForLevel = useMemo(() => {
    if (!rackId || activeLevel === null) return [];
    return publishedCells.filter(
      (cell) =>
        cell.rackId === rackId &&
        cell.address.parts.level === activeLevel &&
        cell.status === 'active'
    );
  }, [publishedCells, rackId, activeLevel]);

  const [searchQuery, setSearchQuery] = useState('');
  const [occupancyFilter, setOccupancyFilter] = useState<'all' | 'empty-only'>('all');

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
  const rackDisplayCode = rackId ? (racks?.[rackId]?.displayCode ?? rackId) : '-';

  const isLoading = cellsLoading || occupancyLoading;
  const noRackContext = !rackId && !isLoading;
  const hasPublishedLevels = availableLevels.length > 0;

  return (
    <div className="flex h-full w-72 flex-col overflow-hidden border-r border-gray-200 bg-white">
      <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Rack</span>
          <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-800">
            {isLoading ? '...' : rackDisplayCode}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Level</span>
          <div className="ml-auto flex gap-1">
            {hasPublishedLevels ? (
              availableLevels.map((level) => (
                <button
                  key={level}
                  className={`min-w-8 rounded-md border px-2 py-1 text-xs font-semibold transition-colors ${
                    activeLevel === level
                      ? 'border-blue-300 bg-blue-50 text-blue-900'
                      : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveLevel(level)}
                >
                  L{level}
                </button>
              ))
            ) : (
              <span className="text-xs text-gray-400">
                {rackId ? 'No published levels' : 'Select rack'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Search location"
            className="h-8 min-w-0 flex-1 rounded-md border border-gray-300 px-2.5 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-blue-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button
            className={`h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              occupancyFilter === 'all'
                ? 'border-blue-300 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setOccupancyFilter('all')}
          >
            All
          </button>
          <button
            className={`h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              occupancyFilter === 'empty-only'
                ? 'border-blue-300 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setOccupancyFilter('empty-only')}
          >
            Empty
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {noRackContext ? (
          <div className="px-3 py-6 text-sm text-gray-500">
            Select a rack on the map to browse locations.
          </div>
        ) : isLoading ? (
          <div className="px-3 py-6 text-sm text-gray-400">Loading locations...</div>
        ) : !hasPublishedLevels ? (
          <div className="px-3 py-6 text-sm text-gray-500">
            This rack has no published storage locations.
          </div>
        ) : activeLevel === null ? (
          <div className="px-3 py-6 text-sm text-gray-500">
            Select a published level to browse locations.
          </div>
        ) : cellsForLevel.length === 0 ? (
          <div className="px-3 py-6 text-sm text-gray-500">No locations for level {activeLevel}</div>
        ) : visibleCells.length === 0 && filtersActive ? (
          <div className="px-3 py-6 text-sm text-gray-500">No locations match current filters</div>
        ) : (
          <div>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                Level {activeLevel}
              </h3>
              <span className="text-xs text-gray-500">{visibleCells.length}</span>
            </div>

            <div className="divide-y divide-gray-100">
              {visibleCells.map((cell) => {
                const occupancyRow = occupancyByCellId.get(cell.id);
                const isOccupied = Boolean(occupancyRow);
                const isSelected = selectedCellId === cell.id;
                const containerCode = occupancyRow?.externalCode ?? occupancyRow?.containerId ?? null;

                return (
                  <div
                    key={cell.id}
                    className={`group flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
                      isSelected
                        ? 'border-l-2 border-blue-400 bg-blue-50'
                        : 'border-l-2 border-transparent hover:bg-gray-50'
                    }`}
                    title={
                      isSelected
                        ? `Selected: ${cell.address.raw}`
                        : `Location ${cell.address.raw} - ${isOccupied ? 'occupied' : 'empty'}`
                    }
                    onClick={() => {
                      selectCell({
                        cellId: cell.id,
                        rackId: cell.rackId,
                        level: cell.address.parts.level,
                      });
                    }}
                  >
                    <span
                      className={`h-2 w-2 flex-shrink-0 rounded-full ${
                        isOccupied ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      aria-hidden
                    />

                    <span className="flex-1 font-mono text-[13px] font-medium text-gray-900">
                      {cell.address.raw}
                    </span>

                    {containerCode && (
                      <span
                        className={`max-w-24 truncate rounded px-1.5 py-0.5 text-[11px] ${
                          isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {containerCode}
                      </span>
                    )}

                    {isSelected && (
                      <span className="flex-shrink-0 text-xs font-semibold text-blue-600">Selected</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
