import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ManualOperatorPage } from './manual-operator-page';
import type { TenantMembership } from '@/shared/api/bff/use-workspace-session';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

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
      lines: [{
        line: {
          id: 'line-1',
          tenantId: 'tenant-1',
          shiftId: 'shift-1',
          name: '????',
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

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('????')).toBeTruthy();
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

  it.each([
    ['closed', {
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
    }],
    ['non-empty', {
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
    }]
  ])('past date with a %s shift hides import actions', async (_label, response) => {
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
});
