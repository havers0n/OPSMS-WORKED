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
      expect(screen.getByText('ЧђЧ™Чџ Ч§Ч•Ч•Ч™Чќ Ч‘ЧЄЧ•ЧЁ')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'ЧЄЧ¦Ч•Ч’Ч” ЧћЧ§Ч“Ч™ЧћЧ” Ч—Ч•Ч“Ч©Ч™ЧЄ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ч™Ч™Ч‘Ч•Чђ Ч™Ч•ЧћЧ™ Ч§Ч™Ч™Чќ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ч”Ч•ЧЎЧЈ Ч§Ч• Ч™Ч“Ч Ч™ЧЄ' })).toBeTruthy();
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
      expect(screen.getByText('ЧђЧ™Чџ Ч§Ч•Ч•Ч™Чќ Ч‘ЧЄЧ•ЧЁ')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: 'ЧЄЧ¦Ч•Ч’Ч” ЧћЧ§Ч“Ч™ЧћЧ” Ч—Ч•Ч“Ч©Ч™ЧЄ' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ч™Ч™Ч‘Ч•Чђ Ч™Ч•ЧћЧ™ Ч§Ч™Ч™Чќ' })).toBeTruthy();
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

    expect(screen.queryByRole('button', { name: 'ЧЄЧ¦Ч•Ч’Ч” ЧћЧ§Ч“Ч™ЧћЧ” Ч—Ч•Ч“Ч©Ч™ЧЄ' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ч™Ч™Ч‘Ч•Чђ Ч™Ч•ЧћЧ™ Ч§Ч™Ч™Чќ' })).toBeNull();
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
      expect(screen.getByText('ЧђЧ™Чџ Ч§Ч•Ч•Ч™Чќ Ч‘ЧЄЧ•ЧЁ')).toBeTruthy();
    });

    expect(screen.queryByRole('button', { name: 'ЧЄЧ¦Ч•Ч’Ч” ЧћЧ§Ч“Ч™ЧћЧ” Ч—Ч•Ч“Ч©Ч™ЧЄ' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ч™Ч™Ч‘Ч•Чђ Ч™Ч•ЧћЧ™ Ч§Ч™Ч™Чќ' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ч”Ч•ЧЎЧЈ Ч§Ч• Ч™Ч“Ч Ч™ЧЄ' })).toBeTruthy();
  });

  it('no shift shows explanatory text', async () => {
    mockedBffRequest.mockResolvedValue({ shift: null, lines: [] });

    renderPage(makeQueryClient());

    await waitFor(() => {
      expect(screen.getByText('ЧђЧ™Чџ ЧћЧ©ЧћЧЁЧЄ')).toBeTruthy();
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
      expect(screen.getByRole('button', { name: 'Ч™Ч™Ч‘Ч•Чђ Ч™Ч•ЧћЧ™ Ч§Ч™Ч™Чќ' })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Ч™Ч™Ч‘Ч•Чђ Ч™Ч•ЧћЧ™ Ч§Ч™Ч™Чќ' }));
    expect(screen.getByText('Ч™Ч™Ч‘Ч•Чђ Ч§Ч•Ч•Ч™Чќ ЧћЧђЧ§ЧЎЧњ')).toBeTruthy();
  });
});
