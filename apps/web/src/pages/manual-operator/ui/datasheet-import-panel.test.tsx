// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { DatasheetImportPanel } from './datasheet-import-panel';

const previewMutateAsync = vi.fn();
const createMutateAsync = vi.fn();
const createDraftMutate = vi.fn();

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/entities/demand/api/mutations', () => ({
  usePreviewDataSheetDemandImport: () => ({
    mutateAsync: previewMutateAsync,
    isPending: false,
    error: null
  }),
  useCreateDataSheetDemandImport: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
    error: null
  }),
  useCreateDemandPlanningDraft: () => ({
    mutate: createDraftMutate,
    isPending: false,
    error: null
  })
}));

const mockPlanningPreviewData = {
  batch: { id: 'test-batch-id', sourceFile: 'datasheet.xlsx', sourceSheet: 'DataSheet', uploadedAt: '2026-06-24T12:00:00.000Z', status: 'ready', rowsCount: 10, rawRowsCount: 7, warningRowsCount: 2, errorRowsCount: 1, specialFlowRowsCount: 1, distributionAreasCount: 2, distinctOrdersCount: 5, distinctSkuCount: 8 },
  summary: { rowsCount: 10, normalRowsCount: 7, specialFlowRowsCount: 1, errorRowsCount: 1, distributionAreasCount: 2, ordersCount: 5, skuCount: 8, totalQuantity: 180 },
  distributionAreas: [
    { distributionArea: 'דרום', rowsCount: 5, ordersCount: 3, skuCount: 4, totalQuantity: 100, specialFlowRowsCount: 0, errorRowsCount: 0, orders: [], productSummary: [], issues: [] },
    { distributionArea: 'צפון', rowsCount: 5, ordersCount: 2, skuCount: 4, totalQuantity: 80, specialFlowRowsCount: 1, errorRowsCount: 0, orders: [], productSummary: [], issues: [] },
  ],
  specialFlows: [],
  errors: [],
};

vi.mock('@/entities/demand/api/queries', () => ({
  demandPlanningPreviewQueryOptions: (batchId: string) => ({
    queryKey: ['demand-import', 'planning-preview', batchId],
    queryFn: () => mockPlanningPreviewData,
    enabled: !!batchId,
    staleTime: 30_000,
  }),
  demandPlanningDraftQueryOptions: (draftId: string) => ({
    queryKey: ['demand-import', 'draft', draftId],
    queryFn: () => ({}),
    enabled: !!draftId,
    staleTime: 30_000,
  }),
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DatasheetImportPanel />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

const previewPayload = {
  preview: {
    sourceFile: 'datasheet.xlsx',
    sourceSheet: 'DataSheet' as const,
    rowsCount: 10,
    rawRowsCount: 7,
    warningRowsCount: 2,
    errorRowsCount: 1,
    specialFlowRowsCount: 1,
    distributionAreasCount: 2,
    distinctOrdersCount: 5,
    distinctSkuCount: 8,
    distributionAreaSummary: [
      { distributionArea: 'דרום', rowsCount: 5, ordersCount: 3, skuCount: 4, totalQty: 100, specialFlowRowsCount: 0, errorRowsCount: 0 },
      { distributionArea: 'צפון', rowsCount: 5, ordersCount: 2, skuCount: 4, totalQty: 80, specialFlowRowsCount: 1, errorRowsCount: 0 }
    ],
    productHandlingSummary: [
      { productHandlingFlow: 'regular' as const, rowsCount: 8, totalQty: 150 },
      { productHandlingFlow: 'cigarette' as const, rowsCount: 2, totalQty: 30 }
    ],
    specialFlowSummary: [
      { routeFlow: 'pickup' as const, rowsCount: 1, totalQty: 10 }
    ],
    sampleRows: [
      {
        sourceSheet: 'DataSheet',
        sourceRowNumber: 1,
        agent: null,
        orderDate: '2026-06-14',
        customerName: 'לקוח א',
        orderNumber: 'SO-001',
        sku: 'SKU-1',
        description: 'מוצר 1',
        category: 'קטגוריה א',
        quantity: 10,
        cost: null,
        notes: null,
        distributionArea: 'דרום',
        rawRouteLine: null,
        plannedDeliveryDate: null,
        plannedRouteLine: null,
        plannedWorkBucket: null,
        planningStatus: 'unplanned' as const,
        routeFlow: 'unassigned' as const,
        productHandlingFlow: 'regular' as const,
        noteDateHints: [],
        issues: []
      }
    ],
    issues: [
      { severity: 'warning' as const, code: 'ZERO_QUANTITY', message: 'Zero quantity rows found', count: 1 },
      { severity: 'error' as const, code: 'MISSING_SKU', message: 'Missing SKU', count: 1 }
    ],
    rows: []
  }
};

const createResponse = {
  batch: {
    id: 'test-batch-id',
    tenantId: '00000000-0000-0000-0000-000000000000',
    sourceFile: 'datasheet.xlsx',
    sourceSheet: 'DataSheet',
    uploadedAt: '2026-06-24T12:00:00.000Z',
    uploadedBy: null,
    status: 'ready' as const,
    rowsCount: 10,
    rawRowsCount: 7,
    warningRowsCount: 2,
    errorRowsCount: 1,
    specialFlowRowsCount: 1,
    distributionAreasCount: 2,
    distinctOrdersCount: 5,
    distinctSkuCount: 8
  },
  preview: previewPayload.preview
};

describe('DatasheetImportPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the upload section with file input', () => {
    const { container } = renderPanel();
    expect(screen.getByText('בחר קובץ ‎.xlsx')).toBeTruthy();
    expect(screen.getByLabelText('בחר קובץ DataSheet')).toBeTruthy();
    expect(container.textContent).toContain('הנתונים יישמרו לתכנון לפי אזור הפצה ולא ייכנסו עדיין למשמרת');
  });

  it('shows preview after successful file upload', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    const { container } = renderPanel();

    const input = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('datasheet.xlsx')).toBeTruthy();
    });

    expect(container.textContent).toContain('סה"כ שורות: 10');
    expect(container.textContent).toContain('שורות גולמיות: 7');
    expect(container.textContent).toContain('שורות עם אזהרה: 2');
    expect(container.textContent).toContain('שורות שגיאה: 1');
    expect(container.textContent).toContain('שורות Special Flow: 1');
    expect(container.textContent).toContain('אזורי הפצה: 2');
    expect(container.textContent).toContain('הזמנות ייחודיות: 5');
    expect(container.textContent).toContain('SKU ייחודיים: 8');
  });

  it('shows save button after preview', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    renderPanel();

    const input = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });
  });

  it('calls create API on save button click', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    renderPanel();

    const input = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledTimes(1);
    });
  });

  it('shows batch info and "לא בוצע שיוך למשמרת" after successful save', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    const { container } = renderPanel();

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(container.textContent).toContain('Batch ID: test-batch-id');
    });

    expect(container.textContent).toContain('סטטוס: ready');
    expect(container.textContent).toContain('שורות: 10');
    expect(container.textContent).toContain('לא בוצע שיוך למשמרת');
  });
});

