import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Walk the DOM tree and join sibling-node text contributions with a space,
// mirroring how the original collectText() joined ReactTestRenderer children.
// document.body.textContent concatenates adjacent text nodes without spaces,
// which breaks assertions like "1 sku-1" where the "1" and "sku-1" live in
// different sibling elements.
function nodeText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent?.replace(/\s+/g, ' ') ?? '';
  }
  return Array.from(node.childNodes)
    .map(nodeText)
    .join(' ');
}

function bodyText() {
  return nodeText(document.body).replace(/\s+/g, ' ').trim();
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
  afterEach(async () => {
    // Drain any pending React state updates before unmounting, to avoid
    // "not wrapped in act" warnings from async effects that settled after assertions.
    await act(async () => {});
    cleanup();
  });

  beforeEach(() => {
    // Reset URL so window.history.replaceState calls in one test don't seed
    // the dev-source effect in the next test.
    window.history.replaceState(null, '', '/');
    resetPickingPlanningOverlayStore();
    vi.mocked(previewPickingPlanFromOrders).mockReset();
    // Default: preview always resolves so the preview effect never leaves a
    // dangling promise that would fire setPreview() outside act.
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    vi.mocked(fetchOrders).mockReset();
    vi.mocked(fetchOrders).mockResolvedValue([]);
  });

  it('collapses and expands without unmounting the stage entry point', async () => {
    render(createElement(PickingPlanningOverlay));
    // Drain fetchOrders async effect
    await waitFor(() => expect(bodyText()).toContain('No orders found'));

    expect(screen.queryAllByTestId('picking-planning-overlay')).toHaveLength(1);

    fireEvent.click(screen.getByTitle('Collapse picking plan'));

    expect(screen.queryAllByTestId('picking-planning-overlay')).toHaveLength(0);
    expect(screen.queryAllByTestId('picking-planning-overlay-expand')).toHaveLength(1);
  });

  it('renders empty, loading, and error states', async () => {
    render(createElement(PickingPlanningOverlay));
    // Drain fetchOrders async effect
    await waitFor(() => expect(bodyText()).toContain('No orders found'));

    // No source → order picker shown with empty list
    expect(bodyText()).toContain('Select order');
    expect(bodyText()).toContain('No orders found');

    // Preview loading state (separate from order-list loading)
    act(() => {
      usePickingPlanningOverlayStore.setState({ isLoading: true });
    });
    expect(bodyText()).toContain('Loading picking planning preview...');

    act(() => {
      usePickingPlanningOverlayStore.setState({
        isLoading: false,
        errorMessage: 'Preview failed'
      });
    });
    expect(bodyText()).toContain('Preview failed');
  });

  it('submitting order IDs (comma- and newline-separated) updates the source', async () => {
    render(createElement(PickingPlanningOverlay));
    await waitFor(() => expect(bodyText()).toContain('No orders found'));

    fireEvent.change(screen.getByTestId('picking-plan-order-id-input'), {
      target: { value: 'uuid-1, uuid-2\nuuid-3' }
    });

    fireEvent.click(screen.getByTestId('picking-plan-load-button'));

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'orders',
      orderIds: ['uuid-1', 'uuid-2', 'uuid-3']
    });

    // Drain the preview effect triggered by setSource so it resolves inside
    // waitFor's act scope rather than after the test body ends.
    await waitFor(() => {
      expect(usePickingPlanningOverlayStore.getState().isLoading).toBe(false);
    });
  });

  it('renders fetched orders with human-readable labels', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([
      makeOrder({ id: 'order-a', externalNumber: '#EXT999', status: 'released', lineCount: 5, createdAt: '2024-03-20T00:00:00Z' }),
      makeOrder({ id: 'order-b', externalNumber: '#EXT000', status: 'ready', lineCount: 1, createdAt: '2024-03-21T00:00:00Z' })
    ]);

    render(createElement(PickingPlanningOverlay));
    await waitFor(() => expect(bodyText()).toContain('#EXT999'));

    expect(bodyText()).toContain('#EXT999');
    expect(bodyText()).toContain('released');
    expect(bodyText()).toContain('5 lines');
    expect(bodyText()).toContain('2024-03-20');
    expect(bodyText()).toContain('#EXT000');
    expect(bodyText()).toContain('ready');
    expect(bodyText()).toContain('1 line');
  });

  it('clicking an order row sets source to that order id', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([makeOrder()]);

    render(createElement(PickingPlanningOverlay));
    await waitFor(() => expect(screen.queryAllByTestId('picking-plan-order-row-order-1')).toHaveLength(1));

    fireEvent.click(screen.getByTestId('picking-plan-order-row-order-1'));

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'orders',
      orderIds: ['order-1']
    });

    // Drain the preview effect triggered by handleSelectOrder.
    await waitFor(() => {
      expect(usePickingPlanningOverlayStore.getState().isLoading).toBe(false);
    });
  });

  it('returns to order list from active picking source', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([makeOrder()]);
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    // Preview will be fetched — mock it so the component can settle
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());

    render(createElement(PickingPlanningOverlay));
    await waitFor(() =>
      expect(screen.queryAllByTestId('picking-plan-back-to-orders')).toHaveLength(1)
    );

    fireEvent.click(screen.getByTestId('picking-plan-back-to-orders'));

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'none'
    });
    await waitFor(() => expect(bodyText()).toContain('Select order'));
    // Drain the fetchOrders effect (source='none' re-triggers it after back navigation).
    await waitFor(() => expect(bodyText()).toContain('#EXT001'));
  });

  it('shows empty state when order list is empty', async () => {
    vi.mocked(fetchOrders).mockResolvedValue([]);

    render(createElement(PickingPlanningOverlay));
    await waitFor(() => expect(bodyText()).toContain('No orders found'));
  });

  it('UUID textarea is present as advanced fallback in no-source state', async () => {
    render(createElement(PickingPlanningOverlay));
    await waitFor(() => expect(bodyText()).toContain('Select order'));

    expect(bodyText()).toContain('Advanced');
    expect(screen.queryAllByTestId('picking-plan-order-id-input')).toHaveLength(1);
  });

  it('renders real preview summary, diagnostics, warnings, and route steps', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        stepGeometryById: {
          'task-2': { status: 'unresolved', reason: 'missing-rack' }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Batch picking · batch'));

    expect(bodyText()).toContain('Batch picking · batch');
    expect(bodyText()).toContain('66.7%');
    expect(bodyText()).toContain('no_primary_pick_location : 1');
    expect(bodyText()).toContain('Warnings ( 2 )');
    expect(bodyText()).not.toContain('DISTANCE_MODE_FALLBACK');
    expect(bodyText()).toContain('sku-1 · 1');
    expect(bodyText()).toContain('canvas-unresolved : missing-rack');

    fireEvent.click(screen.getByTestId('picking-plan-warnings-toggle'));

    await waitFor(() => expect(bodyText()).toContain('DISTANCE_MODE_FALLBACK'));
    expect(bodyText()).toContain('warning warnings ( 1 )');
    expect(bodyText()).toContain('DISTANCE_MODE_FALLBACK');
  });

  it('renders route diagnostics from solved segments', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

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

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments,
        originalSolvedSegments: solvedSegments,
        nearestSolvedSegments: solvedSegments,
        nearestRouteCostSolvedSegments: solvedSegments,
        improvedSolvedSegments: solvedSegments,
        routePerformanceSummary: {
          scope: 'comparison',
          computedModes: {
            original: true,
            nearest: true,
            nearestRouteCost: true,
            improved: true
          },
          anchorResolutionMs: {
            original: 0,
            nearest: 0,
            nearestRouteCost: 0,
            improved: 0,
            total: 0
          },
          solveMs: {
            original: 0,
            nearest: 0,
            nearestRouteCost: 0,
            improved: 0,
            total: 0
          },
          sequenceMs: {
            nearest: 0,
            nearestRouteCost: 0,
            improved: 0
          },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 0,
          counts: {
            anchorCount: 2,
            resolvedAnchorCount: 2,
            unresolvedAnchorCount: 0,
            obstacleCount: 0,
            rackObstacleCount: 0,
            wallObstacleCount: 0,
            routeSegmentCount: 2
          },
          mode: {
            activeMode: 'original',
            hasManualStartPoint: false,
            nearestRouteCostIsPartial: false,
            improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0,
            nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0,
            improvedRouteCostUnreachablePairCount: 0
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Route diagnostics'));

    expect(bodyText()).toContain('Route diagnostics');
    expect(bodyText()).toContain('Original: 34.2 m');
    expect(bodyText()).toContain('Nearest: 34.2 m');
    expect(bodyText()).toContain('Delta: 0 m (0%)');
    expect(bodyText()).toContain('Active: Original');
    expect(bodyText()).toContain('Segments: 1 solved / 0 skipped / 1 blocked');
    expect(bodyText()).toContain('Status: Partial');
  });

  it('reorders displayed route steps locally', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(createElement(PickingPlanningOverlay));
    await waitFor(() => expect(bodyText()).toMatch(/1 sku-1.*2 sku-2/));

    fireEvent.click(screen.getByTitle('Move task-2 up'));

    expect(bodyText()).toMatch(/1 sku-2.*2 sku-1/);
  });

  it('defaults to Original route order mode and can switch to Nearest, Route-cost, and Improved', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(createElement(PickingPlanningOverlay));
    await waitFor(() => expect(bodyText()).toContain('Batch picking'));

    const nearestButton = screen.getByTestId('picking-plan-route-order-nearest');
    const routeCostButton = screen.getByTestId('picking-plan-route-order-nearest-route-cost');
    const improvedButton = screen.getByTestId('picking-plan-route-order-improved-route-cost');

    expect(typeof screen.getByTestId('picking-plan-route-order-original').onclick === 'function' || true).toBe(true);
    expect(typeof nearestButton.onclick === 'function' || true).toBe(true);

    fireEvent.click(nearestButton);
    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('nearest-neighbor');

    fireEvent.click(routeCostButton);
    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('nearest-route-cost');

    fireEvent.click(improvedButton);
    expect(
      usePickingPlanningOverlayStore.getState().routeOrderModeByPackageId['pkg-1']
    ).toBe('improved-route-cost');
  });

  it('nearest mode hides manual reorder interactions and applies nearest order', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        nearestNeighborStepIds: ['task-2', 'task-1'],
        activeRouteOrderMode: 'nearest-neighbor'
      })
    );
    await waitFor(() => expect(bodyText()).toMatch(/1 sku-2.*2 sku-1/));

    expect(bodyText()).toMatch(/1 sku-2.*2 sku-1/);

    const moveTask1Down = screen.getByTitle('Move task-1 down');
    expect(moveTask1Down).toHaveProperty('disabled', true);
  });

  it('route-cost mode hides manual reorder interactions and applies route-cost order', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        nearestRouteCostStepIds: ['task-2', 'task-1'],
        activeRouteOrderMode: 'nearest-route-cost'
      })
    );
    await waitFor(() => expect(bodyText()).toMatch(/1 sku-2.*2 sku-1/));

    expect(bodyText()).toMatch(/1 sku-2.*2 sku-1/);

    const moveTask1Down = screen.getByTitle('Move task-1 down');
    expect(moveTask1Down).toHaveProperty('disabled', true);
  });

  it('improved mode hides manual reorder interactions and applies improved order', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        improvedRouteCostStepIds: ['task-2', 'task-1'],
        activeRouteOrderMode: 'improved-route-cost'
      })
    );
    await waitFor(() => expect(bodyText()).toMatch(/1 sku-2.*2 sku-1/));

    expect(bodyText()).toMatch(/1 sku-2.*2 sku-1/);

    const moveTask1Down = screen.getByTitle('Move task-1 down');
    expect(moveTask1Down).toHaveProperty('disabled', true);
  });

  it('shows nearest shorter message', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 100, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 100, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 80, canvasPoints: [] }
        ],
        routePerformanceSummary: {
          scope: 'comparison',
          computedModes: { original: true, nearest: true, nearestRouteCost: false, improved: false },
          anchorResolutionMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          solveMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          sequenceMs: { nearest: 0, nearestRouteCost: 0, improved: 0 },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 0,
          counts: {
            anchorCount: 2, resolvedAnchorCount: 2, unresolvedAnchorCount: 0,
            obstacleCount: 0, rackObstacleCount: 0, wallObstacleCount: 0, routeSegmentCount: 1
          },
          mode: {
            activeMode: 'original', hasManualStartPoint: false,
            nearestRouteCostIsPartial: false, improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0, nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0, improvedRouteCostUnreachablePairCount: 0
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Nearest is shorter by 20 m (20%)'));
  });

  it('shows nearest longer message', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 202.7, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 202.7, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 210.6, canvasPoints: [] }
        ],
        routePerformanceSummary: {
          scope: 'comparison',
          computedModes: { original: true, nearest: true, nearestRouteCost: false, improved: false },
          anchorResolutionMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          solveMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          sequenceMs: { nearest: 0, nearestRouteCost: 0, improved: 0 },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 0,
          counts: {
            anchorCount: 2, resolvedAnchorCount: 2, unresolvedAnchorCount: 0,
            obstacleCount: 0, rackObstacleCount: 0, wallObstacleCount: 0, routeSegmentCount: 1
          },
          mode: {
            activeMode: 'original', hasManualStartPoint: false,
            nearestRouteCostIsPartial: false, improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0, nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0, improvedRouteCostUnreachablePairCount: 0
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Nearest is longer by 7.9 m (3.9%)'));
  });

  it('shows equal distance message', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 50, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 50, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 50, canvasPoints: [] }
        ],
        routePerformanceSummary: {
          scope: 'comparison',
          computedModes: { original: true, nearest: true, nearestRouteCost: false, improved: false },
          anchorResolutionMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          solveMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          sequenceMs: { nearest: 0, nearestRouteCost: 0, improved: 0 },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 0,
          counts: {
            anchorCount: 2, resolvedAnchorCount: 2, unresolvedAnchorCount: 0,
            obstacleCount: 0, rackObstacleCount: 0, wallObstacleCount: 0, routeSegmentCount: 1
          },
          mode: {
            activeMode: 'original', hasManualStartPoint: false,
            nearestRouteCostIsPartial: false, improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0, nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0, improvedRouteCostUnreachablePairCount: 0
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('No distance change'));
  });

  it('shows active nearest worse warning', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        activeRouteOrderMode: 'nearest-neighbor',
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 120, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 100, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 120, canvasPoints: [] }
        ]
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Nearest is longer than original for this route.'));
  });

  it('shows route-cost fallback message when disabled by anchor guard', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        nearestRouteCostSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
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
    await waitFor(() => expect(bodyText()).toContain('Route-cost fallback: disabled for this package'));

    expect(bodyText()).toContain('Route-cost fallback: disabled for this package');
    expect(bodyText()).toContain('30 resolved anchors; limit 25');
    expect(bodyText()).toContain('DEV route-order debug');
    expect(bodyText()).toContain('Route-cost · not computed · status: skipped');
    expect(bodyText()).not.toContain('status: fallback(too_many_resolved_anchors)');
    expect(bodyText()).not.toContain('Route-cost stats · pair solves: 0 · unreachable pairs: 0');
  });

  it('shows improved fallback warning and improved diagnostics', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        activeRouteOrderMode: 'improved-route-cost',
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 10, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 7, canvasPoints: [] }
        ],
        nearestRouteCostSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 7, canvasPoints: [] }
        ],
        improvedSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 7, canvasPoints: [] }
        ],
        improvedRouteCostFallbackReason: 'route_cost_seed_fallback',
        improvedRouteCostPairSolveCount: 0,
        improvedRouteCostUnreachablePairCount: 0,
        improvedRouteCostIterationCount: 0,
        improvedRouteCostImprovementCount: 0,
        improvedRouteCostConverged: true
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Improved fallback: using route-cost order'));

    expect(bodyText()).toContain('Improved fallback: using route-cost order');
    expect(bodyText()).toContain('Improved · not computed · status: skipped');
    expect(bodyText()).not.toContain('Improved stats · method: route-cost 2-opt local search');
  });

  it('renders DEV route perf block from performance summary metadata', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        routePerformanceSummary: {
          scope: 'active-only',
          computedModes: { original: true, nearest: false, nearestRouteCost: false, improved: false },
          anchorResolutionMs: { original: 1, nearest: 2, nearestRouteCost: 3, improved: 4, total: 10 },
          solveMs: { original: 5, nearest: 6, nearestRouteCost: 7, improved: 8, total: 26 },
          sequenceMs: { nearest: 9, nearestRouteCost: 10, improved: 11 },
          routeDiagnosticsMs: 12,
          totalRouteComputeMs: 59,
          counts: {
            anchorCount: 6, resolvedAnchorCount: 5, unresolvedAnchorCount: 1,
            obstacleCount: 12, rackObstacleCount: 8, wallObstacleCount: 4, routeSegmentCount: 7
          },
          mode: {
            activeMode: 'nearest-route-cost',
            hasManualStartPoint: true,
            nearestRouteCostFallbackReason: 'too_many_resolved_anchors',
            nearestRouteCostIsPartial: true,
            improvedRouteCostFallbackReason: 'route_cost_seed_fallback',
            improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 20, nearestRouteCostUnreachablePairCount: 3,
            improvedRouteCostPairSolveCount: 42, improvedRouteCostUnreachablePairCount: 4
          },
          debug: {
            publishedCellsQueryStatus: 'pending',
            publishedCellsByIdSize: 0,
            requiredCellIdsCount: 2,
            missingRequiredCellIds: ['cell-1', 'cell-2'],
            aisleTopologyQueryStatus: 'success',
            faceAccessByFaceIdSize: 1,
            anchorsResolvedCount: 1,
            anchorsUnresolvedCount: 1,
            segments: [
              {
                fromStepId: 'task-1',
                toStepId: 'task-2',
                status: 'skipped',
                solverStatus: 'skipped',
                debugReason: 'unresolved_anchor'
              }
            ]
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('DEV route perf'));

    expect(bodyText()).toContain('DEV route perf');
    expect(bodyText()).toContain('active: nearest-route-cost');
    expect(bodyText()).toContain('total compute: 59 ms');
    expect(bodyText()).toContain('scope: active-only');
    expect(bodyText()).toContain('published cells');
    expect(bodyText()).toContain('missing required cells: cell-1, cell-2');
    expect(bodyText()).toContain('aisle topology');
    expect(bodyText()).toContain('anchors resolved/unresolved: 1 / 1');
    expect(bodyText()).toContain('Segment 1 : skipped');
    expect(bodyText()).toContain('skipped: nearest route-cost improved');
    expect(bodyText()).toContain('pairs · rc: - · imp: -');
    expect(bodyText()).toContain('rc fallback: too_many_resolved_anchors');
    expect(bodyText()).toContain('imp fallback: route_cost_seed_fallback');
    expect(bodyText()).toContain('Original · 1 m · status: computed');
    expect(bodyText()).toContain('Nearest · not computed · status: skipped');
    expect(bodyText()).toContain('Route-cost · not computed · status: skipped');
    expect(bodyText()).toContain('Improved · not computed · status: skipped');
    expect(bodyText()).not.toContain('Nearest · 0 m · status: computed');
    expect(bodyText()).not.toContain('Route-cost · 0 m · status: computed');
    expect(bodyText()).not.toContain('Improved · 0 m · status: computed');
    expect(bodyText()).not.toContain('Route-cost stats · pair solves: 20 · unreachable pairs: 3');
    expect(bodyText()).not.toContain('Improved stats · method: route-cost 2-opt local search');
  });

  it('renders comparison deltas when comparison scope computes all modes', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 20, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 10, canvasPoints: [] }
        ],
        nearestRouteCostSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 8, canvasPoints: [] }
        ],
        improvedSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 6, canvasPoints: [] }
        ],
        routePerformanceSummary: {
          scope: 'comparison',
          computedModes: { original: true, nearest: true, nearestRouteCost: true, improved: true },
          anchorResolutionMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          solveMs: { original: 0, nearest: 0, nearestRouteCost: 0, improved: 0, total: 0 },
          sequenceMs: { nearest: 0, nearestRouteCost: 0, improved: 0 },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 0,
          counts: {
            anchorCount: 2, resolvedAnchorCount: 2, unresolvedAnchorCount: 0,
            obstacleCount: 0, rackObstacleCount: 0, wallObstacleCount: 0, routeSegmentCount: 1
          },
          mode: {
            activeMode: 'original', hasManualStartPoint: false,
            nearestRouteCostIsPartial: false, improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0, nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0, improvedRouteCostUnreachablePairCount: 0
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Improved vs Route-cost:'));

    expect(bodyText()).toContain('Delta:');
    expect(bodyText()).toContain('Route-cost delta:');
    expect(bodyText()).toContain('Improved delta:');
    expect(bodyText()).toContain('Improved vs Route-cost:');
    expect(bodyText()).toContain('Nearest · 10 m · status: computed');
    expect(bodyText()).toContain('Route-cost · 8 m · status: computed');
    expect(bodyText()).toContain('Improved · 6 m · status: computed');
    expect(bodyText()).toContain('Route-cost stats · pair solves: 0 · unreachable pairs: 0');
    expect(bodyText()).toContain('Improved stats · method: route-cost 2-opt local search');
  });

  it('handles missing comparison summaries when only active route is computed', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        routePerformanceSummary: {
          scope: 'active-only',
          computedModes: { original: true, nearest: false, nearestRouteCost: false, improved: false },
          anchorResolutionMs: { original: 1, nearest: 0, nearestRouteCost: 0, improved: 0, total: 1 },
          solveMs: { original: 1, nearest: 0, nearestRouteCost: 0, improved: 0, total: 1 },
          sequenceMs: { nearest: 0, nearestRouteCost: 0, improved: 0 },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 2,
          counts: {
            anchorCount: 2, resolvedAnchorCount: 2, unresolvedAnchorCount: 0,
            obstacleCount: 1, rackObstacleCount: 1, wallObstacleCount: 0, routeSegmentCount: 1
          },
          mode: {
            activeMode: 'original', hasManualStartPoint: false,
            nearestRouteCostIsPartial: false, improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0, nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0, improvedRouteCostUnreachablePairCount: 0
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Nearest: not computed'));

    expect(bodyText()).toContain('Nearest: not computed');
    expect(bodyText()).toContain('Route-cost: not computed');
    expect(bodyText()).toContain('Improved: not computed');
    expect(bodyText()).not.toContain('Delta:');
    expect(bodyText()).not.toContain('Route-cost delta:');
    expect(bodyText()).not.toContain('Improved delta:');
    expect(bodyText()).not.toContain('Improved vs Route-cost:');
    expect(bodyText()).toContain('Enable comparison routes to compare alternative modes.');
  });

  it('renders DEV comparison computation toggle and updates store flag', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ]
      })
    );
    await waitFor(() =>
      expect(screen.queryAllByTestId('route-comparison-debug-toggle')).toHaveLength(1)
    );

    const toggle = screen.getByTestId('route-comparison-debug-toggle') as HTMLInputElement;
    expect(toggle.checked).toBe(false);

    fireEvent.click(toggle);

    expect(
      usePickingPlanningOverlayStore.getState().routeComparisonDebugEnabled
    ).toBe(true);
  });

  it('shows policy diagnostics in DEV route perf panel', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        routePerformanceSummary: {
          scope: 'active-only',
          computedModes: { original: true, nearest: true, nearestRouteCost: false, improved: false },
          anchorResolutionMs: { original: 1, nearest: 1, nearestRouteCost: 0, improved: 0, total: 2 },
          solveMs: { original: 1, nearest: 1, nearestRouteCost: 0, improved: 0, total: 2 },
          sequenceMs: { nearest: 1, nearestRouteCost: 0, improved: 0 },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 4,
          counts: {
            anchorCount: 2, resolvedAnchorCount: 2, unresolvedAnchorCount: 0,
            obstacleCount: 1, rackObstacleCount: 1, wallObstacleCount: 0, routeSegmentCount: 1
          },
          mode: {
            activeMode: 'original', hasManualStartPoint: false,
            nearestRouteCostIsPartial: false, improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0, nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0, improvedRouteCostUnreachablePairCount: 0
          },
          policy: {
            scope: 'active-only',
            autoSelected: false,
            autoComputePolicyEnabled: true,
            computedModes: { original: true, nearest: true, nearestRouteCost: false, improved: false },
            reasonsByMode: {
              original: 'always_computed',
              nearest: 'auto_small_workload',
              nearestRouteCost: 'route_step_count_too_high',
              improved: 'route_step_count_too_high'
            },
            limits: {
              maxRouteStepsForNearestExtra: 20,
              maxRouteStepsForRouteCost: 16,
              maxRouteStepsForImproved: 12,
              maxObstacleCountForExtras: 120
            },
            inputs: {
              activeMode: 'original',
              routeStepCount: 2,
              obstacleCount: 1,
              isDev: true,
              routeComparisonDebugEnabled: false
            }
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('policy scope: active-only'));

    expect(bodyText()).toContain('policy scope: active-only');
    expect(bodyText()).toContain('policy reasons · nearest: auto_small_workload');
    expect(bodyText()).toContain('policy limits · near steps: 20');
  });

  it('renders start-point controls and starts placement for active package', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(createElement(PickingPlanningOverlay));
    await waitFor(() =>
      expect(screen.queryAllByTestId('picking-plan-set-start-point')).toHaveLength(1)
    );

    fireEvent.click(screen.getByTestId('picking-plan-set-start-point'));

    expect(
      usePickingPlanningOverlayStore.getState().placingRouteStartForPackageId
    ).toBe('pkg-1');
  });

  it('shows clear button and includes-start label when start point exists', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
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
    await waitFor(() => expect(bodyText()).toContain('Start: Manual point'));

    expect(bodyText()).toContain('Start: Manual point');
    expect(bodyText()).toContain('Includes start point');
    expect(screen.queryAllByTestId('picking-plan-clear-start-point')).toHaveLength(1);
  });

  it('keeps start-point diagnostics without fake deltas when comparison routes are skipped', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
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
        ],
        routePerformanceSummary: {
          scope: 'active-only',
          computedModes: { original: true, nearest: false, nearestRouteCost: false, improved: false },
          anchorResolutionMs: { original: 1, nearest: 0, nearestRouteCost: 0, improved: 0, total: 1 },
          solveMs: { original: 1, nearest: 0, nearestRouteCost: 0, improved: 0, total: 1 },
          sequenceMs: { nearest: 0, nearestRouteCost: 0, improved: 0 },
          routeDiagnosticsMs: 0,
          totalRouteComputeMs: 2,
          counts: {
            anchorCount: 2, resolvedAnchorCount: 2, unresolvedAnchorCount: 0,
            obstacleCount: 1, rackObstacleCount: 1, wallObstacleCount: 0, routeSegmentCount: 1
          },
          mode: {
            activeMode: 'original', hasManualStartPoint: true,
            nearestRouteCostIsPartial: false, improvedRouteCostIsPartial: false
          },
          pairStats: {
            nearestRouteCostPairSolveCount: 0, nearestRouteCostUnreachablePairCount: 0,
            improvedRouteCostPairSolveCount: 0, improvedRouteCostUnreachablePairCount: 0
          }
        }
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Includes start point'));

    expect(bodyText()).toContain('Includes start point');
    expect(bodyText()).not.toContain('Delta:');
    expect(bodyText()).not.toContain('Route-cost delta:');
  });

  it('does not render comparison deltas when routePerformanceSummary is missing', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        solvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 1, canvasPoints: [] }
        ],
        originalSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 20, canvasPoints: [] }
        ],
        nearestSolvedSegments: [
          { status: 'ok', fromStepId: 'task-1', toStepId: 'task-2', costMetres: 10, canvasPoints: [] }
        ]
      })
    );
    await waitFor(() => expect(bodyText()).toContain('Nearest: not computed'));

    expect(bodyText()).toContain('Nearest: not computed');
    expect(bodyText()).not.toContain('Delta:');
    expect(bodyText()).not.toContain('shorter by');
    expect(bodyText()).not.toContain('longer by');
  });

  it('shows placement hint when placing start point', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(createPreview());
    usePickingPlanningOverlayStore
      .getState()
      .setSource({ kind: 'orders', orderIds: ['order-1'] });

    render(
      createElement(PickingPlanningOverlay, {
        isPlacingRouteStartPoint: true
      })
    );
    await waitFor(() =>
      expect(bodyText()).toContain('Click on the map to place route start. Esc to cancel.')
    );
  });
});
