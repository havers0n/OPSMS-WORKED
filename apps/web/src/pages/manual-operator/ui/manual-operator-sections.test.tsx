import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ManualOperatorPage } from './manual-operator-page';
import { routes } from '@/shared/config/routes';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

let isDesktop = false;

vi.mock('@/shared/hooks/use-media-query', () => ({
  useMediaQuery: () => isDesktop
}));

vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => ({
    currentTenantId: 'tenant-1',
    memberships: [
      {
        tenantId: 'tenant-1',
        tenantCode: 'default',
        tenantName: 'Default',
        role: 'tenant_admin'
      }
    ]
  })
}));

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const shift = {
  id: 'shift-1',
  tenantId: 'tenant-1',
  date: '2026-06-17',
  name: 'Morning Shift',
  status: 'active' as const,
  createdBy: null,
  createdAt: new Date().toISOString(),
  closedAt: null
};

const line = {
  id: 'line-1',
  tenantId: 'tenant-1',
  shiftId: shift.id,
  name: 'Line A',
  sortOrder: 1,
  status: 'open' as const,
  createdAt: new Date().toISOString(),
  deletedAt: null,
  deletedByProfileId: null,
  deletedByName: null,
  deleteReason: null
};

const lineSummary = {
  line,
  totalOrders: 1,
  queuedOrders: 1,
  pickingOrders: 0,
  waitingCheckOrders: 0,
  returnedOrders: 0,
  doneOrders: 0,
  errorCount: 0
};

const waitingOrder = {
  id: 'order-1',
  tenantId: 'tenant-1',
  shiftId: shift.id,
  lineId: line.id,
  orderNumber: '502481',
  customerName: null,
  pointName: 'Point A',
  palletCount: 1,
  pickerName: 'Picker A',
  pickerWorkerId: null,
  checkerName: null,
  lineCount: 5,
  size: 'M',
  status: 'waiting_check' as const,
  startedAt: null,
  waitingCheckAt: new Date().toISOString(),
  checkedAt: null,
  finishedAt: null,
  comment: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
  deletedByProfileId: null,
  deletedByName: null,
  deleteReason: null,
  checkStartedAt: null
};

