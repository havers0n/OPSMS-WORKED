// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyImportPreviewSheet } from './monthly-import-preview-sheet';

const monthlyPreviewMutateAsync = vi.fn();
const monthlyApplyMutateAsync = vi.fn();

const defaultReplaceSafety = {
  canReplace: true,
  activeLinesCount: 0,
  activeOrdersCount: 0,
  startedOrdersCount: 0,
  assignedPickersCount: 0,
  assignedCheckersCount: 0,
  checkUnitsCount: 0,
  nonImportEventsCount: 0,
  blockReasons: []
};

vi.mock('@/entities/manual-shift/api/mutations', () => ({
  usePreviewManualShiftMonthlyImport: () => ({
    mutateAsync: monthlyPreviewMutateAsync,
    isPending: false,
    error: null
  }),
  useApplyManualShiftMonthlyImport: () => ({
    mutateAsync: monthlyApplyMutateAsync,
    isPending: false,
    error: null
  })
}));

vi.mock('@/entities/manual-shift/api/queries', () => ({
  monthlyReplaceSafetyQueryOptions: () => ({ queryKey: ['mock'], queryFn: () => defaultReplaceSafety })
}));

const previewPayload = {
  source: {
    fileName: 'monthly.xlsx',
    sheetName: 'יוני 26',
    availableSheets: ['יוני 26'],
  },
  selectedDate: {
    raw: '14.6.26',
    normalized: '2026-06-14'
  },
  dateSummary: {
    totalRows: 4,
    matchingRows: 3,
    skippedOtherDateRows: 1,
    normalRows: 0,
    availableDates: [
      { raw: '5.6.26', normalized: '2026-06-05', rows: 1 },
      { raw: '14.6.26', normalized: '2026-06-14', rows: 3 }
    ]
  },
  totals: {
    lines: 1,
    rawDistributionValues: 2,
    derivedPoints: 2,
    uniqueOrderNumbers: 2,
    orderGroups: 2,
    skuRows: 3,
    aggregatedSkuGroups: 2,
    uniqueSkus: 2,
    totalQuantity: 4,
    rawTotalQuantity: 4,
    positiveTotalQuantity: 3,
    negativeTotalQuantity: -1,
    zeroQuantityRowsCount: 0,
    negativeQuantityRowsCount: 1,
    positiveQuantityRowsCount: 2
  },
  anomalies: {
    negativeQuantityRows: 1,
    nonSoOrderRows: 1,
    rowsWithoutDistributionSlash: 1,
    pointFallbackRows: 1,
    pickupNoteRows: 2,
    ashlamaNoteRows: 1,
    invalidDistributionDateRows: [],
    missingRequiredFields: []
  },
  lines: [
    {
      lineName: 'עמקים',
      points: 2,
      uniqueOrderNumbers: 2,
      orderGroups: 2,
      itemRows: 3,
      aggregatedSkuGroups: 2,
      uniqueSkus: 2,
      totalQuantity: 4,
      negativeQuantityRows: 1,
      anomalyCount: 5,
      warnings: []
    }
  ],
  excludedRows: [],
  warnings: [
    {
      severity: 'blocking' as const,
      code: 'SELECTED_DATE_NOT_FOUND',
      message: 'Selected date was not found',
      count: 0
    }
  ]
};

describe('MonthlyImportPreviewSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

it('accepts xlsx files', () => {
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={false}
        replaceSafety={null}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );
    expect(screen.getByLabelText('ייבוא הזמנות לתאריך נבחר').getAttribute('accept')).toBe(
      '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

it('requests preview and renders metrics, dates, anomalies, and lines', async () => {
    monthlyPreviewMutateAsync.mockResolvedValueOnce({ preview: previewPayload });
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={false}
        replaceSafety={null}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );

    const file = new File(['x'], 'monthly.xlsx');
    fireEvent.change(screen.getByLabelText('ייבוא הזמנות לתאריך נבחר'), { target: { files: [file] } });

    await waitFor(() => expect(monthlyPreviewMutateAsync).toHaveBeenCalledWith(file));

    expect(screen.getAllByText('ייבוא הזמנות לתאריך נבחר').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('תצוגה מקדימה לפי תאריך המשמרת שנבחרה')).toBeTruthy();
    expect(screen.getByText(/monthly.xlsx/)).toBeTruthy();
    expect(screen.getByText(/תאריך משמרת:/)).toBeTruthy();
    expect(screen.getByText(/עמקים/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'אשר ייבוא' })).toBeTruthy();
  });

it('shows translated error when preview request fails', async () => {
    monthlyPreviewMutateAsync.mockRejectedValueOnce(new Error('preview failed'));
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={false}
        replaceSafety={null}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText('ייבוא הזמנות לתאריך נבחר'), {
      target: { files: [new File(['x'], 'monthly.xlsx')] }
    });

    await waitFor(() => expect(screen.getByText('preview failed')).toBeTruthy());
  });

