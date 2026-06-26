// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AppendModePanel } from './append-mode-panel';

const mockBffRequest = vi.fn();

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: (...args: unknown[]) => mockBffRequest(...args)
}));

const mockAppendDiffResponse = {
  batchId: 'batch-1',
  shiftId: 'shift-1',
  existingLines: [
    { lineId: 'line-1', lineName: 'Line A', distributionArea: 'דרום', status: 'open' }
  ],
  summary: {
    totalRows: 20,
    newRows: 10,
    alreadyExistsRows: 5,
    quantityChangedRows: 3,
    duplicateRows: 1,
    specialFlowRows: 2,
    requiresReviewRows: 4,
    newOrders: 6
  },
  newOrders: [
    {
      orderKey: 'order-1',
      orderNumber: 'SO-001',
      customerName: 'Customer A',
      distributionArea: 'דרום',
      classification: 'new' as const,
      rows: [
        { rawDemandRowId: 'row-1', sourceRowNumber: 1, orderNumber: 'SO-001', customerName: 'Customer A', sku: 'SKU-1', description: 'Product 1', quantity: 10, distributionArea: 'דרום', classification: 'new' as const, suggestedLineId: 'line-1', suggestedLineName: 'Line A' }
      ],
      suggestedLineId: 'line-1',
      suggestedLineName: 'Line A',
      totalQuantity: 10
    }
  ],
  alreadyExistsOrders: [
    {
      orderKey: 'order-2',
      orderNumber: 'SO-002',
      customerName: 'Customer B',
      distributionArea: 'צפון',
      classification: 'already_exists' as const,
      rows: [
        { rawDemandRowId: 'row-2', sourceRowNumber: 2, orderNumber: 'SO-002', customerName: 'Customer B', sku: 'SKU-2', description: 'Product 2', quantity: 5, distributionArea: 'צפון', classification: 'already_exists' as const, suggestedLineId: null, suggestedLineName: null }
      ],
      suggestedLineId: null,
      suggestedLineName: null,
      totalQuantity: 5
    }
  ],
  quantityChangedOrders: [],
  duplicateOrders: [],
  specialFlowOrders: [],
  requiresReviewOrders: []
};

