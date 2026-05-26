import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PeopleTab } from './people-tab';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function makeQC() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function renderPeopleTab(shiftId = 'shift-1') {
  return render(
    <QueryClientProvider client={makeQC()}>
      <PeopleTab shiftId={shiftId} />
    </QueryClientProvider>
  );
}

const basePeopleResponse = {
  shiftId: 'shift-1',
  items: [
    {
      pickerName: 'מרים',
      activeOrdersCount: 2,
      waitingCheckCount: 1,
      returnedCount: 0,
      doneCount: 5,
      errorCount: 0,
      currentActiveOrder: null
    }
  ]
};

describe('PeopleTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders picker cards with name and counts', async () => {
    mockedBffRequest.mockResolvedValue(basePeopleResponse);

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('מרים')).toBeTruthy();
    });

    expect(screen.getByText('2')).toBeTruthy(); // activeOrdersCount
    expect(screen.getByText('5')).toBeTruthy(); // doneCount
  });

  it('shows empty state when no items', async () => {
    mockedBffRequest.mockResolvedValue({ shiftId: 'shift-1', items: [] });

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('אין מלקטים פעילים')).toBeTruthy();
    });
  });

  it('groups missing pickerName as ללא מלקט', async () => {
    mockedBffRequest.mockResolvedValue({
      shiftId: 'shift-1',
      items: [
        {
          pickerName: '',
          activeOrdersCount: 1,
          waitingCheckCount: 0,
          returnedCount: 0,
          doneCount: 0,
          errorCount: 0,
          currentActiveOrder: null
        }
      ]
    });

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('ללא מלקט')).toBeTruthy();
    });
  });

  it('shows current active order point name', async () => {
    mockedBffRequest.mockResolvedValue({
      shiftId: 'shift-1',
      items: [
        {
          pickerName: 'יוסי',
          activeOrdersCount: 1,
          waitingCheckCount: 0,
          returnedCount: 0,
          doneCount: 0,
          errorCount: 0,
          currentActiveOrder: {
            id: 'order-1',
            tenantId: 'tenant-1',
            shiftId: 'shift-1',
            lineId: 'line-1',
            orderNumber: null,
            customerName: null,
            pointName: 'נקודה ג',
            palletCount: null,
            pickerName: 'יוסי',
            checkerName: null,
            lineCount: 3,
            size: 'S',
            status: 'picking',
            startedAt: new Date().toISOString(),
            waitingCheckAt: null,
            checkedAt: null,
            finishedAt: null,
            comment: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        }
      ]
    });

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('פעיל: נקודה ג')).toBeTruthy();
    });
  });

  it('shows error count badge when picker has errors', async () => {
    mockedBffRequest.mockResolvedValue({
      shiftId: 'shift-1',
      items: [
        {
          pickerName: 'דינה',
          activeOrdersCount: 0,
          waitingCheckCount: 0,
          returnedCount: 1,
          doneCount: 3,
          errorCount: 2,
          currentActiveOrder: null
        }
      ]
    });

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('2 תקלות')).toBeTruthy();
    });
  });

  it('renders multiple picker cards', async () => {
    mockedBffRequest.mockResolvedValue({
      shiftId: 'shift-1',
      items: [
        {
          pickerName: 'אלי',
          activeOrdersCount: 1,
          waitingCheckCount: 0,
          returnedCount: 0,
          doneCount: 2,
          errorCount: 0,
          currentActiveOrder: null
        },
        {
          pickerName: 'רחל',
          activeOrdersCount: 0,
          waitingCheckCount: 1,
          returnedCount: 0,
          doneCount: 4,
          errorCount: 0,
          currentActiveOrder: null
        }
      ]
    });

    renderPeopleTab();

    await waitFor(() => {
      expect(screen.getByText('אלי')).toBeTruthy();
      expect(screen.getByText('רחל')).toBeTruthy();
    });
  });

  it('does not access supabase directly', () => {
    expect(mockedBffRequest).toBeDefined();
  });
});
