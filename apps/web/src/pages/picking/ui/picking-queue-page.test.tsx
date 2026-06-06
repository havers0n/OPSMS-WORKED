import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchOrderExecution } from '@/entities/order/api/queries';
import type { PickingQueueItemDto } from '@/entities/picking-queue/api/queries';
import { fetchPickingQueue } from '@/entities/picking-queue/api/queries';
import type { PickTaskSummary } from '@wos/domain';
import { PickingQueuePage } from './picking-queue-page';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

vi.mock('@/entities/order/api/queries', async () => {
  const actual = await vi.importActual<typeof import('@/entities/order/api/queries')>('@/entities/order/api/queries');
  return {
    ...actual,
    fetchOrderExecution: vi.fn(),
    orderExecutionQueryOptions: (orderId: string | null) => ({
      queryKey: ['order', 'execution', orderId ?? 'none'],
      queryFn: () => vi.mocked(fetchOrderExecution)(orderId as string),
      enabled: Boolean(orderId)
    })
  };
});

vi.mock('@/entities/picking-queue/api/queries', async () => {
  const actual = await vi.importActual<typeof import('@/entities/picking-queue/api/queries')>('@/entities/picking-queue/api/queries');
  return {
    ...actual,
    fetchPickingQueue: vi.fn(),
    pickingQueueQueryOptions: () => ({ queryKey: ['picking-queue'], queryFn: vi.mocked(fetchPickingQueue) })
  };
});

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client: queryClient },
      createElement(MemoryRouter, { initialEntries: ['/picking'] },
        createElement(PickingQueuePage)
      )
    )
  );
}

