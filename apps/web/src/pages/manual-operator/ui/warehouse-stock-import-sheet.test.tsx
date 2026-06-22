// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WarehouseStockImportSheet } from './warehouse-stock-import-sheet';
import type { ReactElement } from 'react';

const uploadMutateAsync = vi.fn();
const publishMutateAsync = vi.fn();

vi.mock('@/entities/warehouse-stock/api/mutations', () => ({
  useUploadWarehouseStockExcel: () => ({
    mutateAsync: uploadMutateAsync,
    isPending: false,
    error: null
  }),
  usePublishWarehouseStockSnapshot: () => ({
    mutateAsync: publishMutateAsync,
    isPending: false,
    error: null
  })
}));

vi.mock('@/entities/warehouse-stock/api/queries', () => ({
  warehouseStockSnapshotsQueryOptions: () => ({
    queryKey: ['warehouse-stock', 'snapshots'],
    queryFn: vi.fn()
  }),
  warehouseStockKeys: {
    all: ['warehouse-stock'],
    snapshots: () => ['warehouse-stock', 'snapshots'],
    snapshotDetail: (id: string) => ['warehouse-stock', 'snapshots', id]
  }
}));

const mockUseQuery = vi.hoisted(() => vi.fn().mockReturnValue({ data: [], isLoading: false }));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: mockUseQuery
  };
});

