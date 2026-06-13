import { describe, expect, it, vi } from 'vitest';
import { createWarehouseLabelsRepo } from './repo.js';

type QueryCall = {
  op: string;
  args: unknown[];
};

type TableCall = {
  table: string;
  calls: QueryCall[];
};

function findTable(tables: TableCall[], table: string) {
  const match = tables.find((entry) => entry.table === table);
  expect(match).toBeDefined();
  return match as TableCall;
}

function makeSupabaseMock(results: Record<string, unknown[] | unknown | null>) {
  const tables: TableCall[] = [];

  return {
    tables,
    supabase: {
      from(table: string) {
        const tableCall: TableCall = { table, calls: [] };
        tables.push(tableCall);
        const builder = {
          select(...args: unknown[]) {
            tableCall.calls.push({ op: 'select', args });
            return builder;
          },
          eq(...args: unknown[]) {
            tableCall.calls.push({ op: 'eq', args });
            return builder;
          },
          in(...args: unknown[]) {
            tableCall.calls.push({ op: 'in', args });
            return builder;
          },
          maybeSingle() {
            tableCall.calls.push({ op: 'maybeSingle', args: [] });
            const rows = results[table];
            return Promise.resolve({
              data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null,
              error: null
            });
          },
          then(
            resolve: (value: { data: unknown[]; error: null }) => void,
            reject?: (reason: unknown) => void
          ) {
            const rows = results[table];
            return Promise.resolve({
              data: Array.isArray(rows) ? rows : rows ? [rows] : [],
              error: null
            }).then(resolve, reject);
          }
        };

        return builder;
      }
    }
  };
}

describe('warehouse labels repo', () => {
  it('resolves published layout versions only after validating tenant floor lineage', async () => {
    const ids = {
      tenant: '11111111-1111-4111-8111-111111111111',
      floor: '22222222-2222-4222-8222-222222222222',
      layout: '33333333-3333-4333-8333-333333333333'
    };
    const { supabase, tables } = makeSupabaseMock({
      floors: { id: ids.floor, sites: { tenant_id: ids.tenant } },
      layout_versions: [{ id: ids.layout, floor_id: ids.floor, state: 'published' }]
    });
    const repo = createWarehouseLabelsRepo(supabase as never);

    const result = await repo.listPublishedLayoutVersionsForFloor(ids.tenant, ids.floor);

    expect(result).toEqual([
      {
        id: ids.layout,
        floor_id: ids.floor,
        state: 'published'
      }
    ]);
    expect(findTable(tables, 'floors').calls).toContainEqual({
      op: 'eq',
      args: ['sites.tenant_id', ids.tenant]
    });
    expect(findTable(tables, 'layout_versions').calls).toContainEqual({
      op: 'eq',
      args: ['floor_id', ids.floor]
    });
    expect(findTable(tables, 'layout_versions').calls).toContainEqual({
      op: 'eq',
      args: ['state', 'published']
    });
  });

  it('returns an empty result and skips layout lookups when the floor is outside tenant lineage', async () => {
    const ids = {
      tenant: '11111111-1111-4111-8111-111111111111',
      otherTenant: '99999999-9999-4999-8999-999999999999',
      floor: '22222222-2222-4222-8222-222222222222'
    };
    const { supabase, tables } = makeSupabaseMock({
      floors: { id: ids.floor, sites: { tenant_id: ids.otherTenant } }
    });
    const repo = createWarehouseLabelsRepo(supabase as never);

    const result = await repo.listPublishedLayoutVersionsForFloor(ids.tenant, ids.floor);

    expect(result).toEqual([]);
    expect(tables.map((entry) => entry.table)).toEqual(['floors']);
  });
});
