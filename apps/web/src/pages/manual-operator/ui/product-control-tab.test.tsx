import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ProductControlTab } from './product-control-tab';
import { CoverageStatusBadge } from '@/entities/product-control/coverage-status-badge';
import type { ProductControlStatus } from '@/entities/product-control/product-control-types';

vi.mock('@/shared/api/bff/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/api/bff/client')>();
  return { ...actual, bffRequest: vi.fn() };
});

import { bffRequest } from '@/shared/api/bff/client';

const mockedBffRequest = vi.mocked(bffRequest);

const SHIFT_ID = '33333333-3333-4333-8333-333333333333';

const mockSnapshot = {
  id: 'snap-1',
  planningDate: '2026-06-20',
  importedAt: '2026-06-20T10:00:00.000Z',
  fileName: 'פיבוט מילניום 2026.xlsx',
  rowCount: 468,
};

const mockCandidate1 = {
  block: '3346/26',
  sourceLabel: 'נעמן',
  availableQty: 200,
  releasedQty: 150,
  totalPulledQty: 0,
  releasedBalanceQty: 150,
  packFactor: 24,
  cartonsPerPallet: 40,
  unitsPerPallet: 960,
  notes: 'בוצעה הזמנת רכש חלופית לספק משנה',
};

const mockCandidate2 = {
  block: '3772/24',
  sourceLabel: 'בונדד',
  availableQty: 100,
  releasedQty: 120,
  totalPulledQty: 20,
  releasedBalanceQty: 100,
  packFactor: 6,
  cartonsPerPallet: 30,
  unitsPerPallet: 180,
  notes: null,
};

const mockCandidateNegative = {
  block: '4011/18',
  sourceLabel: 'בונדד',
  availableQty: 0,
  releasedQty: 50,
  totalPulledQty: 60,
  releasedBalanceQty: -10,
  packFactor: 12,
  cartonsPerPallet: 20,
  unitsPerPallet: 240,
  notes: 'יתרה שלילית — נמשך מעל הכמות המשוחררת',
};

const mockCandidateDataIssue = {
  block: '5123/09',
  sourceLabel: 'בונדד',
  availableQty: 564,
  releasedQty: 600,
  totalPulledQty: 36,
  releasedBalanceQty: 564,
  packFactor: 12,
  cartonsPerPallet: 24,
  unitsPerPallet: 288,
  notes: null,
};

