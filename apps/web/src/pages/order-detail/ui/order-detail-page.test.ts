import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Order, OrderLine } from '@wos/domain';
import { usePickingPlanningOverlayStore } from '@/entities/picking-planning/model/overlay-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
import { OrderDetailPage } from './order-detail-page';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  order: null as Order | null,
  transitionMutate: vi.fn(),
  removeLineMutate: vi.fn(),
  addLineMutate: vi.fn()
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
  useParams: () => ({ orderId: 'order-1' })
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: (options: { queryKey?: readonly unknown[] }) => {
      if (options.queryKey?.includes('execution')) {
        return { data: [], isLoading: false };
      }

      return {
        data: mocks.order,
        isLoading: false,
        refetch: vi.fn(),
        isRefetching: false
      };
    }
  };
});

vi.mock('@/entities/order/api/mutations', () => ({
  useAddOrderLine: () => ({ isPending: false, mutate: mocks.addLineMutate }),
  useRemoveOrderLine: () => ({ isPending: false, mutate: mocks.removeLineMutate }),
  useTransitionOrderStatus: () => ({
    isPending: false,
    error: null,
    mutate: mocks.transitionMutate
  })
}));

vi.mock('@/entities/product/api/use-products-search', () => ({
  useProductsSearch: () => ({ data: [], isLoading: false })
}));

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;

function makeLine(overrides: Partial<OrderLine> = {}): OrderLine {
  return {
    id: 'line-1',
    orderId: 'order-1',
    tenantId: 'tenant-1',
    productId: 'product-1',
    sku: 'SKU-1',
    name: 'Product 1',
    qtyRequired: 2,
    qtyPicked: 0,
    reservedQty: 0,
    status: 'pending',
    ...overrides
  };
}

function makeOrder(lines: OrderLine[]): Order {
  return {
    id: 'order-1',
    tenantId: 'tenant-1',
    externalNumber: 'ORD-1',
    status: 'ready',
    priority: 0,
    waveId: null,
    waveName: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    releasedAt: null,
    closedAt: null,
    lines
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
    renderer = TestRenderer.create(React.createElement(OrderDetailPage));
  });
}

function findButton(label: string) {
  return renderer!.root
    .findAllByType('button')
    .find((button) => button.children.includes(label));
}

describe('OrderDetailPage picking plan navigation', () => {
  beforeEach(() => {
    mocks.order = makeOrder([makeLine()]);
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

  it('disables planning when the order has no lines', () => {
    mocks.order = makeOrder([]);
    renderPage();

    const button = findButton('Plan picking');

    expect(button?.props.disabled).toBe(true);
    expect(button?.props.title).toBe('Add order lines before planning picking.');
  });

  it('opens picking planning for the selected order without calling mutations', () => {
    renderPage();

    const button = findButton('Plan picking');

    act(() => {
      button?.props.onClick();
    });

    expect(usePickingPlanningOverlayStore.getState().source).toEqual({
      kind: 'orders',
      orderIds: ['order-1']
    });
    expect(useModeStore.getState().viewMode).toBe('view');
    expect(useModeStore.getState().viewStage).toBe('picking-plan');
    expect(mocks.navigate).toHaveBeenCalledWith('/warehouse/view');
    expect(mocks.transitionMutate).not.toHaveBeenCalled();
    expect(mocks.removeLineMutate).not.toHaveBeenCalled();
    expect(mocks.addLineMutate).not.toHaveBeenCalled();
  });
});