it('disables apply when blocking warnings exist', async () => {
    monthlyPreviewMutateAsync.mockResolvedValueOnce({ preview: previewPayload });
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={false}
        replaceSafety={null}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText('ייבוא הזמנות לתאריך נבחר'), {
      target: { files: [new File(['x'], 'monthly.xlsx')] }
    });

    await waitFor(() => expect(monthlyPreviewMutateAsync).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'אשר ייבוא' }).getAttribute('disabled')).toBe('');
  });

  it('applies the same file, selected date, and shift id', async () => {
    const onSuccess = vi.fn();
    monthlyPreviewMutateAsync.mockResolvedValueOnce({
      preview: {
        ...previewPayload,
        warnings: []
      }
    });
    monthlyApplyMutateAsync.mockResolvedValueOnce({
      shiftId: 'shift-1',
      selectedDate: '2026-06-14',
      linesCreated: 1,
      ordersCreated: 1,
      orderItemsCreated: 1,
      appliedGroups: 1,
      skippedGroups: 0,
      skippedNegativeQuantityRows: 0,
      skippedZeroQuantityRows: 0,
      appliedTotalQuantity: 3,
      appliedItemLines: 1,
      excludedRowsCount: 0,
      warningSummary: { info: 0, warning: 0, blocking: 0 },
      warnings: [],
      previewTotals: previewPayload.totals,
      previewAnomalies: previewPayload.anomalies
    });

render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={false}
        replaceSafety={null}
        onClose={() => undefined}
        onSuccess={onSuccess}
      />
    );

    const file = new File(['x'], 'monthly.xlsx');
    fireEvent.change(screen.getByLabelText('ייבוא הזמנות לתאריך נבחר'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'אשר ייבוא' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'אשר ייבוא' }));

await waitFor(() => expect(monthlyApplyMutateAsync).toHaveBeenCalledWith({ shiftId: 'shift-1', file, mode: 'initial' }));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      shiftId: 'shift-1',
      selectedDate: '2026-06-14'
    }));
  });

  it('shows existing work warning and requires confirmation when hasExistingWork is true and canReplace is true', async () => {
    const onSuccess = vi.fn();
    monthlyPreviewMutateAsync.mockResolvedValueOnce({
      preview: {
        ...previewPayload,
        warnings: []
      }
    });
    monthlyApplyMutateAsync.mockResolvedValueOnce({
      shiftId: 'shift-1',
      selectedDate: '2026-06-14',
      linesCreated: 1,
      ordersCreated: 1,
      orderItemsCreated: 1,
      appliedGroups: 1,
      skippedGroups: 0,
      skippedNegativeQuantityRows: 0,
      skippedZeroQuantityRows: 0,
      appliedTotalQuantity: 3,
      appliedItemLines: 1,
      excludedRowsCount: 0,
      warningSummary: { info: 0, warning: 0, blocking: 0 },
      warnings: [],
      previewTotals: previewPayload.totals,
      previewAnomalies: previewPayload.anomalies
    });

    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={true}
        replaceSafety={{ ...defaultReplaceSafety, canReplace: true }}
        onClose={() => undefined}
        onSuccess={onSuccess}
      />
    );

    const file = new File(['x'], 'monthly.xlsx');
    fireEvent.change(screen.getByLabelText('ייבוא הזמנות לתאריך נבחר'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /ייבוא מחדש והחלפת עבודה קיימת/ })).toBeTruthy());
    expect(screen.getByText('כבר קיימים קווים והזמנות ליום הזה.')).toBeTruthy();
  });

  it('shows blocked message when canReplace is false', () => {
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={true}
        replaceSafety={{ ...defaultReplaceSafety, canReplace: false, blockReasons: ['orders_started', 'picker_assigned'] }}
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );

    expect(screen.getByText('אי אפשר לייבא מחדש אחרי שהעבודה התחילה.')).toBeTruthy();
  });

  it('sends mode=replace when hasExistingWork is true', async () => {
    const onSuccess = vi.fn();
    monthlyPreviewMutateAsync.mockResolvedValueOnce({
      preview: {
        ...previewPayload,
        warnings: []
      }
    });
    monthlyApplyMutateAsync.mockResolvedValueOnce({
      shiftId: 'shift-1',
      selectedDate: '2026-06-14',
      linesCreated: 1,
      ordersCreated: 1,
      orderItemsCreated: 1,
      replacedLines: 1,
      replacedOrders: 2,
      replacedItems: 3,
      appliedGroups: 1,
      skippedGroups: 0,
      skippedNegativeQuantityRows: 0,
      skippedZeroQuantityRows: 0,
      appliedTotalQuantity: 3,
      appliedItemLines: 1,
      excludedRowsCount: 0,
      warningSummary: { info: 0, warning: 0, blocking: 0 },
      warnings: [],
      previewTotals: previewPayload.totals,
      previewAnomalies: previewPayload.anomalies
    });

    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        hasExistingWork={true}
        replaceSafety={{ ...defaultReplaceSafety, canReplace: true }}
        onClose={() => undefined}
        onSuccess={onSuccess}
      />
    );

    const file = new File(['x'], 'monthly.xlsx');
    fireEvent.change(screen.getByLabelText('ייבוא הזמנות לתאריך נבחר'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: /ייבוא מחדש והחלפת עבודה קיימת/ })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: /ייבוא מחדש והחלפת עבודה קיימת/ }));

    fireEvent.click(screen.getByRole('button', { name: /ייבוא מחדש והחלפת עבודה קיימת/ }));

    await waitFor(() => expect(monthlyApplyMutateAsync).toHaveBeenCalledWith({ shiftId: 'shift-1', file, mode: 'replace' }));
  });
});
