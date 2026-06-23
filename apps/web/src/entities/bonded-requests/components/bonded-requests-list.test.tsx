import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BondedRequestsList } from './bonded-requests-list';
import type { BondedCoverageRequest, BondedCoverageRequestDetail } from '@wos/domain';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const SHIFT_ID = '33333333-3333-4333-8333-333333333333';

const mockOpenRequests: BondedCoverageRequest[] = [
  {
    id: 'req-1',
    tenantId: 'tenant-1',
    shiftId: SHIFT_ID,
    planningDate: '2026-06-23',
    status: 'open',
    title: 'בקשת כיסוי - 100002',
    notes: 'בקשה דחופה',
    bondedSnapshotId: null,
    warehouseStockSnapshotId: null,
    createdByProfileId: 'profile-1',
    createdByName: 'דני',
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:00:00.000Z',
    closedByProfileId: null,
    closedByName: null,
    closedAt: null,
    cancelledByProfileId: null,
    cancelledByName: null,
    cancelledAt: null,
  },
  {
    id: 'req-2',
    tenantId: 'tenant-1',
    shiftId: SHIFT_ID,
    planningDate: '2026-06-23',
    status: 'open',
    title: 'בקשת כיסוי - 100003',
    notes: null,
    bondedSnapshotId: null,
    warehouseStockSnapshotId: null,
    createdByProfileId: 'profile-2',
    createdByName: 'יוסי',
    createdAt: '2026-06-23T09:00:00.000Z',
    updatedAt: '2026-06-23T09:00:00.000Z',
    closedByProfileId: null,
    closedByName: null,
    closedAt: null,
    cancelledByProfileId: null,
    cancelledByName: null,
    cancelledAt: null,
  },
];

const mockClosedRequests: BondedCoverageRequest[] = [
  {
    id: 'req-3',
    tenantId: 'tenant-1',
    shiftId: SHIFT_ID,
    planningDate: '2026-06-23',
    status: 'closed',
    title: 'בקשת כיסוי - 100004',
    notes: null,
    bondedSnapshotId: null,
    warehouseStockSnapshotId: null,
    createdByProfileId: 'profile-1',
    createdByName: 'דני',
    createdAt: '2026-06-23T07:00:00.000Z',
    updatedAt: '2026-06-23T10:00:00.000Z',
    closedByProfileId: 'profile-1',
    closedByName: 'דני',
    closedAt: '2026-06-23T10:00:00.000Z',
    cancelledByProfileId: null,
    cancelledByName: null,
    cancelledAt: null,
  },
];

const mockCancelledRequests: BondedCoverageRequest[] = [
  {
    id: 'req-4',
    tenantId: 'tenant-1',
    shiftId: SHIFT_ID,
    planningDate: '2026-06-23',
    status: 'cancelled',
    title: 'בקשת כיסוי - 100005',
    notes: 'בוטל עקב טעות',
    bondedSnapshotId: null,
    warehouseStockSnapshotId: null,
    createdByProfileId: 'profile-2',
    createdByName: 'יוסי',
    createdAt: '2026-06-23T06:00:00.000Z',
    updatedAt: '2026-06-23T06:30:00.000Z',
    closedByProfileId: null,
    closedByName: null,
    closedAt: null,
    cancelledByProfileId: 'profile-2',
    cancelledByName: 'יוסי',
    cancelledAt: '2026-06-23T06:30:00.000Z',
  },
];

const mockDetailItems = [
  {
    id: 'item-1',
    requestId: 'req-1',
    sku: '100002',
    description: 'טונר דיו שחור HP 85A',
    category: 'דיו והדפסה',
    requestedQty: 150,
    fulfilledQty: 0,
    demandQtyAtCreate: 200,
    warehouseQtyAtCreate: 50,
    shortageQtyAtCreate: 150,
    bondedAvailableQtyAtCreate: 200,
    bondedCoverQtyAtCreate: 150,
    notes: null,
    createdAt: '2026-06-23T08:00:00.000Z',
    updatedAt: '2026-06-23T08:00:00.000Z',
  },
];

