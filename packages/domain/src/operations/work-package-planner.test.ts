import { describe, expect, it } from 'vitest';
import type { PickTaskCandidate, PickingStrategy } from './picking-planning';
import { getDefaultPickingStrategy } from './picking-strategies';
import {
  collectOrderIdsFromTasks,
  countOrdersInTasks,
  createWorkPackageCode,
  planWorkPackage
} from './work-package-planner';

function makeTask(overrides: Partial<PickTaskCandidate> = {}): PickTaskCandidate {
  return {
    id: 'task-1',
    skuId: 'sku-1',
    fromLocationId: 'loc-1',
    qty: 1,
    orderRefs: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 1 }],
    ...overrides
  };
}

describe('work-package-planner helpers', () => {
  it('collects and counts unique order ids from tasks', () => {
    const tasks = [
      makeTask(),
      makeTask({
        id: 'task-2',
        orderRefs: [
          { orderId: 'order-1', orderLineId: 'line-2', qty: 1 },
          { orderId: 'order-2', orderLineId: 'line-3', qty: 1 }
        ]
      })
    ];

    expect(collectOrderIdsFromTasks(tasks)).toEqual(['order-1', 'order-2']);
    expect(countOrdersInTasks(tasks)).toBe(2);
  });

  it('creates deterministic work package code', () => {
    expect(createWorkPackageCode('batch', 42)).toBe('WP-BATCH-42');
  });
});

describe('planWorkPackage', () => {
  it('creates empty draft and warning for empty tasks', () => {
    const draft = planWorkPackage({ tasks: [] });

    expect(draft.tasks).toEqual([]);
    expect(draft.metadata.taskCount).toBe(0);
    expect(draft.warnings).toContain('WorkPackage has no tasks.');
  });

  it('uses default strategy when no strategy is provided', () => {
    const draft = planWorkPackage({ tasks: [makeTask()] });

    expect(draft.strategyId).toBe(getDefaultPickingStrategy().id);
    expect(draft.method).toBe(getDefaultPickingStrategy().method);
  });

  it('uses strategyMethod default strategy when provided', () => {
    const draft = planWorkPackage({ tasks: [makeTask()], strategyMethod: 'cluster' });

    expect(draft.strategyId).toBe(getDefaultPickingStrategy('cluster').id);
    expect(draft.method).toBe('cluster');
  });

  it('prefers explicit strategy over strategyMethod', () => {
    const explicitStrategy: PickingStrategy = {
      ...getDefaultPickingStrategy('batch'),
      id: 'custom-batch',
      method: 'batch'
    };

    const draft = planWorkPackage({
      tasks: [makeTask()],
      strategy: explicitStrategy,
      strategyMethod: 'cluster'
    });

    expect(draft.strategyId).toBe('custom-batch');
    expect(draft.method).toBe('batch');
  });

  it('preserves task list and order refs as provided', () => {
    const tasks = [
      makeTask(),
      makeTask({
        id: 'task-2',
        skuId: 'sku-2',
        fromLocationId: 'loc-2',
        orderRefs: [{ orderId: 'order-2', orderLineId: 'line-2', qty: 2 }]
      })
    ];

    const draft = planWorkPackage({ tasks });

    expect(draft.tasks).toBe(tasks);
    expect(draft.tasks[1].orderRefs[0]).toEqual({ orderId: 'order-2', orderLineId: 'line-2', qty: 2 });
  });

  it('uses complexity totals and keeps estimatedDistanceMeters undefined', () => {
    const draft = planWorkPackage({
      tasks: [makeTask({ weightKg: 10, volumeLiters: 50 })],
      locationsById: {
        'loc-1': { id: 'loc-1', taskZoneId: 'zone-a', accessAisleId: 'aisle-a' }
      }
    });

    expect(draft.totalWeightKg).toBe(10);
    expect(draft.totalVolumeLiters).toBe(50);
    expect(draft.complexityScore).toBe(draft.complexity.score);
    expect(draft.estimatedDistanceMeters).toBeUndefined();
    expect(draft.estimatedTimeSec).toBe(195);
  });

  it('fills metadata counts from complexity and task analysis', () => {
    const draft = planWorkPackage({
      tasks: [
        makeTask({ weightKg: 1, volumeLiters: 1 }),
        makeTask({
          id: 'task-2',
          skuId: 'sku-2',
          fromLocationId: 'loc-2',
          orderRefs: [{ orderId: 'order-2', orderLineId: 'line-2', qty: 1 }]
        })
      ],
      locationsById: {
        'loc-1': { id: 'loc-1', taskZoneId: 'zone-a', accessAisleId: 'aisle-a' },
        'loc-2': { id: 'loc-2', taskZoneId: 'zone-b', accessAisleId: 'aisle-b' }
      }
    });

    expect(draft.metadata).toEqual({
      source: 'domain_planner',
      taskCount: 2,
      orderCount: 2,
      uniqueSkuCount: 2,
      uniqueLocationCount: 2,
      uniqueZoneCount: 2,
      uniqueAisleCount: 2
    });
  });

  it('preserves assigned picker, zone, and cart ids', () => {
    const draft = planWorkPackage({
      tasks: [makeTask()],
      assignedPickerId: 'picker-1',
      assignedZoneId: 'zone-1',
      assignedCartId: 'cart-1'
    });

    expect(draft.assignedPickerId).toBe('picker-1');
    expect(draft.assignedZoneId).toBe('zone-1');
    expect(draft.assignedCartId).toBe('cart-1');
  });

  it('warns for missing cart id when strategy requires cart slots', () => {
    const draft = planWorkPackage({
      tasks: [makeTask()],
      strategyMethod: 'cluster'
    });

    expect(draft.warnings).toContain('Strategy requires cart slots but no assigned cart is provided.');
  });

  it('warns for strategies that require post-sort', () => {
    const draft = planWorkPackage({
      tasks: [makeTask()],
      strategyMethod: 'batch'
    });

    expect(draft.warnings).toContain('Strategy requires post-sort.');
  });

  it('warns when order separation is disabled for multi-order tasks', () => {
    const draft = planWorkPackage({
      tasks: [
        makeTask(),
        makeTask({
          id: 'task-2',
          fromLocationId: 'loc-2',
          orderRefs: [{ orderId: 'order-2', orderLineId: 'line-2', qty: 1 }]
        })
      ],
      strategyMethod: 'batch'
    });

    expect(draft.warnings).toContain('Strategy may mix multiple orders in one WorkPackage.');
  });

  it('generates deterministic id and code when missing', () => {
    const draft = planWorkPackage({
      tasks: [makeTask()],
      strategyMethod: 'batch',
      locationsById: {
        'loc-1': { id: 'loc-1' }
      }
    });

    expect(draft.id).toBe('wp-batch-1-1');
    expect(draft.code).toBe('WP-BATCH-1');
  });

  it('keeps planner pure and does not mutate input objects', () => {
    const strategy = getDefaultPickingStrategy('batch');
    const frozenStrategy = structuredClone(strategy);
    const tasks = [makeTask({ weightKg: 5, volumeLiters: 5 })];
    const frozenTasks = structuredClone(tasks);

    void planWorkPackage({
      tasks,
      strategy,
      locationsById: { 'loc-1': { id: 'loc-1', zoneId: 'zone-1' } }
    });

    expect(tasks).toEqual(frozenTasks);
    expect(strategy).toEqual(frozenStrategy);
  });
});
