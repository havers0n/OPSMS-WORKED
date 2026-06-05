import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
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

  it('renders order and wave queue items as read-only', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready', lineCount: 2 },
      { kind: 'wave', id: 'wave-1', displayCode: 'WAVE-1', status: 'in_progress', orderCount: 4 }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId('picking-queue-item-order')).toHaveLength(1);
      expect(screen.getAllByTestId('picking-queue-item-wave')).toHaveLength(1);
    });

    const items = screen.getAllByTestId(/picking-queue-item-/);
    items.forEach((item) => {
      expect(item.tagName).toBe('DIV');
      expect(item.className).toContain('opacity-80');
    });
  });

  it('does not navigate when clicking queue items (read-only)', async () => {
    vi.mocked(fetchPickingQueue).mockResolvedValue([
      { kind: 'order', id: 'order-1', displayCode: 'ORD-1', status: 'ready' }
    ]);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('picking-queue-item-order')).toBeTruthy();
    });

    const item = screen.getByTestId('picking-queue-item-order');
    expect(item.tagName).toBe('DIV');
    expect(item.getAttribute('role')).toBeNull();
    expect(item.getAttribute('tabindex')).toBeNull();
  });
});

