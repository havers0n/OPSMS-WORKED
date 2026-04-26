import { describe, expect, it } from 'vitest';
import type { PickingPlanningResult } from '@wos/domain';
import { mapPlanningPreviewToResponse } from './response-mapper.js';

function createPlanningResult(): PickingPlanningResult {
  return {
    strategy: {
      id: 'strategy-1',
      code: 'SINGLE_ORDER',
      name: 'Single order',
      method: 'single_order',
      requiresPostSort: false,
      requiresCartSlots: false,
      preserveOrderSeparation: true,
      aggregateSameSku: false,
      routePriorityMode: 'hybrid',
      splitPolicy: {}
    },
    rootPackage: {
      id: 'wp-root',
      code: 'WP-ROOT',
      strategyId: 'strategy-1',
      strategy: {
        id: 'strategy-1',
        code: 'SINGLE_ORDER',
        name: 'Single order',
        method: 'single_order',
        requiresPostSort: false,
        requiresCartSlots: false,
        preserveOrderSeparation: true,
        aggregateSameSku: false,
        routePriorityMode: 'hybrid',
        splitPolicy: {}
      },
      method: 'single_order',
      tasks: [
        {
          id: 'task-1',
          skuId: 'sku-1',
          fromLocationId: 'loc-1',
          qty: 2,
          orderRefs: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 2 }]
        }
      ],
      complexity: {
        level: 'low',
        score: 10,
        pickLines: 1,
        uniqueSkuCount: 1,
        uniqueLocationCount: 1,
        uniqueZoneCount: 1,
        uniqueAisleCount: 1,
        totalWeightKg: 0,
        totalVolumeLiters: 0,
        heavyTaskCount: 0,
        bulkyTaskCount: 0,
        fragileTaskCount: 0,
        coldTaskCount: 0,
        hazmatTaskCount: 0,
        unknownWeightCount: 0,
        unknownVolumeCount: 0,
        unknownLocationCount: 0,
        exceeds: {
          maxPickLines: false,
          maxWeightKg: false,
          maxVolumeLiters: false,
          maxUniqueLocations: false,
          maxZones: false
        },
        warnings: []
      },
      warnings: ['pkg-warning'],
      metadata: {
        source: 'domain_planner',
        taskCount: 1,
        orderCount: 1,
        uniqueSkuCount: 1,
        uniqueLocationCount: 1,
        uniqueZoneCount: 1,
        uniqueAisleCount: 1
      }
    },
    split: {
      wasSplit: false,
      reason: 'none',
      packages: [],
      warnings: ['split-warning']
    },
    packages: [
      {
        package: {
          id: 'wp-1',
          code: 'WP-1',
          strategyId: 'strategy-1',
          strategy: {
            id: 'strategy-1',
            code: 'SINGLE_ORDER',
            name: 'Single order',
            method: 'single_order',
            requiresPostSort: false,
            requiresCartSlots: false,
            preserveOrderSeparation: true,
            aggregateSameSku: false,
            routePriorityMode: 'hybrid',
            splitPolicy: {}
          },
          method: 'single_order',
          tasks: [
            {
              id: 'task-1',
              skuId: 'sku-1',
              fromLocationId: 'loc-1',
              qty: 2,
              orderRefs: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 2 }]
            }
          ],
          complexity: {
            level: 'low',
            score: 10,
            pickLines: 1,
            uniqueSkuCount: 1,
            uniqueLocationCount: 1,
            uniqueZoneCount: 1,
            uniqueAisleCount: 1,
            totalWeightKg: 0,
            totalVolumeLiters: 0,
            heavyTaskCount: 0,
            bulkyTaskCount: 0,
            fragileTaskCount: 0,
            coldTaskCount: 0,
            hazmatTaskCount: 0,
            unknownWeightCount: 0,
            unknownVolumeCount: 0,
            unknownLocationCount: 0,
            exceeds: {
              maxPickLines: false,
              maxWeightKg: false,
              maxVolumeLiters: false,
              maxUniqueLocations: false,
              maxZones: false
            },
            warnings: []
          },
          warnings: ['pkg-warning'],
          metadata: {
            source: 'domain_planner',
            taskCount: 1,
            orderCount: 1,
            uniqueSkuCount: 1,
            uniqueLocationCount: 1,
            uniqueZoneCount: 1,
            uniqueAisleCount: 1
          }
        },
        route: {
          steps: [
            {
              sequence: 1,
              taskId: 'task-1',
              fromLocationId: 'loc-1',
              skuId: 'sku-1',
              qtyToPick: 2,
              allocations: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 2 }]
            }
          ],
          warnings: ['route-warning'],
          metadata: {
            mode: 'hybrid',
            taskCount: 1,
            sequencedCount: 1,
            unknownLocationCount: 0
          }
        }
      }
    ],
    warnings: ['planning-warning', 'shared-warning'],
    metadata: {
      packageCount: 1,
      routeStepCount: 1,
      taskCount: 1,
      wasSplit: false,
      splitReason: 'none'
    }
  };
}

