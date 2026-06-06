import { describe, expect, it, vi } from 'vitest';
import { createPickingPlanningPreviewService } from './service.js';
import type { PickingPlanningInput } from '@wos/domain';
import type { PickingPlanningOrderInputReadRepo } from './input-builder.js';
import type { PickingPlanningWaveReadRepo } from './repo.js';
import { ApiError } from '../../errors.js';

describe('picking planning preview service', () => {
  it('delegates to domain planner without additional dependencies', () => {
    const plannerResult = {
      metadata: { packageCount: 1, routeStepCount: 1, taskCount: 1, wasSplit: false, splitReason: 'none' }
    };
    const planner = vi.fn().mockReturnValue(plannerResult);
    const service = createPickingPlanningPreviewService(planner);

    const input: PickingPlanningInput = {
      strategyMethod: 'single_order' as const,
      routeMode: 'hybrid' as const,
      assignedPickerId: 'picker-1',
      assignedZoneId: 'zone-a',
      assignedCartId: 'cart-1',
      id: 'wp-preview-1',
      code: 'WP-PREVIEW-1',
      tasks: [
        {
          id: 'task-1',
          skuId: 'sku-1',
          fromLocationId: 'loc-1',
          qty: 1,
          orderRefs: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 1 }]
        }
      ],
      locationsById: {
        'loc-1': { id: 'loc-1', zoneId: 'zone-a' }
      }
    };

    const result = service.previewPickingPlan(input);

    expect(planner).toHaveBeenCalledWith(input);
    expect(result).toBe(plannerResult);
  });

  it('builds candidates from orders and previews with same planner', async () => {
    const planner = vi.fn().mockReturnValue({ metadata: { taskCount: 1 }, warnings: [] });
    const repo: PickingPlanningOrderInputReadRepo = {
      listOrdersByIds: vi.fn().mockResolvedValue([{ id: 'o1' }]),
      listOrderLines: vi.fn().mockResolvedValue([
        { order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'fallback-sku', qty_required: 3, qty_picked: 1 }
      ]),
      listProducts: vi.fn().mockResolvedValue([{ id: 'p1', sku: 'sku-1' }]),
      listUnitProfiles: vi.fn().mockResolvedValue([
        {
          product_id: 'p1',
          unit_weight_g: 500,
          unit_width_mm: 100,
          unit_height_mm: 100,
          unit_depth_mm: 100,
          weight_class: 'light',
          size_class: 'small'
        }
      ]),
      listPackagingLevels: vi.fn().mockResolvedValue([]),
      listExplicitLocationRoles: vi.fn().mockResolvedValue([{ product_id: 'p1', location_id: 'loc-1', role: 'primary_pick' }]),
      listStructuralRolesForLocations: vi.fn().mockResolvedValue([]),
      listInventoryUnits: vi.fn().mockResolvedValue([
        { id: 'iu-1', product_id: 'p1', container_id: 'c-1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
      ]),
      listContainerLocations: vi.fn().mockResolvedValue([{ id: 'c-1', current_location_id: 'loc-1' }]),
      listLocations: vi.fn().mockResolvedValue([
        {
          id: 'loc-1',
          tenant_id: 't1',
          floor_id: 'f1',
          code: 'A-01',
          sort_order: 1,
          route_sequence: 10,
          pick_sequence: 11
        }
      ])
    };

    const service = createPickingPlanningPreviewService(planner, repo);
    const result = await service.previewPickingPlanFromOrders({ orderIds: ['o1'] });

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toMatchObject({
      id: 'candidate-o1-l1',
      skuId: 'sku-1',
      fromLocationId: 'loc-1',
      qty: 2
    });
    expect(result.locationsById['loc-1']).toBeDefined();
    expect(result.orderIds).toEqual(['o1']);
    expect(result.unresolvedSummary).toEqual({ total: 0, byReason: {} });
    expect(result.coverage).toMatchObject({ orderCount: 1, orderLineCount: 1, plannedLineCount: 1, unresolvedLineCount: 0 });
    expect(planner).toHaveBeenCalledTimes(1);
  });

  it('resolves wave orders and returns diagnostics with deduplicated warnings', async () => {
    const planner = vi.fn().mockReturnValue({ metadata: { taskCount: 1 }, warnings: ['shared-warning', 'planning-only'] });
    const orderRepo: PickingPlanningOrderInputReadRepo = {
      listOrdersByIds: vi.fn().mockResolvedValue([{ id: 'o1' }, { id: 'o2' }]),
      listOrderLines: vi.fn().mockResolvedValue([
        { order_id: 'o1', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 2, qty_picked: 0 },
        { order_id: 'o2', id: 'l2', product_id: 'p2', sku: 'sku-2', qty_required: 1, qty_picked: 0 }
      ]),
      listProducts: vi.fn().mockResolvedValue([{ id: 'p1', sku: 'sku-1' }, { id: 'p2', sku: 'sku-2' }]),
      listUnitProfiles: vi.fn().mockResolvedValue([]),
      listPackagingLevels: vi.fn().mockResolvedValue([]),
      listExplicitLocationRoles: vi.fn().mockResolvedValue([{ product_id: 'p1', location_id: 'loc-1', role: 'primary_pick' }]),
      listStructuralRolesForLocations: vi.fn().mockResolvedValue([]),
      listInventoryUnits: vi.fn().mockResolvedValue([
        { id: 'iu-1', product_id: 'p1', container_id: 'c-1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
      ]),
      listContainerLocations: vi.fn().mockResolvedValue([{ id: 'c-1', current_location_id: 'loc-1' }]),
      listLocations: vi.fn().mockResolvedValue([{ id: 'loc-1', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }])
    };
    const waveRepo: PickingPlanningWaveReadRepo = {
      getWaveById: vi.fn().mockResolvedValue({ id: 'wave-1' }),
      listOrderIdsForWave: vi.fn().mockResolvedValue(['o1', 'o2'])
    };

    const service = createPickingPlanningPreviewService(planner, orderRepo, waveRepo);
    const result = await service.previewPickingPlanFromWave({ waveId: 'wave-1' });

    expect(waveRepo.getWaveById).toHaveBeenCalledWith('wave-1');
    expect(waveRepo.listOrderIdsForWave).toHaveBeenCalledWith('wave-1');
    expect(result.waveId).toBe('wave-1');
    expect(result.orderIds).toEqual(['o1', 'o2']);
    expect(result.unresolvedSummary.total).toBe(1);
    expect(result.unresolvedSummary.byReason).toEqual({ no_primary_pick_location: 1 });
    expect(result.coverage).toMatchObject({
      orderCount: 2,
      plannedLineCount: 1,
      unresolvedLineCount: 1,
      orderLineCount: 2,
      plannedQty: 2,
      unresolvedQty: 1,
      planningCoveragePct: 50
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        'shared-warning',
        'planning-only',
        'Unresolved planning lines are present in wave preview.'
      ])
    );
    expect(new Set(result.warnings).size).toBe(result.warnings.length);
    expect(result.warningDetails).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'NO_PRIMARY_PICK_LOCATION', severity: 'error' }),
        expect.objectContaining({ code: 'UNRESOLVED_PLANNING_LINES_PRESENT', severity: 'warning' })
      ])
    );
  });

  it('returns warning and zeroed diagnostics for empty wave', async () => {
    const planner = vi.fn().mockReturnValue({ metadata: { taskCount: 0 }, warnings: [] });
    const orderRepo: PickingPlanningOrderInputReadRepo = {
      listOrdersByIds: vi.fn().mockResolvedValue([]),
      listOrderLines: vi.fn().mockResolvedValue([]),
      listProducts: vi.fn().mockResolvedValue([]),
      listUnitProfiles: vi.fn().mockResolvedValue([]),
      listPackagingLevels: vi.fn().mockResolvedValue([]),
      listExplicitLocationRoles: vi.fn().mockResolvedValue([]),
      listStructuralRolesForLocations: vi.fn().mockResolvedValue([]),
      listInventoryUnits: vi.fn().mockResolvedValue([]),
      listContainerLocations: vi.fn().mockResolvedValue([]),
      listLocations: vi.fn().mockResolvedValue([])
    };
    const waveRepo: PickingPlanningWaveReadRepo = {
      getWaveById: vi.fn().mockResolvedValue({ id: 'wave-empty' }),
      listOrderIdsForWave: vi.fn().mockResolvedValue([])
    };

    const service = createPickingPlanningPreviewService(planner, orderRepo, waveRepo);
    const result = await service.previewPickingPlanFromWave({ waveId: 'wave-empty' });

    expect(result.orderIds).toEqual([]);
    expect(result.tasks).toEqual([]);
    expect(result.unresolvedSummary).toEqual({ total: 0, byReason: {} });
    expect(result.coverage).toEqual({
      orderCount: 0,
      orderLineCount: 0,
      plannedLineCount: 0,
      unresolvedLineCount: 0,
      plannedQty: 0,
      unresolvedQty: 0,
      planningCoveragePct: 100
    });
    expect(result.warnings).toContain('Wave contains no orders.');
    expect(result.warningDetails).toContainEqual(
      expect.objectContaining({ code: 'EMPTY_WAVE', severity: 'warning', message: 'Wave contains no orders.' })
    );
  });

  describe('tenant isolation - orders endpoint', () => {
    it('returns 200 for own order ID', async () => {
      const planner = vi.fn().mockReturnValue({ metadata: { taskCount: 1 }, warnings: [] });
      const repo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]),
        listOrderLines: vi.fn().mockResolvedValue([
          { order_id: '11111111-1111-4111-8111-111111111111', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 2, qty_picked: 0 }
        ]),
        listProducts: vi.fn().mockResolvedValue([{ id: 'p1', sku: 'sku-1' }]),
        listUnitProfiles: vi.fn().mockResolvedValue([]),
        listPackagingLevels: vi.fn().mockResolvedValue([]),
        listExplicitLocationRoles: vi.fn().mockResolvedValue([{ product_id: 'p1', location_id: 'loc-1', role: 'primary_pick' }]),
        listStructuralRolesForLocations: vi.fn().mockResolvedValue([]),
        listInventoryUnits: vi.fn().mockResolvedValue([
          { id: 'iu-1', product_id: 'p1', container_id: 'c-1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
        ]),
        listContainerLocations: vi.fn().mockResolvedValue([{ id: 'c-1', current_location_id: 'loc-1' }]),
        listLocations: vi.fn().mockResolvedValue([{ id: 'loc-1', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }])
      };

      const service = createPickingPlanningPreviewService(planner, repo);
      const result = await service.previewPickingPlanFromOrders({ orderIds: ['11111111-1111-4111-8111-111111111111'] });

      expect(result.planning.metadata.taskCount).toBe(1);
    });

    it('throws 404 for foreign order ID', async () => {
      const planner = vi.fn();
      const repo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn().mockResolvedValue([]),
        listOrderLines: vi.fn(),
        listProducts: vi.fn(),
        listUnitProfiles: vi.fn(),
        listPackagingLevels: vi.fn(),
        listExplicitLocationRoles: vi.fn(),
        listStructuralRolesForLocations: vi.fn(),
        listInventoryUnits: vi.fn(),
        listContainerLocations: vi.fn(),
        listLocations: vi.fn()
      };

      const service = createPickingPlanningPreviewService(planner, repo);

      await expect(
        service.previewPickingPlanFromOrders({ orderIds: ['22222222-2222-4222-8222-222222222222'] })
      ).rejects.toThrow(new ApiError(404, 'NOT_FOUND', 'Order not found'));

      expect(repo.listOrdersByIds).toHaveBeenCalledWith(['22222222-2222-4222-8222-222222222222']);
      expect(planner).not.toHaveBeenCalled();
    });

    it('throws 404 for mixed own and foreign order IDs', async () => {
      const planner = vi.fn();
      const repo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]),
        listOrderLines: vi.fn(),
        listProducts: vi.fn(),
        listUnitProfiles: vi.fn(),
        listPackagingLevels: vi.fn(),
        listExplicitLocationRoles: vi.fn(),
        listStructuralRolesForLocations: vi.fn(),
        listInventoryUnits: vi.fn(),
        listContainerLocations: vi.fn(),
        listLocations: vi.fn()
      };

      const service = createPickingPlanningPreviewService(planner, repo);

      await expect(
        service.previewPickingPlanFromOrders({
          orderIds: [
            '11111111-1111-4111-8111-111111111111',
            '22222222-2222-4222-8222-222222222222'
          ]
        })
      ).rejects.toThrow(new ApiError(404, 'NOT_FOUND', 'Order not found'));

      expect(planner).not.toHaveBeenCalled();
    });

    it('throws 404 for own order ID and missing order ID mixed', async () => {
      const planner = vi.fn();
      const repo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]),
        listOrderLines: vi.fn(),
        listProducts: vi.fn(),
        listUnitProfiles: vi.fn(),
        listPackagingLevels: vi.fn(),
        listExplicitLocationRoles: vi.fn(),
        listStructuralRolesForLocations: vi.fn(),
        listInventoryUnits: vi.fn(),
        listContainerLocations: vi.fn(),
        listLocations: vi.fn()
      };

      const service = createPickingPlanningPreviewService(planner, repo);

      await expect(
        service.previewPickingPlanFromOrders({
          orderIds: [
            '11111111-1111-4111-8111-111111111111',
            '33333333-3333-4333-8333-333333333333'
          ]
        })
      ).rejects.toThrow(new ApiError(404, 'NOT_FOUND', 'Order not found'));

      expect(planner).not.toHaveBeenCalled();
    });

    it('deduplicates duplicate own order IDs', async () => {
      const planner = vi.fn().mockReturnValue({ metadata: { taskCount: 1 }, warnings: [] });
      const repo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn().mockResolvedValue([{ id: '11111111-1111-4111-8111-111111111111' }]),
        listOrderLines: vi.fn().mockResolvedValue([
          { order_id: '11111111-1111-4111-8111-111111111111', id: 'l1', product_id: 'p1', sku: 'sku-1', qty_required: 2, qty_picked: 0 }
        ]),
        listProducts: vi.fn().mockResolvedValue([{ id: 'p1', sku: 'sku-1' }]),
        listUnitProfiles: vi.fn().mockResolvedValue([]),
        listPackagingLevels: vi.fn().mockResolvedValue([]),
        listExplicitLocationRoles: vi.fn().mockResolvedValue([{ product_id: 'p1', location_id: 'loc-1', role: 'primary_pick' }]),
        listStructuralRolesForLocations: vi.fn().mockResolvedValue([]),
        listInventoryUnits: vi.fn().mockResolvedValue([
          { id: 'iu-1', product_id: 'p1', container_id: 'c-1', quantity: 2, uom: 'ea', created_at: '2025-01-01T00:00:00Z' }
        ]),
        listContainerLocations: vi.fn().mockResolvedValue([{ id: 'c-1', current_location_id: 'loc-1' }]),
        listLocations: vi.fn().mockResolvedValue([{ id: 'loc-1', tenant_id: 't1', floor_id: 'f1', code: 'A-01' }])
      };

      const service = createPickingPlanningPreviewService(planner, repo);
      const result = await service.previewPickingPlanFromOrders({
        orderIds: [
          '11111111-1111-4111-8111-111111111111',
          '11111111-1111-4111-8111-111111111111'
        ]
      });

      expect(repo.listOrdersByIds).toHaveBeenCalledWith(['11111111-1111-4111-8111-111111111111']);
      expect(result.orderIds).toEqual(['11111111-1111-4111-8111-111111111111']);
    });
  });

  describe('tenant isolation - wave endpoint', () => {
    it('returns 200 for own wave ID', async () => {
      const planner = vi.fn().mockReturnValue({ metadata: { taskCount: 0 }, warnings: [] });
      const orderRepo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn().mockResolvedValue([]),
        listOrderLines: vi.fn().mockResolvedValue([]),
        listProducts: vi.fn().mockResolvedValue([]),
        listUnitProfiles: vi.fn().mockResolvedValue([]),
        listPackagingLevels: vi.fn().mockResolvedValue([]),
        listExplicitLocationRoles: vi.fn().mockResolvedValue([]),
        listStructuralRolesForLocations: vi.fn().mockResolvedValue([]),
        listInventoryUnits: vi.fn().mockResolvedValue([]),
        listContainerLocations: vi.fn().mockResolvedValue([]),
        listLocations: vi.fn().mockResolvedValue([])
      };
      const waveRepo: PickingPlanningWaveReadRepo = {
        getWaveById: vi.fn().mockResolvedValue({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
        listOrderIdsForWave: vi.fn().mockResolvedValue([])
      };

      const service = createPickingPlanningPreviewService(planner, orderRepo, waveRepo);
      const result = await service.previewPickingPlanFromWave({ waveId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });

      expect(result.waveId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    });

    it('throws 404 for foreign wave ID', async () => {
      const planner = vi.fn();
      const orderRepo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn(),
        listOrderLines: vi.fn(),
        listProducts: vi.fn(),
        listUnitProfiles: vi.fn(),
        listPackagingLevels: vi.fn(),
        listExplicitLocationRoles: vi.fn(),
        listStructuralRolesForLocations: vi.fn(),
        listInventoryUnits: vi.fn(),
        listContainerLocations: vi.fn(),
        listLocations: vi.fn()
      };
      const waveRepo: PickingPlanningWaveReadRepo = {
        getWaveById: vi.fn().mockResolvedValue(null),
        listOrderIdsForWave: vi.fn()
      };

      const service = createPickingPlanningPreviewService(planner, orderRepo, waveRepo);

      await expect(
        service.previewPickingPlanFromWave({ waveId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' })
      ).rejects.toThrow(new ApiError(404, 'NOT_FOUND', 'Wave not found'));

      expect(waveRepo.getWaveById).toHaveBeenCalledWith('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      expect(waveRepo.listOrderIdsForWave).not.toHaveBeenCalled();
      expect(planner).not.toHaveBeenCalled();
    });

    it('throws 404 for missing wave ID', async () => {
      const planner = vi.fn();
      const orderRepo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn(),
        listOrderLines: vi.fn(),
        listProducts: vi.fn(),
        listUnitProfiles: vi.fn(),
        listPackagingLevels: vi.fn(),
        listExplicitLocationRoles: vi.fn(),
        listStructuralRolesForLocations: vi.fn(),
        listInventoryUnits: vi.fn(),
        listContainerLocations: vi.fn(),
        listLocations: vi.fn()
      };
      const waveRepo: PickingPlanningWaveReadRepo = {
        getWaveById: vi.fn().mockResolvedValue(null),
        listOrderIdsForWave: vi.fn()
      };

      const service = createPickingPlanningPreviewService(planner, orderRepo, waveRepo);

      await expect(
        service.previewPickingPlanFromWave({ waveId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' })
      ).rejects.toThrow(new ApiError(404, 'NOT_FOUND', 'Wave not found'));
    });

    it('preserves empty-preview response for tenant-owned wave with zero orders', async () => {
      const planner = vi.fn().mockReturnValue({ metadata: { taskCount: 0 }, warnings: [] });
      const orderRepo: PickingPlanningOrderInputReadRepo = {
        listOrdersByIds: vi.fn().mockResolvedValue([]),
        listOrderLines: vi.fn().mockResolvedValue([]),
        listProducts: vi.fn().mockResolvedValue([]),
        listUnitProfiles: vi.fn().mockResolvedValue([]),
        listPackagingLevels: vi.fn().mockResolvedValue([]),
        listExplicitLocationRoles: vi.fn().mockResolvedValue([]),
        listStructuralRolesForLocations: vi.fn().mockResolvedValue([]),
        listInventoryUnits: vi.fn().mockResolvedValue([]),
        listContainerLocations: vi.fn().mockResolvedValue([]),
        listLocations: vi.fn().mockResolvedValue([])
      };
      const waveRepo: PickingPlanningWaveReadRepo = {
        getWaveById: vi.fn().mockResolvedValue({ id: 'wave-empty' }),
        listOrderIdsForWave: vi.fn().mockResolvedValue([])
      };

      const service = createPickingPlanningPreviewService(planner, orderRepo, waveRepo);
      const result = await service.previewPickingPlanFromWave({ waveId: 'wave-empty' });

      expect(result.orderIds).toEqual([]);
      expect(result.tasks).toEqual([]);
      expect(result.warnings).toContain('Wave contains no orders.');
    });

    it('does not distinguish foreign and missing wave in error message', async () => {
      const foreignError = await (async () => {
        const planner = vi.fn();
        const repo: PickingPlanningWaveReadRepo = {
          getWaveById: vi.fn().mockResolvedValue(null),
          listOrderIdsForWave: vi.fn()
        };
        const orderRepo = createEmptyOrderRepo();
        const service = createPickingPlanningPreviewService(planner, orderRepo, repo);
        try {
          await service.previewPickingPlanFromWave({ waveId: 'foreign-wave' });
          return null;
        } catch (e) {
          return e as ApiError;
        }
      })();

      const missingError = await (async () => {
        const planner = vi.fn();
        const repo: PickingPlanningWaveReadRepo = {
          getWaveById: vi.fn().mockResolvedValue(null),
          listOrderIdsForWave: vi.fn()
        };
        const orderRepo = createEmptyOrderRepo();
        const service = createPickingPlanningPreviewService(planner, orderRepo, repo);
        try {
          await service.previewPickingPlanFromWave({ waveId: 'missing-wave' });
          return null;
        } catch (e) {
          return e as ApiError;
        }
      })();

      expect(foreignError).toBeInstanceOf(ApiError);
      expect(missingError).toBeInstanceOf(ApiError);
      expect(foreignError!.message).toBe('Wave not found');
      expect(missingError!.message).toBe('Wave not found');
      expect(foreignError!.statusCode).toBe(404);
      expect(missingError!.statusCode).toBe(404);
      expect(foreignError!.code).toBe('NOT_FOUND');
      expect(missingError!.code).toBe('NOT_FOUND');
    });
  });
});

function createEmptyOrderRepo(): PickingPlanningOrderInputReadRepo {
  return {
    listOrdersByIds: vi.fn(),
    listOrderLines: vi.fn(),
    listProducts: vi.fn(),
    listUnitProfiles: vi.fn(),
    listPackagingLevels: vi.fn(),
    listExplicitLocationRoles: vi.fn(),
    listStructuralRolesForLocations: vi.fn(),
    listInventoryUnits: vi.fn(),
    listContainerLocations: vi.fn(),
    listLocations: vi.fn()
  };
}
