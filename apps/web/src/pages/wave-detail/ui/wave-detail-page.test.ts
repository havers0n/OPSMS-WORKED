import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { OrderSummary, Wave } from '@wos/domain';
import { usePickingPlanningOverlayStore } from '@/entities/picking-planning/model/overlay-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
import { WaveDetailPage } from './wave-detail-page';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  setSearchParams: vi.fn(),
  wave: null as Wave | null,
  waveTransitionMutate: vi.fn(),
  orderTransitionMutate: vi.fn(),
  createOrderMutate: vi.fn(),
  attachOrderMutate: vi.fn(),
  detachOrderMutate: vi.fn()
}));

vi.mock('react-router-dom', () => ({
  Link: ({
    children,
    to,
    className,
    title
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
    title?: string;
  }) => React.createElement('a', { href: to, className, title }, children),
  useNavigate: () => mocks.navigate,
  useParams: () => ({ id: 'wave-1' }),
  useSearchParams: () => [new URLSearchParams(), mocks.setSearchParams]
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: () => ({
      data: mocks.wave,
      isLoading: false,
      refetch: vi.fn(),
      isRefetching: false
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn()
    })
  };
});

vi.mock('@/entities/order/api/mutations', () => ({
  useCreateOrder: () => ({ isPending: false, mutate: mocks.createOrderMutate }),
  useTransitionOrderStatus: () => ({
    isPending: false,
    variables: null,
    mutate: mocks.orderTransitionMutate
  })
}));

vi.mock('@/entities/wave/api/mutations', () => ({
  useAttachOrderToWave: () => ({ isPending: false, mutate: mocks.attachOrderMutate }),
  useDetachOrderFromWave: () => ({ isPending: false, mutate: mocks.detachOrderMutate }),
  useTransitionWaveStatus: () => ({
    isPending: false,
    mutate: mocks.waveTransitionMutate
  })
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function makeOrder(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    externalNumber: 'ORD-1',
    status: 'ready',
    priority: 0,
    waveId: 'wave-1',
    waveName: 'Wave 1',
    createdAt: '2026-01-01T00:00:00.000Z',
    releasedAt: null,
    closedAt: null,
    lineCount: 1,
    unitCount: 2,
    pickedUnitCount: 0,
    ...overrides
  };
}

function makeWave(orders: OrderSummary[]): Wave {
  return {
    id: 'wave-1',
    tenantId: 'tenant-1',
    name: 'Wave 1',
    status: 'ready',
    createdAt: '2026-01-01T00:00:00.000Z',
    releasedAt: null,
    closedAt: null,
    totalOrders: orders.length,
    readyOrders: orders.length,
    blockingOrderCount: 0,
    orders
  };
}

function resetStores() {
  usePickingPlanningOverlayStore.setState({
    source: { kind: 'none' },
    preview: null,
    isLoading: false,
    errorMessage: null,
    activePackageId: null,
    selectedStepId: null,
    reorderedStepIdsByPackageId: {}
  });
  useModeStore.setState({
    viewMode: 'layout',
    viewStage: 'map',
    editorMode: 'select'
  });
}

function renderPage() {
  act(() => {
    renderer = TestRenderer.create(React.createElement(WaveDetailPage));
  });
}

function findButton(label: string) {
  return renderer!.root
    .findAllByType('button')
    .find((button) => button.children.includes(label));
}

describe('WaveDetailPage picking plan navigation', () => {
  beforeEach(() => {
    mocks.wave = makeWave([makeOrder()]);
    vi.clearAllMocks();
    resetStores();
  });

  afterEach(() => {
    if (!renderer) return;
    act(() => {
      renderer?.unmount();
      renderer = null;
    });
  });

  it('disables planning when the wave has no orders', () => {
    mocks.wave = makeWave([]);
    renderPage();

    const button = findButton('Plan wave');

    expect(button?.props.disabled).toBe(true);
    expect(button?.props.title).toBe('Add orders to this wave before planning picking.');
  });

  it('opens picking planning for the selected wave without calling mutations', () => {
    renderPage();

    const button = findButton('Plan wave');

    act(() => {
      button?.props.onClick();
    });

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'wave',
      waveId: 'wave-1'
    });
    expect(useModeStore.getState().viewMode).toBe('view');
    expect(useModeStore.getState().viewStage).toBe('picking-plan');
    expect(mocks.navigate).toHaveBeenCalledWith('/warehouse/view');
    expect(mocks.waveTransitionMutate).not.toHaveBeenCalled();
    expect(mocks.orderTransitionMutate).not.toHaveBeenCalled();
    expect(mocks.createOrderMutate).not.toHaveBeenCalled();
    expect(mocks.attachOrderMutate).not.toHaveBeenCalled();
    expect(mocks.detachOrderMutate).not.toHaveBeenCalled();
  });
});
