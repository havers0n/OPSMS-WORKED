import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PickingQueueItemDto } from '@/entities/picking-queue/api/queries';
import { fetchPickingQueue } from '@/entities/picking-queue/api/queries';
import { PickingQueuePage } from './picking-queue-page';

vi.mock('@/entities/picking-queue/api/queries', async () => {
  const actual = await vi.importActual<typeof import('@/entities/picking-queue/api/queries')>('@/entities/picking-queue/api/queries');
  return {
    ...actual,
    fetchPickingQueue: vi.fn(),
    pickingQueueQueryOptions: () => ({ queryKey: ['picking-queue'], queryFn: vi.mocked(fetchPickingQueue) })
  };
});

function RouteEcho() {
  const location = useLocation();
  return <div data-testid="route-echo">{`${location.pathname}${location.search}`}</div>;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    createElement(QueryClientProvider, { client: queryClient },
      createElement(MemoryRouter, { initialEntries: ['/picking'] },
        createElement(Routes, null,
          createElement(Route, { path: '/picking', element: createElement(PickingQueuePage) }),
          createElement(Route, {
            path: '/picking/run',
            element: createElement('div', null,
              createElement('div', { 'data-testid': 'run-target' }, 'run'),
              createElement(RouteEcho)
            )
          })
        )
      )
    )
  );
}

describe('PickingQueuePage', () => {
  beforeEach(() => {
    vi.mocked(fetchPickingQueue).mockReset();
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

  it('renders order and wave queue items', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready', lineCount: 2 },
      { kind: 'wave', id: 'wave-1', displayCode: 'WAVE-1', status: 'in_progress', orderCount: 4 }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('picking-queue-item-order')).toHaveLength(1);
      expect(screen.getAllByTestId('picking-queue-item-wave')).toHaveLength(1);
    });
  });

  it('clicking order navigates to /picking/run?orderId=...', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-order'));

    await waitFor(() => {
      expect(screen.getByTestId('route-echo').textContent).toBe('/picking/run?orderId=order-1');
    });
  });

  it('clicking wave navigates to /picking/run?waveId=...', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'wave', id: 'wave-1', displayCode: 'WAVE-1', status: 'ready' }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-wave')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('picking-queue-item-wave'));

    await waitFor(() => {
      expect(screen.getByTestId('route-echo').textContent).toBe('/picking/run?waveId=wave-1');
    });
  });
});

