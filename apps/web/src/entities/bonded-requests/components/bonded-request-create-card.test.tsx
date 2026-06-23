import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BondedRequestCreateCard } from './bonded-request-create-card';
import type { ProductControlRow } from '@/entities/product-control/product-control-types';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const SHIFT_ID = '33333333-3333-4333-8333-333333333333';
const PLANNING_DATE = '2026-06-23';
const BONDED_SNAPSHOT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const WAREHOUSE_SNAPSHOT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const bondedCoveredRow: ProductControlRow = {
  sku: '100002',
  description: 'טונר דיו שחור HP 85A',
  category: 'דיו והדפסה',
  demandQty: 200,
  warehouseQty: 50,
  shortageQty: 150,
  bondedAvailableQty: 200,
  bondedCoverQty: 150,
  finalMissingQty: 0,
  surplusQty: 0,
  status: 'covered_by_bonded',
  affectedLinesCount: 8,
  affectedOrdersCount: 3,
  workLines: [],
};

const partialBondedRow: ProductControlRow = {
  sku: '100003',
  description: 'קלסר טבעות 5 ס"מ כחול',
  category: 'ניירת',
  demandQty: 300,
  warehouseQty: 100,
  shortageQty: 200,
  bondedAvailableQty: 100,
  bondedCoverQty: 100,
  finalMissingQty: 100,
  surplusQty: 0,
  status: 'partial_bonded',
  affectedLinesCount: 4,
  affectedOrdersCount: 2,
  workLines: [],
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderCard(row: ProductControlRow) {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <BondedRequestCreateCard
        shiftId={SHIFT_ID}
        row={row}
        planningDate={PLANNING_DATE}
        bondedSnapshotId={BONDED_SNAPSHOT_ID}
        warehouseStockSnapshotId={WAREHOUSE_SNAPSHOT_ID}
      />
    </QueryClientProvider>,
  );
}