const mockWorkHierarchy = {
  shiftId: 'shift-1',
  areas: [
    {
      areaName: 'דרום',
      displayName: 'דרום',
      totalLines: 1,
      totalBuckets: 1,
      totalOrders: 1,
      totalQuantity: 10,
      statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
      lines: [
        {
          lineId: 'line-1',
          lineGroupName: 'Line A',
          distributionArea: 'דרום',
          status: 'open',
          totalBuckets: 1,
          totalOrders: 1,
          totalQuantity: 10,
          statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
          buckets: [
            {
              bucketName: 'Bucket 1',
              displayName: 'Bucket 1',
              totalOrders: 1,
              totalQuantity: 10,
              statusBreakdown: { queued: 1, picking: 0, waitingCheck: 0, returned: 0, done: 0 },
              orders: [
                {
                  orderId: 'order-1',
                  orderNumber: 'SO-001',
                  customerName: 'Customer A',
                  pointName: 'Point A',
                  status: 'queued',
                  lineCount: 1,
                  totalQuantity: 10,
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

const mockPlanningPreview = {
  batch: {
    id: 'batch-1',
    sourceFile: 'datasheet.xlsx',
    sourceSheet: 'DataSheet',
    status: 'ready',
    rowsCount: 20
  },
  summary: {
    rowsCount: 20,
    normalRowsCount: 18,
    specialFlowRowsCount: 2,
    errorRowsCount: 0,
    distributionAreasCount: 2,
    ordersCount: 6,
    skuCount: 10,
    totalQuantity: 150
  },
  distributionAreas: [],
  specialFlows: [],
  errors: []
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
}

function renderPanel(shiftId = 'shift-1', batchId = 'batch-1') {
  return render(
    <MemoryRouter>
      <QueryClientProvider client={makeQueryClient()}>
        <AppendModePanel shiftId={shiftId} batchId={batchId} />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

describe('AppendModePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockBffRequest.mockReturnValue(new Promise(() => {}));
    renderPanel();
    expect(screen.getByText('טוען נתוני הוספה...')).toBeTruthy();
  });

  it('shows error state on fetch failure', async () => {
    mockBffRequest.mockRejectedValue(new Error('Network error'));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText('שגיאה בטעינת נתונים')).toBeTruthy();
    });
  });

  it('renders header with append mode title', async () => {
    mockBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/work-hierarchy')) return Promise.resolve(mockWorkHierarchy);
      if (path.includes('/append-diff')) return Promise.resolve(mockAppendDiffResponse);
      if (path.includes('/planning-preview')) return Promise.resolve(mockPlanningPreview);
      return Promise.resolve({});
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('הוספת ביקוש גולמי לקווים קיימים')).toBeTruthy();
    });
  });

  it('shows batch source info when available', async () => {
    mockBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/work-hierarchy')) return Promise.resolve(mockWorkHierarchy);
      if (path.includes('/append-diff')) return Promise.resolve(mockAppendDiffResponse);
      if (path.includes('/planning-preview')) return Promise.resolve(mockPlanningPreview);
      return Promise.resolve({});
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('מקור: datasheet.xlsx ← DataSheet | סטטוס: ready')).toBeTruthy();
    });
  });

  it('shows summary cards for each classification', async () => {
    mockBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/work-hierarchy')) return Promise.resolve(mockWorkHierarchy);
      if (path.includes('/append-diff')) return Promise.resolve(mockAppendDiffResponse);
      if (path.includes('/planning-preview')) return Promise.resolve(mockPlanningPreview);
      return Promise.resolve({});
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getAllByText('חדש', { exact: true }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('כבר קיים', { exact: true }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('כמות השתנתה', { exact: true }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('כפול', { exact: true }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Special Flow', { exact: true }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('דורש בדיקה', { exact: true }).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows new orders backlog by default', async () => {
    mockBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/work-hierarchy')) return Promise.resolve(mockWorkHierarchy);
      if (path.includes('/append-diff')) return Promise.resolve(mockAppendDiffResponse);
      if (path.includes('/planning-preview')) return Promise.resolve(mockPlanningPreview);
      return Promise.resolve({});
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('SO-001')).toBeTruthy();
      expect(screen.getByText('Customer A')).toBeTruthy();
    });
  });

  it('shows already exists section collapsed by default', async () => {
    mockBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/work-hierarchy')) return Promise.resolve(mockWorkHierarchy);
      if (path.includes('/append-diff')) return Promise.resolve(mockAppendDiffResponse);
      if (path.includes('/planning-preview')) return Promise.resolve(mockPlanningPreview);
      return Promise.resolve({});
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('כבר קיים', { exact: true })).toBeTruthy();
    });

    expect(screen.queryByText('SO-002')).toBeNull();
  });

  it('shows empty state when no orders in any section', async () => {
    const emptyResponse = {
      ...mockAppendDiffResponse,
      summary: {
        totalRows: 0,
        newRows: 0,
        alreadyExistsRows: 0,
        quantityChangedRows: 0,
        duplicateRows: 0,
        specialFlowRows: 0,
        requiresReviewRows: 0,
        newOrders: 0
      },
      newOrders: [],
      alreadyExistsOrders: [],
      quantityChangedOrders: [],
      duplicateOrders: [],
      specialFlowOrders: [],
      requiresReviewOrders: []
    };

    mockBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/work-hierarchy')) return Promise.resolve(mockWorkHierarchy);
      if (path.includes('/append-diff')) return Promise.resolve(emptyResponse);
      if (path.includes('/planning-preview')) return Promise.resolve(mockPlanningPreview);
      return Promise.resolve({});
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('אין שורות חדשות להוספה')).toBeTruthy();
    });
  });

  it('shows existing lines area', async () => {
    mockBffRequest.mockImplementation((url: string) => {
      const path = String(url);
      if (path.includes('/work-hierarchy')) return Promise.resolve(mockWorkHierarchy);
      if (path.includes('/append-diff')) return Promise.resolve(mockAppendDiffResponse);
      if (path.includes('/planning-preview')) return Promise.resolve(mockPlanningPreview);
      return Promise.resolve({});
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.getByText('קווים קיימים')).toBeTruthy();
      expect(screen.getByText('דרום')).toBeTruthy();
    });
  });
});
