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
      product_location_roles: [{ product_id: 'product-1', location_id: 'location-1', role: 'primary_pick' }],
      inventory_unit: [{ id: 'iu-1', product_id: 'product-1', container_id: 'container-1', quantity: 1, uom: 'ea', created_at: '2026-01-01T00:00:00Z' }],
      containers: [{ id: 'container-1', current_location_id: 'location-1' }],
      locations: [{ id: 'location-1', tenant_id: tenantId, floor_id: 'floor-1', code: 'A-01', geometry_slot_id: null }]
    });
    const repo = createPickingPlanningOrderInputReadRepo(supabase as never, tenantId);

    await repo.listOrdersByIds(['order-1', 'order-other']);
    await repo.listOrderLines(['order-1', 'order-other']);
    await repo.listProducts(['product-1']);
    await repo.listUnitProfiles(['product-1']);
    await repo.listPackagingLevels(['product-1']);
    await repo.listExplicitLocationRoles(['product-1'], ['location-1']);
    await repo.listStructuralRolesForLocations(['location-1']);
    await repo.listInventoryUnits(['product-1']);
    await repo.listContainerLocations(['container-1']);
    await repo.listLocations(['location-1']);

    expectEq(findTable(tables, 'orders'), 'tenant_id', tenantId);
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

  it('filters explicit location roles by published state only', async () => {
    const { supabase, tables } = makeSupabaseMock({
      product_location_roles: [
        { product_id: 'product-1', location_id: 'location-a', role: 'primary_pick' },
        { product_id: 'product-1', location_id: 'location-b', role: 'reserve' }
      ]
    });
    const repo = createPickingPlanningOrderInputReadRepo(supabase as never, tenantId);

    await repo.listExplicitLocationRoles(['product-1'], ['location-a', 'location-b']);

    const productLocationRoles = findTable(tables, 'product_location_roles');
    expectEq(productLocationRoles, 'state', 'published');
    expectEq(productLocationRoles, 'tenant_id', tenantId);
    expect(productLocationRoles.calls).toContainEqual({ op: 'in', args: ['product_id', ['product-1']] });
    expect(productLocationRoles.calls).toContainEqual({ op: 'in', args: ['location_id', ['location-a', 'location-b']] });
  });

  it('resolves structural roles through location → cell → rack_level chain', async () => {
    const { supabase, tables } = makeSupabaseMock({
      locations: [{ id: 'loc-1', geometry_slot_id: 'slot-1' }],
      cells: [{ id: 'slot-1', rack_level_id: 'level-1' }],
      rack_levels: [{ id: 'level-1', structural_default_role: 'primary_pick' }]
    });
    const repo = createPickingPlanningOrderInputReadRepo(supabase as never, tenantId);

    const result = await repo.listStructuralRolesForLocations(['loc-1']);

    expect(result).toEqual([{ location_id: 'loc-1', structural_default_role: 'primary_pick' }]);

    // Verify query chain: locations → cells → rack_levels
    const locationsTable = findTable(tables, 'locations');
    expectEq(locationsTable, 'tenant_id', tenantId);
    expect(locationsTable.calls).toContainEqual({ op: 'in', args: ['id', ['loc-1']] });

    const cellsTable = findTable(tables, 'cells');
    expect(cellsTable.calls).toContainEqual({ op: 'in', args: ['id', ['slot-1']] });

    const levelsTable = findTable(tables, 'rack_levels');
    expect(levelsTable.calls).toContainEqual({ op: 'in', args: ['id', ['level-1']] });
  });

  it('returns no wave order IDs when the wave is not visible in the tenant', async () => {
    const { supabase, tables } = makeSupabaseMock({ waves: [] });
    const repo = createPickingPlanningWaveReadRepo(supabase as never, tenantId);

    await expect(repo.listOrderIdsForWave('other-tenant-wave')).resolves.toEqual([]);

    expect(tables.map((entry) => entry.table)).toEqual(['waves']);
    expectEq(findTable(tables, 'waves'), 'tenant_id', tenantId);
  });

  it('returns wave data when wave exists for tenant via getWaveById', async () => {
    const { supabase, tables } = makeSupabaseMock({
      waves: [{ id: 'wave-1' }]
    });
    const repo = createPickingPlanningWaveReadRepo(supabase as never, tenantId);

    const result = await repo.getWaveById('wave-1');

    expect(result).toEqual({ id: 'wave-1' });
    const waves = findTable(tables, 'waves');
    expectEq(waves, 'id', 'wave-1');
    expectEq(waves, 'tenant_id', tenantId);
  });

  it('returns null from getWaveById when wave is not visible to the tenant', async () => {
    const { supabase, tables } = makeSupabaseMock({ waves: [] });
    const repo = createPickingPlanningWaveReadRepo(supabase as never, tenantId);

    const result = await repo.getWaveById('other-tenant-wave');

    expect(result).toBeNull();
    expect(tables.map((entry) => entry.table)).toEqual(['waves']);
    expectEq(findTable(tables, 'waves'), 'tenant_id', tenantId);
  });

  it('returns orders scoped by tenant via listOrdersByIds', async () => {
    const { supabase, tables } = makeSupabaseMock({
      orders: [{ id: 'order-1' }, { id: 'order-2' }]
    });
    const repo = createPickingPlanningOrderInputReadRepo(supabase as never, tenantId);

    const result = await repo.listOrdersByIds(['order-1', 'order-2', 'order-3']);

    expect(result).toEqual([{ id: 'order-1' }, { id: 'order-2' }]);
    const orders = findTable(tables, 'orders');
    expectEq(orders, 'tenant_id', tenantId);
    expect(orders.calls).toContainEqual({ op: 'in', args: ['id', ['order-1', 'order-2', 'order-3']] });
  });

  it('returns empty arrays without hitting the database when input lists are empty', async () => {
    const { supabase, tables } = makeSupabaseMock({});
    const repo = createPickingPlanningOrderInputReadRepo(supabase as never, tenantId);

    await expect(repo.listOrdersByIds([])).resolves.toEqual([]);
    await expect(repo.listExplicitLocationRoles([], ['loc-1'])).resolves.toEqual([]);
    await expect(repo.listExplicitLocationRoles(['p1'], [])).resolves.toEqual([]);
    await expect(repo.listStructuralRolesForLocations([])).resolves.toEqual([]);

    expect(tables).toHaveLength(0);
  });
});
