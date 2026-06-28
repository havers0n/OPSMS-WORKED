// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { SchemeBuilder } from './index';
import { useSchemeBuilderStore } from './scheme-store';

const mockBffRequest = vi.fn();

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: (...args: unknown[]) => mockBffRequest(...args),
  BffRequestError: class BffRequestError extends Error {
    status: number;
    code: string | null;
    requestId: string | null;
    errorId: string | null;
    details: unknown;

    constructor(status: number, code: string | null, message: string, requestId: string | null, errorId: string | null, details: unknown = null) {
      super(message);
      this.status = status;
      this.code = code;
      this.requestId = requestId;
      this.errorId = errorId;
      this.details = details;
    }
  },
}));

const BATCH_ID = 'b0000000-0000-4000-8000-000000000001';
const DRAFT_ID = 'd0000000-0000-4000-8000-000000000001';
const TARGET_SHIFT_ID = 's0000000-0000-4000-8000-000000000001';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function makePreview() {
  return {
    batch: {
      id: BATCH_ID,
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      uploadedAt: '2026-06-24T12:00:00.000Z',
      status: 'ready',
      rowsCount: 2,
      rawRowsCount: 2,
      warningRowsCount: 0,
      errorRowsCount: 0,
      specialFlowRowsCount: 0,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 2,
    },
    summary: {
      rowsCount: 2,
      normalRowsCount: 2,
      specialFlowRowsCount: 0,
      errorRowsCount: 0,
      distributionAreasCount: 1,
      ordersCount: 1,
      skuCount: 2,
      totalQuantity: 30,
    },
    distributionAreas: [
      {
        distributionArea: 'דרום',
        rowsCount: 2,
        ordersCount: 1,
        skuCount: 2,
        totalQuantity: 30,
        specialFlowRowsCount: 0,
        errorRowsCount: 0,
        orders: [
          {
            orderNumber: 'SO-001',
            customerName: 'לקוח א',
            rowsCount: 2,
            skuCount: 2,
            totalQuantity: 30,
            productHandlingFlows: ['regular'],
            issues: [],
            items: [
              {
                rawDemandRowId: 'r0000000-0000-4000-8000-000000000001',
                sku: 'SKU-001',
                description: 'מוצר 1',
                category: 'כללי',
                quantity: 10,
                productHandlingFlow: 'regular',
                planningStatus: 'unplanned',
                issues: [],
              },
              {
                rawDemandRowId: 'r0000000-0000-4000-8000-000000000002',
                sku: 'SKU-002',
                description: 'מוצר 2',
                category: 'כללי',
                quantity: 20,
                productHandlingFlow: 'regular',
                planningStatus: 'unplanned',
                issues: [],
              },
            ],
          },
        ],
        productSummary: [],
        issues: [],
      },
    ],
    specialFlows: [],
    errors: [],
  };
}

