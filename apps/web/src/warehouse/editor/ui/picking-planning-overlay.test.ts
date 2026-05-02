import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetPickingPlanningOverlayStore,
  usePickingPlanningOverlayStore
} from '@/entities/picking-planning/model/overlay-store';
import { previewPickingPlanFromOrders } from '@/entities/picking-planning/api/preview';
import type { PickingPlanningPreviewResponse } from '@/entities/picking-planning/model/types';
import { PickingPlanningOverlay } from './picking-planning-overlay';

vi.mock('@/entities/picking-planning/api/preview', () => ({
  previewPickingPlanFromOrders: vi.fn(),
  previewPickingPlanFromWave: vi.fn()
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function collectText(
  node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null
): string {
  if (node === null) return '';
  if (Array.isArray(node)) return node.map((child) => collectText(child)).join(' ');

  return (node.children ?? [])
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function createPreview(): PickingPlanningPreviewResponse {
  const workPackage = {
    id: 'pkg-1',
    code: 'WP-1',
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
  };

  return {
    kind: 'orders',
    input: { orderIds: ['order-1'] },
    strategy: {
      id: 'strategy-1',
      code: 'BATCH',
      name: 'Batch picking',
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
      warningCount: 2
    },
    coverage: {
      orderCount: 1,
      orderLineCount: 3,
      plannedLineCount: 2,
      unresolvedLineCount: 1,
      plannedQty: 2,
      unresolvedQty: 1,
      planningCoveragePct: 66.7
    },
    unresolvedSummary: {
      total: 1,
      byReason: { no_primary_pick_location: 1 }
    },
    rootWorkPackage: workPackage,
    split: { wasSplit: false, reason: 'none', warnings: [], packageIds: ['pkg-1'] },
    packages: [
      {
        workPackage,
        route: {
          steps: [
            {
              sequence: 1,
              taskId: 'task-1',
              fromLocationId: 'loc-1',
              skuId: 'sku-1',
              qtyToPick: 1,
              allocations: [{ orderId: 'order-1', orderLineId: 'line-1', qty: 1 }]
            },
            {
              sequence: 2,
              taskId: 'task-2',
              fromLocationId: 'loc-2',
              skuId: 'sku-2',
              qtyToPick: 1,
              allocations: [{ orderId: 'order-1', orderLineId: 'line-2', qty: 1 }]
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
    warnings: ['warning'],
    warningDetails: [
      {
        code: 'UNRESOLVED_PLANNING_LINES_PRESENT',
        severity: 'warning',
        message: 'Unresolved planning lines are present.',
        source: 'wave'
      },
      {
        code: 'DISTANCE_MODE_FALLBACK',
        severity: 'info',
        message: 'Distance mode fallback.',
        source: 'route'
      }
    ]
  };
}

describe('PickingPlanningOverlay', () => {
  beforeEach(() => {
    resetPickingPlanningOverlayStore();
    vi.mocked(previewPickingPlanFromOrders).mockReset();
  });

  it('collapses and expands without unmounting the stage entry point', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
    });

    expect(
      renderer.root.findAllByProps({ 'data-testid': 'picking-planning-overlay' })
    ).toHaveLength(1);

    const collapseButton = renderer.root.find(
      (instance) =>
        instance.type === 'button' &&
        instance.props.title === 'Collapse picking plan'
    );

    act(() => {
      collapseButton.props.onClick();
    });

    expect(
      renderer.root.findAllByProps({ 'data-testid': 'picking-planning-overlay' })
    ).toHaveLength(0);
    expect(
      renderer.root.findAllByProps({
        'data-testid': 'picking-planning-overlay-expand'
      })
    ).toHaveLength(1);
  });

  it('renders empty, loading, and error states', () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
    });
    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'No picking planning source selected.'
    );

    act(() => {
      usePickingPlanningOverlayStore.setState({
        isLoading: true
      });
    });
    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'Loading picking planning preview...'
    );

    act(() => {
      usePickingPlanningOverlayStore.setState({
        isLoading: false,
        errorMessage: 'Preview failed'
      });
    });
    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'Preview failed'
    );
  });

  it('renders real preview summary, diagnostics, warnings, and route steps', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    act(() => {
      usePickingPlanningOverlayStore
        .getState()
        .setSource({ kind: 'orders', orderIds: ['order-1'] });
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        createElement(PickingPlanningOverlay, {
          stepGeometryById: {
            'task-2': { status: 'unresolved', reason: 'missing-rack' }
          }
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Batch picking · batch');
    expect(text).toContain('66.7%');
    expect(text).toContain('no_primary_pick_location : 1');
    expect(text).toContain('warning warnings');
    expect(text).toContain('DISTANCE_MODE_FALLBACK');
    expect(text).toContain('sku-1 · 1');
    expect(text).toContain('canvas-unresolved : missing-rack');
  });

  it('reorders displayed route steps locally', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    act(() => {
      usePickingPlanningOverlayStore
        .getState()
        .setSource({ kind: 'orders', orderIds: ['order-1'] });
    });

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
      await Promise.resolve();
    });

    expect(normalizeText(collectText(renderer.toJSON()))).toMatch(
      /1 sku-1.*2 sku-2/
    );

    const moveTask2Up = renderer.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === 'Move task-2 up'
    );
    act(() => {
      moveTask2Up.props.onClick();
    });

    expect(normalizeText(collectText(renderer.toJSON()))).toMatch(
      /1 sku-2.*2 sku-1/
    );
  });
});
