import { beforeEach, describe, expect, it } from 'vitest';
import {
  resetPickingPlanningOverlayStore,
  usePickingPlanningOverlayStore
} from './overlay-store';
import { deriveDisplayedRouteSteps, getRouteStepId } from './route-steps';
import type { PickingPlanningPreviewResponse } from './types';

function createPreview(): PickingPlanningPreviewResponse {
  return {
    kind: 'orders',
    input: { orderIds: ['order-1'] },
    strategy: {
      id: 'strategy-1',
      code: 'BATCH',
      name: 'Batch',
      method: 'batch',
      requiresPostSort: false,
      requiresCartSlots: false,
      preserveOrderSeparation: false,
      aggregateSameSku: true,
      routePriorityMode: 'hybrid'
    },
    summary: {
      packageCount: 1,
      routeStepCount: 2,
      taskCount: 2,
      wasSplit: false,
      splitReason: 'none',
      warningCount: 0
    },
    rootWorkPackage: {} as never,
    split: { wasSplit: false, reason: 'none', warnings: [], packageIds: ['pkg-1'] },
    packages: [
      {
        workPackage: {
          id: 'pkg-1',
          method: 'batch',
          strategyId: 'strategy-1',
          taskCount: 2,
          orderCount: 1,
          uniqueSkuCount: 2,
          uniqueLocationCount: 2,
          uniqueZoneCount: 1,
          uniqueAisleCount: 1,
          complexity: { level: 'low', score: 1, warnings: [], exceeds: {} },
          warnings: []
        },
        route: {
          steps: [
            {
              sequence: 1,
              taskId: 'task-1',
              fromLocationId: 'loc-1',
              locationId: 'loc-1',
              addressLabel: 'A-01',
              cellId: 'cell-1',
              productId: 'product-1',
              skuId: 'sku-1',
              displayCode: 'sku-1',
              barcode: null,
              productName: 'Product 1',
              productImageUrl: null,
              qtyToPick: 1,
              qtyEach: 1,
              packagingLevels: [],
              allocations: []
            },
            {
              sequence: 2,
              taskId: 'task-2',
              fromLocationId: 'loc-2',
              locationId: 'loc-2',
              addressLabel: 'A-02',
              cellId: 'cell-2',
              productId: 'product-2',
              skuId: 'sku-2',
              displayCode: 'sku-2',
              barcode: null,
              productName: 'Product 2',
              productImageUrl: null,
              qtyToPick: 1,
              qtyEach: 1,
              packagingLevels: [],
              allocations: []
            }
          ],
          warnings: [],
          metadata: {
            mode: 'hybrid',
            taskCount: 2,
            sequencedCount: 2,
            unknownLocationCount: 0
          }
        }
      }
    ],
    locationsById: {},
    warnings: [],
    warningDetails: []
  };
}