describe('DatasheetPlanningPreview', () => {
  it('shows planning preview section after save', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    const { container } = renderPanel();

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(container.textContent).toContain('Batch ID: test-batch-id');
    });
  });
});

describe('Demand mode "פתח תכנון ב-Lines" button', () => {
  it('appears after planning preview loads', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    renderPanel();

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(screen.getByText('פתח תכנון ב-Lines')).toBeTruthy();
    });
  });

  it('calls createDemandPlanningDraft on click and navigates', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);

    const draftResult = {
      draft: { id: 'draft-1111-1111-1111' },
      buckets: [],
      allocations: [],
    };
    createDraftMutate.mockImplementation((_batchId: string, opts?: { onSuccess?: (result: unknown) => void }) => {
      if (opts?.onSuccess) opts.onSuccess(draftResult);
    });

    renderPanel();

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(screen.getByText('פתח תכנון ב-Lines')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('פתח תכנון ב-Lines'));

    expect(createDraftMutate).toHaveBeenCalledWith('test-batch-id', expect.any(Object));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/operator/manual/lines?batchId=test-batch-id&draftId=draft-1111-1111-1111'
      );
    });
  });

  it('button shows initial state', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    renderPanel();

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      const btn = screen.getByText('פתח תכנון ב-Lines');
      expect(btn).toBeTruthy();
      expect(btn.closest('button')).toHaveProperty('disabled', false);
    });
  });
});

describe('Append button visibility', () => {
  it('shows append button when shiftId is provided and batch is saved', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DatasheetImportPanel shiftId="shift-123" />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(screen.getByText('הוסף לקווים קיימים')).toBeTruthy();
    });
  });

  it('does not show append button when shiftId is null', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    const { container } = render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DatasheetImportPanel shiftId={null} />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(container.textContent).toContain('Batch ID: test-batch-id');
    });

    expect(screen.queryByText('הוסף לקווים קיימים')).toBeNull();
  });

  it('navigates to append mode URL on click', async () => {
    previewMutateAsync.mockResolvedValueOnce(previewPayload);
    createMutateAsync.mockResolvedValueOnce(createResponse);
    render(
      <MemoryRouter>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <DatasheetImportPanel shiftId="shift-123" />
        </QueryClientProvider>
      </MemoryRouter>
    );

    const fileInput = screen.getByLabelText('בחר קובץ DataSheet');
    const file = new File(['test'], 'datasheet.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('שמור ביקוש גולמי')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('שמור ביקוש גולמי'));

    await waitFor(() => {
      expect(screen.getByText('הוסף לקווים קיימים')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('הוסף לקווים קיימים'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        '/operator/manual/lines?shiftId=shift-123&batchId=test-batch-id&mode=append'
      );
    });
  });
});
