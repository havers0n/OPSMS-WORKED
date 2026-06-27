import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../../app.js';

// ── Auth stub ─────────────────────────────────────────────────────────────────

const authContext = {
  accessToken: 'test-token',
  user: { id: 'test-user-id', email: 'test@example.com' },
  displayName: 'Test User',
  memberships: [],
  currentTenant: null
};

// ── Fixtures ──────────────────────────────────────────────────────────────────

const POINT_ID_1 = '10000000-0000-4000-8000-000000000001';
const POINT_ID_2 = '20000000-0000-4000-8000-000000000002';

const POINT_1_ROW = {
  id: POINT_ID_1,
  source_type: 'fuel_admin_registry',
  source_external_id: 'fuel_admin_2503',
  official_fuel_admin_id: '2503',
  display_name: 'דור אלון - יסודות',
  company_name: 'דור אלון',
  site_name: 'יסודות',
  address: 'כביש 3 בכניסה למושב יסודות',
  municipality: 'מ.א מטה יהודה',
  latitude: 31.81026403,
  longitude: 34.85956775,
  status: 'active',
  created_at: '2026-06-27T00:00:00.000Z',
  updated_at: '2026-06-27T00:00:00.000Z'
};

const POINT_2_ROW = {
  id: POINT_ID_2,
  source_type: 'fuel_admin_registry',
  source_external_id: 'fuel_admin_2454',
  official_fuel_admin_id: '2454',
  display_name: 'דור אלון - נס ציונה',
  company_name: 'דור אלון',
  site_name: 'נס ציונה',
  address: 'ויצמן 37 נס ציונה',
  municipality: 'נס ציונה',
  latitude: 31.92812084,
  longitude: 34.79767026,
  status: 'active',
  created_at: '2026-06-27T00:00:00.000Z',
  updated_at: '2026-06-27T00:00:00.000Z'
};

// ── Supabase stub factory ─────────────────────────────────────────────────────

function makeSupabaseStub(
  aliasResults: Array<{ deliveryPointId: string; pointRow: Record<string, unknown> }[]> = []
) {
  let callIndex = 0;

  return {
    from: vi.fn((table: string) => {
      if (table === 'delivery_point_aliases') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => {
                const rows = aliasResults[callIndex] ?? [];
                callIndex++;
                const data = rows.map((r) => ({
                  delivery_point_id: r.deliveryPointId,
                  delivery_points: r.pointRow
                }));
                return { data, error: null };
              })
            }))
          }))
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(async () => ({ data: [], error: null }))
        }))
      };
    })
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/delivery-points/match-aliases', () => {
  it('returns matched and unmatched results', async () => {
    const supabase = makeSupabaseStub([
      [{ deliveryPointId: POINT_ID_1, pointRow: POINT_1_ROW }],
      []
    ]);
    const getUserSupabase = vi.fn(() => supabase as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/delivery-points/match-aliases',
      payload: {
        aliases: ['דור אלון - יסודות :950', 'bogus alias']
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].status).toBe('matched');
    expect(body.results[0].input).toBe('דור אלון - יסודות :950');
    expect(body.results[1].status).toBe('unmatched');
    expect(body.results[1].input).toBe('bogus alias');

    await app.close();
  });

  it('includes DeliveryPoint coordinates for matched results', async () => {
    const supabase = makeSupabaseStub([
      [{ deliveryPointId: POINT_ID_1, pointRow: POINT_1_ROW }],
      [{ deliveryPointId: POINT_ID_2, pointRow: POINT_2_ROW }]
    ]);
    const getUserSupabase = vi.fn(() => supabase as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/delivery-points/match-aliases',
      payload: {
        aliases: ['דור אלון - יסודות :950', 'דור אלון - נס ציונה :908']
      }
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results[0].deliveryPoint.latitude).toBe(31.81026403);
    expect(body.results[0].deliveryPoint.longitude).toBe(34.85956775);
    expect(body.results[1].deliveryPoint.latitude).toBe(31.92812084);
    expect(body.results[1].deliveryPoint.longitude).toBe(34.79767026);

    await app.close();
  });

  it('returns 400 for empty aliases array', async () => {
    const supabase = makeSupabaseStub();
    const getUserSupabase = vi.fn(() => supabase as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/delivery-points/match-aliases',
      payload: { aliases: [] }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 400 for whitespace-only alias', async () => {
    const supabase = makeSupabaseStub();
    const getUserSupabase = vi.fn(() => supabase as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/delivery-points/match-aliases',
      payload: { aliases: ['   '] }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('VALIDATION_ERROR');

    await app.close();
  });

  it('returns 400 for too-large batch', async () => {
    const supabase = makeSupabaseStub();
    const getUserSupabase = vi.fn(() => supabase as never);
    const app = buildApp({
      getAuthContext: vi.fn(async () => authContext as never),
      getUserSupabase
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/delivery-points/match-aliases',
      payload: { aliases: Array.from({ length: 501 }, (_, i) => `alias-${i}`) }
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.code).toBe('VALIDATION_ERROR');

    await app.close();
  });
});
