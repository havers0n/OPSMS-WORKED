// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ImportExcelSheet } from './import-excel-sheet';

const previewMutateAsync = vi.fn();
const applyMutateAsync = vi.fn();

vi.mock('@/entities/manual-shift/api/mutations', () => ({
  usePreviewManualShiftExcelImport: () => ({
    mutateAsync: previewMutateAsync,
    isPending: false,
    error: null
  }),
  useApplyManualShiftExcelImport: () => ({
    mutateAsync: applyMutateAsync,
    isPending: false,
    error: null
  })
}));

const previewPayload = {
  fileName: 'daily.xlsx',
  sheetName: 'Sheet1',
  importDateRaw: '1.6.26',
  importDate: '2026-06-01',
  lineCount: 1,
  orderCount: 2,
  lines: [{
    name: 'South',
    rawLabel: 'South',
    sourceRow: 4,
    sortOrder: 1,
    orders: [
      { pointName: 'A', rawLabel: 'South/A', sourceRow: 5, sortOrder: 1 },
      { pointName: 'B', rawLabel: 'South/B', sourceRow: 6, sortOrder: 2 }
    ]
  }]
};

describe('ImportExcelSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('file input accepts xlsx', () => {
    render(<ImportExcelSheet shiftId="s1" selectedDate="2026-06-01" onClose={() => undefined} onSuccess={() => undefined} />);
    const input = screen.getByLabelText('בחר קובץ אקסל');
    expect(input.getAttribute('accept')).toBe('.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  it('select file calls preview and renders summary', async () => {
    previewMutateAsync.mockResolvedValueOnce({ preview: previewPayload });
    render(<ImportExcelSheet shiftId="s1" selectedDate="2026-06-01" onClose={() => undefined} onSuccess={() => undefined} />);

    const file = new File(['x'], 'daily.xlsx');
    fireEvent.change(screen.getByLabelText('בחר קובץ אקסל'), { target: { files: [file] } });

    await waitFor(() => expect(previewMutateAsync).toHaveBeenCalledWith(file));

    expect(screen.getByText(/daily.xlsx/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'South - 2 הזמנות' }));
    expect(screen.getByText('A')).toBeTruthy();
    expect(screen.getByText('B')).toBeTruthy();
  });

  it('date mismatch shows warning and disables confirm', async () => {
    previewMutateAsync.mockResolvedValueOnce({
      preview: { ...previewPayload, importDate: '2026-06-02' }
    });
    render(<ImportExcelSheet shiftId="s1" selectedDate="2026-06-01" onClose={() => undefined} onSuccess={() => undefined} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ אקסל'), { target: { files: [new File(['x'], 'daily.xlsx')] } });

    await waitFor(() => expect(screen.getByText(/קובץ האקסל הוא לתאריך 2026-06-02/)).toBeTruthy());
    expect((screen.getByRole('button', { name: 'אשר ייבוא' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('confirm calls apply with shiftId and preview', async () => {
    previewMutateAsync.mockResolvedValueOnce({ preview: previewPayload });
    applyMutateAsync.mockResolvedValueOnce({ shiftId: 's1', linesCreated: 1, ordersCreated: 1 });
    const onSuccess = vi.fn();

    render(<ImportExcelSheet shiftId="s1" selectedDate="2026-06-01" onClose={() => undefined} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByLabelText('בחר קובץ אקסל'), { target: { files: [new File(['x'], 'daily.xlsx')] } });
    await waitFor(() => expect((screen.getByRole('button', { name: 'אשר ייבוא' }) as HTMLButtonElement).disabled).toBe(false));

    fireEvent.click(screen.getByRole('button', { name: 'אשר ייבוא' }));

    await waitFor(() => {
      expect(applyMutateAsync).toHaveBeenCalledWith({ shiftId: 's1', preview: previewPayload });
      expect(onSuccess).toHaveBeenCalledWith({ linesCreated: 1, ordersCreated: 1 });
    });
  });

  it('apply error keeps preview visible and shows error', async () => {
    previewMutateAsync.mockResolvedValueOnce({ preview: previewPayload });
    applyMutateAsync.mockRejectedValueOnce(new Error('apply failed'));

    render(<ImportExcelSheet shiftId="s1" selectedDate="2026-06-01" onClose={() => undefined} onSuccess={() => undefined} />);
    fireEvent.change(screen.getByLabelText('בחר קובץ אקסל'), { target: { files: [new File(['x'], 'daily.xlsx')] } });
    await waitFor(() => expect(screen.getByText(/daily.xlsx/)).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'אשר ייבוא' }));

    await waitFor(() => {
      expect(screen.getByText('apply failed')).toBeTruthy();
      expect(screen.getByText(/daily.xlsx/)).toBeTruthy();
    });
  });

  it('allows selecting the same file again', async () => {
    previewMutateAsync.mockResolvedValue({ preview: previewPayload });
    render(<ImportExcelSheet shiftId="s1" selectedDate="2026-06-01" onClose={() => undefined} onSuccess={() => undefined} />);

    const input = screen.getByLabelText('בחר קובץ אקסל');
    const file = new File(['x'], 'daily.xlsx');

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(previewMutateAsync).toHaveBeenCalledTimes(1));

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(previewMutateAsync).toHaveBeenCalledTimes(2));
  });
});
