import type { FloorWorkspace, Rack } from '@wos/domain';
import React, { useEffect, useMemo } from 'react';
import { PanelLeft } from 'lucide-react';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { collectRackPublishedSemanticLevels } from '@/warehouse/editor/model/storage-level-mapping';
import { useT } from '@/shared/i18n';
import { useIsNavigatorCollapsed, useToggleNavigator } from '@/app/store/ui-selectors';
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
  const t = useT();
  const floorId = workspace?.floorId ?? null;
  const racks: Record<string, Rack> | undefined = workspace?.latestPublished?.racks;

  const selectedCellId = useStorageFocusSelectedCellId();
  const rackId = useStorageFocusSelectedRackId();
  const activeLevel = useStorageFocusActiveLevel() ?? 1;

  const selectCell = useStorageFocusSelectCell();
  const setActiveLevel = useStorageFocusSetActiveLevel();

  const { data: publishedCells = [], isLoading: cellsLoading } = usePublishedCells(floorId);
  const { data: occupancyRows = [], isLoading: occupancyLoading } = useFloorLocationOccupancy(floorId);

  const isCollapsed = useIsNavigatorCollapsed();
  const toggle = useToggleNavigator();

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== '`' || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      toggle();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggle]);

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
    if (!rackId) return [];
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
  const levelButtons = availableLevels.length > 0 ? availableLevels : [1, 2, 3];

  if (isCollapsed) {
    return (
      <div className="flex h-full w-10 flex-shrink-0 flex-col items-center border-e border-gray-200 bg-white pt-2.5">
        <button
          type="button"
          onClick={toggle}
          title={t('storage.navigator.show')}
          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full w-72 flex-shrink-0 flex-col overflow-hidden border-e border-gray-200 bg-white">
      <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{t('storage.field.rack')}</span>
          <div className="flex items-center gap-1.5">
            <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-800" dir="ltr">
              {isLoading ? '...' : rackDisplayCode}
            </span>
            <button
              type="button"
              onClick={toggle}
              title={t('storage.navigator.hide')}
              className="flex h-5 w-5 items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{t('storage.field.level')}</span>
          <div className="ms-auto flex gap-1">
            {levelButtons.map((level) => (
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
            ))}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            placeholder={t('storage.placeholder.searchLocation')}
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
            {t('storage.filter.all')}
          </button>
          <button
            className={`h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              occupancyFilter === 'empty-only'
                ? 'border-blue-300 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
            onClick={() => setOccupancyFilter('empty-only')}
          >
            {t('storage.filter.empty')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {noRackContext ? (
          <div className="px-3 py-6 text-sm text-gray-500">
            {t('storage.state.selectRackOnMap')}
          </div>
        ) : isLoading ? (
          <div className="px-3 py-6 text-sm text-gray-400">{t('storage.state.loadingLocations')}</div>
        ) : cellsForLevel.length === 0 ? (
          <div className="px-3 py-6 text-sm text-gray-500">{t('storage.state.noLocationsForLevel', { level: activeLevel })}</div>
        ) : visibleCells.length === 0 && filtersActive ? (
          <div className="px-3 py-6 text-sm text-gray-500">{t('storage.state.noLocationsMatchFilters')}</div>
        ) : (
          <div>
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-gray-600">
                {t('storage.field.levelWithNumber', { level: activeLevel })}
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
                        ? `${t('storage.status.selected')}: ${cell.address.raw}`
                        : t('storage.navigator.locationTitle', {
                            address: cell.address.raw,
                            state: isOccupied ? t('storage.status.occupied') : t('storage.status.empty')
                          })
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

                    <span className="flex-1 font-mono text-[13px] font-medium text-gray-900" dir="ltr">
                      {cell.address.raw}
                    </span>

                    {containerCode && (
                      <span
                        className={`max-w-24 truncate rounded px-1.5 py-0.5 text-[11px] ${
                          isSelected ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}
                        dir="ltr"
                      >
                        {containerCode}
                      </span>
                    )}

                    {isSelected && (
                      <span className="flex-shrink-0 text-xs font-semibold text-blue-600">{t('storage.status.selected')}</span>
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
