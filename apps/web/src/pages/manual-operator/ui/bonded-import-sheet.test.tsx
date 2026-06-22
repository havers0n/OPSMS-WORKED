// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BondedImportSheet } from './bonded-import-sheet';
import type { ReactElement } from 'react';

const uploadMutateAsync = vi.fn();
const publishMutateAsync = vi.fn();

vi.mock('@/entities/bonded/api/mutations', () => ({
  useUploadBondedExcel: () => ({
    mutateAsync: uploadMutateAsync,
    isPending: false,
    error: null
  }),
  usePublishBondedSnapshot: () => ({
    mutateAsync: publishMutateAsync,
    isPending: false,
    error: null
  })
}));

vi.mock('@/entities/bonded/api/queries', () => ({
  bondedSnapshotsQueryOptions: () => ({
    queryKey: ['bonded', 'snapshots'],
    queryFn: vi.fn()
  }),
  bondedKeys: {
    all: ['bonded'],
    snapshots: () => ['bonded', 'snapshots'],
    snapshotDetail: (id: string) => ['bonded', 'snapshots', id]
  }
}));

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>();
  return {
    ...actual,
    useQuery: vi.fn().mockReturnValue({ data: [], isLoading: false })
  };
});

const draftPayload = {
  sourceSheetName: 'בונדד!',
  rowCount: 3,
  rows: [
    {
      rowNumber: 1,
      sourceLabel: null,
      block: 'A1',
      sku: 'SKU001',
      description: 'מוצר 1',
      releasedQty: 100,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [],
      totalPulledQty: 20,
      releasedBalanceQty: 80,
      availableQty: 80,
      notes: null,
      remainingBondedRaw: null,
      diagnostics: []
    },
    {
      rowNumber: 2,
      sourceLabel: null,
      block: 'B2',
      sku: 'SKU002',
      description: 'מוצר 2',
      releasedQty: 200,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [],
      totalPulledQty: 50,
      releasedBalanceQty: 150,
      availableQty: 150,
      notes: null,
      remainingBondedRaw: null,
      diagnostics: []
    }
  ],
  diagnostics: {
    totalRows: 3,
    populatedRows: 2,
    missingSkuRows: 1,
    negativeBalanceRows: 0,
    duplicateSkuGroups: 0,
    formulaDiscrepancyRows: 0,
    warnings: ['1 row(s) have missing SKU']
  }
};

function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('BondedImportSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders title and subtitle', () => {
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);
    expect(screen.getByText('טעינת קובץ בונדד')).toBeTruthy();
    expect(screen.getByText('העלאת קובץ בונדד, בדיקת נתונים ופרסום לתאריך עבודה')).toBeTruthy();
  });

  it('renders date field with helper text', () => {
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);
    expect(screen.getByLabelText('תאריך עבודה')).toBeTruthy();
    expect(screen.getByText(/קובץ הבונדד אינו כולל תאריך/)).toBeTruthy();
  });

  it('date field is required before publish', () => {
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);
    const dateInput = screen.getByLabelText('תאריך עבודה') as HTMLInputElement;
    expect(dateInput.type).toBe('date');
    expect(dateInput.value).toBeTruthy();
  });

  it('file input accepts xlsx', () => {
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);
    const input = screen.getByLabelText('בחר קובץ בונדד');
    expect(input.getAttribute('accept')).toBe('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('upload calls /api/bonded/upload', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ draft: draftPayload, fileName: 'bonded.xlsx', pivotSheetFound: false });
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);

    const file = new File(['x'], 'bonded.xlsx');
    fireEvent.change(screen.getByLabelText('בחר קובץ בונדד'), { target: { files: [file] } });

    await waitFor(() => expect(uploadMutateAsync).toHaveBeenCalledWith(file));
    expect(screen.getByText(/bonded.xlsx/)).toBeTruthy();
  });

  it('preview renders row count and diagnostics', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ draft: draftPayload, fileName: 'bonded.xlsx', pivotSheetFound: false });
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ בונדד'), { target: { files: [new File(['x'], 'bonded.xlsx')] } });

    await waitFor(() => {
      expect(screen.getByText(/שורות:/)).toBeTruthy();
      expect(screen.getByText(/3/)).toBeTruthy();
    });
  });

  it('PIVOT detected/ignored warning renders if present', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ draft: draftPayload, fileName: 'bonded.xlsx', pivotSheetFound: true });
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ בונדד'), { target: { files: [new File(['x'], 'bonded.xlsx')] } });

    await waitFor(() => {
      expect(screen.getByText(/PIVOT/)).toBeTruthy();
    });
  });

  it('publish button calls /api/bonded/snapshots with planningDate', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ draft: draftPayload, fileName: 'bonded.xlsx', pivotSheetFound: false });
    publishMutateAsync.mockResolvedValueOnce({ id: 'snap-1', planningDate: '2026-06-21', status: 'completed', rowCount: 3, importedAt: new Date().toISOString() });
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ בונדד'), { target: { files: [new File(['x'], 'bonded.xlsx')] } });
    await waitFor(() => expect(screen.getByText('bonded.xlsx')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'פרסם לתאריך עבודה' }));

    await waitFor(() => {
      expect(publishMutateAsync).toHaveBeenCalledWith({
        draft: draftPayload,
        planningDate: expect.any(String),
        fileName: 'bonded.xlsx',
        shiftId: null
      });
    });
  });

  it('publish shows result with snapshot id', async () => {
    uploadMutateAsync.mockResolvedValueOnce({ draft: draftPayload, fileName: 'bonded.xlsx', pivotSheetFound: false });
    publishMutateAsync.mockResolvedValueOnce({ id: 'snap-1', planningDate: '2026-06-21', status: 'completed', rowCount: 3, importedAt: new Date().toISOString() });
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ בונדד'), { target: { files: [new File(['x'], 'bonded.xlsx')] } });
    await waitFor(() => expect(screen.getByText('bonded.xlsx')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'פרסם לתאריך עבודה' }));
    await waitFor(() => {
      expect(screen.getByText(/snap-1/)).toBeTruthy();
      expect(screen.getByText(/completed/)).toBeTruthy();
    });
  });

  it('error state renders for upload failure', async () => {
    uploadMutateAsync.mockRejectedValueOnce(new Error('Upload failed'));
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ בונדד'), { target: { files: [new File(['x'], 'bonded.xlsx')] } });

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeTruthy();
    });
  });

  it('snapshot list heading renders', () => {
    renderWithQuery(<BondedImportSheet onClose={() => undefined} />);
    expect(screen.getByText('Snapshots אחרונים')).toBeTruthy();
  });
});
