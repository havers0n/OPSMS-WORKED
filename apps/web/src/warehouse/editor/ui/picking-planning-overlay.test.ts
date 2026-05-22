import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resetPickingPlanningOverlayStore,
  usePickingPlanningOverlayStore
} from '@/entities/picking-planning/model/overlay-store';
import { previewPickingPlanFromOrders } from '@/entities/picking-planning/api/preview';
import { fetchOrders } from '@/entities/order/api/queries';
import type { OrderSummary } from '@wos/domain';
import type { PickingPlanningPreviewResponse } from '@/entities/picking-planning/model/types';
import type { SolvedRouteSegment } from '@/features/picking-planning-canvas/model/route-step-geometry';
import { PickingPlanningOverlay } from './picking-planning-overlay';

vi.mock('@/entities/picking-planning/api/preview', () => ({
  previewPickingPlanFromOrders: vi.fn(),
  previewPickingPlanFromWave: vi.fn()
}));

vi.mock('@/entities/order/api/queries', () => ({
  fetchOrders: vi.fn(),
  ordersQueryOptions: vi.fn()
}));

function makeOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    externalNumber: '#EXT001',
    status: 'released',
    priority: 0,
    waveId: null,
    waveName: null,
    createdAt: '2024-01-15T00:00:00Z',
    releasedAt: null,
    closedAt: null,
    lineCount: 3,
    unitCount: 5,
    pickedUnitCount: 0,
    ...overrides
  };
}

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
    vi.mocked(fetchOrders).mockReset();
    vi.mocked(fetchOrders).mockResolvedValue([]);
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

  it('renders empty, loading, and error states', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    // Let orders effect resolve so we see the empty-list state
    await act(async () => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
      await Promise.resolve();
    });
    // No source → order picker shown with empty list
    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'Select order'
    );
    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'No orders found'
    );

    // Preview loading state (separate from order-list loading)
    act(() => {
      usePickingPlanningOverlayStore.setState({ isLoading: true });
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

  it('submitting order IDs (comma- and newline-separated) updates the source', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
      await Promise.resolve();
    });

    const textarea = renderer.root.find(
      (n) => n.type === 'textarea' &&
        n.props['data-testid'] === 'picking-plan-order-id-input'
    );
    act(() => {
      textarea.props.onChange({ target: { value: 'uuid-1, uuid-2\nuuid-3' } });
    });

    const loadButton = renderer.root.find(
      (n) =>
        n.type === 'button' &&
        n.props['data-testid'] === 'picking-plan-load-button'
    );
    act(() => {
      loadButton.props.onClick();
    });

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'orders',
      orderIds: ['uuid-1', 'uuid-2', 'uuid-3']
    });
  });

  it('renders fetched orders with human-readable labels', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([
      makeOrder({ id: 'order-a', externalNumber: '#EXT999', status: 'released', lineCount: 5, createdAt: '2024-03-20T00:00:00Z' }),
      makeOrder({ id: 'order-b', externalNumber: '#EXT000', status: 'ready', lineCount: 1, createdAt: '2024-03-21T00:00:00Z' })
    ]);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('#EXT999');
    expect(text).toContain('released');
    expect(text).toContain('5 lines');
    expect(text).toContain('2024-03-20');
    expect(text).toContain('#EXT000');
    expect(text).toContain('ready');
    expect(text).toContain('1 line');
  });

  it('clicking an order row sets source to that order id', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([makeOrder()]);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
      await Promise.resolve();
    });

    const orderRow = renderer.root.find(
      (n) =>
        n.type === 'button' &&
        n.props['data-testid'] === 'picking-plan-order-row-order-1'
    );
    act(() => {
      orderRow.props.onClick();
    });

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'orders',
      orderIds: ['order-1']
    });
  });

  it('returns to order list from active picking source', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([makeOrder()]);
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

    const backButton = renderer.root.find(
      (n) =>
        n.type === 'button' &&
        n.props['data-testid'] === 'picking-plan-back-to-orders'
    );
    act(() => {
      backButton.props.onClick();
    });

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'none'
    });
    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'Select order'
    );
  });

  it('shows empty state when order list is empty', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([]);

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
      await Promise.resolve();
    });

    expect(normalizeText(collectText(renderer.toJSON()))).toContain(
      'No orders found'
    );
  });

  it('UUID textarea is present as advanced fallback in no-source state', async () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(createElement(PickingPlanningOverlay));
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Advanced');

    // The textarea is still present in the DOM
    const textarea = renderer.root.find(
      (n) =>
        n.type === 'textarea' &&
        n.props['data-testid'] === 'picking-plan-order-id-input'
    );
    expect(textarea).toBeDefined();
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

    const collapsedText = normalizeText(collectText(renderer.toJSON()));
    expect(collapsedText).toContain('Batch picking · batch');
    expect(collapsedText).toContain('66.7%');
    expect(collapsedText).toContain('no_primary_pick_location : 1');
    expect(collapsedText).toContain('Warnings ( 2 )');
    expect(collapsedText).not.toContain('DISTANCE_MODE_FALLBACK');
    expect(collapsedText).toContain('sku-1 · 1');
    expect(collapsedText).toContain('canvas-unresolved : missing-rack');

    const warningsToggle = renderer.root.findByProps({
      'data-testid': 'picking-plan-warnings-toggle'
    });
    await act(async () => {
      warningsToggle.props.onClick();
      await Promise.resolve();
    });

    const expandedText = normalizeText(collectText(renderer.toJSON()));
    expect(expandedText).toContain('warning warnings ( 1 )');
    expect(expandedText).toContain('DISTANCE_MODE_FALLBACK');
  });

  it('renders route diagnostics from solved segments', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    act(() => {
      usePickingPlanningOverlayStore
        .getState()
        .setSource({ kind: 'orders', orderIds: ['order-1'] });
    });

    const solvedSegments: SolvedRouteSegment[] = [
      {
        status: 'ok',
        fromStepId: 'task-1',
        toStepId: 'task-2',
        costMetres: 34.2,
        canvasPoints: [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ]
      },
      {
        status: 'unroutable',
        solverStatus: 'end_blocked',
        debugReason: 'end_snap:r1',
        fromStepId: 'task-2',
        toStepId: 'task-3',
        fromCanvasPoint: { x: 10, y: 0 },
        toCanvasPoint: { x: 20, y: 0 }
      }
    ];

    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        createElement(PickingPlanningOverlay, { solvedSegments })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Route diagnostics');
    expect(text).toContain('Original: 34.2 m');
    expect(text).toContain('Nearest: 34.2 m');
    expect(text).toContain('Delta: 0 m (0%)');
    expect(text).toContain('Active: Original');
    expect(text).toContain('Segments: 1 solved / 0 skipped / 1 blocked');
    expect(text).toContain('Status: Partial');
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

  it('defaults to Original route order mode and can switch to Nearest, Route-cost, and Improved', async () => {
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

    const originalButton = renderer.root.findByProps({
      'data-testid': 'picking-plan-route-order-original'
    });
    const nearestButton = renderer.root.findByProps({
      'data-testid': 'picking-plan-route-order-nearest'
    });
    const routeCostButton = renderer.root.findByProps({
      'data-testid': 'picking-plan-route-order-nearest-route-cost'
    });
    const improvedButton = renderer.root.findByProps({
      'data-testid': 'picking-plan-route-order-improved-route-cost'
    });
    expect(typeof originalButton.props.onClick).toBe('function');
    expect(typeof nearestButton.props.onClick).toBe('function');
    expect(typeof routeCostButton.props.onClick).toBe('function');
    expect(typeof improvedButton.props.onClick).toBe('function');

    act(() => {
      nearestButton.props.onClick();
    });
    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('nearest-neighbor');

    act(() => {
      routeCostButton.props.onClick();
    });
    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('nearest-route-cost');

    act(() => {
      improvedButton.props.onClick();
    });
    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('improved-route-cost');
  });

  it('nearest mode hides manual reorder interactions and applies nearest order', async () => {
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
          nearestNeighborStepIds: ['task-2', 'task-1'],
          activeRouteOrderMode: 'nearest-neighbor'
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toMatch(/1 sku-2.*2 sku-1/);

    const moveTask1Down = renderer.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === 'Move task-1 down'
    );
    expect(moveTask1Down.props.disabled).toBe(true);
  });

  it('route-cost mode hides manual reorder interactions and applies route-cost order', async () => {
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
          nearestRouteCostStepIds: ['task-2', 'task-1'],
          activeRouteOrderMode: 'nearest-route-cost'
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toMatch(/1 sku-2.*2 sku-1/);

    const moveTask1Down = renderer.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === 'Move task-1 down'
    );
    expect(moveTask1Down.props.disabled).toBe(true);
  });

  it('improved mode hides manual reorder interactions and applies improved order', async () => {
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
          improvedRouteCostStepIds: ['task-2', 'task-1'],
          activeRouteOrderMode: 'improved-route-cost'
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toMatch(/1 sku-2.*2 sku-1/);

    const moveTask1Down = renderer.root.find(
      (instance) =>
        instance.type === 'button' && instance.props.title === 'Move task-1 down'
    );
    expect(moveTask1Down.props.disabled).toBe(true);
  });

  it('shows nearest shorter message', async () => {
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
          solvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 100,
              canvasPoints: []
            }
          ],
          originalSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 100,
              canvasPoints: []
            }
          ],
          nearestSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 80,
              canvasPoints: []
            }
          ]
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Nearest is shorter by 20 m (20%)');
  });

  it('shows nearest longer message', async () => {
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
          solvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 202.7,
              canvasPoints: []
            }
          ],
          originalSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 202.7,
              canvasPoints: []
            }
          ],
          nearestSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 210.6,
              canvasPoints: []
            }
          ]
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Nearest is longer by 7.9 m (3.9%)');
  });

  it('shows equal distance message', async () => {
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
          solvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 50,
              canvasPoints: []
            }
          ],
          originalSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 50,
              canvasPoints: []
            }
          ],
          nearestSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 50,
              canvasPoints: []
            }
          ]
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('No distance change');
  });

  it('shows active nearest worse warning', async () => {
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
          activeRouteOrderMode: 'nearest-neighbor',
          solvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 120,
              canvasPoints: []
            }
          ],
          originalSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 100,
              canvasPoints: []
            }
          ],
          nearestSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 120,
              canvasPoints: []
            }
          ]
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Nearest is longer than original for this route.');
  });

  it('shows route-cost fallback message when disabled by anchor guard', async () => {
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
          solvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 1,
              canvasPoints: []
            }
          ],
          originalSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 1,
              canvasPoints: []
            }
          ],
          nearestSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 1,
              canvasPoints: []
            }
          ],
          nearestRouteCostSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 1,
              canvasPoints: []
            }
          ],
          nearestRouteCostFallbackReason: 'too_many_resolved_anchors',
          nearestRouteCostResolvedAnchorsCount: 30,
          nearestRouteCostMaxResolvedAnchors: 25,
          nearestRouteCostPairSolveCount: 0,
          nearestRouteCostUnreachablePairCount: 0,
          originalCanvasStepIds: ['task-1', 'task-2'],
          nearestCanvasStepIds: ['task-1', 'task-2'],
          nearestRouteCostCanvasStepIds: ['task-1', 'task-2']
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Route-cost fallback: disabled for this package');
    expect(text).toContain('30 resolved anchors; limit 25');
    expect(text).toContain('DEV route-order debug');
    expect(text).toContain('status: fallback(too_many_resolved_anchors)');
    expect(text).toContain('Route-cost stats · pair solves: 0 · unreachable pairs: 0');
  });

  it('shows improved fallback warning and improved diagnostics', async () => {
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
          activeRouteOrderMode: 'improved-route-cost',
          solvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 1,
              canvasPoints: []
            }
          ],
          originalSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 10,
              canvasPoints: []
            }
          ],
          nearestSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 7,
              canvasPoints: []
            }
          ],
          nearestRouteCostSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 7,
              canvasPoints: []
            }
          ],
          improvedSolvedSegments: [
            {
              status: 'ok',
              fromStepId: 'task-1',
              toStepId: 'task-2',
              costMetres: 7,
              canvasPoints: []
            }
          ],
          improvedRouteCostFallbackReason: 'route_cost_seed_fallback',
          improvedRouteCostPairSolveCount: 0,
          improvedRouteCostUnreachablePairCount: 0,
          improvedRouteCostIterationCount: 0,
          improvedRouteCostImprovementCount: 0,
          improvedRouteCostConverged: true
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Improved fallback: using route-cost order');
    expect(text).toContain('Improved stats · method: route-cost 2-opt local search');
  });

  it('renders start-point controls and starts placement for active package', async () => {
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

    const setStartButton = renderer.root.findByProps({
      'data-testid': 'picking-plan-set-start-point'
    });
    act(() => {
      setStartButton.props.onClick();
    });

    expect(
      usePickingPlanningOverlayStore.getState().placingRouteStartForPackageId
    ).toBe('pkg-1');
  });

  it('shows clear button and includes-start label when start point exists', async () => {
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
          routeStartPoint: { x: 1, y: 2, source: 'manual' },
          solvedSegments: [
            {
              status: 'ok',
              fromStepId: '__route_start__',
              toStepId: 'task-1',
              costMetres: 10,
              canvasPoints: []
            }
          ]
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Start: Manual point');
    expect(text).toContain('Includes start point');
    expect(
      renderer.root.findAllByProps({
        'data-testid': 'picking-plan-clear-start-point'
      })
    ).toHaveLength(1);
  });

  it('shows placement hint when placing start point', async () => {
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
          isPlacingRouteStartPoint: true
        })
      );
      await Promise.resolve();
    });

    const text = normalizeText(collectText(renderer.toJSON()));
    expect(text).toContain('Click on the map to place route start. Esc to cancel.');
  });
});
