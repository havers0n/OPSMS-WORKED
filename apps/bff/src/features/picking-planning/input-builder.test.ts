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

function totalPlannedQty(result: Awaited<ReturnType<typeof buildPlanningInputFromOrders>>): number {
  return result.tasks.reduce((sum, task) => sum + task.qty, 0);
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
          { id: 'iu-1', product_id: 'p1', container_id: 'c1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
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
    expect(unresolvedNoLocation.warningDetails).toContainEqual(
      expect.objectContaining({ code: 'NO_PRIMARY_PICK_LOCATION', severity: 'error' })
    );

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
    expect(unresolvedNoInventory.warningDetails).toContainEqual(
      expect.objectContaining({ code: 'NO_AVAILABLE_INVENTORY', severity: 'error' })
    );
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
          { id: 'iu-1', product_id: 'p1', container_id: 'c1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
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
    expect(result.warningDetails.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['UNKNOWN_WEIGHT', 'UNKNOWN_VOLUME'])
    );
  });

  it('does not overcommit one inventory unit across competing lines', async () => {
    const result = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [
          { order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 10, qty_picked: 0 },
          { order_id: 'o1', id: 'l2', product_id: 'p1', sku: 'sku-1', qty_required: 10, qty_picked: 0 }
        ],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listUnitProfiles: async () => [],
        listPrimaryPickLocations: async () => [{ product_id: 'p1', location_id: 'loc-1' }],
        listInventoryUnits: async () => [
          { id: 'iu-1', product_id: 'p1', container_id: 'c1', quantity: 10, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
        ],
        listContainerLocations: async () => [{ id: 'c1', current_location_id: 'loc-1' }],
        listLocations: async () => [{ id: 'loc-1', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }]
      }),
      { orderIds: ['o1'] }
    );

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: 'candidate-o1-l1',
      qty: 10,
      orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 10 }]
    });
    expect(totalPlannedQty(result)).toBe(10);
    expect(result.unresolved).toEqual([
      expect.objectContaining({ orderLineId: 'l2', qty: 10, reason: 'no_available_inventory' })
    ]);
  });

  it('satisfies one line from multiple inventory units across source locations', async () => {
    const result = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [{ order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 10, qty_picked: 0 }],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listUnitProfiles: async () => [],
        listPrimaryPickLocations: async () => [
          { product_id: 'p1', location_id: 'loc-a' },
          { product_id: 'p1', location_id: 'loc-b' }
        ],
        listInventoryUnits: async () => [
          { id: 'iu-a', product_id: 'p1', container_id: 'c-a', quantity: 6, uom: 'ea', created_at: '2025-01-01T00:00:00Z' },
          { id: 'iu-b', product_id: 'p1', container_id: 'c-b', quantity: 4, uom: 'ea', created_at: '2025-01-02T00:00:00Z' }
        ],
        listContainerLocations: async () => [
          { id: 'c-a', current_location_id: 'loc-a' },
          { id: 'c-b', current_location_id: 'loc-b' }
        ],
        listLocations: async () => [
          { id: 'loc-a', tenant_id: 't1', floor_id: 'f1', code: 'A-01' },
          { id: 'loc-b', tenant_id: 't1', floor_id: 'f1', code: 'B-01' }
        ]
      }),
      { orderIds: ['o1'] }
    );

    expect(result.unresolved).toEqual([]);
    expect(result.tasks).toEqual([
      expect.objectContaining({
        id: 'candidate-o1-l1-1',
        fromLocationId: 'loc-a',
        qty: 6,
        orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 6 }]
      }),
      expect.objectContaining({
        id: 'candidate-o1-l1-2',
        fromLocationId: 'loc-b',
        qty: 4,
        orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 4 }]
      })
    ]);
    expect(totalPlannedQty(result)).toBe(10);
  });

  it('satisfies one line from multiple inventory units at the same source location', async () => {
    const result = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [{ order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 10, qty_picked: 0 }],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listUnitProfiles: async () => [],
        listPrimaryPickLocations: async () => [{ product_id: 'p1', location_id: 'loc-a' }],
        listInventoryUnits: async () => [
          { id: 'iu-a', product_id: 'p1', container_id: 'c-a', quantity: 6, uom: 'ea', created_at: '2025-01-01T00:00:00Z' },
          { id: 'iu-b', product_id: 'p1', container_id: 'c-b', quantity: 4, uom: 'ea', created_at: '2025-01-02T00:00:00Z' }
        ],
        listContainerLocations: async () => [
          { id: 'c-a', current_location_id: 'loc-a' },
          { id: 'c-b', current_location_id: 'loc-a' }
        ],
        listLocations: async () => [{ id: 'loc-a', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }]
      }),
      { orderIds: ['o1'] }
    );

    expect(result.unresolved).toEqual([]);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: 'candidate-o1-l1',
      fromLocationId: 'loc-a',
      qty: 10,
      orderRefs: [{ orderId: 'o1', orderLineId: 'l1', qty: 10 }]
    });
  });

  it('consumes shared stock deterministically and leaves insufficient later lines unresolved', async () => {
    const result = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [
          { order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 5, qty_picked: 0 },
          { order_id: 'o1', id: 'l2', product_id: 'p1', sku: 'sku-1', qty_required: 5, qty_picked: 0 },
          { order_id: 'o1', id: 'l3', product_id: 'p1', sku: 'sku-1', qty_required: 5, qty_picked: 0 }
        ],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listUnitProfiles: async () => [],
        listPrimaryPickLocations: async () => [{ product_id: 'p1', location_id: 'loc-a' }],
        listInventoryUnits: async () => [
          { id: 'iu-a', product_id: 'p1', container_id: 'c-a', quantity: 12, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
        ],
        listContainerLocations: async () => [{ id: 'c-a', current_location_id: 'loc-a' }],
        listLocations: async () => [{ id: 'loc-a', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }]
      }),
      { orderIds: ['o1'] }
    );

    expect(result.tasks.map((task) => task.orderRefs[0]?.orderLineId)).toEqual(['l1', 'l2']);
    expect(totalPlannedQty(result)).toBe(10);
    expect(result.unresolved).toEqual([
      expect.objectContaining({ orderLineId: 'l3', qty: 5, reason: 'no_available_inventory' })
    ]);
  });

  it('keeps insufficient total inventory unresolved without emitting partial tasks', async () => {
    const result = await buildPlanningInputFromOrders(
      makeRepo({
        listOrderLines: async () => [{ order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 10, qty_picked: 0 }],
        listProducts: async () => [{ id: 'p1', sku: 'sku-1' }],
        listUnitProfiles: async () => [],
        listPrimaryPickLocations: async () => [{ product_id: 'p1', location_id: 'loc-a' }],
        listInventoryUnits: async () => [
          { id: 'iu-a', product_id: 'p1', container_id: 'c-a', quantity: 6, uom: 'ea', created_at: '2025-01-01T00:00:00Z' },
          { id: 'iu-b', product_id: 'p1', container_id: 'c-b', quantity: 3, uom: 'ea', created_at: '2025-01-02T00:00:00Z' }
        ],
        listContainerLocations: async () => [
          { id: 'c-a', current_location_id: 'loc-a' },
          { id: 'c-b', current_location_id: 'loc-a' }
        ],
        listLocations: async () => [{ id: 'loc-a', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }]
      }),
      { orderIds: ['o1'] }
    );

    expect(result.tasks).toEqual([]);
    expect(result.unresolved).toEqual([
      expect.objectContaining({ orderLineId: 'l1', qty: 10, reason: 'no_available_inventory' })
    ]);
  });
});
