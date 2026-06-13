import { describe, expect, it } from 'vitest';
import { createWarehouseLabelsRepo } from './repo.js';

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

function findTables(tables: TableCall[], table: string) {
  return tables.filter((entry) => entry.table === table);
}

function findTable(tables: TableCall[], table: string) {
  const match = tables.find((entry) => entry.table === table);
  expect(match).toBeDefined();
  return match as TableCall;
}

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

describe('warehouse labels repo', () => {
  it('resolves published layout versions only after validating tenant floor lineage', async () => {
    const ids = {
      tenant: '11111111-1111-4111-8111-111111111111',
      floor: '22222222-2222-4222-8222-222222222222',
      layout: '33333333-3333-4333-8333-333333333333'
    };
    const { supabase, tables } = makeSupabaseMock({
      floors: { data: { id: ids.floor, sites: { tenant_id: ids.tenant } } },
      layout_versions: { data: [{ id: ids.layout, floor_id: ids.floor, state: 'published' }] }
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
      floors: { data: { id: ids.floor, sites: { tenant_id: ids.otherTenant } } }
    });
    const repo = createWarehouseLabelsRepo(supabase as never);

    const result = await repo.listPublishedLayoutVersionsForFloor(ids.tenant, ids.floor);

    expect(result).toEqual([]);
    expect(tables.map((entry) => entry.table)).toEqual(['floors']);
  });

  it('chunks cell id reads into 10 bounded PostgREST requests and merges the rows', async () => {
    const cellIds = Array.from(
      { length: 1000 },
      (_, index) => `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    );
    const { supabase, tables } = makeSupabaseMock({
      cells: Array.from({ length: 10 }, (_, chunkIndex) => {
        const chunkIds = cellIds.slice(chunkIndex * 100, (chunkIndex + 1) * 100);
        return {
          data: chunkIds.map((id, index) => ({
            id,
            address_sort_key: `${String(chunkIndex).padStart(2, '0')}-${String(index).padStart(3, '0')}`,
            status: 'active',
            layout_version_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
          }))
        };
      })
    });
    const repo = createWarehouseLabelsRepo(supabase as never);

    const result = await repo.listCellsByIds(cellIds);

    const cellTables = findTables(tables, 'cells');
    expect(cellTables).toHaveLength(10);
    expect(result.map((row) => row.id)).toEqual(cellIds);
    for (const table of cellTables) {
      const inCall = table.calls.find((call) => call.op === 'in');
      expect(inCall).toBeDefined();
      expect(inCall?.args[0]).toBe('id');
      expect((inCall?.args[1] as string[]).length).toBeLessThanOrEqual(100);
    }
  });

  it('returns an empty array for empty cell ids without reading Supabase', async () => {
    const { supabase, tables } = makeSupabaseMock({});
    const repo = createWarehouseLabelsRepo(supabase as never);

    const result = await repo.listCellsByIds([]);

    expect(result).toEqual([]);
    expect(tables).toEqual([]);
  });

  it('chunks tenant location id reads into 10 bounded tenant-scoped requests and merges the rows', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const locationIds = Array.from(
      { length: 1000 },
      (_, index) => `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    );
    const { supabase, tables } = makeSupabaseMock({
      locations: Array.from({ length: 10 }, (_, chunkIndex) => {
        const chunkIds = locationIds.slice(chunkIndex * 100, (chunkIndex + 1) * 100);
        return {
          data: chunkIds.map((id, index) => ({
            id,
            tenant_id: tenantId,
            floor_id: '22222222-2222-4222-8222-222222222222',
            code: `03-A.02.${String(chunkIndex).padStart(2, '0')}.${String(index).padStart(2, '0')}`,
            location_type: 'rack_slot',
            geometry_slot_id: `71000000-0000-4000-8000-${String(chunkIndex * 100 + index).padStart(12, '0')}`,
            status: 'active'
          }))
        };
      })
    });
    const repo = createWarehouseLabelsRepo(supabase as never);

    const result = await repo.listTenantLocationsByIds(tenantId, locationIds);

    const locationTables = findTables(tables, 'locations');
    expect(locationTables).toHaveLength(10);
    expect(result.map((row) => row.id)).toEqual(locationIds);
    for (const table of locationTables) {
      expect(table.calls).toContainEqual({
        op: 'eq',
        args: ['tenant_id', tenantId]
      });
      const inCall = table.calls.find((call) => call.op === 'in');
      expect(inCall).toBeDefined();
      expect(inCall?.args[0]).toBe('id');
      expect((inCall?.args[1] as string[]).length).toBeLessThanOrEqual(100);
    }
  });

  it('rejects cell reads if any chunked Supabase request fails', async () => {
    const cellIds = Array.from(
      { length: 1000 },
      (_, index) => `70000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    );
    const error = new Error('chunk failed');
    const { supabase } = makeSupabaseMock({
      cells: Array.from({ length: 10 }, (_, chunkIndex) =>
        chunkIndex === 4
          ? { error }
          : {
              data: [
                {
                  id: cellIds[chunkIndex],
                  address_sort_key: `chunk-${chunkIndex}`,
                  status: 'active',
                  layout_version_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
                }
              ]
            }
      )
    });
    const repo = createWarehouseLabelsRepo(supabase as never);

    await expect(repo.listCellsByIds(cellIds)).rejects.toBe(error);
  });

  it('rejects tenant location reads if any chunked Supabase request fails', async () => {
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const locationIds = Array.from(
      { length: 1000 },
      (_, index) => `40000000-0000-4000-8000-${String(index).padStart(12, '0')}`
    );
    const error = new Error('chunk failed');
    const { supabase } = makeSupabaseMock({
      locations: Array.from({ length: 10 }, (_, chunkIndex) =>
        chunkIndex === 6
          ? { error }
          : {
              data: [
                {
                  id: locationIds[chunkIndex],
                  tenant_id: tenantId,
                  floor_id: '22222222-2222-4222-8222-222222222222',
                  code: `03-A.02.03.${String(chunkIndex).padStart(2, '0')}`,
                  location_type: 'rack_slot',
                  geometry_slot_id: `71000000-0000-4000-8000-${String(chunkIndex).padStart(12, '0')}`,
                  status: 'active'
                }
              ]
            }
      )
    });
    const repo = createWarehouseLabelsRepo(supabase as never);

    await expect(repo.listTenantLocationsByIds(tenantId, locationIds)).rejects.toBe(error);
  });
});