const previewPayload = {
  sourceSheetName: 'מלאי',
  rowCount: 3,
  populatedSkuCount: 2,
  uniqueSkuCount: 2,
  duplicateSkuRowsCount: 0,
  missingSkuRowsCount: 1,
  negativeStockRowsCount: 0,
  conflictingStockSkuCount: 0,
  diagnostics: [{ code: 'missing_sku', message: '1 row(s) have missing SKU' }],
  rows: [
    {
      sku: 'SKU001',
      description: 'מוצר 1',
      category: 'קטגוריה א',
      warehouseQtyRaw: 100,
      availableQty: 100,
      sourceDemandQty: 50,
      sourceRowCount: 1,
      diagnostics: []
    },
    {
      sku: 'SKU002',
      description: 'מוצר 2',
      category: 'קטגוריה ב',
      warehouseQtyRaw: 200,
      availableQty: 200,
      sourceDemandQty: 30,
      sourceRowCount: 1,
      diagnostics: []
    }
  ]
};

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('WarehouseStockImportSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders title and subtitle', () => {
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);
    expect(screen.getByText('ייבוא מלאי מחסן')).toBeTruthy();
    expect(screen.getByText('העלאת קובץ מלאי מחסן, בדיקת נתונים ופרסום לתאריך עבודה')).toBeTruthy();
  });

  it('renders date field', () => {
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);
    expect(screen.getByLabelText('תאריך עבודה')).toBeTruthy();
  });

  it('file input accepts xlsx', () => {
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);
    const input = screen.getByLabelText('בחר קובץ מלאי מחסן');
    expect(input.getAttribute('accept')).toBe('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('upload calls API', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ preview: previewPayload, fileName: 'stock.xlsx', pivotSheetFound: false });
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    const file = new File(['x'], 'stock.xlsx');
    fireEvent.change(screen.getByLabelText('בחר קובץ מלאי מחסן'), { target: { files: [file] } });

    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledWith(file));
    expect(screen.getByText(/stock.xlsx/)).toBeTruthy();
  });

  it('preview renders stats', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ preview: previewPayload, fileName: 'stock.xlsx', pivotSheetFound: false });
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ מלאי מחסן'), { target: { files: [new File(['x'], 'stock.xlsx')] } });

    await waitFor(() => {
      expect(screen.getByText(/שורות מקור:/)).toBeTruthy();
      expect(screen.getByText(/3/)).toBeTruthy();
      expect(screen.getByText(/SKU ייחודיים:/)).toBeTruthy();
      // '2' appears as uniqueSkuCount; also '20MB' contains '2'; use getAllByText
      expect(screen.getAllByText(/2/).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('preview table visible after upload', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ preview: previewPayload, fileName: 'stock.xlsx', pivotSheetFound: false });
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ מלאי מחסן'), { target: { files: [new File(['x'], 'stock.xlsx')] } });

    await waitFor(() => {
      expect(screen.getByText('תצוגה מקדימה של שורות')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('תצוגה מקדימה של שורות'));
    expect(screen.getByText(/SKU001/)).toBeTruthy();
    expect(screen.getByText(/SKU002/)).toBeTruthy();
  });

  it('publish button calls API with planningDate', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ preview: previewPayload, fileName: 'stock.xlsx', pivotSheetFound: false });
    publishMutateAsync.mockResolvedValueOnce({ id: 'snap-1', planningDate: '2026-06-22', status: 'completed', rowCount: 2, importedAt: new Date().toISOString() });
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ מלאי מחסן'), { target: { files: [new File(['x'], 'stock.xlsx')] } });
    await waitFor(() => expect(screen.getByText('stock.xlsx')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'פרסם Snapshot מלאי לתאריך עבודה' }));

    await waitFor(() => {
      expect(publishMutateAsync).toHaveBeenCalledWith({
        preview: previewPayload,
        planningDate: expect.any(String),
        fileName: 'stock.xlsx',
        shiftId: null
      });
    });
  });

  it('publish shows result with snapshot id', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ preview: previewPayload, fileName: 'stock.xlsx', pivotSheetFound: false });
    publishMutateAsync.mockResolvedValueOnce({ id: 'snap-1', planningDate: '2026-06-22', status: 'completed', rowCount: 2, importedAt: new Date().toISOString() });
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ מלאי מחסן'), { target: { files: [new File(['x'], 'stock.xlsx')] } });
    await waitFor(() => expect(screen.getByText('stock.xlsx')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'פרסם Snapshot מלאי לתאריך עבודה' }));
    await waitFor(() => {
      expect(screen.getByText(/snap-1/)).toBeTruthy();
      expect(screen.getByText(/completed/)).toBeTruthy();
    });
  });

  it('error state renders for upload failure', async () => {
    uploadMutateAsync.mockRejectedValueOnce(new Error('Upload failed'));
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ מלאי מחסן'), { target: { files: [new File(['x'], 'stock.xlsx')] } });

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeTruthy();
    });
  });

  it('snapshot list heading renders', () => {
    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);
    expect(screen.getByText('Snapshots אחרונים')).toBeTruthy();
  });

  it('shows no duplicate warning when planningDate has no completed snapshot', () => {
    mockUseQuery.mockReturnValue({
      data: [{
        id: 'snap-other',
        planningDate: '2025-01-01',
        fileName: 'other.xlsx',
        importedAt: '2025-01-01T10:00:00.000Z',
        rowCount: 100,
        sourceRowCount: 100,
        uniqueSkuCount: 50,
        status: 'completed',
        diagnostics: []
      }],
      isLoading: false
    });

    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    const dateInput = screen.getByLabelText('תאריך עבודה') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-06-18' } });

    expect(screen.queryByText(/לתאריך עבודה זה כבר קיים/)).toBeNull();
    expect(screen.getByRole('button', { name: 'פרסם Snapshot מלאי לתאריך עבודה' })).toBeTruthy();
  });

  it('shows duplicate warning when planningDate already has a completed snapshot', () => {
    const existingSnapshot = {
      id: 'existing-snap-1',
      planningDate: '2026-06-18',
      fileName: 'previous-stock.xlsx',
      importedAt: '2026-06-18T08:00:00.000Z',
      rowCount: 450,
      sourceRowCount: 450,
      uniqueSkuCount: 300,
      status: 'completed',
      diagnostics: []
    };

    mockUseQuery.mockReturnValue({
      data: [existingSnapshot],
      isLoading: false
    });

    renderWithQuery(<WarehouseStockImportSheet onClose={() => undefined} />);

    const dateInput = screen.getByLabelText('תאריך עבודה') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2026-06-18' } });

    expect(screen.getByText(/לתאריך עבודה זה כבר קיים Snapshot מלאי/)).toBeTruthy();
    expect(screen.getByText(/פרסום חדש יהפוך לגרסה הפעילה לתאריך זה/)).toBeTruthy();
    expect(screen.getByText(/הגרסאות הקודמות יישארו בהיסטוריית הייבוא/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'פרסם כגרסה חדשה' })).toBeTruthy();
  });
});
