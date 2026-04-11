import type { FloorWorkspace } from '@wos/domain';
import { AlertCircle, Box, Loader2, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import {
  useEditorSelection,
  useSelectedRackActiveLevel,
  useSetSelectedRackActiveLevel
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { useLocationByCell } from '@/entities/location/api/use-location-by-cell';
import { useLocationStorage } from '@/entities/location/api/use-location-storage';
import { CellPlacementOperationalBody } from './storage-location-detail-body';
import { getRackFaceALevelCount } from '../lib/rack-level-count';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { resolveStorageFocusContext } from '../model/storage-focus';
import { RackLevelPager } from './rack-level-pager';

export function StorageRackInspector({
  workspace,
  onClose
}: {
  workspace: FloorWorkspace | null;
  onClose: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const activeLevel = useSelectedRackActiveLevel();
  const setActiveLevel = useSetSelectedRackActiveLevel();
  const selection = useEditorSelection();
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const { data: locationOccupancy = [] } = useFloorLocationOccupancy(workspace?.floorId ?? null);
  const publishedCellsById = useMemo(
    () => new Map(publishedCells.map((cell) => [cell.id, cell] as const)),
    [publishedCells]
  );
  const focusContext = resolveStorageFocusContext({
    viewMode: 'storage',
    selection,
    selectedRackActiveLevel: activeLevel,
    publishedCellsById
  });

  const selectedCell =
    focusContext.leaf === 'cell' && focusContext.resolvedCellId
      ? (publishedCellsById.get(focusContext.resolvedCellId) ?? null)
      : null;
  const resolvedRackId = focusContext.rackId;
  const rack = layoutDraft && resolvedRackId ? layoutDraft.racks[resolvedRackId] : null;
  const structureLevelCount = getRackFaceALevelCount(rack ?? null);
  const publishedAddressLevelCount =
    resolvedRackId === null
      ? 0
      : new Set(
          publishedCells
            .filter((cell) => cell.rackId === resolvedRackId)
            .map((cell) => cell.address.parts.level)
            .filter((level): level is number => Number.isFinite(level))
        ).size;
  const publishedRackLevelIdCount =
    resolvedRackId === null
      ? 0
      : new Set(
          publishedCells
            .filter((cell) => cell.rackId === resolvedRackId)
            .map((cell) => cell.rackLevelId)
            .filter((levelId): levelId is string => typeof levelId === 'string' && levelId.length > 0)
        ).size;
  const publishedLevelCount = Math.max(publishedAddressLevelCount, publishedRackLevelIdCount);
  const levelCount = Math.max(structureLevelCount, publishedLevelCount);
  const selectedCellId = selection.type === 'cell' ? selection.cellId : null;
  const { data: selectedCellLocationRef, error: selectedCellLocationError } = useLocationByCell(selectedCellId);
  const selectedCellLocationId = selectedCellLocationRef?.locationId ?? null;
  const {
    data: selectedCellLocationStorage = [],
    isPending: isSelectedCellStoragePending,
    isError: isSelectedCellStorageError
  } = useLocationStorage(selectedCellLocationId);

  const previousShellStateRef = useRef<{
    selectionType: 'none' | 'rack' | 'zone' | 'wall' | 'cell' | 'container';
    rackId: string | null;
    activeLevel: number;
  }>({
    selectionType: selection.type,
    rackId: resolvedRackId,
    activeLevel
  });

  // Keep current level when drilling from rack -> cell for the same rack.
  // This does not introduce cell-driven level sync; it only prevents an unwanted reset.
  useEffect(() => {
    const previous = previousShellStateRef.current;
    const isSameRackDrillDown =
      previous.selectionType === 'rack' &&
      selection.type === 'cell' &&
      previous.rackId !== null &&
      resolvedRackId === previous.rackId;

    if (isSameRackDrillDown && activeLevel !== previous.activeLevel) {
      setActiveLevel(previous.activeLevel);
      return;
    }

    previousShellStateRef.current = {
      selectionType: selection.type,
      rackId: resolvedRackId,
      activeLevel
    };
  }, [selection.type, resolvedRackId, activeLevel, setActiveLevel]);

  const levelSummary = useMemo(() => {
    if (!rack) {
      return {
        totalLocations: 0,
        occupiedLocations: 0,
        emptyLocations: 0
      };
    }

    const levelNo = activeLevel + 1;
    const levelCells = publishedCells.filter(
      (cell) => cell.rackId === rack.id && cell.address.parts.level === levelNo
    );
    const levelCellIds = new Set(levelCells.map((cell) => cell.id));
    const occupiedLocationIds = new Set(
      locationOccupancy
        .filter((row) => row.cellId !== null && levelCellIds.has(row.cellId))
        .map((row) => row.locationId)
    );

    const totalLocations = levelCells.length;
    const occupiedLocations = occupiedLocationIds.size;
    return {
      totalLocations,
      occupiedLocations,
      emptyLocations: Math.max(0, totalLocations - occupiedLocations)
    };
  }, [rack, activeLevel, publishedCells, locationOccupancy]);

  if (!rack) {
    return (
      <aside className="flex h-full w-full flex-col bg-white">
        <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
            Storage rack
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
          Select a rack or storage location to inspect storage by level.
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between border-b border-[var(--border-muted)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-[var(--accent)]" />
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
              Storage rack
            </div>
            <div className="mt-0.5 text-sm font-semibold text-slate-800">Rack {rack.displayCode}</div>
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

      <div className="space-y-4 overflow-y-auto px-5 py-4">
        {levelCount > 1 && (
          <RackLevelPager
            testId="storage-rack-inspector-level-pager"
            activeLevel={activeLevel}
            levelCount={levelCount}
            onPrev={() => setActiveLevel(activeLevel - 1)}
            onNext={() => setActiveLevel(activeLevel + 1)}
          />
        )}

        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Storage summary
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Locations
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{levelSummary.totalLocations}</div>
            </div>
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Occupied
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{levelSummary.occupiedLocations}</div>
            </div>
            <div className="rounded-lg border border-[var(--border-muted)] bg-[var(--surface-secondary)] px-2.5 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Empty
              </div>
              <div className="mt-0.5 text-sm font-semibold text-slate-800">{levelSummary.emptyLocations}</div>
            </div>
          </div>
        </div>

        {selection.type !== 'cell' && (
          <div className="rounded-xl border border-[var(--border-muted)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Selected location
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Select a storage location to view its details.
            </p>
          </div>
        )}

        {selection.type === 'cell' && selectedCell && (
          <div
            className="rounded-xl border border-[var(--border-muted)] p-3"
            data-testid="storage-shell-location-detail"
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Location detail
            </div>
            <div className="mt-2 flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <div className="font-mono text-sm font-semibold text-slate-800">{selectedCell.address.raw}</div>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Cell ID: {selectedCell.id}
            </p>
            {selectedCellLocationId && !isSelectedCellStoragePending && !isSelectedCellStorageError ? (
              <div className="mt-3">
                <CellPlacementOperationalBody
                  selectedCell={selectedCell}
                  locationId={selectedCellLocationId}
                  rows={selectedCellLocationStorage}
                  isReadOnlyView={false}
                />
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-[var(--border-muted)] bg-[var(--surface-subtle)] px-3 py-3">
                {isSelectedCellStoragePending ? (
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading storage details for this location...
                  </div>
                ) : (
                  <div className="flex items-start gap-2 text-[11px] text-slate-500">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                    <span>
                      {selectedCellLocationError || isSelectedCellStorageError
                        ? 'Could not load location details.'
                        : 'Location details are unavailable for this selection.'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {selection.type === 'cell' && !selectedCell && (
          <div className="rounded-xl border border-[var(--border-muted)] p-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Location detail
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Selected storage location is unavailable in the published layout.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
