import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ManualOperatorPage } from './manual-operator-page';
import type { TenantMembership } from '@/shared/api/bff/use-workspace-session';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

let desktopOverride = false;
vi.mock('@/shared/hooks/use-media-query', () => ({
  useMediaQuery: () => desktopOverride,
}));

let authState: { currentTenantId: string | null; memberships: TenantMembership[] } = {
  currentTenantId: 'tenant-1',
  memberships: [{
    tenantId: 'tenant-1',
    tenantCode: 'default',
    tenantName: 'Default',
    role: 'tenant_admin'
  }]
};

vi.mock('@/app/providers/auth-provider', () => ({
  useAuth: () => authState
}));

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

function todayIsrael(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
  });
}

function renderPage(queryClient: QueryClient) {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ManualOperatorPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

async function selectMobileDate(date: string) {
  fireEvent.click(screen.getByRole('button', { name: 'בחר תאריך' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: date })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole('button', { name: date }));
}

describe('ManualOperatorPage queue import placement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    desktopOverride = false;
    localStorage.clear();
    authState = {
      currentTenantId: 'tenant-1',
      memberships: [{
        tenantId: 'tenant-1',
        tenantCode: 'default',
        tenantName: 'Default',
        role: 'tenant_admin'
      }]
    };
  });

  it('empty queue with active shift shows import and manual actions for tenant_admin', async () => {
    mockedBffRequest.mockResolvedValue({
      shift: {
        id: 'shift-1',
        tenantId: 'tenant-1',
        date: todayIsrael(),
        name: 'Shift',
        status: 'active',
        createdBy: null,
        createdAt: new Date().toISOString(),
        closedAt: null
      },
      lines: []
    });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('אין קווים בתור')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'תצוגה מקדימה חודשית' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ייבוא יומי קיים' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'הוסף קו ידנית' })).toBeTruthy();
  });

  it('empty queue with active shift shows import for platform_admin', async () => {
    authState = {
      currentTenantId: 'tenant-1',
      memberships: [{
        tenantId: 'tenant-1',
        tenantCode: 'default',
        tenantName: 'Default',
        role: 'platform_admin'
      }]
    };
    mockedBffRequest.mockResolvedValue({
      shift: {
        id: 'shift-1',
        tenantId: 'tenant-1',
        date: '2026-06-01',
        name: 'Shift',
        status: 'active',
        createdBy: null,
        createdAt: new Date().toISOString(),
        closedAt: null
      },
      lines: []
    });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('אין קווים בתור')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'תצוגה מקדימה חודשית' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ייבוא יומי קיים' })).toBeTruthy();
  });

  it('non-empty queue hides Import Excel CTA', async () => {
    mockedBffRequest.mockImplementation((url: string) => {
      if (String(url).includes('/monthly-replace-safety')) {
        return Promise.resolve({
          canReplace: true,
          activeLinesCount: 1,
          activeOrdersCount: 2,
          startedOrdersCount: 0,
          assignedPickersCount: 0,
          assignedCheckersCount: 0,
          checkUnitsCount: 0,
          nonImportEventsCount: 0,
          blockReasons: []
        });
      }

      if (String(url).includes('/api/manual-shifts/by-date')) {
        return Promise.resolve({
          shift: {
            id: 'shift-1',
            tenantId: 'tenant-1',
            date: '2026-06-20',
            name: 'Shift',
            status: 'active',
            createdBy: null,
            createdAt: new Date().toISOString(),
            closedAt: null
          },
          lines: [{
            line: {
              id: 'line-1',
              tenantId: 'tenant-1',
              shiftId: 'shift-1',
              name: 'Line 1',
              sortOrder: 1,
              status: 'open',
              createdAt: new Date().toISOString(),
              deletedAt: null,
              deletedByProfileId: null,
              deletedByName: null,
              deleteReason: null
            },
            totalOrders: 2,
            queuedOrders: 2,
            pickingOrders: 0,
            waitingCheckOrders: 0,
            returnedOrders: 0,
            doneOrders: 0,
            errorCount: 0
          }]
        });
      }

      return Promise.resolve({ shift: null, lines: [] });
    });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('Line 1')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'תצוגה מקדימה חודשית' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ייבוא יומי קיים' })).toBeNull();
  });

  it('operator membership hides Import Excel but keeps manual action', async () => {
    authState = {
      currentTenantId: 'tenant-1',
      memberships: [{
        tenantId: 'tenant-1',
        tenantCode: 'default',
        tenantName: 'Default',
        role: 'operator'
      }]
    };
    mockedBffRequest.mockResolvedValue({
      shift: {
        id: 'shift-1',
        tenantId: 'tenant-1',
        date: todayIsrael(),
        name: 'Shift',
        status: 'active',
        createdBy: null,
        createdAt: new Date().toISOString(),
        closedAt: null
      },
      lines: []
    });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('אין קווים בתור')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'תצוגה מקדימה חודשית' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'ייבוא יומי קיים' })).toBeNull();
    expect(screen.getByRole('button', { name: 'הוסף קו ידנית' })).toBeTruthy();
  });

  it.skip('no shift shows explanatory text', async () => {
    mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('אין משמרת')).toBeTruthy();
    });

    expect(screen.getByText('אין משמרת פתוחה להיום. פתח משמרת כדי להתחיל בתור.')).toBeTruthy();
  });

  it('opens daily import sheet from empty queue CTA', async () => {
    mockedBffRequest.mockResolvedValue({
      shift: {
        id: 'shift-1',
        tenantId: 'tenant-1',
        date: '2026-06-01',
        name: 'Shift',
        status: 'active',
        createdBy: null,
        createdAt: new Date().toISOString(),
        closedAt: null
      },
      lines: []
    });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'ייבוא יומי קיים' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'ייבוא יומי קיים' }));
    expect(screen.getByText('ייבוא קווים מאקסל')).toBeTruthy();
  });

  it('past date with an active empty shift shows import actions but not manual add', async () => {
    mockedBffRequest.mockImplementation((url: string) => {
      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-14')) {
        return Promise.resolve({
          shift: {
            id: 'shift-past',
            tenantId: 'tenant-1',
            date: '2026-06-14',
            name: 'Shift',
            status: 'active',
            createdBy: null,
            createdAt: new Date().toISOString(),
            closedAt: null
          },
          lines: []
        });
      }

      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-15')) {
        return Promise.resolve({ shift: null, lines: [] });
      }

      return Promise.resolve({ shift: null, lines: [] });
    });

    renderPage(makeQueryClient());

    await selectMobileDate('2026-06-14');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'תצוגה מקדימה חודשית' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'ייבוא יומי קיים' })).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'הוסף קו ידנית' })).toBeNull();
  });