const workHierarchy = {
  shiftId: shift.id,
  areas: [
    {
      areaName: 'south',
      displayName: 'South',
      totalLines: 1,
      totalBuckets: 1,
      totalOrders: 1,
      totalQuantity: 5,
      statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
      lines: [
        {
          lineId: line.id,
          lineGroupName: line.name,
          distributionArea: 'South',
          status: 'open',
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 5,
          statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
          buckets: [
            {
              bucketName: 'Point A',
              displayName: 'Point A',
              totalOrders: 1,
              totalQuantity: 5,
              statusBreakdown: { queued: 0, picking: 0, waitingCheck: 1, returned: 0, done: 0 },
              orders: [
                {
                  orderId: waitingOrder.id,
                  orderNumber: waitingOrder.orderNumber,
                  customerName: waitingOrder.customerName,
                  pointName: waitingOrder.pointName,
                  status: waitingOrder.status,
                  lineCount: 2,
                  totalQuantity: 5,
                  hasAshlama: false,
                  hasCheckUnits: false
                }
              ]
            }
          ]
        }
      ]
    }
  ]
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={makeQueryClient()}>
        <LocationProbe />
        <ManualOperatorPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

function mockWorkspaceData(options?: {
  lines?: (typeof lineSummary)[];
  daySummary?: Record<string, unknown>;
  orders?: unknown[];
  workers?: unknown[];
  peopleSummaryItems?: unknown[];
}) {
  const lines = options?.lines ?? [lineSummary];
  const daySummary =
    options?.daySummary ??
    ({
      shiftId: shift.id,
      totalOrders: 1,
      queuedOrders: 1,
      pickingOrders: 0,
      waitingCheckOrders: 0,
      returnedOrders: 0,
      doneOrders: 0,
      errorsCount: 0,
      byErrorType: [],
      byLine: lines,
      byPicker: []
    } satisfies Record<string, unknown>);
  const orders = options?.orders ?? [waitingOrder];
  const workers =
    options?.workers ?? [{ id: 'worker-1', name: 'Picker A', role: 'picker', active: true, authUserId: null }];
  const peopleSummaryItems = options?.peopleSummaryItems ?? [];

  mockedBffRequest.mockImplementation((url: string) => {
    const path = String(url);
    if (path.includes('/api/manual-shifts/by-date')) return Promise.resolve({ shift, lines });
    if (path.endsWith(`/api/manual-shifts/${shift.id}/work-hierarchy`)) return Promise.resolve(workHierarchy);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/day-summary`)) return Promise.resolve(daySummary);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/orders`)) return Promise.resolve(orders);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/workers`)) return Promise.resolve(workers);
    if (path.endsWith(`/api/manual-shifts/${shift.id}/people-summary`)) {
      return Promise.resolve({ shiftId: shift.id, items: peopleSummaryItems });
    }
    if (path.endsWith('/api/manual-shifts/worker-bindable-users')) return Promise.resolve([]);
    if (path.includes('/open-ashlamot')) return Promise.resolve([]);
    if (path.includes('/check-units')) return Promise.resolve([]);
    if (path.includes('/ashlamot')) return Promise.resolve([]);
    if (path.endsWith(`/api/manual-shift-lines/${line.id}/orders`)) return Promise.resolve([]);
    return Promise.resolve([]);
  });
}

describe('ManualOperatorPage URL sections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDesktop = false;
  });

  it.each([
    routes.operatorManualWork,
    routes.operatorManualSummary,
    routes.operatorManualCheck,
    routes.operatorManualPeople
  ])('renders %s content', async (path) => {
    mockWorkspaceData();
    renderAt(path);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(path);
    });
  });

  it('mobile bottom nav switches the URL and active section', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualWork);
    });

    fireEvent.click(screen.getByTestId('manual-section-check'));

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualCheck);
    });

    expect(screen.getByTestId('manual-section-check').className).toContain('text-blue-600');
    expect(screen.getByTestId('manual-section-work').className).toContain('text-gray-500');
  });

  it('renders product control for products section without mutating data', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualProducts);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualProducts);
    });

    await waitFor(() => {
      expect(screen.getByText('בקרת מוצרים וחוסרים')).toBeTruthy();
    });
    expect(screen.queryByTestId('manual-placeholder-products')).toBeNull();
    expect(
      mockedBffRequest.mock.calls.some(([, init]) => (init?.method ?? 'GET') !== 'GET')
    ).toBe(false);
  });

  it('still renders placeholders for other unimplemented sections', async () => {
    mockWorkspaceData();
    renderAt(routes.operatorManualAshlamot);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualAshlamot);
    });

    await waitFor(() => {
      expect(screen.getByTestId('manual-placeholder-ashlamot')).toBeTruthy();
    });
    expect(
      mockedBffRequest.mock.calls.some(([, init]) => (init?.method ?? 'GET') !== 'GET')
    ).toBe(false);
  });

  it('falls back from an invalid section to work', async () => {
    mockWorkspaceData();
    renderAt('/operator/manual/not-a-real-section');

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(routes.operatorManualWork);
    });
  });

  it.each([
    routes.operatorManualWork,
    routes.operatorManualSummary,
    routes.operatorManualCheck,
    routes.operatorManualPeople
  ])('desktop renders %s safely', async (path) => {
    isDesktop = true;
    mockWorkspaceData();
    renderAt(path);

    await waitFor(() => {
      expect(screen.getByTestId('location').textContent).toBe(path);
    });
  });

  it('desktop work route requests work hierarchy', async () => {
    isDesktop = true;
    mockWorkspaceData();
    renderAt(routes.operatorManualWork);

    await waitFor(() => {
      expect(mockedBffRequest).toHaveBeenCalledWith(`/api/manual-shifts/${shift.id}/work-hierarchy`);
    });
  });
});
