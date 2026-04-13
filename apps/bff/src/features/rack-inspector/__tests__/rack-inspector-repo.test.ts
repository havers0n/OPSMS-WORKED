import { describe, expect, it, vi } from 'vitest';
import { createRackInspectorRepo } from '../rack-inspector-repo.js';

// ── Fixture IDs ───────────────────────────────────────────────────────────────

const ids = {
  rack:      'a1000000-0000-4000-8000-000000000001',
  faceA:     'a2000000-0000-4000-8000-000000000002',
  section1:  'a3000000-0000-4000-8000-000000000003',
  section2:  'a3000000-0000-4000-8000-000000000004',
  level1:    'a4000000-0000-4000-8000-000000000011',
  level2:    'a4000000-0000-4000-8000-000000000012',
  // cells: 2 at level 1, 2 at level 2
  cell1a:    'c1000000-0000-4000-8000-000000000001',
  cell1b:    'c1000000-0000-4000-8000-000000000002',
  cell2a:    'c2000000-0000-4000-8000-000000000001',
  cell2b:    'c2000000-0000-4000-8000-000000000002',
};

const rackRow = {
  id: ids.rack,
  display_code: 'R1',
  kind: 'single' as const,
  axis: 'NS' as const,
};

const cellRows = [
  { id: ids.cell1a, rack_level_id: ids.level1 },
  { id: ids.cell1b, rack_level_id: ids.level1 },
  { id: ids.cell2a, rack_level_id: ids.level2 },
  { id: ids.cell2b, rack_level_id: ids.level2 },
];

const rackLevelRows = [
  { id: ids.level1, ordinal: 1 },
  { id: ids.level2, ordinal: 2 },
];

// Only cell1a is occupied
const occupancyRows = [
  { cell_id: ids.cell1a },
];

// ── Supabase stub factory ─────────────────────────────────────────────────────

function makeSupabaseStub(overrides: {
  rackData?: unknown;
  rackError?: unknown;
  cellData?: typeof cellRows;
  cellError?: unknown;
  levelData?: typeof rackLevelRows;
  levelError?: unknown;
  occupancyData?: typeof occupancyRows;
  occupancyError?: unknown;
} = {}) {
  const {
    rackData = rackRow,
    rackError = null,
    cellData = cellRows,
    cellError = null,
    levelData = rackLevelRows,
    levelError = null,
    occupancyData = occupancyRows,
    occupancyError = null,
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      if (table === 'racks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: rackData, error: rackError })),
            })),
          })),
        };
      }

      if (table === 'cells') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: cellData, error: cellError })),
            })),
          })),
        };
      }

      if (table === 'rack_levels') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: levelData, error: levelError })),
          })),
        };
      }

      if (table === 'location_occupancy_v') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: occupancyData, error: occupancyError })),
          })),
        };
      }

      throw new Error(`Unexpected table in rack-inspector stub: ${table}`);
    }),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createRackInspectorRepo', () => {
  describe('getRackInspector', () => {
    it('returns null when rack does not exist', async () => {
      const supabase = makeSupabaseStub({ rackData: null });
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      expect(result).toBeNull();
    });

    it('returns rack identity fields correctly', async () => {
      const supabase = makeSupabaseStub();
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      expect(result?.rackId).toBe(ids.rack);
      expect(result?.displayCode).toBe('R1');
      expect(result?.kind).toBe('single');
      expect(result?.axis).toBe('NS');
    });

    it('kind is never "double" — regression guard on stale type', async () => {
      const supabase = makeSupabaseStub({
        rackData: { ...rackRow, kind: 'paired' },
      });
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      expect(result?.kind).not.toBe('double');
      expect(['single', 'paired']).toContain(result?.kind);
    });

    it('returns correct totalLevels and totalCells', async () => {
      const supabase = makeSupabaseStub();
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      expect(result?.totalLevels).toBe(2);
      expect(result?.totalCells).toBe(4);
    });

    it('levels array length equals totalLevels', async () => {
      const supabase = makeSupabaseStub();
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      expect(result?.levels).toHaveLength(result?.totalLevels ?? -1);
    });

    it('levels are ordered by levelOrdinal ascending', async () => {
      const supabase = makeSupabaseStub();
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      const ordinals = result?.levels.map((l) => l.levelOrdinal) ?? [];
      expect(ordinals).toEqual([...ordinals].sort((a, b) => a - b));
    });

    it('per-level cell counts match fixture', async () => {
      const supabase = makeSupabaseStub();
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      const level1 = result?.levels.find((l) => l.levelOrdinal === 1);
      const level2 = result?.levels.find((l) => l.levelOrdinal === 2);
      expect(level1?.totalCells).toBe(2);
      expect(level2?.totalCells).toBe(2);
    });

    it('per-level occupancy counts match known placements', async () => {
      const supabase = makeSupabaseStub(); // only cell1a occupied
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      const level1 = result?.levels.find((l) => l.levelOrdinal === 1);
      const level2 = result?.levels.find((l) => l.levelOrdinal === 2);
      expect(level1?.occupiedCells).toBe(1);
      expect(level1?.emptyCells).toBe(1);
      expect(level2?.occupiedCells).toBe(0);
      expect(level2?.emptyCells).toBe(2);
    });

    it('occupancySummary totals are consistent', async () => {
      const supabase = makeSupabaseStub();
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      const s = result?.occupancySummary;
      expect(s?.occupiedCells).toBe(1);
      expect(s?.emptyCells).toBe(3);
      expect(s?.totalCells).toBe(4);
      expect(s?.occupiedCells).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      expect(s!.occupiedCells + s!.emptyCells).toBe(s!.totalCells);
    });

    it('occupancyRate is 0 when no containers placed', async () => {
      const supabase = makeSupabaseStub({ occupancyData: [] });
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      expect(result?.occupancySummary.occupancyRate).toBe(0);
    });

    it('occupancyRate is between 0 and 1', async () => {
      const supabase = makeSupabaseStub();
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      const rate = result?.occupancySummary.occupancyRate ?? -1;
      expect(rate).toBeGreaterThanOrEqual(0);
      expect(rate).toBeLessThanOrEqual(1);
    });

    it('returns empty payload for rack with no active cells', async () => {
      const supabase = makeSupabaseStub({ cellData: [] });
      const repo = createRackInspectorRepo(supabase as never);
      const result = await repo.getRackInspector(ids.rack);
      expect(result).not.toBeNull();
      expect(result?.totalCells).toBe(0);
      expect(result?.totalLevels).toBe(0);
      expect(result?.levels).toHaveLength(0);
      expect(result?.occupancySummary.occupancyRate).toBe(0);
    });

    it('throws when supabase returns a rack error', async () => {
      const supabase = makeSupabaseStub({ rackError: new Error('DB error') });
      const repo = createRackInspectorRepo(supabase as never);
      await expect(repo.getRackInspector(ids.rack)).rejects.toThrow('DB error');
    });
  });
});
