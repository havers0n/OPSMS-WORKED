import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrintPickerSheetPage } from './PrintPickerSheetPage';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn().mockResolvedValue({ planningLines: [] }),
  BffRequestError: class extends Error {
    status = 500;
    code = 'MOCK';
    requestId = null;
    errorId = null;
    details = null;
  }
}));

vi.mock('../components/PickerSheetPrintDocument', () => ({
  PickerSheetPrintDocument: () => <div data-testid="print-document">Document</div>
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
    renderPage('shiftId=shift-1&distributionArea=Ч’ЧњЧ™Чњ&scope=line&planningLineName=Ч§Ч•+1&pdfRender=1');
    expect(screen.queryByText('הדפס')).toBeNull();
    expect(screen.queryByText('פתח PDF')).toBeNull();
    expect(screen.queryByText('חזור להדפסות')).toBeNull();
  });

  it('shows toolbar when pdfRender is absent', () => {
    renderPage('shiftId=shift-1&distributionArea=Ч’ЧњЧ™Чњ&scope=line&planningLineName=Ч§Ч•+1');
    expect(screen.getByText('הדפס')).toBeDefined();
    expect(screen.getByText('חזור להדפסות')).toBeDefined();
  });

  it('renders error state when scope=area for real shift', () => {
    renderPage('shiftId=shift-1&distributionArea=Ч’ЧњЧ™Чњ&scope=area');
    expect(screen.getByText(/Unable to load printable picker-sheet data/)).toBeDefined();
  });

  it('renders error when missing shiftId', () => {
    renderPage('distributionArea=Ч’ЧњЧ™Чњ');
    expect(screen.getByText(/Missing print parameters/)).toBeDefined();
  });

  it('does not render order numbers', async () => {
    renderPage('shiftId=demo-print-shift&distributionArea=Ч’ЧњЧ™Чњ&scope=line&planningLineName=Ч§Ч•+1');
    await vi.waitFor(() => {
      expect(screen.queryByText(/מס' ההזמנה/)).toBeNull();
    });
  });
});
