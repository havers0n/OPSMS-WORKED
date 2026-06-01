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

    expect(screen.getByRole('button', { name: 'ייבוא אקסל' })).toBeTruthy();
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

    expect(screen.getByRole('button', { name: 'ייבוא אקסל' })).toBeTruthy();
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

    expect(screen.queryByRole('button', { name: 'ייבוא אקסל' })).toBeNull();
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

    expect(screen.queryByRole('button', { name: 'ייבוא אקסל' })).toBeNull();
    expect(screen.getByRole('button', { name: 'הוסף קו ידנית' })).toBeTruthy();
  });

  it('no shift shows explanatory text', async () => {
    mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('No shift')).toBeTruthy();
    });

    expect(screen.getByText('No open shift for today. Open a shift to start the queue.')).toBeTruthy();
  });

  it('opens import sheet from empty queue CTA', async () => {
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
      expect(screen.getByRole('button', { name: 'ייבוא אקסל' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'ייבוא אקסל' }));
    expect(screen.getByText('ייבוא קווים מאקסל')).toBeTruthy();
  });
});
