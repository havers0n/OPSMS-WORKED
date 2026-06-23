import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrintPickerSheetPage } from './PrintPickerSheetPage';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn().mockResolvedValue({ planningLines: [] }),
  BffRequestError: class extends Error { status = 500; code = 'MOCK'; requestId = null; errorId = null; details = null; },
}));

vi.mock('../components/PickerSheetPrintDocument', () => ({
  PickerSheetPrintDocument: () => <div data-testid="print-document">Document</div>,
}));

function renderPage(queryString: string) {
  return render(
    <MemoryRouter initialEntries={[`/operator/manual/print/picker-sheet?${queryString}`]}>
      <PrintPickerSheetPage />
    </MemoryRouter>
  );
}

describe('PrintPickerSheetPage', () => {
  it('hides toolbar when pdfRender=1', () => {
    renderPage('shiftId=shift-1&distributionArea=גליל&scope=line&planningLineName=קו+1&pdfRender=1');
    expect(screen.queryByText('הדפס')).toBeNull();
    expect(screen.queryByText('פתח PDF')).toBeNull();
    expect(screen.queryByText('חזור להדפסות')).toBeNull();
  });

  it('shows toolbar when pdfRender is absent', () => {
    renderPage('shiftId=shift-1&distributionArea=גליל&scope=line&planningLineName=קו+1');
    expect(screen.getByText('הדפס')).toBeDefined();
    expect(screen.getByText('חזור להדפסות')).toBeDefined();
  });

  it('renders error state when scope=area for real shift', () => {
    renderPage('shiftId=shift-1&distributionArea=גליל&scope=area');
    expect(screen.getByText(/אינה זמינה/)).toBeDefined();
  });

  it('renders error when missing shiftId', () => {
    renderPage('distributionArea=גליל');
    expect(screen.getByText(/לא נבחרה משמרת/)).toBeDefined();
  });

  it('does not render order numbers', async () => {
    renderPage('shiftId=demo-print-shift&distributionArea=גליל&scope=line&planningLineName=קו+1');
    await vi.waitFor(() => {
      expect(screen.queryByText(/מס' הזמנה/)).toBeNull();
    });
  });
});
