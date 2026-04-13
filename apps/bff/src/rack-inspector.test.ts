import { describe, expect, it, vi } from 'vitest';
import { buildApp } from './app.js';
import { rackInspectorPayloadSchema } from './schemas.js';

// ── Auth stub ─────────────────────────────────────────────────────────────────

const authContext = {
  accessToken: 'token',
  user: { id: '16e4f7f4-0d03-4ea0-ac6a-3d6f6b6e2b2d', email: 'operator@wos.local' },
  displayName: 'Local Operator',
  memberships: [{ tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a', tenantCode: 'default', tenantName: 'Default Tenant', role: 'tenant_admin' }],
  currentTenant: { tenantId: '9a22f6a8-8db3-46d8-97be-4ca3b164fe1a', tenantCode: 'default', tenantName: 'Default Tenant', role: 'tenant_admin' }
};

// ── Fixture IDs ───────────────────────────────────────────────────────────────

const ids = {
  rack:    'b1000000-0000-4000-8000-000000000001',
  level1:  'b4000000-0000-4000-8000-000000000011',
  level2:  'b4000000-0000-4000-8000-000000000012',
  cell1a:  'bc000000-0000-4000-8000-000000000001',
  cell1b:  'bc000000-0000-4000-8000-000000000002',
  cell2a:  'bc000000-0000-4000-8000-000000000003',
  cell2b:  'bc000000-0000-4000-8000-000000000004',
};

const rackRow = { id: ids.rack, display_code: 'R2', kind: 'paired', axis: 'WE' };
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
const occupancyRows = [
  { cell_id: ids.cell1a },
  { cell_id: ids.cell2a },
];

// ── Supabase stub factory ─────────────────────────────────────────────────────

function makeSupabaseStub(overrides: {
  rackData?: unknown;
  cellData?: unknown[];
  levelData?: unknown[];
  occupancyData?: unknown[];
} = {}) {
  const {
    rackData = rackRow,
    cellData = cellRows,
    levelData = rackLevelRows,
    occupancyData = occupancyRows,
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      if (table === 'racks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: rackData, error: null })),
            })),
          })),
        };
      }
      if (table === 'cells') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: cellData, error: null })),
            })),
          })),
        };
      }
      if (table === 'rack_levels') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: levelData, error: null })),
          })),
        };
      }
      if (table === 'location_occupancy_v') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: occupancyData, error: null })),
          })),
        };
      }
      // Fall-through for any other tables the framework may query
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null })),
          in: vi.fn(async () => ({ data: [], error: null })),
        })),
      };
    }),
    rpc: vi.fn(async () => ({ data: null, error: null })),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/racks/:rackId/inspector', () => {
  it('returns 401 when bearer token is missing', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: `/api/racks/${ids.rack}/inspector`,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it('returns 200 with valid RackInspectorPayload', async () => {
    const supabase = makeSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/racks/${ids.rack}/inspector`,
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    // Must parse without throwing
    expect(() => rackInspectorPayloadSchema.parse(body)).not.toThrow();
    await app.close();
  });

  it('returns correct rack identity in response', async () => {
    const supabase = makeSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/racks/${ids.rack}/inspector`,
      headers: { authorization: 'Bearer token' },
    });

    const body = response.json();
    expect(body.rackId).toBe(ids.rack);
    expect(body.displayCode).toBe('R2');
    expect(body.kind).toBe('paired');
    expect(body.axis).toBe('WE');
    await app.close();
  });

  it('kind is never "double" in response', async () => {
    const supabase = makeSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/racks/${ids.rack}/inspector`,
      headers: { authorization: 'Bearer token' },
    });

    expect(response.json().kind).not.toBe('double');
    await app.close();
  });

  it('levels array has correct length matching totalLevels', async () => {
    const supabase = makeSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/racks/${ids.rack}/inspector`,
      headers: { authorization: 'Bearer token' },
    });

    const body = response.json();
    expect(body.levels).toHaveLength(body.totalLevels);
    await app.close();
  });

  it('occupancySummary counts are consistent', async () => {
    const supabase = makeSupabaseStub();
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/racks/${ids.rack}/inspector`,
      headers: { authorization: 'Bearer token' },
    });

    const { occupancySummary } = response.json();
    expect(occupancySummary.occupiedCells + occupancySummary.emptyCells).toBe(occupancySummary.totalCells);
    expect(occupancySummary.occupancyRate).toBeGreaterThanOrEqual(0);
    expect(occupancySummary.occupancyRate).toBeLessThanOrEqual(1);
    await app.close();
  });

  it('returns 404 when rack does not exist', async () => {
    const supabase = makeSupabaseStub({ rackData: null });
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase: vi.fn(() => supabase as never),
    });

    const unknownId = 'f0000000-0000-4000-8000-000000000099';
    const response = await app.inject({
      method: 'GET',
      url: `/api/racks/${unknownId}/inspector`,
      headers: { authorization: 'Bearer token' },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().code).toBe('RACK_NOT_FOUND');
    await app.close();
  });
});
