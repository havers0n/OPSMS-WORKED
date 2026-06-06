import { beforeEach, describe, expect, it } from 'vitest';
import {
  getPreviewSourceKey,
  resetPickingPlanningOverlayStore,
  usePickingPlanningOverlayStore
} from './overlay-store';
import { deriveDisplayedRouteSteps, getRouteStepId } from './route-steps';
import type { PickingPlanningOverlaySource, PickingPlanningPreviewResponse } from './types';

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

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', 'task-2', -1);

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
    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', 'task-2', -1);

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
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'nearest-neighbor');

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', 'task-2', -1);

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('original');
  });

  it('manual reorder switches route-cost mode back to original', () => {
    const preview = createPreview();
    usePickingPlanningOverlayStore.getState().setPreview(preview);
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'nearest-route-cost');

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', 'task-2', -1);

    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('original');
  });

  it('manual reorder switches improved mode back to original', () => {
    const preview = createPreview();
    usePickingPlanningOverlayStore.getState().setPreview(preview);
    usePickingPlanningOverlayStore
      .getState()
      .setRouteOrderMode('pkg-1', 'improved-route-cost');

    usePickingPlanningOverlayStore
      .getState()
      .reorderPackageSteps('pkg-1', 'task-2', -1);

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

  describe('reorderPackageSteps focused behavior', () => {
    function createStep(sequence: number) {
      return {
        sequence,
        taskId: `task-${sequence}`,
        fromLocationId: `loc-${sequence}`,
        locationId: `loc-${sequence}`,
        addressLabel: `A-${String(sequence).padStart(2, '0')}`,
        cellId: `cell-${sequence}`,
        productId: `product-${sequence}`,
        skuId: `sku-${sequence}`,
        displayCode: `sku-${sequence}`,
        barcode: null,
        productName: `Product ${sequence}`,
        productImageUrl: null,
        qtyToPick: 1,
        qtyEach: 1,
        packagingLevels: [],
        allocations: []
      };
    }

    function createNStepPreview(n: number): PickingPlanningPreviewResponse {
      const base = createPreview();
      const steps = Array.from({ length: n }, (_, i) => createStep(i + 1));
      return {
        ...base,
        packages: [
          {
            ...base.packages[0],
            route: {
              ...base.packages[0].route,
              steps,
              metadata: {
                ...base.packages[0].route.metadata,
                taskCount: n,
                sequencedCount: n
              }
            }
          }
        ],
        summary: {
          ...base.summary,
          routeStepCount: n,
          taskCount: n
        }
      };
    }

    // A. Single reorder
    it('single reorder moves last step up', () => {
      const preview = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(preview);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toEqual(['task-1', 'task-2', 'task-4', 'task-3']);
    });

    // B. Repeated reorder builds on override, not original
    it('repeated reorder applies to current override', () => {
      const preview = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(preview);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toEqual(['task-1', 'task-2', 'task-4', 'task-3']);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toEqual(['task-1', 'task-4', 'task-2', 'task-3']);
    });

    // C. Move down after move up
    it('move down after move up restores original order', () => {
      const preview = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(preview);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-3', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toEqual(['task-1', 'task-3', 'task-2', 'task-4']);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-3', 1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toEqual(['task-1', 'task-2', 'task-3', 'task-4']);
    });

    // D. Bounds
    it('move first step up leaves effective order unchanged', () => {
      const preview = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(preview);
      const steps = preview.packages[0].route.steps;
      const originalStepIds = steps.map(getRouteStepId);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-1', -1);

      const reordered =
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ];
      expect(
        deriveDisplayedRouteSteps(steps, reordered).map(getRouteStepId)
      ).toEqual(originalStepIds);
    });

    it('move last step down leaves effective order unchanged', () => {
      const preview = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(preview);
      const steps = preview.packages[0].route.steps;
      const originalStepIds = steps.map(getRouteStepId);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', 1);

      const reordered =
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ];
      expect(
        deriveDisplayedRouteSteps(steps, reordered).map(getRouteStepId)
      ).toEqual(originalStepIds);
    });

    // E. Package isolation
    it('reorder of one package does not affect other packages', () => {
      const preview = createNStepPreview(4);
      const pkg2WorkPackage = {
        ...preview.packages[0].workPackage,
        id: 'pkg-2',
        taskCount: 2
      };
      const dualPreview: PickingPlanningPreviewResponse = {
        ...preview,
        packages: [
          preview.packages[0],
          {
            workPackage: pkg2WorkPackage,
            route: {
              steps: [createStep(1), createStep(2)].map((s, i) => ({
                ...s,
                taskId: `pkg2-task-${i + 1}`
              })),
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
        summary: { ...preview.summary, packageCount: 2 }
      };

      usePickingPlanningOverlayStore.getState().setPreview(dualPreview);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-2'
        ]
      ).toBeUndefined();

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toEqual(['task-1', 'task-2', 'task-4', 'task-3']);
    });

    // F. Reset
    it('reset restores original order after manual reorder', () => {
      const preview = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(preview);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toBeDefined();

      usePickingPlanningOverlayStore.getState().resetReorder('pkg-1');

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toBeUndefined();
    });

    // G. Missing-preview no-op
    it('reorder with no preview does not write ghost override', () => {
      expect(usePickingPlanningOverlayStore.getState().preview).toBeNull();

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId
      ).toEqual({});
    });

    // H. Unknown package no-op
    it('reorder with unknown packageId does not write ghost override', () => {
      const preview = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(preview);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('unknown-pkg', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId
      ).toEqual({});
    });

    // I. Empty route no-op
    it('reorder with empty route steps does not write ghost override', () => {
      const preview = createNStepPreview(0);
      usePickingPlanningOverlayStore.getState().setPreview(preview);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId
      ).toEqual({});
    });

    // J. Preview replacement clears reorders
    it('preview replacement clears old manual reorders', () => {
      const previewA = createNStepPreview(4);
      usePickingPlanningOverlayStore.getState().setPreview(previewA);

      usePickingPlanningOverlayStore
        .getState()
        .reorderPackageSteps('pkg-1', 'task-4', -1);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId[
          'pkg-1'
        ]
      ).toBeDefined();

      const previewB = createNStepPreview(2);
      usePickingPlanningOverlayStore.getState().setPreview(previewB);

      expect(
        usePickingPlanningOverlayStore.getState().reorderedStepIdsByPackageId
      ).toEqual({});
    });
  });

  describe('getPreviewSourceKey', () => {
    it('returns none for no source', () => {
      expect(getPreviewSourceKey({ kind: 'none' })).toBe('none');
    });

    it('returns orders with preserved order IDs', () => {
      expect(
        getPreviewSourceKey({ kind: 'orders', orderIds: ['A', 'B'] })
      ).toBe('orders:["A","B"]');
    });

    it('returns wave with wave ID', () => {
      expect(getPreviewSourceKey({ kind: 'wave', waveId: 'W1' })).toBe('wave:W1');
    });
  });

  describe('setSource semantic deduplication', () => {
    it('same source while loading is a no-op', () => {
      const store = usePickingPlanningOverlayStore;
      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });

      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });

      expect(store.getState().source).toEqual({
        kind: 'orders',
        orderIds: ['A']
      });
      expect(store.getState().preview).toBeNull();
      expect(store.getState().errorMessage).toBeNull();
    });

    it('same successfully loaded source is a no-op', () => {
      const store = usePickingPlanningOverlayStore;
      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });

      const preview = createPreview();
      store.getState().setPreview(preview);

      const stateBefore = store.getState();
      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });

      const stateAfter = store.getState();
      expect(stateAfter.preview).toEqual(preview);
      expect(stateAfter.source).toEqual(stateBefore.source);
    });

    it('retries after failure', () => {
      const store = usePickingPlanningOverlayStore;
      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });
      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });

      const secondCallState = store.getState();
      expect(secondCallState.errorMessage).toBeNull();

      const errorState = {
        ...secondCallState,
        errorMessage: 'Server error',
        isLoading: false
      };
      store.setState(errorState);

      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });

      expect(store.getState().errorMessage).toBeNull();
      expect(store.getState().preview).toBeNull();
    });

    it('different source triggers full reset', () => {
      const store = usePickingPlanningOverlayStore;
      store.getState().setSource({ kind: 'orders', orderIds: ['A'] });
      store.getState().setRouteOrderMode('pkg-1', 'nearest-neighbor');

      store.getState().setSource({ kind: 'orders', orderIds: ['B'] });

      expect(store.getState().routeOrderModeByPackageId).toEqual({});
      expect(store.getState().source).toEqual({
        kind: 'orders',
        orderIds: ['B']
      });
    });

    it('orders [A,B] and [B,A] are different sources', () => {
      const store = usePickingPlanningOverlayStore;
      store.getState().setSource({ kind: 'orders', orderIds: ['A', 'B'] });
      store.getState().setRouteOrderMode('pkg-1', 'nearest-neighbor');

      store.getState().setSource({ kind: 'orders', orderIds: ['B', 'A'] });

      expect(store.getState().source).toEqual({
        kind: 'orders',
        orderIds: ['B', 'A']
      });
      expect(store.getState().routeOrderModeByPackageId).toEqual({});
    });

    it('retry with same object reference creates a new source reference', () => {
      const store = usePickingPlanningOverlayStore;
      const source: PickingPlanningOverlaySource = { kind: 'orders', orderIds: ['A'] };

      store.getState().setSource(source);

      store.setState({
        ...store.getState(),
        errorMessage: 'fail',
        isLoading: false
      });

      const previousRef = store.getState().source;

      store.getState().setSource(source);

      expect(store.getState().source).not.toBe(previousRef);
      expect(store.getState().source).toEqual(source);
      expect(store.getState().errorMessage).toBeNull();
    });
  });
});
