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
              skuId: 'sku-1',
              qtyToPick: 1,
              allocations: []
            },
            {
              sequence: 2,
              taskId: 'task-2',
              fromLocationId: 'loc-2',
              skuId: 'sku-2',
              qtyToPick: 1,
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
});
