import { describe, expect, it } from 'vitest';
import { createManualShiftsRepo } from './repo.js';

function createFakeSupabase() {
  const inserts: Record<string, Array<Record<string, unknown>>> = {
    demand_import_batches: [],
    raw_demand_rows: []
  };

  const from = (table: string) => {
    const state = {
      table,
      filters: [] as Array<[string, unknown]>,
      limitCount: undefined as number | undefined
    };

    const builder = {
      insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
        const rows = Array.isArray(payload) ? payload : [payload];
        inserts[table] ??= [];
        for (const row of rows) {
          const stored = {
            id: `id-${table}-${inserts[table].length + 1}`,
            uploaded_at: '2026-06-24T08:00:00.000Z',
            created_at: '2026-06-24T08:00:00.000Z',
            ...row
          };
          inserts[table].push(stored);
        }
        return {
          select() {
            return {
              single: async () => ({ data: inserts[table][inserts[table].length - 1], error: null })
            };
          },
          then(resolve: (value: { error: null }) => unknown) {
            return Promise.resolve({ error: null }).then(resolve);
          }
        };
      },
      select() {
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters.push([column, value]);
        return builder;
      },
      order() {
        return builder;
      },
      limit(count: number) {
        state.limitCount = count;
        return builder;
      },
      async single() {
        const rows = inserts[table].filter((row) => state.filters.every(([column, value]) => row[column] === value));
        return { data: rows[0] ?? null, error: null };
      },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        let rows = inserts[table].filter((row) => state.filters.every(([column, value]) => row[column] === value));
        if (state.limitCount !== undefined) {
          rows = rows.slice(0, state.limitCount);
        }
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      }
    };

    return builder;
  };

  return {
    supabase: {
      from,
      rpc: async () => ({ data: null, error: null })
    },
    inserts
  };
}

describe('demand import repo methods', () => {
  it('creates batches and raw rows without touching manual_shift tables', async () => {
    const { supabase, inserts } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const batch = await repo.createDemandImportBatch({
      tenantId: '11111111-1111-4111-8111-111111111111',
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      uploadedBy: '22222222-2222-4222-8222-222222222222',
      status: 'ready',
      rowsCount: 1,
      rawRowsCount: 1,
      warningRowsCount: 0,
      errorRowsCount: 0,
      specialFlowRowsCount: 0,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 1
    });

    await repo.insertRawDemandRows({
      tenantId: batch.tenantId,
      batchId: batch.id,
      sourceSheet: 'DataSheet',
      rows: [
        {
          sourceSheet: 'DataSheet',
          sourceRowNumber: 2,
          agent: 'agent',
          orderDate: '2026-06-24',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: 'SKU-1',
          description: 'מוצר',
          category: 'cat',
          quantity: 3,
          cost: 10,
          notes: null,
          distributionArea: 'דרום',
          rawRouteLine: null,
          plannedDeliveryDate: null,
          plannedRouteLine: null,
          plannedWorkBucket: null,
          planningStatus: 'unplanned',
          routeFlow: 'unassigned',
          productHandlingFlow: 'regular',
          noteDateHints: [],
          issues: []
        }
      ]
    });

    expect(Object.keys(inserts).sort()).toEqual(['demand_import_batches', 'raw_demand_rows']);
    expect(inserts.raw_demand_rows).toHaveLength(1);
    expect(inserts.raw_demand_rows[0]).toMatchObject({
      batch_id: batch.id,
      planned_delivery_date: null,
      planned_route_line: null,
      planned_work_bucket: null
    });
  });
});
