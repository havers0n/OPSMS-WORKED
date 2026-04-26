import { describe, expect, it } from 'vitest';
import { buildPlanningInputFromOrders, type PickingPlanningOrderInputReadRepo } from './input-builder.js';

function makeRepo(overrides: Partial<PickingPlanningOrderInputReadRepo> = {}): PickingPlanningOrderInputReadRepo {
  return {
    listOrderLines: async () => [],
    listProducts: async () => [],
    listUnitProfiles: async () => [],
    listPackagingLevels: async () => [],
    listPrimaryPickLocations: async () => [],
    listInventoryUnits: async () => [],
    listContainerLocations: async () => [],
    listLocations: async () => [],
    ...overrides
  };
}

describe('buildPlanningInputFromOrders', () => {
  it('builds one candidate from one line and maps source location projection', async () => {
    const result = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [{ order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'line-sku', qty_required: 2, qty_picked: 0 }],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listUnitProfiles: async () => [
          {
            product_id: 'p1',
            unit_weight_g: 1000,
            unit_width_mm: 100,
            unit_height_mm: 100,
            unit_depth_mm: 100,
            weight_class: 'heavy',
            size_class: 'small'
          }
        ],
        listPrimaryPickLocations: async () => [{ product_id: 'p1', location_id: 'loc-1' }],
        listInventoryUnits: async () => [
          { product_id: 'p1', container_id: 'c1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
        ],
        listContainerLocations: async () => [{ id: 'c1', current_location_id: 'loc-1' }],
        listLocations: async () => [
          {
            id: 'loc-1',
            tenant_id: 't1',
            floor_id: 'f1',
            code: 'A-01',
            route_sequence: 5,
            pick_sequence: 9
          }
        ]
      }),
      { orderIds: ['o1'] }
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: 'candidate-o1-l1',
      skuId: 'sku-1',
      qty: 2,
      fromLocationId: 'loc-1',
      handlingClass: 'heavy',
      weightKg: 2,
      volumeLiters: 2
    });
    expect(result.locationsById['loc-1']).toMatchObject({ id: 'loc-1', addressLabel: 'A-01' });
    expect(result.unresolved).toEqual([]);
  });

  it('marks unresolved when no primary pick location or inventory', async () => {
    const unresolvedNoLocation = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [{ order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 1, qty_picked: 0 }],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }]
      }),
      { orderIds: ['o1'] }
    );
    expect(unresolvedNoLocation.unresolved[0]?.reason).toBe('no_primary_pick_location');

    const unresolvedNoInventory = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [{ order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 2, qty_picked: 0 }],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listPrimaryPickLocations: async () => [{ product_id: 'p1', location_id: 'loc-1' }],
        listLocations: async () => [{ id: 'loc-1', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }]
      }),
      { orderIds: ['o1'] }
    );
    expect(unresolvedNoInventory.unresolved.some((line) => line.reason === 'no_available_inventory')).toBe(true);
  });

  it('does not block candidate when dimensions are missing', async () => {
    const result = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [{ order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 1, qty_picked: 0 }],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listUnitProfiles: async () => [
          {
            product_id: 'p1',
            unit_weight_g: null,
            unit_width_mm: null,
            unit_height_mm: null,
            unit_depth_mm: null,
            weight_class: null,
            size_class: null
          }
        ],
        listPrimaryPickLocations: async () => [{ product_id: 'p1', location_id: 'loc-1' }],
        listInventoryUnits: async () => [
          { product_id: 'p1', container_id: 'c1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
        ],
        listContainerLocations: async () => [{ id: 'c1', current_location_id: 'loc-1' }],
        listLocations: async () => [{ id: 'loc-1', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }]
      }),
      { orderIds: ['o1'] }
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]?.weightKg).toBeUndefined();
    expect(result.tasks[0]?.volumeLiters).toBeUndefined();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