function makeDraft(status: 'draft' | 'applied') {
  return {
    draft: {
      id: DRAFT_ID,
      tenantId: 't0000000-0000-4000-8000-000000000001',
      batchId: BATCH_ID,
      status,
      createdBy: null,
      createdAt: '2026-06-24T12:00:00.000Z',
      updatedAt: '2026-06-24T12:00:00.000Z',
    },
    buckets: [
      {
        id: 'b1000000-0000-4000-8000-000000000001',
        tenantId: 't0000000-0000-4000-8000-000000000001',
        draftId: DRAFT_ID,
        batchId: BATCH_ID,
        distributionArea: 'דרום',
        planningLineName: 'קו א',
        bucketName: 'קבוצה א',
        sortOrder: 0,
        createdAt: '2026-06-24T12:00:00.000Z',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
    ],
    allocations: [
      {
        id: 'a1000000-0000-4000-8000-000000000001',
        tenantId: 't0000000-0000-4000-8000-000000000001',
        draftId: DRAFT_ID,
        batchId: BATCH_ID,
        bucketId: 'b1000000-0000-4000-8000-000000000001',
        rawDemandRowId: 'r0000000-0000-4000-8000-000000000001',
        allocatedQuantity: 10,
        createdAt: '2026-06-24T12:00:00.000Z',
        updatedAt: '2026-06-24T12:00:00.000Z',
      },
    ],
  };
}

function installDemandMocks({
  draftStatus = 'draft',
  targetShiftId,
}: {
  draftStatus?: 'draft' | 'applied';
  targetShiftId?: string;
}) {
  mockBffRequest.mockImplementation((url: string, init?: RequestInit) => {
    const path = String(url);

    if (path.includes('/planning-preview')) {
      return Promise.resolve(makePreview());
    }

    if (path.endsWith(`/api/demand-planning-drafts/${DRAFT_ID}`) || path.includes(`/demand-planning-drafts/${DRAFT_ID}`) && !path.includes('/plan') && !path.includes('/publish-to-shift')) {
      return Promise.resolve(makeDraft(draftStatus));
    }

    if (path.includes(`/demand-planning-drafts/${DRAFT_ID}/plan`) && init?.method === 'PUT') {
      return Promise.resolve(makeDraft(draftStatus));
    }

    if (path.includes(`/demand-planning-drafts/${DRAFT_ID}/publish-to-shift`) && init?.method === 'POST') {
      return Promise.resolve({
        draftId: DRAFT_ID,
        shiftId: targetShiftId ?? TARGET_SHIFT_ID,
        createdLines: 1,
        createdOrders: 1,
        createdItems: 2,
        skippedRows: 0,
        warnings: [],
      });
    }

    return Promise.reject(new Error(`Unhandled request: ${path}`));
  });
}

function renderBuilder(targetShiftId?: string, initialEntry = '/operator/manual/lines') {
  const queryClient = makeQueryClient();
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <SchemeBuilder
          mode="demand"
          batchId={BATCH_ID}
          draftId={DRAFT_ID}
          targetDate="2026-07-01"
          targetShiftId={targetShiftId}
        />
        <LocationProbe />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('SchemeBuilder demand lifecycle hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSchemeBuilderStore.getState().clearLocalDraft();
  });

  it('opens applied draft from server in published read-only state', async () => {
    installDemandMocks({ draftStatus: 'applied', targetShiftId: TARGET_SHIFT_ID });
    renderBuilder(TARGET_SHIFT_ID);

    await waitFor(() => {
      expect(screen.getAllByText('פורסם למשמרת').length).toBeGreaterThan(0);
    });

    expect(screen.getByText('טיוטה זו כבר פורסמה למשמרת. העריכה והשמירה מושבתות, ו-append/diff נשארים בזרימה נפרדת.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'שמור טיוטה' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'פרסם למשמרת' })).toBeNull();
  });

  it('does not call PUT /plan in published draft state, including repeated open-work clicks', async () => {
    installDemandMocks({ draftStatus: 'applied', targetShiftId: TARGET_SHIFT_ID });
    renderBuilder(TARGET_SHIFT_ID);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'פתח עבודה' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'פתח עבודה' }));
    fireEvent.click(screen.getByRole('button', { name: 'פתח עבודה' }));

    const planCalls = mockBffRequest.mock.calls.filter(([url, init]) =>
      String(url).includes(`/demand-planning-drafts/${DRAFT_ID}/plan`) && (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(planCalls).toHaveLength(0);
  });

  it('requires targetShiftId before ready-to-publish state exposes publish CTA', async () => {
    installDemandMocks({ draftStatus: 'draft' });
    renderBuilder(undefined);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'שמור טיוטה' })).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'פרסם למשמרת' })).toBeNull();
    expect(screen.getByText('בחר משמרת יעד כדי לאפשר פרסום. append/diff נשאר במסלול נפרד.')).toBeInTheDocument();
  });

  it('navigates to work using targetShiftId', async () => {
    installDemandMocks({ draftStatus: 'applied', targetShiftId: TARGET_SHIFT_ID });
    renderBuilder(TARGET_SHIFT_ID, '/operator/manual/lines?batchId=test&draftId=test&mode=demand');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'פתח עבודה' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'פתח עבודה' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent(`/operator/manual/work?shiftId=${TARGET_SHIFT_ID}`);
    });
  });

  it('keeps mutable draft save and publish flow active', async () => {
    installDemandMocks({ draftStatus: 'draft', targetShiftId: TARGET_SHIFT_ID });
    renderBuilder(TARGET_SHIFT_ID);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'שמור טיוטה' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'פרסם למשמרת' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'פרסם למשמרת' }));

    await waitFor(() => {
      const planCalls = mockBffRequest.mock.calls.filter(([url, init]) =>
        String(url).includes(`/demand-planning-drafts/${DRAFT_ID}/plan`) && (init as RequestInit | undefined)?.method === 'PUT',
      );
      const publishCalls = mockBffRequest.mock.calls.filter(([url, init]) =>
        String(url).includes(`/demand-planning-drafts/${DRAFT_ID}/publish-to-shift`) && (init as RequestInit | undefined)?.method === 'POST',
      );

      expect(planCalls).toHaveLength(1);
      expect(publishCalls).toHaveLength(1);
    });
  });
});
