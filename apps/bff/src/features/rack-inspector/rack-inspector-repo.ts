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
  structural_default_role: 'primary_pick' | 'reserve' | 'none' | null;
};

type OccupancyRow = {
  cell_id: string | null;
};

type RackFaceRow = {
  id: string;
  side: 'A' | 'B';
  face_mode: 'mirrored' | 'independent' | null;
  is_mirrored: boolean;
};

type RackSectionRow = {
  id: string;
};

export type RackInspectorRepo = {
  getRackInspector(rackId: string): Promise<RackInspectorPayload | null>;
};

export function createRackInspectorRepo(supabase: SupabaseClient): RackInspectorRepo {
  return {
    async getRackInspector(rackId) {
      // Phase 1: fetch rack identity, faces, and cells in parallel
      const [rackResult, facesResult, cellsResult] = await Promise.all([
        supabase.from('racks').select('id,display_code,kind,axis').eq('id', rackId).maybeSingle(),
        supabase.from('rack_faces').select('id,side,face_mode,is_mirrored').eq('rack_id', rackId),
        supabase.from('cells').select('id,rack_level_id').eq('rack_id', rackId).eq('status', 'active')
      ]);

      if (rackResult.error) throw rackResult.error;
      if (facesResult.error) throw facesResult.error;
      if (cellsResult.error) throw cellsResult.error;

      if (!rackResult.data) return null;

      const rack = rackResult.data as RackIdentityRow;
      const faces = (facesResult.data ?? []) as RackFaceRow[];
      const cells = (cellsResult.data ?? []) as CellRow[];

      const faceIds = faces.map((face) => face.id);
      const cellIds = cells.map((c) => c.id);
      const distinctLevelIds = [...new Set(cells.map((c) => c.rack_level_id))];

      // Phase 2: fetch sections (needs face IDs) in parallel with level ordinals + occupancy (need cell IDs)
      const sectionsPromise = faceIds.length === 0
        ? Promise.resolve({ data: [] as RackSectionRow[], error: null })
        : supabase.from('rack_sections').select('id').in('rack_face_id', faceIds);

      const levelOrdinalsPromise = cells.length === 0
        ? Promise.resolve({ data: [] as RackLevelRow[], error: null })
        : supabase.from('rack_levels').select('id,ordinal,structural_default_role').in('id', distinctLevelIds);

      const occupancyPromise = cells.length === 0
        ? Promise.resolve({ data: [] as OccupancyRow[], error: null })
        : supabase.from('location_occupancy_v').select('cell_id').in('cell_id', cellIds);

      const [sectionsResult, levelOrdinalsResult, occupancyResult] = await Promise.all([
        sectionsPromise,
        levelOrdinalsPromise,
        occupancyPromise
      ]);

      if (sectionsResult.error) throw sectionsResult.error;
      if (levelOrdinalsResult.error) throw levelOrdinalsResult.error;
      if (occupancyResult.error) throw occupancyResult.error;

      const sectionIds = ((sectionsResult.data ?? []) as RackSectionRow[]).map((s) => s.id);

      // Phase 3: all levels for structural defaults (needs section IDs from phase 2)
      const { data: allLevelsData, error: allLevelsError } = sectionIds.length === 0
        ? { data: [] as RackLevelRow[], error: null }
        : await supabase
          .from('rack_levels')
          .select('id,ordinal,structural_default_role')
          .in('rack_section_id', sectionIds);

      if (allLevelsError) throw allLevelsError;
      const allLevels = (allLevelsData ?? []) as RackLevelRow[];

      const inspectorFaces = faces.map((face) => ({
        faceId: face.id,
        side: face.side,
        relationshipMode: face.face_mode ?? (face.is_mirrored ? 'mirrored' : 'independent')
      }));

      const levelDefaults = allLevels
        .sort((left, right) => left.ordinal - right.ordinal)
        .map((level) => ({
          rackLevelId: level.id,
          levelOrdinal: level.ordinal,
          structuralDefaultRole: level.structural_default_role ?? 'none'
        }));

      const rackLevels = (levelOrdinalsResult.data ?? []) as RackLevelRow[];
      const levelOrdinalById = new Map<string, number>(
        rackLevels.map((rl) => [rl.id, rl.ordinal])
      );

      const occupiedCellIds = new Set(
        ((occupancyResult.data ?? []) as OccupancyRow[])
          .map((row) => row.cell_id)
          .filter((id): id is string => id !== null)
      );

      if (cells.length === 0) {
        return {
          rackId: rack.id,
          displayCode: rack.display_code,
          kind: rack.kind,
          axis: rack.axis,
          totalLevels: 0,
          totalCells: 0,
          levels: [],
          faces: inspectorFaces,
          levelDefaults,
          occupancySummary: {
            totalCells: 0,
            occupiedCells: 0,
            emptyCells: 0,
            occupancyRate: 0,
          },
        };
      }

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
        faces: inspectorFaces,
        levelDefaults,
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
