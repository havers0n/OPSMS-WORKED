import { describe, expect, it } from 'vitest';
import { createDeliveryPointsRepo } from './delivery-points-repo.js';
import { normalizeDeliveryPointAliasText } from '@wos/domain';

// ── Mock helpers ─────────────────────────────────────────────────────────────

type QueryCall = {
  op: string;
  args: unknown[];
};

type TableCall = {
  table: string;
  calls: QueryCall[];
};

type QueryResult = {
  data?: unknown[] | unknown | null;
  error?: unknown;
};

function makeSupabaseMock(results: Record<string, QueryResult | QueryResult[]>) {
  const tables: TableCall[] = [];
  const counters = new Map<string, number>();

  function takeResult(table: string): QueryResult {
    const configured = results[table];
    if (Array.isArray(configured)) {
      const index = counters.get(table) ?? 0;
      counters.set(table, index + 1);
      return configured[index] ?? { data: [] };
    }
    return configured ?? { data: [] };
  }

  let thenOrder: { field: string; asc: boolean } | null = null;

  return {
    tables,
    supabase: {
      from(table: string) {
        const tableCall: TableCall = { table, calls: [] };
        tables.push(tableCall);
        let eqChain: Record<string, string> = {};
        const builder = {
          select(...args: unknown[]) {
            tableCall.calls.push({ op: 'select', args });
            return builder;
          },
          eq(...args: unknown[]) {
            tableCall.calls.push({ op: 'eq', args });
            eqChain[String(args[0])] = String(args[1]);
            return builder;
          },
          or(...args: unknown[]) {
            tableCall.calls.push({ op: 'or', args });
            return builder;
          },
          in(...args: unknown[]) {
            tableCall.calls.push({ op: 'in', args });
            return builder;
          },
          limit(...args: unknown[]) {
            tableCall.calls.push({ op: 'limit', args });
            return builder;
          },
          range(...args: unknown[]) {
            tableCall.calls.push({ op: 'range', args });
            return builder;
          },
          order(field: string, opts: { ascending: boolean }) {
            tableCall.calls.push({ op: 'order', args: [field, opts] });
            thenOrder = { field, asc: opts.ascending };
            return builder;
          },
          maybeSingle() {
            tableCall.calls.push({ op: 'maybeSingle', args: [] });
            const result = takeResult(table);
            return Promise.resolve({
              data: Array.isArray(result.data) ? (result.data[0] ?? null) : (result.data ?? null),
              error: result.error ?? null
            });
          },
          then(
            resolve: (value: { data: unknown[]; error: unknown | null }) => void,
            reject?: (reason: unknown) => void
          ) {
            const result = takeResult(table);
            const data = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
            return Promise.resolve({
              data,
              error: result.error ?? null
            }).then(resolve, reject);
          }
        };
        return builder;
      }
    }
  };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const POINT_ID_1 = '10000000-0000-4000-8000-000000000001';
const POINT_ID_2 = '20000000-0000-4000-8000-000000000002';
const ALIAS_ID_1 = '30000000-0000-4000-8000-000000000001';
const ALIAS_ID_2 = '30000000-0000-4000-8000-000000000002';
const ALIAS_ID_3 = '30000000-0000-4000-8000-000000000003';

const POINT_1_ROW = {
  id: POINT_ID_1,
  source_type: 'fuel_admin',
  source_external_id: 'dor-alon-yesodot',
  official_fuel_admin_id: null,
  display_name: 'דור אלון - יסודות',
  company_name: 'דור אלון',
  site_name: 'יסודות',
  address: 'רחוב הראשי 1',
  municipality: null,
  latitude: 31.813,
  longitude: 34.648,
  status: 'active',
  created_at: '2026-06-27T00:00:00.000Z',
  updated_at: '2026-06-27T00:00:00.000Z'
};

const POINT_2_ROW = {
  id: POINT_ID_2,
  source_type: 'fuel_admin',
  source_external_id: 'paz-hav-lanpet',
  official_fuel_admin_id: null,
  display_name: 'פז חב.לנפט - ניתוב',
  company_name: 'פז',
  site_name: 'ניתוב',
  address: null,
  municipality: null,
  latitude: null,
  longitude: null,
  status: 'active',
  created_at: '2026-06-27T00:00:00.000Z',
  updated_at: '2026-06-27T00:00:00.000Z'
};

const ALIAS_1_ROW = {
  id: ALIAS_ID_1,
  delivery_point_id: POINT_ID_1,
  alias_text: 'דור אלון - יסודות :950',
  normalized_alias_text: 'דור אלון - יסודות :950',
  alias_source: 'order_import',
  confidence: 'confirmed'
};

const ALIAS_2_ROW = {
  id: ALIAS_ID_2,
  delivery_point_id: POINT_ID_1,
  alias_text: 'דור אלון – יסודות :950',
  normalized_alias_text: 'דור אלון - יסודות :950',
  alias_source: 'order_import',
  confidence: 'confirmed'
};

const ALIAS_3_ROW = {
  id: ALIAS_ID_3,
  delivery_point_id: POINT_ID_2,
  alias_text: 'פז חב.לנפט -ניתוב - מנדלבאום : 513',
  normalized_alias_text: 'פז חב.לנפט -ניתוב - מנדלבאום :513',
  alias_source: 'order_import',
  confidence: 'confirmed'
};

describe('DeliveryPointsRepo', () => {
  describe('findDeliveryPointByAliasExact', () => {
    it('normalizes input and returns the matched delivery point', async () => {
      const normalized = normalizeDeliveryPointAliasText(' דור אלון - יסודות :950 ');

      const { supabase, tables } = makeSupabaseMock({
        delivery_point_aliases: {
          data: [
            {
              delivery_point_id: POINT_ID_1,
              delivery_points: POINT_1_ROW
            }
          ]
        }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.findDeliveryPointByAliasExact(' דור אלון - יסודות :950 ');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(POINT_ID_1);
      expect(result!.displayName).toBe('דור אלון - יסודות');

      // Verify query used normalized text and confidence filter
      const aliasCalls = tables.find(t => t.table === 'delivery_point_aliases');
      expect(aliasCalls).toBeDefined();
      expect(aliasCalls!.calls).toContainEqual({ op: 'eq', args: ['normalized_alias_text', normalized] });
      expect(aliasCalls!.calls).toContainEqual({ op: 'eq', args: ['confidence', 'confirmed'] });
    });

    it('deduplicates aliases pointing to the same delivery point', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: {
          data: [ALIAS_1_ROW, ALIAS_2_ROW].map(a => ({
            delivery_point_id: a.delivery_point_id,
            delivery_points: POINT_1_ROW
          }))
        }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.findDeliveryPointByAliasExact('דור אלון – יסודות :950');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(POINT_ID_1);
    });

    it('returns null for unknown alias', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: { data: [] }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.findDeliveryPointByAliasExact('bogus alias');

      expect(result).toBeNull();
    });

    it('returns null for empty input after normalization', async () => {
      const { supabase } = makeSupabaseMock({});
      const repo = createDeliveryPointsRepo(supabase as never);

      const result = await repo.findDeliveryPointByAliasExact('   ');
      expect(result).toBeNull();
    });

    it('throws AMBIGUOUS_ALIAS when alias maps to multiple different delivery points', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: {
          data: [
            { delivery_point_id: POINT_ID_1, delivery_points: POINT_1_ROW },
            { delivery_point_id: POINT_ID_2, delivery_points: POINT_2_ROW }
          ]
        }
      });

      const repo = createDeliveryPointsRepo(supabase as never);

      await expect(
        repo.findDeliveryPointByAliasExact('ambiguous alias')
      ).rejects.toMatchObject({
        code: 'AMBIGUOUS_ALIAS',
        deliveryPoints: [
          expect.objectContaining({ id: POINT_ID_1 }),
          expect.objectContaining({ id: POINT_ID_2 })
        ]
      });
    });

    it('does not match review or rejected aliases by default', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: { data: [] }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      // Even though we could have a 'review' alias, the query only looks for 'confirmed'
      const result = await repo.findDeliveryPointByAliasExact('דור אלון - יסודות :950');
      expect(result).toBeNull();
    });
  });

  describe('getDeliveryPointById', () => {
    it('returns a delivery point by id', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_points: { data: POINT_1_ROW }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.getDeliveryPointById(POINT_ID_1);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(POINT_ID_1);
      expect(result!.displayName).toBe('דור אלון - יסודות');
    });

    it('returns null when not found', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_points: { data: null }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.getDeliveryPointById('00000000-0000-4000-8000-000000000099');

      expect(result).toBeNull();
    });
  });

  describe('findDeliveryPointBySource', () => {
    it('returns a delivery point by source', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_points: { data: POINT_1_ROW }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.findDeliveryPointBySource('fuel_admin', 'dor-alon-yesodot');

      expect(result).not.toBeNull();
      expect(result!.id).toBe(POINT_ID_1);
    });

    it('returns null when source not found', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_points: { data: null }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.findDeliveryPointBySource('fuel_admin', 'unknown');

      expect(result).toBeNull();
    });
  });

  describe('listDeliveryPoints', () => {
    it('returns all delivery points without params', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_points: { data: [POINT_1_ROW, POINT_2_ROW] }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.listDeliveryPoints();

      expect(result).toHaveLength(2);
    });

    it('filters by status', async () => {
      const { supabase, tables } = makeSupabaseMock({
        delivery_points: { data: [POINT_1_ROW] }
      });

      const repo = createDeliveryPointsRepo(supabase as never);
      const result = await repo.listDeliveryPoints({ status: 'active' });

      expect(result).toHaveLength(1);
      const dpCalls = tables.find(t => t.table === 'delivery_points');
      expect(dpCalls!.calls).toContainEqual({ op: 'eq', args: ['status', 'active'] });
    });
  });
});
