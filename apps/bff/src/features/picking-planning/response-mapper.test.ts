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
          productId: 'product-1',
          productName: 'Widget',
          productImageUrl: 'https://cdn.example.com/widget.png',
          barcode: '1234567890',
          displayCode: '1234567890',
          qtyEach: 2,
          packagingLevels: [
            { id: 'pack-each', code: 'EA', name: 'Each', qtyEach: 1, sortOrder: 1 },
            { id: 'pack-box', code: 'BOX', name: 'Box', qtyEach: 6, sortOrder: 2 }
          ],
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
        warnings: [],
        warningDetails: []
      },
      warnings: ['pkg-warning'],
      warningDetails: [],
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
      warnings: ['split-warning'],
      warningDetails: []
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
              productId: 'product-1',
              productName: 'Widget',
              productImageUrl: 'https://cdn.example.com/widget.png',
              barcode: '1234567890',
              displayCode: '1234567890',
              qtyEach: 2,
              packagingLevels: [
                { id: 'pack-each', code: 'EA', name: 'Each', qtyEach: 1, sortOrder: 1 },
                { id: 'pack-box', code: 'BOX', name: 'Box', qtyEach: 6, sortOrder: 2 }
              ],
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
            warnings: [],
            warningDetails: []
          },
          warnings: ['pkg-warning'],
          warningDetails: [],
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
          warningDetails: [],
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
    warningDetails: [
      {
        code: 'POST_SORT_REQUIRED',
        severity: 'info',
        message: 'planning-warning',
        source: 'domain'
      },
      {
        code: 'DISTANCE_MODE_FALLBACK',
        severity: 'info',
        message: 'shared-warning',
        source: 'route'
      }
    ],
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
      input: { strategyMethod: 'single_order', routeMode: 'hybrid' },
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01',
          cellId: 'cell-1',
          x: 1,
          y: 2
        }
      }
    });

    expect(result.kind).toBe('explicit');
    expect(result.rootWorkPackage.id).toBe('wp-root');
    expect((result as any).rootPackage).toBeUndefined();
    expect(result.packages[0].workPackage.id).toBe('wp-1');
    expect((result.packages[0] as any).package).toBeUndefined();
    expect(result.summary).toMatchObject({ taskCount: 1, packageCount: 1, routeStepCount: 1, splitReason: 'none' });
    expect(result.packages[0].route.steps.map((step) => step.sequence)).toEqual([1]);
    expect(result.packages[0].route.steps[0]).toMatchObject({
      productId: 'product-1',
      displayCode: '1234567890',
      barcode: '1234567890',
      productName: 'Widget',
      productImageUrl: 'https://cdn.example.com/widget.png',
      qtyToPick: 2,
      qtyEach: 2,
      locationId: 'loc-1',
      addressLabel: 'A-01',
      cellId: 'cell-1'
    });
    expect(result.packages[0].route.steps[0].packagingLevels).toEqual([
      { id: 'pack-each', code: 'EA', name: 'Each', qtyEach: 1, sortOrder: 1 },
      { id: 'pack-box', code: 'BOX', name: 'Box', qtyEach: 6, sortOrder: 2 }
    ]);
    expect(result.locationsById['loc-1']).toMatchObject({
      id: 'loc-1',
      cellId: 'cell-1',
      x: 1,
      y: 2
    });
    expect(result.warnings).toEqual(['planning-warning', 'shared-warning']);
    expect(result.warningDetails).toEqual([
      expect.objectContaining({ code: 'POST_SORT_REQUIRED', severity: 'info', message: 'planning-warning' }),
      expect.objectContaining({ code: 'DISTANCE_MODE_FALLBACK', severity: 'info', message: 'shared-warning' })
    ]);
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
      },
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01'
        }
      }
    });

    expect(result.kind).toBe('orders');
    expect(result.input.orderIds).toEqual(['order-1']);
    expect(result.unresolvedSummary).toEqual({ total: 1, byReason: { no_primary_pick_location: 1 } });
    expect(result.coverage?.planningCoveragePct).toBe(50);
    expect(result.locationsById['loc-1']?.addressLabel).toBe('A-01');
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
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01',
          cellId: 'cell-1'
        }
      },
      extraWarnings: ['shared-warning', 'wave-warning']
    });

    expect(result.kind).toBe('wave');
    expect(result.input.waveId).toBe('wave-1');
    expect(result.input.orderIds).toEqual(['order-1']);
    expect(result.warnings).toEqual(['planning-warning', 'shared-warning', 'wave-warning']);
    expect(result.locationsById['loc-1']?.cellId).toBe('cell-1');
    expect(result.warningDetails.map((warning) => warning.message)).toEqual(['planning-warning', 'shared-warning']);
    expect(planning.warnings).toEqual(originalWarnings);
  });

  it('returns nullables and empty packagingLevels when product metadata is missing', () => {
    const planning = createPlanningResult();
    planning.packages[0]!.package.tasks[0] = {
      ...planning.packages[0]!.package.tasks[0]!,
      productId: undefined,
      productName: undefined,
      productImageUrl: null,
      barcode: null,
      displayCode: undefined,
      qtyEach: undefined,
      packagingLevels: undefined
    };

    const result = mapPlanningPreviewToResponse({
      kind: 'explicit',
      planning,
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01'
        }
      }
    });

    expect(result.packages[0].route.steps[0]).toMatchObject({
      productId: null,
      productName: null,
      productImageUrl: null,
      barcode: null,
      qtyToPick: 2,
      qtyEach: null
    });
    expect(result.packages[0].route.steps[0].packagingLevels).toEqual([]);
  });

  it('preserves qtyEach from task when present', () => {
    const planning = createPlanningResult();
    const step = mapPlanningPreviewToResponse({
      kind: 'explicit',
      planning
    }).packages[0].route.steps[0];

    expect(step.qtyToPick).toBe(2);
    expect(step.qtyEach).toBe(2);
  });

  it('emits null qtyEach when task metadata is absent and no fallback to qtyToPick', () => {
    const planning = createPlanningResult();
    planning.packages[0]!.package.tasks[0] = {
      ...planning.packages[0]!.package.tasks[0]!,
      qtyEach: undefined,
      packagingLevels: undefined
    };

    const result = mapPlanningPreviewToResponse({
      kind: 'explicit',
      planning,
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01'
        }
      }
    });

    expect(result.packages[0].route.steps[0].qtyEach).toBeNull();
    expect(result.packages[0].route.steps[0].qtyToPick).toBe(2);
  });

  it('does not modify packagingLevels[].qtyEach conversion factor', () => {
    const planning = createPlanningResult();
    const step = mapPlanningPreviewToResponse({
      kind: 'explicit',
      planning,
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01'
        }
      }
    }).packages[0].route.steps[0];

    expect(step.packagingLevels).toEqual([
      { id: 'pack-each', code: 'EA', name: 'Each', qtyEach: 1, sortOrder: 1 },
      { id: 'pack-box', code: 'BOX', name: 'Box', qtyEach: 6, sortOrder: 2 }
    ]);
  });

  it('preserves full DTO shape: qtyToPick, allocations, product fields unchanged', () => {
    const planning = createPlanningResult();
    const step = mapPlanningPreviewToResponse({
      kind: 'explicit',
      planning,
      locationsById: {
        'loc-1': {
          id: 'loc-1',
          warehouseId: 'warehouse-1',
          addressLabel: 'A-01',
          cellId: 'cell-1'
        }
      }
    }).packages[0].route.steps[0];

    expect(step).toMatchObject({
      sequence: 1,
      taskId: 'task-1',
      fromLocationId: 'loc-1',
      locationId: 'loc-1',
      addressLabel: 'A-01',
      cellId: 'cell-1',
      productId: 'product-1',
      skuId: 'sku-1',
      displayCode: '1234567890',
      barcode: '1234567890',
      productName: 'Widget',
      qtyToPick: 2,
      qtyEach: 2
    });
    expect(step.allocations).toHaveLength(1);
  });
});
