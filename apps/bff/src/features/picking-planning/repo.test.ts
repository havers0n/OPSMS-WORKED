import { describe, expect, it } from 'vitest';
import {
  createPickingPlanningOrderInputReadRepo,
  createPickingPlanningWaveReadRepo
} from './repo.js';

type QueryCall = {
  op: string;
  args: unknown[];
};

type TableCall = {
  table: string;
  calls: QueryCall[];
};

function makeSupabaseMock(results: Record<string, unknown[] | null> = {}) {
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
          gt(...args: unknown[]) {
            tableCall.calls.push({ op: 'gt', args });
            return builder;
          },
          not(...args: unknown[]) {
            tableCall.calls.push({ op: 'not', args });
            return builder;
          },
          order(...args: unknown[]) {
            tableCall.calls.push({ op: 'order', args });
            return builder;
          },
          maybeSingle() {
            tableCall.calls.push({ op: 'maybeSingle', args: [] });
            const rows = results[table] ?? [];
            return Promise.resolve({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null });
          },
          then(resolve: (value: { data: unknown[] | null; error: null }) => void) {
            resolve({ data: results[table] ?? [], error: null });
          }
        };

        return builder;
      }
    }
  };
}

function expectEq(table: TableCall, column: string, value: unknown) {
  expect(table.calls).toContainEqual({ op: 'eq', args: [column, value] });
}

function findTable(tables: TableCall[], table: string) {
  const match = tables.find((entry) => entry.table === table);
  expect(match).toBeDefined();
  return match as TableCall;
}

describe('picking planning read repos', () => {
  const tenantId = 'tenant-1';

  it('tenant-scopes order input read tables that carry tenant_id', async () => {
    const { supabase, tables } = makeSupabaseMock({
      order_lines: [{ order_id: 'order-1', id: 'line-1', product_id: 'product-1', sku: 'sku-1', qty_required: 1, qty_picked: 0 }],
      product_location_roles: [{ product_id: 'product-1', location_id: 'location-1' }],
      inventory_unit: [{ id: 'iu-1', product_id: 'product-1', container_id: 'container-1', quantity: 1, uom: 'ea', created_at: '2026-01-01T00:00:00Z' }],
      containers: [{ id: 'container-1', current_location_id: 'location-1' }],
      locations: [{ id: 'location-1', tenant_id: tenantId, floor_id: 'floor-1', code: 'A-01' }]
    });
    const repo = createPickingPlanningOrderInputReadRepo(supabase as never, tenantId);

    await repo.listOrderLines(['order-1', 'order-other']);
    await repo.listProducts(['product-1']);
    await repo.listUnitProfiles(['product-1']);
    await repo.listPackagingLevels(['product-1']);
    await repo.listPrimaryPickLocations(['product-1']);
    await repo.listInventoryUnits(['product-1']);
    await repo.listContainerLocations(['container-1']);
    await repo.listLocations(['location-1']);

    expectEq(findTable(tables, 'order_lines'), 'tenant_id', tenantId);
    expectEq(findTable(tables, 'product_location_roles'), 'tenant_id', tenantId);
    expectEq(findTable(tables, 'inventory_unit'), 'tenant_id', tenantId);
    expect(findTable(tables, 'inventory_unit').calls).toContainEqual({
      op: 'select',
      args: ['id,product_id,container_id,quantity,uom,created_at']
    });
    expectEq(findTable(tables, 'containers'), 'tenant_id', tenantId);
    expectEq(findTable(tables, 'locations'), 'tenant_id', tenantId);

    expect(findTable(tables, 'products').calls).toContainEqual({ op: 'in', args: ['id', ['product-1']] });
    expect(findTable(tables, 'product_unit_profiles').calls).toContainEqual({ op: 'in', args: ['product_id', ['product-1']] });
    expect(findTable(tables, 'product_packaging_levels').calls).toContainEqual({ op: 'in', args: ['product_id', ['product-1']] });
  });

  it('tenant-scopes wave resolution and uses orders.wave_id as the membership contract', async () => {
    const { supabase, tables } = makeSupabaseMock({
      waves: [{ id: 'wave-1' }],
      orders: [{ id: 'order-1' }, { id: 'order-2' }]
    });
    const repo = createPickingPlanningWaveReadRepo(supabase as never, tenantId);

    const orderIds = await repo.listOrderIdsForWave('wave-1');

    expect(orderIds).toEqual(['order-1', 'order-2']);
    const waves = findTable(tables, 'waves');
    expectEq(waves, 'id', 'wave-1');
    expectEq(waves, 'tenant_id', tenantId);

    const orders = findTable(tables, 'orders');
    expectEq(orders, 'wave_id', 'wave-1');
    expectEq(orders, 'tenant_id', tenantId);
  });

  it('orders primary pick locations deterministically by product then location', async () => {
    const { supabase, tables } = makeSupabaseMock({
      product_location_roles: [
        { product_id: 'product-1', location_id: 'location-b' },
        { product_id: 'product-1', location_id: 'location-a' }
      ]
    });
    const repo = createPickingPlanningOrderInputReadRepo(supabase as never, tenantId);

    await repo.listPrimaryPickLocations(['product-1']);

    const productLocationRoles = findTable(tables, 'product_location_roles');
    expect(productLocationRoles.calls.filter((call) => call.op === 'order')).toEqual([
      { op: 'order', args: ['product_id', { ascending: true }] },
      { op: 'order', args: ['location_id', { ascending: true }] }
    ]);
  });

  it('returns no wave order IDs when the wave is not visible in the tenant', async () => {
    const { supabase, tables } = makeSupabaseMock({ waves: [] });
    const repo = createPickingPlanningWaveReadRepo(supabase as never, tenantId);

    await expect(repo.listOrderIdsForWave('other-tenant-wave')).resolves.toEqual([]);

    expect(tables.map((entry) => entry.table)).toEqual(['waves']);
    expectEq(findTable(tables, 'waves'), 'tenant_id', tenantId);
  });
});
