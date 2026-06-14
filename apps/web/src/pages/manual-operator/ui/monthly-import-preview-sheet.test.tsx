// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonthlyImportPreviewSheet } from './monthly-import-preview-sheet';

const monthlyPreviewMutateAsync = vi.fn();
const monthlyApplyMutateAsync = vi.fn();

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

const previewPayload = {
  source: {
    fileName: 'monthly.xlsx',
    sheetName: 'Ч™Ч•Ч Ч™ 26'
  },
  selectedDate: {
    raw: '14.6.26',
    normalized: '2026-06-14'
  },
  dateSummary: {
    totalRows: 4,
    matchingRows: 3,
    skippedOtherDateRows: 1,
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
    totalQuantity: 4
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
      lineName: 'ЧўЧћЧ§Ч™Чќ',
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

  it('file input accepts xlsx', () => {
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );
    expect(screen.getByLabelText('Ч‘Ч—ЧЁ Ч§Ч•Ч‘ЧҐ ЧђЧ§ЧЎЧњ Ч—Ч•Ч“Ч©Ч™').getAttribute('accept')).toBe(
      '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
  });

  it('requests preview and renders metrics, dates, anomalies, and lines', async () => {
    monthlyPreviewMutateAsync.mockResolvedValueOnce({ preview: previewPayload });
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );

    const file = new File(['x'], 'monthly.xlsx');
    fireEvent.change(screen.getByLabelText('Ч‘Ч—ЧЁ Ч§Ч•Ч‘ЧҐ ЧђЧ§ЧЎЧњ Ч—Ч•Ч“Ч©Ч™'), { target: { files: [file] } });

    await waitFor(() => expect(monthlyPreviewMutateAsync).toHaveBeenCalledWith(file));

    expect(screen.getByText(/monthly.xlsx/)).toBeTruthy();
    expect(screen.getByText('Batch 2 preview only')).toBeTruthy();
    expect(screen.getByText(/ЧЎЧ”ЧґЧ› Ч©Ч•ЧЁЧ•ЧЄ:/)).toBeTruthy();
    expect(screen.getByText(/ЧўЧћЧ§Ч™Чќ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Apply Import' })).toBeTruthy();
  });

  it('shows translated error when preview request fails', async () => {
    monthlyPreviewMutateAsync.mockRejectedValueOnce(new Error('preview failed'));
    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText('Ч‘Ч—ЧЁ Ч§Ч•Ч‘ЧҐ ЧђЧ§ЧЎЧњ Ч—Ч•Ч“Ч©Ч™'), {
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
        onClose={() => undefined}
        onSuccess={() => undefined}
      />
    );

    fireEvent.change(screen.getByLabelText('Ч‘Ч—ЧЁ Ч§Ч•Ч‘ЧҐ ЧђЧ§ЧЎЧњ Ч—Ч•Ч“Ч©Ч™'), {
      target: { files: [new File(['x'], 'monthly.xlsx')] }
    });

    await waitFor(() => expect(monthlyPreviewMutateAsync).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: 'Apply Import' }).getAttribute('disabled')).toBe('');
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
      warningSummary: { info: 0, warning: 0, blocking: 0 },
      warnings: [],
      previewTotals: previewPayload.totals,
      previewAnomalies: previewPayload.anomalies
    });

    render(
      <MonthlyImportPreviewSheet
        shiftId="shift-1"
        selectedDate="2026-06-14"
        onClose={() => undefined}
        onSuccess={onSuccess}
      />
    );

    const file = new File(['x'], 'monthly.xlsx');
    fireEvent.change(screen.getByLabelText('Ч‘Ч—ЧЁ Ч§Ч•Ч‘ЧҐ ЧђЧ§ЧЎЧњ Ч—Ч•Ч“Ч©Ч™'), { target: { files: [file] } });

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply Import' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Apply Import' }));

    await waitFor(() => expect(monthlyApplyMutateAsync).toHaveBeenCalledWith({ shiftId: 'shift-1', file }));
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({
      shiftId: 'shift-1',
      selectedDate: '2026-06-14'
    }));
  });
});