const mockOpenDetail: BondedCoverageRequestDetail = {
  ...mockOpenRequests[0],
  items: mockDetailItems,
};

const mockClosedDetail: BondedCoverageRequestDetail = {
  ...mockClosedRequests[0],
  items: [
    {
      ...mockDetailItems[0],
      id: 'item-2',
      requestId: 'req-3',
      sku: '100004',
      description: 'תיקיית נייר A4 קשיחה',
      requestedQty: 100,
      fulfilledQty: 100,
    },
  ],
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderList() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <BondedRequestsList shiftId={SHIFT_ID} />
    </QueryClientProvider>,
  );
}

describe('BondedRequestsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the main header', () => {
    mockedBffRequest.mockResolvedValue([]);
    renderList();
    expect(screen.getByText('בקשות כיסוי')).toBeTruthy();
  });

  it('shows three status filter tabs', () => {
    mockedBffRequest.mockResolvedValue([]);
    renderList();
    expect(screen.getByText('פתוחות')).toBeTruthy();
    expect(screen.getByText('סגורות')).toBeTruthy();
    expect(screen.getByText('בוטלו')).toBeTruthy();
  });

  it('defaults to open status filter and calls list query', async () => {
    mockedBffRequest.mockResolvedValue(mockOpenRequests);
    renderList();
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        `/api/manual-shifts/${SHIFT_ID}/bonded-requests?status=open`,
      );
    });
  });

  it('switches to closed filter when clicking סגורות tab', async () => {
    mockedBffRequest.mockResolvedValue(mockClosedRequests);
    renderList();
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalled();
    });
    mockedBffRequest.mockResolvedValueOnce(mockClosedRequests);
    fireEvent.click(screen.getByText('סגורות'));
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        `/api/manual-shifts/${SHIFT_ID}/bonded-requests?status=closed`,
      );
    });
  });

  it('switches to cancelled filter when clicking בוטלו tab', async () => {
    mockedBffRequest.mockResolvedValue(mockCancelledRequests);
    renderList();
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalled();
    });
    mockedBffRequest.mockResolvedValueOnce(mockCancelledRequests);
    fireEvent.click(screen.getByText('בוטלו'));
    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(
        `/api/manual-shifts/${SHIFT_ID}/bonded-requests?status=cancelled`,
      );
    });
  });

  it('renders request cards with status badge and title', async () => {
    mockedBffRequest.mockResolvedValue(mockOpenRequests);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100002')).toBeTruthy();
      expect(screen.getByText('בקשת כיסוי - 100003')).toBeTruthy();
    });
    expect(screen.getAllByText('בקשה פתוחה').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('דני')).toBeTruthy();
    expect(screen.getByText('יוסי')).toBeTruthy();
  });

  it('opens detail drawer when clicking a request card', async () => {
    mockedBffRequest.mockResolvedValue(mockOpenRequests);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100002')).toBeTruthy();
    });
    mockedBffRequest.mockResolvedValueOnce(mockOpenDetail);
    fireEvent.click(screen.getByText('בקשת כיסוי - 100002'));
    await waitFor(() => {
      expect(screen.getAllByText('בקשה פתוחה').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('טונר דיו שחור HP 85A')).toBeTruthy();
    });
  });

  it('detail drawer shows item rows', async () => {
    mockedBffRequest.mockResolvedValue(mockOpenRequests);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100002')).toBeTruthy();
    });
    mockedBffRequest.mockResolvedValueOnce(mockOpenDetail);
    fireEvent.click(screen.getByText('בקשת כיסוי - 100002'));
    await waitFor(() => {
      expect(screen.getAllByText('150').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('0')).toBeTruthy();
    });
  });

  it('detail drawer shows close and cancel for open request', async () => {
    mockedBffRequest.mockResolvedValue(mockOpenRequests);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100002')).toBeTruthy();
    });
    mockedBffRequest.mockResolvedValueOnce(mockOpenDetail);
    fireEvent.click(screen.getByText('בקשת כיסוי - 100002'));
    await waitFor(() => {
      expect(screen.getByText('סגור בקשה')).toBeTruthy();
      expect(screen.getByText('בטל בקשה')).toBeTruthy();
    });
  });

  it('closed request detail is read-only (no close/cancel buttons)', async () => {
    mockedBffRequest.mockResolvedValue(mockClosedRequests);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100004')).toBeTruthy();
    });
    mockedBffRequest.mockResolvedValueOnce(mockClosedDetail);
    fireEvent.click(screen.getByText('בקשת כיסוי - 100004'));
    await waitFor(() => {
      expect(screen.getByText('בקשה סגורה')).toBeTruthy();
    });
    expect(screen.queryByText('סגור בקשה')).toBeNull();
    expect(screen.queryByText('בטל בקשה')).toBeNull();
  });

  it('close form defaults fulfilledQty to requestedQty', async () => {
    mockedBffRequest.mockResolvedValue(mockOpenRequests);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100002')).toBeTruthy();
    });
    mockedBffRequest.mockResolvedValueOnce(mockOpenDetail);
    fireEvent.click(screen.getByText('בקשת כיסוי - 100002'));
    await waitFor(() => {
      expect(screen.getByText('סגור בקשה')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('סגור בקשה'));
    await waitFor(() => {
      expect(screen.getByText('סגירת בקשת כיסוי')).toBeTruthy();
      expect(screen.getAllByDisplayValue('150').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('close submit calls bffRequest with fulfilledQty values', async () => {
    mockedBffRequest.mockImplementation((url: string) => {
      if (url.includes('/close')) {
        return Promise.resolve({ ...mockOpenDetail, status: 'closed' });
      }
      if (url.includes('/bonded-requests/') && !url.includes('status=')) {
        return Promise.resolve(mockOpenDetail);
      }
      return Promise.resolve(mockOpenRequests);
    });
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100002')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('בקשת כיסוי - 100002'));
    await waitFor(() => {
      expect(screen.getByText('סגור בקשה')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('סגור בקשה'));
    await waitFor(() => {
      expect(screen.getByText('סגירת בקשת כיסוי')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('סגור בקשה'));
    await waitFor(() => {
      const closeCall = mockedBffRequest.mock.calls.find(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('/close'),
      );
      expect(closeCall).toBeDefined();
    });
    const closeCall = mockedBffRequest.mock.calls.find(
      (call) => typeof call[0] === 'string' && (call[0] as string).includes('/close'),
    );
    if (closeCall) {
      const body = JSON.parse((closeCall[1] as { body: string }).body);
      expect(body.items).toEqual([{ itemId: 'item-1', fulfilledQty: 150 }]);
    }
  });

  it('cancel calls mutation when confirmed', async () => {
    mockedBffRequest.mockImplementation((url: string) => {
      if (url.includes('/cancel')) {
        return Promise.resolve({ ...mockOpenDetail, status: 'cancelled' });
      }
      if (url.includes('/bonded-requests/') && !url.includes('status=')) {
        return Promise.resolve(mockOpenDetail);
      }
      return Promise.resolve(mockOpenRequests);
    });
    renderList();
    await waitFor(() => {
      expect(screen.getByText('בקשת כיסוי - 100002')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('בקשת כיסוי - 100002'));
    await waitFor(() => {
      expect(screen.getByText('בטל בקשה')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('בטל בקשה'));
    await waitFor(() => {
      expect(screen.getByText('האם אתה בטוח שברצונך לבטל בקשה זו?')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('בטל בקשה'));
    await waitFor(() => {
      const cancelCall = mockedBffRequest.mock.calls.find(
        (call) => typeof call[0] === 'string' && (call[0] as string).includes('/cancel'),
      );
      expect(cancelCall).toBeDefined();
    });
  });

  it('shows empty state when no requests in status', async () => {
    mockedBffRequest.mockResolvedValue([]);
    renderList();
    await waitFor(() => {
      expect(screen.getByText('אין בקשות')).toBeTruthy();
    });
  });

  it('shows error state on fetch failure', async () => {
    mockedBffRequest.mockRejectedValue(new Error('Network error'));
    renderList();
    await waitFor(() => {
      expect(screen.getByText('לא הצלחנו לטעון בקשות כיסוי')).toBeTruthy();
    });
  });
});
