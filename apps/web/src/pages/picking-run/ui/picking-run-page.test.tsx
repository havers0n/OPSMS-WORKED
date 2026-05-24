import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  previewPickingPlanFromOrders,
  previewPickingPlanFromWave
} from '@/entities/picking-planning/api/preview';
import { resetPickingRunStore } from '@/features/picking-execution/model/picking-run-store';
import { PickingRunPage } from './picking-run-page';

vi.mock('@/entities/picking-planning/api/preview', () => ({
  previewPickingPlanFromOrders: vi.fn(),
  previewPickingPlanFromWave: vi.fn()
}));

const previewResponse = {
  kind: 'orders',
  input: { orderIds: ['order-1'] },
  strategy: {
    id: 's-1',
    code: 'default',
    name: 'Default',
    method: 'single',
    requiresPostSort: false,
    requiresCartSlots: false,
    preserveOrderSeparation: false,
    aggregateSameSku: true,
    routePriorityMode: 'distance'
  },
  summary: {
    packageCount: 1,
    routeStepCount: 2,
    taskCount: 2,
    wasSplit: false,
    splitReason: '',
    warningCount: 0
  },
  rootWorkPackage: {
    id: 'pkg-1',
    method: 'single',
    strategyId: 's-1',
    taskCount: 2,
    orderCount: 1,
    uniqueSkuCount: 2,
    uniqueLocationCount: 2,
    uniqueZoneCount: 1,
    uniqueAisleCount: 1,
    complexity: { level: 'low', score: 1, warnings: [], exceeds: {} },
    warnings: []
  },
  split: { wasSplit: false, reason: '', warnings: [], packageIds: ['pkg-1'] },
  packages: [
    {
      workPackage: {
        id: 'pkg-1',
        method: 'single',
        strategyId: 's-1',
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
            taskId: 't-1',
            fromLocationId: 'loc-1',
            locationId: 'loc-1',
            cellId: 'cell-1',
            addressLabel: 'A-1',
            skuId: 'SKU-1',
            qtyToPick: 1,
            allocations: []
          },
          {
            sequence: 2,
            taskId: 't-2',
            fromLocationId: 'loc-2',
            locationId: 'loc-2',
            cellId: 'cell-2',
            addressLabel: 'A-2',
            skuId: 'SKU-2',
            qtyToPick: 1,
            allocations: []
          }
        ],
        warnings: [],
        metadata: { mode: 'default', taskCount: 2, sequencedCount: 2, unknownLocationCount: 0 }
      }
    }
  ],
  locationsById: {},
  warnings: [],
  warningDetails: []
};

function LocationEcho() {
  const location = useLocation();
  return <div data-testid="location-echo">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(path: string) {
  resetPickingRunStore();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client: queryClient },
      createElement(MemoryRouter, { initialEntries: [path] },
        createElement(Routes, null,
          createElement(Route, { path: '/picking/run', element: createElement(PickingRunPage) }),
          createElement(Route, { path: '/warehouse/view', element: createElement(LocationEcho) })
        )
      )
    )
  );
}

describe('PickingRunPage', () => {
  beforeEach(() => {
    vi.mocked(previewPickingPlanFromOrders).mockReset();
    vi.mocked(previewPickingPlanFromWave).mockReset();
  });
  it('reads orderId from URL and loads preview', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(previewResponse as never);

    renderPage('/picking/run?orderId=order-1');

    await waitFor(() => {
      expect(previewPickingPlanFromOrders).toHaveBeenCalledWith({ orderIds: ['order-1'] });
    });
  });

  it('reads waveId from URL and loads preview', async () => {
    vi.mocked(previewPickingPlanFromWave).mockResolvedValue(previewResponse as never);

    renderPage('/picking/run?waveId=wave-1');

    await waitFor(() => {
      expect(previewPickingPlanFromWave).toHaveBeenCalledWith({ waveId: 'wave-1' });
    });
  });

  it('renders error when no id is provided', () => {
    renderPage('/picking/run');

    expect(screen.getByTestId('picking-run-no-id')).toBeTruthy();
  });

  it('renders PickingRunPanel when preview is available', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(previewResponse as never);

    renderPage('/picking/run?orderId=order-1');

    await waitFor(() => {
      expect(screen.getByTestId('picking-step-card')).toBeTruthy();
    });
  });

  it('renders error state when order preview request fails', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockRejectedValue(new Error('preview failed'));

    renderPage('/picking/run?orderId=order-1');

    await waitFor(() => {
      expect(screen.getByTestId('picking-run-error')).toBeTruthy();
      expect(screen.getByTestId('picking-run-error').textContent).toContain('preview failed');
    });
  });

  it('renders error state when wave preview request fails', async () => {
    vi.mocked(previewPickingPlanFromWave).mockRejectedValue(new Error('wave preview failed'));

    renderPage('/picking/run?waveId=wave-1');

    await waitFor(() => {
      expect(screen.getByTestId('picking-run-error')).toBeTruthy();
      expect(screen.getByTestId('picking-run-error').textContent).toContain('wave preview failed');
    });
  });

  it('confirm advances local step state and completed state appears', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(previewResponse as never);

    renderPage('/picking/run?orderId=order-1');

    await waitFor(() => {
      expect(screen.getByTestId('picking-step-confirm')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-step-confirm'));
    fireEvent.click(screen.getByTestId('picking-step-confirm'));

    await waitFor(() => {
      expect(screen.getByTestId('picking-run-completed')).toBeTruthy();
    });
  });

  it('where-is-it triggers focus navigation behavior', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(previewResponse as never);

    renderPage('/picking/run?orderId=order-1');

    await waitFor(() => {
      expect(screen.getByTestId('picking-step-where-is-it')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-step-where-is-it'));

    await waitFor(() => {
      expect(screen.getByTestId('location-echo').textContent).toBe('/warehouse/view?cell=cell-1');
    });
  });

  it('makes no backend mutation call when confirming steps', async () => {
    vi.mocked(previewPickingPlanFromOrders).mockResolvedValue(previewResponse as never);

    renderPage('/picking/run?orderId=order-1');

    await waitFor(() => {
      expect(screen.getByTestId('picking-step-confirm')).toBeTruthy();
    });

    const callsBefore = vi.mocked(previewPickingPlanFromOrders).mock.calls.length;
    fireEvent.click(screen.getByTestId('picking-step-confirm'));
    const callsAfter = vi.mocked(previewPickingPlanFromOrders).mock.calls.length;

    expect(callsAfter).toBe(callsBefore);
    expect(previewPickingPlanFromWave).not.toHaveBeenCalled();
  });
});