describe('PickingQueuePage', () => {
  beforeEach(() => {
    vi.mocked(fetchPickingQueue).mockReset();
    vi.mocked(fetchOrderExecution).mockReset();
    mockNavigate.mockReset();
  });

  it('renders loading state', () => {
    vi.mocked(fetchPickingQueue).mockReturnValue(new Promise(() => {}) as Promise<PickingQueueItemDto[]>);

    renderPage();

    expect(screen.getByTestId('picking-queue-loading')).toBeTruthy();
  });

  it('renders empty state', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-empty')).toBeTruthy();
    });
  });

  it('renders error state when queue loading fails', async () => {
    vi.mocked(fetchPickingQueue).mockRejectedValue(new Error('queue failed'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-error')).toBeTruthy();
      expect(screen.getByTestId('picking-queue-error').textContent).toContain('queue failed');
    });
  });

  it('renders order cards as actionable and wave cards as read-only', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready', lineCount: 2 },
      { kind: 'wave', id: 'wave-1', displayCode: 'WAVE-1', status: 'in_progress', orderCount: 4 }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('picking-queue-item-order')).toHaveLength(1);
      expect(screen.getAllByTestId('picking-queue-item-wave')).toHaveLength(1);
    });

    const orderItem = screen.getByTestId('picking-queue-item-order');
    const waveItem = screen.getByTestId('picking-queue-item-wave');

    expect(orderItem.tagName).toBe('BUTTON');
    expect(waveItem.tagName).toBe('DIV');
  });

  it('click resolves execution lazily and navigates to ready task route', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);
    vi.mocked(fetchOrderExecution).mockResolvedValue([
      {
        id: 'task-1',
        taskNumber: 'PT-1',
        tenantId: 'tenant-1',
        sourceType: 'order',
        sourceId: 'order-1',
        status: 'ready',
        assignedTo: null,
        assignedWorkerId: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-06-06T00:00:00.000Z',
        totalSteps: 2,
        completedSteps: 0,
        exceptionSteps: 0
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-order'));

    await waitFor(() => {
      expect(fetchOrderExecution).toHaveBeenCalledWith('order-1');
      expect(mockNavigate).toHaveBeenCalledWith('/operations/pick-tasks/task-1?order=order-1');
    });
  });

  it('one assigned task navigates to execution route', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);
    vi.mocked(fetchOrderExecution).mockResolvedValue([
      {
        id: 'task-2',
        taskNumber: 'PT-2',
        tenantId: 'tenant-1',
        sourceType: 'order',
        sourceId: 'order-1',
        status: 'assigned',
        assignedTo: null,
        assignedWorkerId: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-06-06T00:00:00.000Z',
        totalSteps: 2,
        completedSteps: 0,
        exceptionSteps: 0
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-order'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations/pick-tasks/task-2?order=order-1');
    });
  });

  it('one in-progress task navigates to execution route', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'in_progress' }
    ]);
    vi.mocked(fetchOrderExecution).mockResolvedValue([
      {
        id: 'task-3',
        taskNumber: 'PT-3',
        tenantId: 'tenant-1',
        sourceType: 'order',
        sourceId: 'order-1',
        status: 'in_progress',
        assignedTo: null,
        assignedWorkerId: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-06-06T00:00:00.000Z',
        totalSteps: 2,
        completedSteps: 1,
        exceptionSteps: 0
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-order'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations/pick-tasks/task-3?order=order-1');
    });
  });

  it('zero actionable tasks navigates to order detail', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);
    vi.mocked(fetchOrderExecution).mockResolvedValue([
      {
        id: 'task-4',
        taskNumber: 'PT-4',
        tenantId: 'tenant-1',
        sourceType: 'order',
        sourceId: 'order-1',
        status: 'completed',
        assignedTo: null,
        assignedWorkerId: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-06-06T00:00:00.000Z',
        totalSteps: 2,
        completedSteps: 2,
        exceptionSteps: 0
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-order'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations/orders/order-1');
    });
  });

  it('multiple actionable tasks navigate to order detail and never silently choose the first', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);
    vi.mocked(fetchOrderExecution).mockResolvedValue([
      {
        id: 'task-5',
        taskNumber: 'PT-5',
        tenantId: 'tenant-1',
        sourceType: 'order',
        sourceId: 'order-1',
        status: 'ready',
        assignedTo: null,
        assignedWorkerId: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-06-06T00:00:00.000Z',
        totalSteps: 2,
        completedSteps: 0,
        exceptionSteps: 0
      },
      {
        id: 'task-6',
        taskNumber: 'PT-6',
        tenantId: 'tenant-1',
        sourceType: 'order',
        sourceId: 'order-1',
        status: 'assigned',
        assignedTo: null,
        assignedWorkerId: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-06-06T00:00:00.000Z',
        totalSteps: 2,
        completedSteps: 0,
        exceptionSteps: 0
      }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-order'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations/orders/order-1');
    });
    expect(mockNavigate).not.toHaveBeenCalledWith('/operations/pick-tasks/task-5?order=order-1');
  });

  it('wave card stays non-actionable', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'wave', id: 'wave-1', displayCode: 'WAVE-1', status: 'in_progress', orderCount: 4 }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-wave')).toBeTruthy();
    });

    const item = screen.getByTestId('picking-queue-item-wave');
    fireEvent.click(item);

    expect(fetchOrderExecution).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('duplicate clicks are blocked while resolving', async () => {
    let resolveExecution: (value: PickTaskSummary[]) => void = () => undefined;
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);
    vi.mocked(fetchOrderExecution).mockReturnValue(
      new Promise((resolve) => {
        resolveExecution = resolve;
      })
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    const item = screen.getByTestId('picking-queue-item-order');
    fireEvent.click(item);
    fireEvent.click(item);

    expect(fetchOrderExecution).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Resolving\.\.\./)).toBeTruthy();

    resolveExecution([
      {
        id: 'task-7',
        taskNumber: 'PT-7',
        tenantId: 'tenant-1',
        sourceType: 'order',
        sourceId: 'order-1',
        status: 'ready',
        assignedTo: null,
        assignedWorkerId: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-06-06T00:00:00.000Z',
        totalSteps: 2,
        completedSteps: 0,
        exceptionSteps: 0
      }
    ]);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/operations/pick-tasks/task-7?order=order-1');
    });
  });

  it('request failure shows error and does not navigate', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);
    vi.mocked(fetchOrderExecution).mockRejectedValue(new Error('execution failed'));

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-order'));

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-resolution-error').textContent).toContain('execution failed');
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
