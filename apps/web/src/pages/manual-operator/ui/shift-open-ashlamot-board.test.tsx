import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ShiftOpenAshlamotBoard } from './shift-open-ashlamot-board';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const SHIFT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const boardItem = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  orderId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  orderNumber: '502481',
  pointName: 'ירושלים',
  lineId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  lineName: 'קו A',
  text: 'להוסיף 4 כבלים',
  source: 'manual' as const,
  checkUnitId: null,
  createdAt: new Date('2026-05-26T07:29:00.000Z').toISOString()
};

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function renderBoard(canInteract = true) {
  return render(
    <QueryClientProvider client={makeQC()}>
      <ShiftOpenAshlamotBoard shiftId={SHIFT_ID} canInteract={canInteract} variant="mobile" />
    </QueryClientProvider>
  );
}

describe('ShiftOpenAshlamotBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders open ashlamot with line, order, point, text, and time', async () => {
    mockedBffRequest.mockResolvedValue([boardItem]);

    renderBoard();

    await waitFor(() => {
      expect(screen.getByTestId(`open-ashlama-board-item-${boardItem.id}`)).toBeTruthy();
    });

    expect(screen.getByText(/קו A/)).toBeTruthy();
    expect(screen.getByText(/502481/)).toBeTruthy();
    expect(screen.getByText(/ירושלים/)).toBeTruthy();
    expect(screen.getByText('להוסיף 4 כבלים')).toBeTruthy();
  });

  it('renders empty state when no open ashlamot', async () => {
    mockedBffRequest.mockResolvedValue([]);

    renderBoard();

    await waitFor(() => {
      expect(screen.getByTestId('shift-open-ashlamot-empty')).toBeTruthy();
    });

    expect(screen.getByText('אין השלמות פתוחות')).toBeTruthy();
  });

  it('shows count in heading when items present', async () => {
    mockedBffRequest.mockResolvedValue([boardItem]);

    renderBoard();

    await waitFor(() => {
      expect(screen.getByText(/השלמות פתוחות \(1\)/)).toBeTruthy();
    });
  });

  it('renders done and cancel buttons when canInteract=true', async () => {
    mockedBffRequest.mockResolvedValue([boardItem]);

    renderBoard(true);

    await waitFor(() => {
      expect(screen.getByTestId(`ashlama-done-${boardItem.id}`)).toBeTruthy();
      expect(screen.getByTestId(`ashlama-cancel-${boardItem.id}`)).toBeTruthy();
    });
  });

  it('hides action buttons when canInteract=false', async () => {
    mockedBffRequest.mockResolvedValue([boardItem]);

    renderBoard(false);

    await waitFor(() => {
      expect(screen.getByTestId(`open-ashlama-board-item-${boardItem.id}`)).toBeTruthy();
    });

    expect(screen.queryByTestId(`ashlama-done-${boardItem.id}`)).toBeNull();
    expect(screen.queryByTestId(`ashlama-cancel-${boardItem.id}`)).toBeNull();
  });

  it('done button calls patch mutation with status done', async () => {
    mockedBffRequest.mockImplementation((url: string) => {
      if (url.includes('/open-ashlamot')) return Promise.resolve([boardItem]);
      return Promise.resolve({ ...boardItem, status: 'done' });
    });

    renderBoard(true);

    await waitFor(() => {
      expect(screen.getByTestId(`ashlama-done-${boardItem.id}`)).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId(`ashlama-done-${boardItem.id}`));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        `/api/manual-shift-ashlamot/${boardItem.id}`,
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'done' }) })
      );
    });
  });

  it('cancel button calls patch mutation with status cancelled', async () => {
    mockedBffRequest.mockImplementation((url: string) => {
      if (url.includes('/open-ashlamot')) return Promise.resolve([boardItem]);
      return Promise.resolve({ ...boardItem, status: 'cancelled' });
    });

    renderBoard(true);

    await waitFor(() => {
      expect(screen.getByTestId(`ashlama-cancel-${boardItem.id}`)).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId(`ashlama-cancel-${boardItem.id}`));

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        `/api/manual-shift-ashlamot/${boardItem.id}`,
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) })
      );
    });
  });
});