it('past date with a closed shift hides import actions', async () => {
    const response = {
      shift: {
        id: 'shift-closed',
        tenantId: 'tenant-1',
        date: '2026-06-14',
        name: 'Shift',
        status: 'closed',
        createdBy: null,
        createdAt: new Date().toISOString(),
        closedAt: new Date().toISOString()
      },
      lines: []
    };

    mockedBffRequest.mockImplementation((url: string) => {
      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-14')) {
        return Promise.resolve(response);
      }

      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-15')) {
        return Promise.resolve({ shift: null, lines: [] });
      }

      return Promise.resolve({ shift: null, lines: [] });
    });

    renderPage(makeQueryClient());

    await selectMobileDate('2026-06-14');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'תצוגה מקדימה חודשית' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'ייבוא יומי קיים' })).toBeNull();
    });
  });

  it('active non-empty shift shows re-import option', async () => {
    const response = {
      shift: {
        id: 'shift-non-empty',
        tenantId: 'tenant-1',
        date: '2026-06-14',
        name: 'Shift',
        status: 'active',
        createdBy: null,
        createdAt: new Date().toISOString(),
        closedAt: null
      },
      lines: [
        {
          line: {
            id: 'line-1',
            tenantId: 'tenant-1',
            shiftId: 'shift-non-empty',
            name: 'Line',
            sortOrder: 1,
            status: 'open',
            createdAt: new Date().toISOString(),
            deletedAt: null,
            deletedByProfileId: null,
            deletedByName: null,
            deleteReason: null
          },
          totalOrders: 1,
          queuedOrders: 1,
          pickingOrders: 0,
          waitingCheckOrders: 0,
          returnedOrders: 0,
          doneOrders: 0,
          errorCount: 0
        }
      ]
    };

    mockedBffRequest.mockImplementation((url: string) => {
      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-14')) {
        return Promise.resolve(response);
      }

      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-15')) {
        return Promise.resolve({ shift: null, lines: [] });
      }

      if (String(url).includes('/monthly-replace-safety')) {
        return Promise.resolve({
          canReplace: true,
          activeLinesCount: 1,
          activeOrdersCount: 1,
          startedOrdersCount: 0,
          assignedPickersCount: 0,
          assignedCheckersCount: 0,
          checkUnitsCount: 0,
          nonImportEventsCount: 0,
          blockReasons: []
        });
      }

      return Promise.resolve({ shift: null, lines: [] });
    });

    renderPage(makeQueryClient());

    await selectMobileDate('2026-06-14');

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /ייבוא מחדש והחלפת עבודה קיימת/ })).toBeTruthy();
    });
  });

  describe('demand planning last context', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      desktopOverride = true;
      authState = {
        currentTenantId: 'tenant-1',
        memberships: [{
          tenantId: 'tenant-1',
          tenantCode: 'default',
          tenantName: 'Default',
          role: 'tenant_admin'
        }]
      };
      mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });
    });

    function renderAt(initialUrl: string) {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
      });
      return render(
        <MemoryRouter initialEntries={[initialUrl]}>
          <QueryClientProvider client={qc}>
            <ManualOperatorPage />
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    it('shows resume banner in normal lines mode when saved demand context exists', async () => {
      localStorage.setItem('wos:demand-planning:last-context', JSON.stringify({
        mode: 'demand',
        batchId: 'batch-999',
        draftId: 'draft-888',
        url: '/operator/manual/lines?batchId=batch-999&draftId=draft-888&mode=demand',
        savedAt: new Date().toISOString(),
        sourceFile: 'test.xlsx',
        sourceSheet: 'DataSheet',
      }));

      renderAt('/operator/manual/lines?date=2026-06-27');

      await waitFor(() => {
        expect(screen.getByText('יש טיוטת DataSheet פעילה')).toBeTruthy();
      });
      expect(screen.getByText((content) => content.includes('test.xlsx'))).toBeTruthy();
      expect(screen.getByText('פתח טיוטה')).toBeTruthy();
      expect(screen.getByText('בטל')).toBeTruthy();
    });

    it('does not show resume banner in demand mode', async () => {
      localStorage.setItem('wos:demand-planning:last-context', JSON.stringify({
        mode: 'demand',
        batchId: 'batch-999',
        draftId: 'draft-888',
        url: '/operator/manual/lines?batchId=batch-999&draftId=draft-888&mode=demand',
        savedAt: new Date().toISOString(),
      }));

      renderAt('/operator/manual/lines?batchId=batch-999&draftId=draft-888&mode=demand');

      await waitFor(() => {
        expect(screen.getByTestId('manual-section-switcher-trigger')).toBeTruthy();
      });
      expect(screen.queryByText('יש טיוטת DataSheet פעילה')).toBeNull();
    });

    it('does not show resume banner when no saved context', async () => {
      renderAt('/operator/manual/lines?date=2026-06-27');

      await waitFor(() => {
        expect(screen.getByTestId('manual-section-switcher-trigger')).toBeTruthy();
      });
      expect(screen.queryByText('יש טיוטת DataSheet פעילה')).toBeNull();
    });

    it('shows append button in demand mode when targetDate shift is available', async () => {
      mockedBffRequest.mockImplementation((url: string) => {
        if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-27')) {
          return Promise.resolve({
            shift: {
              id: 'shift-demand',
              tenantId: 'tenant-1', date: '2026-06-27', name: 'Shift', status: 'active',
              createdBy: null, createdAt: new Date().toISOString(), closedAt: null,
            },
            lines: []
          });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-999', sourceFile: 'test.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 0 },
            summary: { rowsCount: 0, normalRowsCount: 0, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 0, ordersCount: 0, skuCount: 0, totalQuantity: 0 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-888', tenantId: 'tenant-1', batchId: 'batch-999', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve({ shift: null, lines: [] });
      });

      renderAt('/operator/manual/lines?batchId=batch-999&draftId=draft-888&mode=demand&targetDate=2026-06-27');

      await waitFor(() => {
        expect(screen.getByText('בדוק התאמה למשמרת')).toBeTruthy();
      });
    });

    it('shows target date prompt when no targetDate in demand mode', async () => {
      renderAt('/operator/manual/lines?batchId=batch-999&draftId=draft-888&mode=demand');

      await waitFor(() => {
        expect(screen.getByText('בחר תאריך עבודה')).toBeTruthy();
      });
    });

    it('clears saved context when dismiss button is clicked', async () => {
      localStorage.setItem('wos:demand-planning:last-context', JSON.stringify({
        mode: 'demand',
        batchId: 'batch-999',
        draftId: 'draft-888',
        url: '/operator/manual/lines?batchId=batch-999&draftId=draft-888&mode=demand',
        savedAt: new Date().toISOString(),
      }));

      renderAt('/operator/manual/lines?date=2026-06-27');

      await waitFor(() => {
        expect(screen.getByText('בטל')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('בטל'));
      expect(localStorage.getItem('wos:demand-planning:last-context')).toBeNull();
    });
  });

  it('no shift on a past date shows create CTA and sends the selected date when creating', async () => {
    const createShiftResponse = {
      id: 'shift-created',
      tenantId: 'tenant-1',
      date: '2026-06-14',
      name: 'Shift',
      status: 'active',
      createdBy: null,
      createdAt: new Date().toISOString(),
      closedAt: null
    };

    mockedBffRequest.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-14')) {
        return Promise.resolve({ shift: null, lines: [] });
      }

      if (String(url).includes('/api/manual-shifts/by-date?date=2026-06-15')) {
        return Promise.resolve({ shift: null, lines: [] });
      }

      if (String(url).includes('/api/manual-shifts') && init?.method === 'POST') {
        return Promise.resolve(createShiftResponse);
      }

      return Promise.resolve({ shift: null, lines: [] });
    });

    renderPage(makeQueryClient());

    await selectMobileDate('2026-06-14');

    const createButton = await screen.findByRole('button', { name: /פתח משמרת לתאריך זה/ });
    fireEvent.click(createButton);

    await waitFor(() => {
      const postCall = mockedBffRequest.mock.calls.find(
        ([url, init]) =>
          String(url).includes('/api/manual-shifts') &&
          (init as RequestInit | undefined)?.method === 'POST'
      );
      expect(postCall).toBeTruthy();
      const body = JSON.parse((postCall![1] as RequestInit).body as string);
      expect(body.date).toBe('2026-06-14');
    });
  });

  describe('targetDate in demand mode', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      localStorage.clear();
      desktopOverride = true;
      authState = {
        currentTenantId: 'tenant-1',
        memberships: [{
          tenantId: 'tenant-1',
          tenantCode: 'default',
          tenantName: 'Default',
          role: 'tenant_admin'
        }]
      };
    });

    function mockNoShift() {
      mockedBffRequest.mockImplementation((url: string) => {
        if (String(url).includes('/api/manual-shifts/by-date')) {
          return Promise.resolve({ shift: null, lines: [] });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-demand-1', sourceFile: 'data.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 5 },
            summary: { rowsCount: 5, normalRowsCount: 5, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 1, ordersCount: 2, skuCount: 3, totalQuantity: 100 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-demand-1', tenantId: 'tenant-1', batchId: 'batch-demand-1', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve([]);
      });
    }

    function mockShiftExists(shiftId: string, date: string) {
      mockedBffRequest.mockImplementation((url: string) => {
        if (String(url).includes(`/api/manual-shifts/by-date?date=${date}`)) {
          return Promise.resolve({
            shift: { id: shiftId, tenantId: 'tenant-1', date, name: 'Target Shift', status: 'active', createdBy: null, createdAt: new Date().toISOString(), closedAt: null },
            lines: []
          });
        }
        if (String(url).includes('/api/manual-shifts/by-date') && !String(url).includes(date)) {
          return Promise.resolve({ shift: null, lines: [] });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-demand-1', sourceFile: 'data.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 5 },
            summary: { rowsCount: 5, normalRowsCount: 5, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 1, ordersCount: 2, skuCount: 3, totalQuantity: 100 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-demand-1', tenantId: 'tenant-1', batchId: 'batch-demand-1', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve([]);
      });
    }

    function renderAt(initialUrl: string) {
      const qc = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
      });
      return render(
        <MemoryRouter initialEntries={[initialUrl]}>
          <QueryClientProvider client={qc}>
            <ManualOperatorPage />
          </QueryClientProvider>
        </MemoryRouter>
      );
    }

    it('demand mode without targetDate shows בחר תאריך עבודה prompt', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand');

      await waitFor(() => {
        expect(screen.getByText('בחר תאריך עבודה')).toBeTruthy();
      });
    });

    it('demand mode without targetDate shows select date CTA button', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'בחר תאריך עבודה' })).toBeTruthy();
      });
    });

    it('append button disabled when no targetDate', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand');

      await waitFor(() => {
        expect(screen.getByText('בחר תאריך עבודה')).toBeTruthy();
      });

      expect(screen.queryByText('בדוק התאמה למשמרת')).toBeNull();
      expect(screen.queryByText('בדוק התאמה למשמרת')).toBeNull();
    });

    it('targetDate selected but no shift shows אין משמרת לתאריך הזה', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('אין משמרת לתאריך הזה')).toBeTruthy();
      });
    });

    it('create/open shift CTA appears when targetDate has no shift', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'פתח צור משמרת לתאריך' })).toBeTruthy();
      });
    });

    it('no shift is created automatically on render (no POST to manual-shifts)', async () => {
      const postFn = vi.fn();
      mockedBffRequest.mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes('/api/manual-shifts') && init?.method === 'POST') {
          postFn();
          return Promise.resolve({ id: 'shift-auto', tenantId: 'tenant-1', date: '2026-07-01', name: 'Auto Shift', status: 'active', createdBy: null, createdAt: new Date().toISOString(), closedAt: null });
        }
        if (String(url).includes('/api/manual-shifts/by-date')) {
          return Promise.resolve({ shift: null, lines: [] });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-demand-1', sourceFile: 'data.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 5 },
            summary: { rowsCount: 5, normalRowsCount: 5, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 1, ordersCount: 2, skuCount: 3, totalQuantity: 100 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-demand-1', tenantId: 'tenant-1', batchId: 'batch-demand-1', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve([]);
      });

      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('אין משמרת לתאריך הזה')).toBeTruthy();
      });

      expect(postFn).not.toHaveBeenCalled();
    });

    it('create shift CTA calls POST with targetDate on explicit click', async () => {
      const createShiftResponse = { id: 'shift-new', tenantId: 'tenant-1', date: '2026-07-01', name: 'New Shift', status: 'active', createdBy: null, createdAt: new Date().toISOString(), closedAt: null };

      mockedBffRequest.mockImplementation((url: string, init?: RequestInit) => {
        if (String(url).includes('/api/manual-shifts') && init?.method === 'POST') {
          return Promise.resolve(createShiftResponse);
        }
        if (String(url).includes('/api/manual-shifts/by-date')) {
          return Promise.resolve({ shift: null, lines: [] });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-demand-1', sourceFile: 'data.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 5 },
            summary: { rowsCount: 5, normalRowsCount: 5, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 1, ordersCount: 2, skuCount: 3, totalQuantity: 100 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-demand-1', tenantId: 'tenant-1', batchId: 'batch-demand-1', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve([]);
      });

      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'פתח צור משמרת לתאריך' })).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: 'פתח צור משמרת לתאריך' }));

      await waitFor(() => {
        const postCall = mockedBffRequest.mock.calls.find(
          ([url, init]) =>
            String(url).includes('/api/manual-shifts') &&
            (init as RequestInit | undefined)?.method === 'POST'
        );
        expect(postCall).toBeTruthy();
        const body = JSON.parse((postCall![1] as RequestInit).body as string);
        expect(body.date).toBe('2026-07-01');
      });
    });

    it('append button disabled when targetDate exists but no shift', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('אין משמרת לתאריך הזה')).toBeTruthy();
      });

      expect(screen.queryByText('בדוק התאמה למשמרת')).toBeNull();
      expect(screen.queryByText('בדוק התאמה למשמרת')).toBeNull();
    });

    it('append button enabled when targetDate has a shift', async () => {
      mockShiftExists('shift-target-1', '2026-07-01');
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('בדוק התאמה למשמרת')).toBeTruthy();
      });

      expect(screen.queryByText('משמרת פעילה נמצאה')).toBeNull();
    });

    it('append button navigates to append mode URL', async () => {
      mockShiftExists('shift-target-1', '2026-07-01');
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('בדוק התאמה למשמרת')).toBeTruthy();
      });

      fireEvent.click(screen.getByText('בדוק התאמה למשמרת'));

      await waitFor(() => {
        expect(screen.getByText('הוספת ביקוש גולמי לקווים קיימים')).toBeTruthy();
      });
    });

    it('demand mode renders DemandTargetDateSelector header when params present', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand');

      await waitFor(() => {
        expect(screen.getByText('בחר תאריך עבודה')).toBeTruthy();
      });

      expect(screen.getByRole('button', { name: 'בחר תאריך עבודה' })).toBeTruthy();
    });

    it('normal date mode rendering does not clear demand context from header', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand');

      await waitFor(() => {
        expect(screen.getByText('בחר תאריך עבודה')).toBeTruthy();
      });
    });

    it('opening target date picker in demand mode shows calendar with selectable dates', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'בחר תאריך עבודה' })).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: 'בחר תאריך עבודה' }));

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'בחר תאריך' })).toBeTruthy();
      });
    });

    it('selecting a future date as targetDate shows no-shift state and preserves demand context in URL', async () => {
      mockNoShift();
      const tomorrow = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date(Date.now() + 86400000));

      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'בחר תאריך עבודה' })).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: 'בחר תאריך עבודה' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: tomorrow })).toBeTruthy();
      });

      expect(screen.getByRole('button', { name: tomorrow })).not.toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: tomorrow }));

      await waitFor(() => {
        expect(screen.getByText('אין משמרת לתאריך הזה')).toBeTruthy();
      });

      expect(screen.getByRole('button', { name: 'פתח צור משמרת לתאריך' })).toBeTruthy();
    });

    it('append button works when targetDate has a shift (no regression)', async () => {
      mockShiftExists('shift-target-1', '2026-07-01');
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('בדוק התאמה למשמרת')).toBeTruthy();
      });

      expect(screen.queryByText('משמרת פעילה נמצאה')).toBeNull();
    });

    function mockShiftWithLines(shiftId: string, date: string) {
      mockedBffRequest.mockImplementation((url: string) => {
        if (String(url).includes(`/api/manual-shifts/by-date?date=${date}`)) {
          return Promise.resolve({
            shift: { id: shiftId, tenantId: 'tenant-1', date, name: 'Target Shift', status: 'active', createdBy: null, createdAt: new Date().toISOString(), closedAt: null },
            lines: [{
              line: { id: 'line-1', tenantId: 'tenant-1', shiftId, name: 'Line 1', sortOrder: 1, status: 'open', createdAt: new Date().toISOString(), deletedAt: null, deletedByProfileId: null, deletedByName: null, deleteReason: null },
              totalOrders: 2, queuedOrders: 2, pickingOrders: 0, waitingCheckOrders: 0, returnedOrders: 0, doneOrders: 0, errorCount: 0
            }]
          });
        }
        if (String(url).includes('/api/manual-shifts/by-date') && !String(url).includes(date)) {
          return Promise.resolve({ shift: null, lines: [] });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-demand-1', sourceFile: 'data.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 5 },
            summary: { rowsCount: 5, normalRowsCount: 5, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 1, ordersCount: 2, skuCount: 3, totalQuantity: 100 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-demand-1', tenantId: 'tenant-1', batchId: 'batch-demand-1', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve([]);
      });
    }

    it('CTA shows "בדוק התאמה למשמרת" when target shift has lines', async () => {
      mockShiftWithLines('shift-with-lines', '2026-07-05');
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-05');

      await waitFor(() => {
        expect(screen.getByText('בדוק התאמה למשמרת')).toBeTruthy();
      });
    });

    it('CTA shows "בדוק התאמה למשמרת" when target shift exists with no lines', async () => {
      mockShiftExists('shift-no-lines', '2026-07-10');
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-10');

      await waitFor(() => {
        expect(screen.getByText('בדוק התאמה למשמרת')).toBeTruthy();
      });
    });

    it('demand mode with stale shiftId renders demand context and target date query independently', async () => {
      const staleShift = { id: 'STALE_SHIFT', tenantId: 'tenant-1', date: '2026-06-01', name: 'Stale Shift', status: 'active', createdBy: null, createdAt: new Date().toISOString(), closedAt: null };
      mockedBffRequest.mockImplementation((url: string) => {
        if (String(url).includes('/api/manual-shifts/STALE_SHIFT')) {
          return Promise.resolve({ shift: staleShift, lines: [] });
        }
        if (String(url).includes('/api/manual-shifts/by-date')) {
          return Promise.resolve({ shift: null, lines: [] });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-demand-1', sourceFile: 'data.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 5 },
            summary: { rowsCount: 5, normalRowsCount: 5, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 1, ordersCount: 2, skuCount: 3, totalQuantity: 100 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-demand-1', tenantId: 'tenant-1', batchId: 'batch-demand-1', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve({ shift: null, lines: [] });
      });

      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01&shiftId=STALE_SHIFT');

      await waitFor(() => {
        expect(screen.getByText('תכנון ביקוש גולמי מ-DataSheet')).toBeTruthy();
      });

      expect(screen.getByText('אין משמרת לתאריך הזה')).toBeTruthy();
    });

    it('selecting a new targetDate preserves demand context and clears shiftId', async () => {
      const staleShift = { id: 'STALE_SHIFT', tenantId: 'tenant-1', date: '2026-06-01', name: 'Stale Shift', status: 'active', createdBy: null, createdAt: new Date().toISOString(), closedAt: null };
      mockedBffRequest.mockImplementation((url: string) => {
        if (String(url).includes('/api/manual-shifts/STALE_SHIFT')) {
          return Promise.resolve({ shift: staleShift, lines: [] });
        }
        if (String(url).includes('/api/manual-shifts/by-date')) {
          return Promise.resolve({ shift: null, lines: [] });
        }
        if (String(url).includes('/planning-preview')) {
          return Promise.resolve({
            batch: { id: 'batch-demand-1', sourceFile: 'data.xlsx', sourceSheet: 'DataSheet', status: 'ready', rowsCount: 5 },
            summary: { rowsCount: 5, normalRowsCount: 5, specialFlowRowsCount: 0, errorRowsCount: 0, distributionAreasCount: 1, ordersCount: 2, skuCount: 3, totalQuantity: 100 },
            distributionAreas: [], specialFlows: [], errors: []
          });
        }
        if (String(url).includes('/demand-planning-drafts/')) {
          return Promise.resolve({ draft: { id: 'draft-demand-1', tenantId: 'tenant-1', batchId: 'batch-demand-1', status: 'draft', createdBy: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, buckets: [], allocations: [] });
        }
        return Promise.resolve({ shift: null, lines: [] });
      });

      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&shiftId=STALE_SHIFT');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'בחר תאריך עבודה' })).toBeTruthy();
      });

      fireEvent.click(screen.getByRole('button', { name: 'בחר תאריך עבודה' }));

      const tomorrow = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(new Date(Date.now() + 86400000));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: tomorrow })).toBeTruthy();
      });

      expect(screen.getByRole('button', { name: tomorrow })).not.toBeDisabled();

      fireEvent.click(screen.getByRole('button', { name: tomorrow }));

      await waitFor(() => {
        expect(screen.getByText('אין משמרת לתאריך הזה')).toBeTruthy();
      });

      expect(screen.getByText('תכנון ביקוש גולמי מ-DataSheet')).toBeTruthy();
    });

    it('shifts to demand-planning-preview query is not filtered by targetDate', async () => {
      mockNoShift();
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('אין משמרת לתאריך הזה')).toBeTruthy();
      });

      const planningPreviewCalls = mockedBffRequest.mock.calls.filter(
        ([url]) => String(url).includes('/planning-preview')
      );
      const targetDateFilteredCalls = planningPreviewCalls.filter(
        ([url]) => String(url).includes('targetDate')
      );
      expect(targetDateFilteredCalls.length).toBe(0);
    });

    it('normal date picker behavior unchanged when targetDate is not set', async () => {
      mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

      renderAt('/operator/manual/lines?date=2026-06-14');

      await waitFor(() => {
        expect(screen.getByTestId('manual-section-switcher-trigger')).toBeTruthy();
      });
    });

    it('"משמרת פעילה נמצאה" badge is not rendered when target shift exists', async () => {
      mockShiftExists('shift-target-1', '2026-07-01');
      renderAt('/operator/manual/lines?batchId=batch-demand-1&draftId=draft-demand-1&mode=demand&targetDate=2026-07-01');

      await waitFor(() => {
        expect(screen.getByText('בדוק התאמה למשמרת')).toBeTruthy();
      });

      expect(screen.queryByText('משמרת פעילה נמצאה')).toBeNull();
    });
  });
});
