import type { SupabaseClient } from '@supabase/supabase-js';
import type { RackInspectorPayload } from '@wos/domain';

// Local row types — use 'paired' to match DB reality and domain enum.
// NOTE: apps/bff/src/features/layout/repo.ts has a stale 'double' type — do not copy it.
type RackIdentityRow = {
  id: string;
  display_code: string;
  kind: 'single' | 'paired';
  axis: 'NS' | 'WE';
};

type CellRow = {
  id: string;
  rack_level_id: string;
};

type RackLevelRow = {
  id: string;
  ordinal: number;
};

type OccupancyRow = {
  cell_id: string | null;
};

export type RackInspectorRepo = {
  getRackInspector(rackId: string): Promise<RackInspectorPayload | null>;
};

export function createRackInspectorRepo(supabase: SupabaseClient): RackInspectorRepo {
  return {
    async getRackInspector(rackId) {
      // Q1: rack identity
      const { data: rackData, error: rackError } = await supabase
        .from('racks')
        .select('id,display_code,kind,axis')
        .eq('id', rackId)
        .maybeSingle();

      if (rackError) throw rackError;
      if (!rackData) return null;

      const rack = rackData as RackIdentityRow;

      // Q2: all active cells for this rack (gives us cell IDs + level IDs)
      const { data: cellsData, error: cellsError } = await supabase
        .from('cells')
        .select('id,rack_level_id')
        .eq('rack_id', rackId)
        .eq('status', 'active');

      if (cellsError) throw cellsError;

      const cells = (cellsData ?? []) as CellRow[];
      const cellIds = cells.map((c) => c.id);
      const distinctLevelIds = [...new Set(cells.map((c) => c.rack_level_id))];

      if (cells.length === 0) {
        // Rack exists but has no active cells — return empty but valid payload
        return {
          rackId: rack.id,
          displayCode: rack.display_code,
          kind: rack.kind,
          axis: rack.axis,
          totalLevels: 0,
          totalCells: 0,
          levels: [],
          occupancySummary: {
            totalCells: 0,
            occupiedCells: 0,
            emptyCells: 0,
            occupancyRate: 0,
          },
        };
      }

      // Q3: ordinals for the level IDs we found
      const { data: levelsData, error: levelsError } = await supabase
        .from('rack_levels')
        .select('id,ordinal')
        .in('id', distinctLevelIds);

      if (levelsError) throw levelsError;

      const rackLevels = (levelsData ?? []) as RackLevelRow[];
      // Build a map: rack_level_id → ordinal
      const levelOrdinalById = new Map<string, number>(
        rackLevels.map((rl) => [rl.id, rl.ordinal])
      );

      // Q4: occupied cells (only rack_slot locations have cell_id set)
      const { data: occupancyData, error: occupancyError } = await supabase
        .from('location_occupancy_v')
        .select('cell_id')
        .in('cell_id', cellIds);

      if (occupancyError) throw occupancyError;

      const occupiedCellIds = new Set(
        ((occupancyData ?? []) as OccupancyRow[])
          .map((row) => row.cell_id)
          .filter((id): id is string => id !== null)
      );

      // Compute per-level summary: group cells by ordinal
      const levelMap = new Map<number, { total: number; occupied: number }>();
      for (const cell of cells) {
        const ordinal = levelOrdinalById.get(cell.rack_level_id);
        if (ordinal === undefined) continue;
        const entry = levelMap.get(ordinal) ?? { total: 0, occupied: 0 };
        entry.total += 1;
        if (occupiedCellIds.has(cell.id)) {
          entry.occupied += 1;
        }
        levelMap.set(ordinal, entry);
      }

      const levels = Array.from(levelMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([levelOrdinal, counts]) => ({
          levelOrdinal,
          totalCells: counts.total,
          occupiedCells: counts.occupied,
          emptyCells: counts.total - counts.occupied,
        }));

      const totalCells = cells.length;
      const occupiedCells = occupiedCellIds.size;
      const emptyCells = totalCells - occupiedCells;

      return {
        rackId: rack.id,
        displayCode: rack.display_code,
        kind: rack.kind,
        axis: rack.axis,
        totalLevels: levelMap.size,
        totalCells,
        levels,
        occupancySummary: {
          totalCells,
          occupiedCells,
          emptyCells,
          occupancyRate: totalCells === 0 ? 0 : occupiedCells / totalCells,
        },
      };
    },
  };
}