describe('response mapper', () => {
  it('maps explicit planning result to stable dto shape', () => {
    const result = mapPlanningPreviewToResponse({
      kind: 'explicit',
      planning: createPlanningResult(),
      input: { strategyMethod: 'single_order', routeMode: 'hybrid' }
    });

    expect(result.kind).toBe('explicit');
    expect(result.rootWorkPackage.id).toBe('wp-root');
    expect((result as any).rootPackage).toBeUndefined();
    expect(result.packages[0].workPackage.id).toBe('wp-1');
    expect((result.packages[0] as any).package).toBeUndefined();
    expect(result.summary).toMatchObject({ taskCount: 1, packageCount: 1, routeStepCount: 1, splitReason: 'none' });
    expect(result.packages[0].route.steps.map((step) => step.sequence)).toEqual([1]);
  });

  it('maps orders result with unresolved summary and coverage', () => {
    const result = mapPlanningPreviewToResponse({
      kind: 'orders',
      planning: createPlanningResult(),
      input: { orderIds: ['order-1'] },
      unresolved: [
        {
          orderId: 'order-2',
          orderLineId: 'line-2',
          qty: 1,
          reason: 'no_primary_pick_location',
          message: 'missing location'
        }
      ],
      unresolvedSummary: { total: 1, byReason: { no_primary_pick_location: 1 } },
      coverage: {
        orderCount: 1,
        orderLineCount: 2,
        plannedLineCount: 1,
        unresolvedLineCount: 1,
        plannedQty: 2,
        unresolvedQty: 1,
        planningCoveragePct: 50
      }
    });

    expect(result.kind).toBe('orders');
    expect(result.input.orderIds).toEqual(['order-1']);
    expect(result.unresolvedSummary).toEqual({ total: 1, byReason: { no_primary_pick_location: 1 } });
    expect(result.coverage?.planningCoveragePct).toBe(50);
    expect(result.unresolved).toHaveLength(1);
  });

  it('maps wave result with waveId/orderIds and deduped warnings without mutating input', () => {
    const planning = createPlanningResult();
    const originalWarnings = [...planning.warnings];

    const result = mapPlanningPreviewToResponse({
      kind: 'wave',
      planning,
      input: { waveId: 'wave-1', orderIds: ['order-1'] },
      unresolved: [],
      unresolvedSummary: { total: 0, byReason: {} },
      coverage: {
        orderCount: 1,
        orderLineCount: 1,
        plannedLineCount: 1,
        unresolvedLineCount: 0,
        plannedQty: 2,
        unresolvedQty: 0,
        planningCoveragePct: 100
      },
      extraWarnings: ['shared-warning', 'wave-warning']
    });

    expect(result.kind).toBe('wave');
    expect(result.input.waveId).toBe('wave-1');
    expect(result.input.orderIds).toEqual(['order-1']);
    expect(result.warnings).toEqual(['planning-warning', 'shared-warning', 'wave-warning']);
    expect(planning.warnings).toEqual(originalWarnings);
  });
});