const mockResponse = {
  shiftId: SHIFT_ID,
  generatedAt: '2026-06-20T10:00:00.000Z',
  bondedSnapshot: mockSnapshot,
  warnings: [],
  rows: [
    {
      sku: '100001',
      description: 'מחברת A4 100 דפים',
      category: 'ניירת',
      demandQty: 500,
      warehouseQty: 500,
      shortageQty: 0,
      bondedAvailableQty: 0,
      bondedCoverQty: 0,
      finalMissingQty: 0,
      surplusQty: 0,
      status: 'ok' as const,
      workLines: [],
    },
    {
      sku: '100002',
      description: 'טונר דיו שחור HP 85A',
      category: 'דיו והדפסה',
      demandQty: 200,
      warehouseQty: 50,
      shortageQty: 150,
      bondedAvailableQty: 200,
      bondedCoverQty: 150,
      finalMissingQty: 0,
      surplusQty: 0,
      status: 'covered_by_bonded' as const,
      affectedLinesCount: 8,
      affectedOrdersCount: 3,
      notes: 'בוצעה הזמנת רכש חלופית לספק משנה',
      workLines: [
        { name: 'משלוח דרום הגדול', units: 80, blockedOrders: 2 },
        { name: 'קמעונאות מרכז', units: 50, blockedOrders: 0 },
        { name: 'סיטונאי צפון', units: 70, blockedOrders: 1 },
      ],
      bondedCandidates: [mockCandidate1],
    },
    {
      sku: '100003',
      description: 'קלסר טבעות 5 ס"מ כחול',
      category: 'ניירת',
      demandQty: 300,
      warehouseQty: 100,
      shortageQty: 200,
      bondedAvailableQty: 100,
      bondedCoverQty: 100,
      finalMissingQty: 100,
      surplusQty: 0,
      status: 'partial_bonded' as const,
      affectedLinesCount: 4,
      affectedOrdersCount: 2,
      workLines: [
        { name: 'משלוח דרום הגדול', units: 80, blockedOrders: 1 },
        { name: 'סיטונאי צפון', units: 120, blockedOrders: 2 },
      ],
      bondedCandidates: [mockCandidate2, mockCandidateNegative],
    },
    {
      sku: '100004',
      description: 'תיקיית נייר A4 קשיחה',
      category: 'ניירת',
      demandQty: 400,
      warehouseQty: 80,
      shortageQty: 320,
      bondedAvailableQty: 0,
      bondedCoverQty: 0,
      finalMissingQty: 320,
      surplusQty: 0,
      status: 'unresolved' as const,
      affectedLinesCount: 12,
      affectedOrdersCount: 5,
      notes: 'מלאי מבונדד אזל — נדרשת רכש',
      workLines: [
        { name: 'משלוח דרום הגדול', units: 150, blockedOrders: 3 },
        { name: 'קמעונאות מרכז', units: 100, blockedOrders: 1 },
        { name: 'סיטונאי צפון', units: 70, blockedOrders: 2 },
      ],
    },
    {
      sku: '999999',
      description: '?!? נתונים לא תקינים',
      category: '—-',
      demandQty: 0,
      warehouseQty: 9999,
      shortageQty: 0,
      bondedAvailableQty: 0,
      bondedCoverQty: 0,
      finalMissingQty: 0,
      surplusQty: 0,
      status: 'data_issue' as const,
      dataIssues: ['unknown_sku'],
      notes: 'ביקורת נתונים נדרשת: כמות דרישה שלילית',
      workLines: [],
    },
    {
      sku: '100005',
      description: 'מדבקות צבעוניות A4',
      category: 'ניירת',
      demandQty: 564,
      warehouseQty: 0,
      shortageQty: 564,
      bondedAvailableQty: 2979,
      bondedCoverQty: 564,
      finalMissingQty: 0,
      surplusQty: 0,
      status: 'data_issue' as const,
      dataIssues: ['unknown_sku'],
      bondedCandidates: [mockCandidateDataIssue],
      workLines: [],
    },
  ],
  totals: {
    totalSkus: 6,
    shortageSkus: 3,
    coveredByBondedSkus: 1,
    partialBondedSkus: 1,
    unresolvedSkus: 1,
    dataIssueSkus: 2,
  },
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function renderTab() {
  return render(
    <QueryClientProvider client={makeQueryClient()}>
      <ProductControlTab shiftId={SHIFT_ID} />
    </QueryClientProvider>
  );
}

describe('CoverageStatusBadge', () => {
  const cases: { status: ProductControlStatus; expected: string }[] = [
    { status: 'ok', expected: 'תקין' },
    { status: 'covered_by_bonded', expected: 'מכוסה בבונדד' },
    { status: 'partial_bonded', expected: 'כיסוי חלקי' },
    { status: 'unresolved', expected: 'חסר ללא כיסוי' },
    { status: 'data_issue', expected: 'בעיית נתונים' },
  ];

  for (const { status, expected } of cases) {
    it(`renders "${expected}" for status "${status}"`, () => {
      render(<CoverageStatusBadge status={status} />);
      expect(screen.getByText(expected)).toBeTruthy();
    });
  }
});

describe('ProductControlTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state while fetching', () => {
    mockedBffRequest.mockImplementationOnce(() => new Promise(() => {}));
    renderTab();
    expect(screen.getByText('טוען נתוני בקרת מוצרים...')).toBeTruthy();
  });

  it('renders error state when request fails', async () => {
    mockedBffRequest.mockRejectedValueOnce(new Error('Network error'));
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('שגיאה בטעינת נתוני בקרת מוצרים')).toBeTruthy();
    });
  });

  it('renders empty state when no rows returned', async () => {
    mockedBffRequest.mockResolvedValueOnce({
      shiftId: SHIFT_ID,
      generatedAt: '2026-06-20T10:00:00.000Z',
      rows: [],
      totals: {
        totalSkus: 0, shortageSkus: 0, coveredByBondedSkus: 0,
        partialBondedSkus: 0, unresolvedSkus: 0, dataIssueSkus: 0,
      },
    });
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('אין נתוני מוצרים')).toBeTruthy();
    });
  });

  it('renders the main title from API response', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('חוסרים להיום + כיסוי בונדד')).toBeTruthy();
    });
  });

  it('renders subtitle describing the view', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/סקירת מלאי זמין מול דרישות/)).toBeTruthy();
    });
  });

  it('renders KPI cards with totals from API', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('סה״כ מק״טים')).toBeTruthy();
      expect(screen.getByText('בחוסר')).toBeTruthy();
      expect(screen.getByText('ניתן לכיסוי בבונדד')).toBeTruthy();
      expect(screen.getByText('בעיות נתונים')).toBeTruthy();
    });
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders product rows with SKU and description', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100001')).toBeTruthy();
      expect(screen.getByText('מחברת A4 100 דפים')).toBeTruthy();
      expect(screen.getByText('100002')).toBeTruthy();
      expect(screen.getByText('טונר דיו שחור HP 85A')).toBeTruthy();
      expect(screen.getByText('100005')).toBeTruthy();
      expect(screen.getAllByText('מדבקות צבעוניות A4').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders status badges for all fixture rows', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('תקין')).toBeTruthy();
      expect(screen.getByText('מכוסה בבונדד')).toBeTruthy();
      expect(screen.getByText('כיסוי חלקי')).toBeTruthy();
    });
    expect(screen.getAllByText('חסר ללא כיסוי').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('בעיית נתונים').length).toBeGreaterThanOrEqual(2);
  });

  it('highlights data_issue row distinctly', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('999999')).toBeTruthy();
      expect(screen.getByText('?!? נתונים לא תקינים')).toBeTruthy();
    });
  });

  it('renders table header columns matching prototype', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      const headers = [
        'תיאור פריט', 'קטגוריה', 'כמות בהזמנה', 'כמות במחסן',
        'חסר', 'זמין בבונדד', 'כיסוי בבונדד', 'נותר חסר',
        'סטטוס כיסוי', 'שורות מושפעות',
      ];
      for (const h of headers) {
        expect(screen.getByText(h)).toBeTruthy();
      }
    });
  });

  it('opens drawer when clicking a normal product row', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100002')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();
    expect(screen.getAllByText('טונר דיו שחור HP 85A').length).toBeGreaterThanOrEqual(2);
  });

  it('drawer shows selected SKU and bonded coverage details', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100003')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100003'));
    expect(screen.getAllByText('קלסר טבעות 5 ס"מ כחול').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('100003').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('במחסן')).toBeTruthy();
    expect(screen.getByText('כמות חסרה להיום')).toBeTruthy();
    expect(screen.getByText('כרגע בבונדד')).toBeTruthy();
    expect(screen.getAllByText('כיסוי בונדד').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('נותר חסר').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('מועמדי בונדד')).toBeTruthy();
    expect(screen.getByText('השפעה על הפצה')).toBeTruthy();
  });

  it('closes drawer when clicking close button', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100002')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('סגור פרטי מוצר'));
    expect(screen.queryByText('פריט נבחר')).toBeNull();
  });

  it('toggles row selection on re-click', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100002')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();
    const skuCells = screen.getAllByText('100002');
    fireEvent.click(skuCells[0]);
    expect(screen.queryByText('פריט נבחר')).toBeNull();
  });

  it('opens drawer for data_issue row when it has bonded coverage', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100005')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100005'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();
    expect(screen.getAllByText('מדבקות צבעוניות A4').length).toBeGreaterThanOrEqual(2);
  });

  it('opens drawer for data_issue row even without bonded coverage', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('999999')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('999999'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();
  });

  it('closes drawer with בטל וסגור button', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100002')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();
    fireEvent.click(screen.getByText('בטל וסגור'));
    expect(screen.queryByText('פריט נבחר')).toBeNull();
  });

  it('calls product-control endpoint with shiftId', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100001')).toBeTruthy();
    });
    expect(mockedBffRequest).toHaveBeenCalledWith(
      `/api/manual-shifts/${SHIFT_ID}/product-control`
    );
  });

  // === NEW: Bonded snapshot banner tests ===

  it('shows active bonded snapshot metadata banner', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/Snapshot בונדד פעיל לתאריך זה/)).toBeTruthy();
    });
    expect(screen.getByText(/פיבוט מילניום 2026\.xlsx/)).toBeTruthy();
    expect(screen.getByText(/468/)).toBeTruthy();
  });

  it('shows warning when no bonded snapshot for planning date', async () => {
    const noSnapshotResponse = {
      ...mockResponse,
      bondedSnapshot: null,
      warnings: ['no_bonded_snapshot_for_planning_date'],
    };
    mockedBffRequest.mockResolvedValueOnce(noSnapshotResponse);
    renderTab();
    await waitFor(() => {
      expect(
        screen.getByText(/לא נמצא Snapshot בונדד לתאריך העבודה הנבחר/)
      ).toBeTruthy();
    });
  });

  // === NEW: Table bonded coverage display tests ===

  it('table row shows bondedCoverQty and finalMissingQty', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      const cells = screen.getAllByText('150');
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getAllByText('100').length).toBeGreaterThanOrEqual(2);
  });

  it('data_issue row with bonded coverage shows bonded coverage summary', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100005')).toBeTruthy();
    });
    expect(screen.getByText('כיסוי בונדד: 564 מתוך 564')).toBeTruthy();
  });

  it('data_issue row shows shortage and bonded values instead of dashes', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100005')).toBeTruthy();
    });
    const five64s = screen.getAllByText('564');
    expect(five64s.length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('2979')).toBeTruthy();
  });

  // === NEW: Data issue explanation tests ===

  it('unknown_sku renders explanation text', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      const explanations = screen.getAllByText('מק"ט לא נמצא בקטלוג המוצרים');
      expect(explanations.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('duplicate_canonical_sku renders explanation text in detail panel', async () => {
    const dupResponse = {
      ...mockResponse,
      rows: mockResponse.rows.map((r) =>
        r.sku === '100005'
          ? { ...r, dataIssues: ['duplicate_canonical_sku' as const] }
          : r
      ),
    };
    mockedBffRequest.mockResolvedValueOnce(dupResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100005')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100005'));
    await waitFor(() => {
      const matches = screen.getAllByText('נמצאו כמה מוצרים בקטלוג לאותו מק"ט');
      expect(matches.length).toBeGreaterThanOrEqual(2);
    });
  });

  // === NEW: Detail panel bondedCandidates tests ===

  it('detail panel displays bondedCandidates with block and quantities', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100002')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100002'));
    await waitFor(() => {
      expect(screen.getByText('3346/26')).toBeTruthy();
      expect(screen.getAllByText('200').length).toBeGreaterThanOrEqual(2);
      expect(screen.getAllByText('150').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('detail panel shows candidates with releasedQty and totalPulledQty', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100003')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100003'));
    await waitFor(() => {
      expect(screen.getByText('3772/24')).toBeTruthy();
      expect(screen.getByText('4011/18')).toBeTruthy();
      expect(screen.getAllByText('120').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('detail panel shows negative balance warning', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100003')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100003'));
    await waitFor(() => {
      expect(screen.getByText('יתרה שלילית')).toBeTruthy();
    });
  });

  it('detail panel handles no candidates gracefully', async () => {
    const mockNoCandidates = {
      ...mockResponse,
      rows: mockResponse.rows.map((r) =>
        r.sku === '100001'
          ? { ...r, shortageQty: 10, warehouseQty: 490, demandQty: 500, bondedAvailableQty: 0, bondedCoverQty: 0, finalMissingQty: 10, status: 'unresolved' as const }
          : r
      ),
    };
    mockedBffRequest.mockResolvedValueOnce(mockNoCandidates);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100001')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100001'));
    await waitFor(() => {
      expect(screen.getByText('לא נמצאו מועמדי בונדד למק"ט זה')).toBeTruthy();
    });
  });

  it('data_issue row with bonded coverage shows data issue + bonded info in detail panel', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100005')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('100005'));
    await waitFor(() => {
      expect(screen.getByText('פריט נבחר')).toBeTruthy();
      expect(screen.getAllByText('בעיית נתונים').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/קיימת בעיית נתונים אך נמצא כיסוי בונדד/)).toBeTruthy();
    });
  });
});