describe('picking planning overlay store', () => {
  beforeEach(() => {
    resetPickingPlanningOverlayStore();
  });

  it('sets active package from preview', () => {
    usePickingPlanningOverlayStore.getState().setPreview(createPreview());

    expect(usePickingPlanningOverlayStore.getState().activePackageId).toBe('pkg-1');
  });

  it('reorders route step ids locally and resets them', () => {
    const preview = createPreview();
    usePickingPlanningOverlayStore.getState().setPreview(preview);
    const steps = preview.packages[0].route.steps;
    const stepIds = steps.map(getRouteStepId);

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', stepIds, 'task-2', -1);

    const reordered =
      usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
        'pkg-1'
      ];
    expect(deriveDisplayedRouteSteps(steps, reordered).map(getRouteStepId)).toEqual([
      'task-2',
      'task-1'
    ]);

    usePickingPlanningOverlayStore.getState().resetReorder('pkg-1');
    expect(
      usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
        'pkg-1'
      ]
    ).toBeUndefined();
  });

  it('sets route order mode per package', () => {
    usePickingPlanningOverlayStore.getState().setRouteOrderMode('pkg-1', 'nearest-neighbor');

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('nearest-neighbor');
  });

  it('supports route-cost mode per package', () => {
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'nearest-route-cost');

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('nearest-route-cost');
  });

  it('supports improved route-cost mode per package', () => {
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'improved-route-cost');

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('improved-route-cost');
  });

  it('clears route order modes when source changes', () => {
    usePickingPlanningOverlayStore.getState().setRouteOrderMode('pkg-1', 'nearest-neighbor');

    usePickingPlanningOverlayStore.getState().setSource({ kind: 'orders', orderIds: ['order-1'] });

    expect(usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId).toEqual({});
  });

  it('clears route order modes when preview changes', () => {
    usePickingPlanningOverlayStore.getState().setRouteOrderMode('pkg-1', 'nearest-neighbor');

    usePickingPlanningOverlayStore.getState().setPreview(createPreview());

    expect(usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId).toEqual({});
  });

  it('switching to nearest mode clears manual reorder for package', () => {
    const preview = createPreview();
    usePickingPlanningOverlayStore.getState().setPreview(preview);
    const stepIds = preview.packages[0].route.steps.map(getRouteStepId);
    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', stepIds, 'task-2', -1);

    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'nearest-neighbor');

    expect(
      usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId['pkg-1']
    ).toBeUndefined();
  });

  it('manual reorder switches nearest mode back to original', () => {
    const preview = createPreview();
    usePickingPlanningOverlayStore.getState().setPreview(preview);
    const stepIds = preview.packages[0].route.steps.map(getRouteStepId);
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'nearest-neighbor');

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', stepIds, 'task-2', -1);

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('original');
  });

  it('manual reorder switches route-cost mode back to original', () => {
    const preview = createPreview();
    usePickingPlanningOverlayStore.getState().setPreview(preview);
    const stepIds = preview.packages[0].route.steps.map(getRouteStepId);
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'nearest-route-cost');

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', stepIds, 'task-2', -1);

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('original');
  });

  it('manual reorder switches improved mode back to original', () => {
    const preview = createPreview();
    usePickingPlanningOverlayStore.getState().setPreview(preview);
    const stepIds = preview.packages[0].route.steps.map(getRouteStepId);
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'improved-route-cost');

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', stepIds, 'task-2', -1);

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('original');
  });

  it('stores and clears route start point per package', () => {
    usePickingPlanningOverlayStore
      .getState()
      .setRouteStartPoint('pkg-1', { x: 1.2, y: 3.4, source: 'manual' });

    expect(
      usePickingPlanningOverlayStore.getState().routeStartPointByPackageId['pkg-1']
    ).toEqual({ x: 1.2, y: 3.4, source: 'manual' });

    usePickingPlanningOverlayStore.getState().clearRouteStartPoint('pkg-1');
    expect(
      usePickingPlanningOverlayStore.getState().routeStartPointByPackageId['pkg-1']
    ).toBeUndefined();
  });

  it('tracks placement mode and clears it when cancelled', () => {
    usePickingPlanningOverlayStore
      .getState()
      .startPlacingRouteStartPoint('pkg-1');

    expect(
      usePickingPlanningOverlayStore.getState().placingRouteStartForPackageId
    ).toBe('pkg-1');

    usePickingPlanningOverlayStore.getState().cancelPlacingRouteStartPoint();

    expect(
      usePickingPlanningOverlayStore.getState().placingRouteStartForPackageId
    ).toBeNull();
  });

  it('setRouteStartPoint clears placement for same package', () => {
    usePickingPlanningOverlayStore
      .getState()
      .startPlacingRouteStartPoint('pkg-1');
    usePickingPlanningOverlayStore
      .getState()
      .setRouteStartPoint('pkg-1', { x: 2, y: 3, source: 'manual' });

    expect(
      usePickingPlanningOverlayStore.getState().placingRouteStartForPackageId
    ).toBeNull();
  });

  it('clears route start points and placement when source changes', () => {
    usePickingPlanningOverlayStore
      .getState()
      .setRouteStartPoint('pkg-1', { x: 1, y: 2, source: 'manual' });
    usePickingPlanningOverlayStore
      .getState()
      .startPlacingRouteStartPoint('pkg-1');

    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    expect(usePickingPlanningOverlayStore.getState().routeStartPointByPackageId).toEqual(
      {}
    );
    expect(
      usePickingPlanningOverlayStore.getState().placingRouteStartForPackageId
    ).toBeNull();
  });

  it('clears route start points and placement when preview changes', () => {
    usePickingPlanningOverlayStore
      .getState()
      .setRouteStartPoint('pkg-1', { x: 1, y: 2, source: 'manual' });
    usePickingPlanningOverlayStore
      .getState()
      .startPlacingRouteStartPoint('pkg-1');

    usePickingPlanningOverlayStore.getState().setPreview(createPreview());

    expect(usePickingPlanningOverlayStore.getState().routeStartPointByPackageId).toEqual(
      {}
    );
    expect(
      usePickingPlanningOverlayStore.getState().placingRouteStartForPackageId
    ).toBeNull();
  });

  it('defaults route comparison debug to disabled and allows toggling it', () => {
    expect(
      usePickingPlanningOverlayStore.getState().routeComparisonDebugEnabled
    ).toBe(false);

    usePickingPlanningOverlayStore
      .getState()
      .setRouteComparisonDebugEnabled(true);

    expect(
      usePickingPlanningOverlayStore.getState().routeComparisonDebugEnabled
    ).toBe(true);
  });

  it('resets route comparison debug flag when source changes', () => {
    usePickingPlanningOverlayStore
      .getState()
      .setRouteComparisonDebugEnabled(true);

    usePickingPlanningOverlayStore.getState().setSource({
      kind: 'orders',
      orderIds: ['order-1']
    });

    expect(
      usePickingPlanningOverlayStore.getState().routeComparisonDebugEnabled
    ).toBe(false);
  });
});