describe('BondedRequestCreateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedBffRequest.mockResolvedValue({
      id: 'request-1',
      status: 'open',
      items: [],
    });
  });

  it('renders section header', () => {
    renderCard(bondedCoveredRow);
    expect(screen.getByText('בקשת כיסוי בונדד')).toBeTruthy();
  });

  it('defaults requested qty to row.bondedCoverQty', () => {
    renderCard(bondedCoveredRow);
    const input = screen.getByDisplayValue('150');
    expect(input).toBeTruthy();
  });

  it('shows recommended max as bondedCoverQty', () => {
    renderCard(bondedCoveredRow);
    expect(screen.getByText(/כמות מומלצת: 150/)).toBeTruthy();
  });

  it('renders submit button', () => {
    renderCard(bondedCoveredRow);
    expect(screen.getByText('צור בקשת כיסוי')).toBeTruthy();
  });

  it('renders notes input fields', () => {
    renderCard(bondedCoveredRow);
    expect(screen.getByPlaceholderText('הערות לבקשה')).toBeTruthy();
    expect(screen.getByPlaceholderText('הערות לפריט בבקשה')).toBeTruthy();
  });

  it('calls bffRequest with correct shiftId and payload on submit', async () => {
    renderCard(bondedCoveredRow);
    const submitButton = screen.getByText('צור בקשת כיסוי');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        `/api/manual-shifts/${SHIFT_ID}/bonded-requests`,
        {
          method: 'POST',
          body: JSON.stringify({
            planningDate: PLANNING_DATE,
            title: 'בקשת כיסוי - 100002',
            notes: null,
            bondedSnapshotId: BONDED_SNAPSHOT_ID,
            warehouseStockSnapshotId: WAREHOUSE_SNAPSHOT_ID,
            items: [
              {
                sku: '100002',
                description: 'טונר דיו שחור HP 85A',
                category: 'דיו והדפסה',
                requestedQty: 150,
                demandQtyAtCreate: 200,
                warehouseQtyAtCreate: 50,
                shortageQtyAtCreate: 150,
                bondedAvailableQtyAtCreate: 200,
                bondedCoverQtyAtCreate: 150,
                notes: null,
              },
            ],
          }),
        },
      );
    });
  });

  it('includes user-entered notes in the payload', async () => {
    renderCard(bondedCoveredRow);

    const requestNotesInput = screen.getByPlaceholderText('הערות לבקשה');
    fireEvent.change(requestNotesInput, { target: { value: 'בקשה דחופה' } });

    const itemNotesInput = screen.getByPlaceholderText('הערות לפריט בבקשה');
    fireEvent.change(itemNotesInput, { target: { value: 'צריך לארוז בקפסולות' } });

    fireEvent.click(screen.getByText('צור בקשת כיסוי'));

    await waitFor(() => {
      const callArg = mockedBffRequest.mock.calls[0][1] as { body: string };
      const body = JSON.parse(callArg.body);
      expect(body.notes).toBe('בקשה דחופה');
      expect(body.items[0].notes).toBe('צריך לארוז בקפסולות');
    });
  });

  it('shows error message when create fails', async () => {
    mockedBffRequest.mockRejectedValueOnce(new Error('Network error'));
    renderCard(bondedCoveredRow);

    fireEvent.click(screen.getByText('צור בקשת כיסוי'));

    await waitFor(() => {
      expect(screen.getByText('לא הצלחנו ליצור בקשת כיסוי')).toBeTruthy();
    });
  });

  it('shows success message after creation', async () => {
    renderCard(bondedCoveredRow);

    fireEvent.click(screen.getByText('צור בקשת כיסוי'));

    await waitFor(() => {
      expect(screen.getByText('בקשה נוצרה')).toBeTruthy();
    });
  });

  it('does not show the form after successful creation', async () => {
    renderCard(bondedCoveredRow);

    fireEvent.click(screen.getByText('צור בקשת כיסוי'));

    await waitFor(() => {
      expect(screen.getByText('בקשה נוצרה')).toBeTruthy();
    });

    expect(screen.queryByText('צור בקשת כיסוי')).toBeNull();
    expect(screen.queryByDisplayValue('150')).toBeNull();
  });

  it('disables submit button while pending', () => {
    mockedBffRequest.mockImplementationOnce(() => new Promise(() => {}));
    renderCard(bondedCoveredRow);

    fireEvent.click(screen.getByText('צור בקשת כיסוי'));

    const button = screen.getByText('יוצר בקשה...');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('shows validation message when qty is zero', () => {
    renderCard(bondedCoveredRow);
    const qtyInput = screen.getByDisplayValue('150');
    fireEvent.change(qtyInput, { target: { value: '0' } });

    expect(screen.getByText('לא ניתן ליצור בקשה ללא כמות תקינה')).toBeTruthy();
  });

  it('disables submit button when qty is zero', () => {
    renderCard(bondedCoveredRow);
    const qtyInput = screen.getByDisplayValue('150');
    fireEvent.change(qtyInput, { target: { value: '0' } });

    const button = screen.getByText('צור בקשת כיסוי');
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('does not call bffRequest when qty is zero', () => {
    renderCard(bondedCoveredRow);
    const qtyInput = screen.getByDisplayValue('150');
    fireEvent.change(qtyInput, { target: { value: '0' } });

    fireEvent.click(screen.getByText('צור בקשת כיסוי'));

    expect(mockedBffRequest).not.toHaveBeenCalled();
  });

  it('calls onCreated with request id after success', async () => {
    const onCreated = vi.fn();
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <BondedRequestCreateCard
          shiftId={SHIFT_ID}
          row={bondedCoveredRow}
          planningDate={PLANNING_DATE}
          bondedSnapshotId={BONDED_SNAPSHOT_ID}
          warehouseStockSnapshotId={WAREHOUSE_SNAPSHOT_ID}
          onCreated={onCreated}
        />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByText('צור בקשת כיסוי'));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('request-1');
    });
  });

  it('works with partial_bonded status row', () => {
    renderCard(partialBondedRow);
    expect(screen.getByText('בקשת כיסוי בונדד')).toBeTruthy();
    const input = screen.getByDisplayValue('100');
    expect(input).toBeTruthy();
  });

  it('handles empty snapshot IDs gracefully', () => {
    render(
      <QueryClientProvider client={makeQueryClient()}>
        <BondedRequestCreateCard
          shiftId={SHIFT_ID}
          row={bondedCoveredRow}
          planningDate={PLANNING_DATE}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText('בקשת כיסוי בונדד')).toBeTruthy();
  });
});
