import type { FloorWorkspace } from '@wos/domain';
import { Box, X } from 'lucide-react';
import { useMemo } from 'react';
import {
  useEditorSelection,
  useSelectedRackActiveLevel,
  useSelectedRackId,
  useSetSelectedRackActiveLevel
} from '@/widgets/warehouse-editor/model/editor-selectors';
import { usePublishedCells } from '@/entities/cell/api/use-published-cells';
import { useFloorLocationOccupancy } from '@/entities/location/api/use-floor-location-occupancy';
import { getRackFaceALevelCount } from '../lib/rack-level-count';
import { useWorkspaceLayout } from '../lib/use-workspace-layout';
import { RackLevelPager } from './rack-level-pager';

export function StorageRackInspector({
  workspace,
  onClose
}: {
  workspace: FloorWorkspace | null;
  onClose: () => void;
}) {
  const layoutDraft = useWorkspaceLayout(workspace);
  const selectedRackId = useSelectedRackId();
  const activeLevel = useSelectedRackActiveLevel();
  const setActiveLevel = useSetSelectedRackActiveLevel();
  const selection = useEditorSelection();
  const { data: publishedCells = [] } = usePublishedCells(workspace?.floorId ?? null);
  const { data: locationOccupancy = [] } = useFloorLocationOccupancy(workspace?.floorId ?? null);

  const rack = layoutDraft && selectedRackId ? layoutDraft.racks[selectedRackId] : null;
  const levelCount = getRackFaceALevelCount(rack ?? null);

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
          Select a rack to see storage overview.
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

        <div className="rounded-xl border border-[var(--border-muted)] p-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Selected location
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            {selection.type === 'cell'
              ? `Selected cell: ${selection.cellId}`
              : 'Select a storage location to see its details.'}
          </p>
        </div>
      </div>
    </aside>
  );
}
