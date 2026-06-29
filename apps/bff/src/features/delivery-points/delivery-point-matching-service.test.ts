import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createDeliveryPointAliasMatchingService } from './delivery-point-matching-service.js';

// ── Mock helpers ─────────────────────────────────────────────────────────────

type QueryResult = {
  data?: unknown[] | unknown | null;
  error?: unknown;
};

function makeSupabaseMock(results: Record<string, QueryResult | QueryResult[]>) {
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

  const stub = {
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        then(resolve: (value: { data: unknown[]; error: unknown | null }) => void) {
          const result = takeResult('delivery_point_aliases');
          const data = Array.isArray(result.data) ? result.data : result.data ? [result.data] : [];
          return Promise.resolve({ data, error: result.error ?? null }).then(resolve);
        }
      };
    }
  };

  return { supabase: stub, tables: [] as never[] };
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

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

function aliasRow(
  deliveryPointId: string,
  pointRow: Record<string, unknown>
) {
  return {
    delivery_point_id: deliveryPointId,
    delivery_points: pointRow
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('DeliveryPointAliasMatchingService', () => {
  describe('matchAliasExact', () => {
    it('returns matched for known alias with full delivery point', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: {
          data: [aliasRow(POINT_ID_1, POINT_1_ROW)]
        }
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);
      const result = await service.matchAliasExact('דור אלון - יסודות :950');

      expect(result).toEqual({
        status: 'matched',
        input: 'דור אלון - יסודות :950',
        normalizedInput: 'דור אלון - יסודות :950',
        deliveryPoint: {
          id: POINT_ID_1,
          sourceType: 'fuel_admin_registry',
          sourceExternalId: 'fuel_admin_2503',
          officialFuelAdminId: '2503',
          displayName: 'דור אלון - יסודות',
          companyName: 'דור אלון',
          siteName: 'יסודות',
          address: 'כביש 3 בכניסה למושב יסודות',
          municipality: 'מ.א מטה יהודה',
          latitude: 31.81026403,
          longitude: 34.85956775,
          status: 'active',
          createdAt: '2026-06-27T00:00:00.000Z',
          updatedAt: '2026-06-27T00:00:00.000Z'
        }
      });
    });

    it('normalizes input before lookup', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: {
          data: [aliasRow(POINT_ID_1, POINT_1_ROW)]
        }
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);
      const result = await service.matchAliasExact(' דור אלון – יסודות :950 ');

      expect(result).toEqual({
        status: 'matched',
        input: ' דור אלון – יסודות :950 ',
        normalizedInput: 'דור אלון - יסודות :950',
        deliveryPoint: expect.objectContaining({
          id: POINT_ID_1,
          displayName: 'דור אלון - יסודות'
        })
      });
    });

    it('returns unmatched for unknown alias', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: { data: [] }
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);
      const result = await service.matchAliasExact('bogus alias');

      expect(result).toEqual({
        status: 'unmatched',
        input: 'bogus alias',
        normalizedInput: 'bogus alias'
      });
    });

    it('returns unmatched for operational/general labels', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: { data: [] }
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);

      const labels = ['גליל כללי', 'שפלה דרומית', 'נהוראי'];
      for (const label of labels) {
        const result = await service.matchAliasExact(label);
        expect(result).toEqual({
          status: 'unmatched',
          input: label,
          normalizedInput: label
        });
      }
    });

    it('returns ambiguous when repo resolves multiple different delivery points', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: {
          data: [
            aliasRow(POINT_ID_1, POINT_1_ROW),
            aliasRow(POINT_ID_2, POINT_2_ROW)
          ]
        }
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);
      const result = await service.matchAliasExact('ambiguous alias');

      expect(result).toEqual({
        status: 'ambiguous',
        input: 'ambiguous alias',
        normalizedInput: 'ambiguous alias',
        message: expect.stringContaining('2 different delivery points')
      });
    });

    it('re-throws non-ambiguous errors from the repo', async () => {
      const dbError = new Error('DB connection failed');
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: { error: dbError }
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);

      await expect(service.matchAliasExact('test')).rejects.toThrow('DB connection failed');
    });
  });

  describe('matchAliasesExact', () => {
    it('preserves input order with mixed results', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: [
          { data: [aliasRow(POINT_ID_1, POINT_1_ROW)] },
          { data: [] },
          { data: [aliasRow(POINT_ID_2, POINT_2_ROW)] }
        ]
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);
      const results = await service.matchAliasesExact([
        'דור אלון - יסודות :950',
        'גליל כללי',
        'דור אלון - נס ציונה :908'
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('matched');
      expect(results[1].status).toBe('unmatched');
      expect(results[2].status).toBe('matched');
      expect(results[2]).toEqual(
        expect.objectContaining({
          input: 'דור אלון - נס ציונה :908',
          deliveryPoint: expect.objectContaining({
            sourceExternalId: 'fuel_admin_2454'
          })
        })
      );
    });

    it('returns duplicate results for duplicate inputs', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: [
          { data: [aliasRow(POINT_ID_1, POINT_1_ROW)] },
          { data: [] }
        ]
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);
      const results = await service.matchAliasesExact([
        'דור אלון - יסודות :950',
        'גליל כללי',
        'דור אלון - יסודות :950'
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('matched');
      expect(results[0].input).toBe('דור אלון - יסודות :950');
      expect(results[1].status).toBe('unmatched');
      expect(results[1].input).toBe('גליל כללי');
      expect(results[2].status).toBe('matched');
      expect(results[2].input).toBe('דור אלון - יסודות :950');
    });

    it('does not fail entire batch because of an unmatched alias', async () => {
      const { supabase } = makeSupabaseMock({
        delivery_point_aliases: [
          { data: [aliasRow(POINT_ID_1, POINT_1_ROW)] },
          { data: [] },
          { data: [aliasRow(POINT_ID_2, POINT_2_ROW)] }
        ]
      });

      const service = createDeliveryPointAliasMatchingService(supabase as never);
      const results = await service.matchAliasesExact([
        'דור אלון - יסודות :950',
        'bogus',
        'דור אלון - נס ציונה :908'
      ]);

      expect(results).toHaveLength(3);
      expect(results[0].status).toBe('matched');
      expect(results[1].status).toBe('unmatched');
      expect(results[2].status).toBe('matched');
    });
  });
});
