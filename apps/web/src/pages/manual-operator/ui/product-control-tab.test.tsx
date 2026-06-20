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

const mockResponse = {
  shiftId: SHIFT_ID,
  generatedAt: '2026-06-20T10:00:00.000Z',
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
      workLines: []
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
      bondedCandidateLabel: 'מחסן בונדד A — מדף 12',
      bondedCandidateBlock: '3346/26',
      bondedCandidateSource: 'נעמן',
      bondedCandidateUnitsPerPallet: 960,
      bondedCandidateCartonsPerPallet: 40,
      bondedCandidatePackFactor: 24,
      bondedCandidateAlreadyPulled: 0,
      bondedCandidateAvailableBalance: 200,
      notes: 'בוצעה הזמנת רכש חלופית לספק משנה',
      workLines: [
        { name: 'משלוח דרום הגדול', units: 80, blockedOrders: 2 },
        { name: 'קמעונאות מרכז', units: 50, blockedOrders: 0 },
        { name: 'סיטונאי צפון', units: 70, blockedOrders: 1 }
      ]
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
      bondedCandidateLabel: 'מחסן בונדד B — מדף 7',
      bondedCandidateBlock: '3772/24',
      bondedCandidateSource: 'בונדד',
      bondedCandidateUnitsPerPallet: 180,
      bondedCandidateCartonsPerPallet: 30,
      bondedCandidatePackFactor: 6,
      bondedCandidateAlreadyPulled: 0,
      bondedCandidateAvailableBalance: 100,
      workLines: [
        { name: 'משלוח דרום הגדול', units: 80, blockedOrders: 1 },
        { name: 'סיטונאי צפון', units: 120, blockedOrders: 2 }
      ]
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
        { name: 'סיטונאי צפון', units: 70, blockedOrders: 2 }
      ]
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
      notes: 'ביקורת נתונים נדרשת: כמות דרישה שלילית',
      workLines: []
    }
  ],
  totals: {
    totalSkus: 4,
    shortageSkus: 3,
    coveredByBondedSkus: 1,
    partialBondedSkus: 1,
    unresolvedSkus: 1,
    dataIssueSkus: 1
  }
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } }
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
    { status: 'covered_by_bonded', expected: 'כיסוי מלא' },
    { status: 'partial_bonded', expected: 'כיסוי חלקי' },
    { status: 'unresolved', expected: 'ללא כיסוי' },
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
        partialBondedSkus: 0, unresolvedSkus: 0, dataIssueSkus: 0
      }
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
      expect(screen.getByText('ניתן לכיסוי')).toBeTruthy();
    });
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders product rows with SKU and description', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('100001')).toBeTruthy();
      expect(screen.getByText('מחברת A4 100 דפים')).toBeTruthy();
      expect(screen.getByText('100002')).toBeTruthy();
      expect(screen.getByText('טונר דיו שחור HP 85A')).toBeTruthy();
    });
  });

  it('renders status badges for all fixture rows', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('תקין')).toBeTruthy();
      expect(screen.getByText('כיסוי מלא')).toBeTruthy();
      expect(screen.getByText('כיסוי חלקי')).toBeTruthy();
    });
    expect(screen.getAllByText('ללא כיסוי').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('בעיית נתונים')).toBeTruthy();
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
      const headers = ['תיאור פריט', 'קטגוריה', 'כמות בהזמנה', 'כמות במחסן', 'חסר', 'זמין בבונדד', 'סטטוס כיסוי', 'שורות מושפעות'];
      for (const h of headers) {
        expect(screen.getByText(h)).toBeTruthy();
      }
    });
  });

  it('opens drawer when clicking a product row', async () => {
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
    expect(screen.getByText('פעולות משיכה מבונדד')).toBeTruthy();
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

  it('does not open drawer for data_issue row', async () => {
    mockedBffRequest.mockResolvedValueOnce(mockResponse);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText('999999')).toBeTruthy();
    });
    fireEvent.click(screen.getByText('999999'));
    expect(screen.queryByText('פריט נבחר')).toBeNull();
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
});
