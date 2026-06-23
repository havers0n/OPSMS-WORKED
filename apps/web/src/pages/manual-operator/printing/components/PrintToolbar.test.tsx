import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { bffRequestBlob } from '@/shared/api/bff/client';
import { PrintToolbar } from './PrintToolbar';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequestBlob: vi.fn()
}));

function renderToolbar(pdfUrl?: string) {
  return render(
    <MemoryRouter>
      <PrintToolbar pdfUrl={pdfUrl} />
    </MemoryRouter>
  );
}

describe('PrintToolbar', () => {
  beforeEach(() => {
    vi.mocked(bffRequestBlob).mockReset();
    vi.mocked(bffRequestBlob).mockResolvedValue({
      blob: new Blob(['pdf'], { type: 'application/pdf' }),
      filename: 'picker-sheet.pdf'
    });
    vi.stubGlobal('open', vi.fn(() => ({ location: { href: '' }, close: vi.fn(), opener: window })));
    URL.createObjectURL = vi.fn(() => 'blob:picker-sheet');
    URL.revokeObjectURL = vi.fn();
  });

  it('renders הדפס button that calls window.print()', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderToolbar();
    const btn = screen.getByText('הדפס');
    btn.click();
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });

  it('renders פתח PDF button when pdfUrl is provided', () => {
    renderToolbar('/api/manual-shifts/123/print/picker-sheet.pdf?scope=line');
    expect(screen.getByRole('button', { name: 'פתח PDF' })).toBeDefined();
  });

  it('does not render פתח PDF when pdfUrl is undefined', () => {
    renderToolbar();
    expect(screen.queryByText('פתח PDF')).toBeNull();
  });

  it('uses authenticated blob fetch instead of a protected href', async () => {
    renderToolbar('/api/manual-shifts/123/print/picker-sheet.pdf?scope=line');
    expect(document.querySelector('a[href*="picker-sheet.pdf"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'פתח PDF' }));

    await waitFor(() => {
      expect(bffRequestBlob).toHaveBeenCalledWith('/api/manual-shifts/123/print/picker-sheet.pdf?scope=line');
      expect(URL.createObjectURL).toHaveBeenCalled();
    });
  });

  it('renders חזור להדפסות link to printing page', () => {
    renderToolbar();
    const backLink = screen.getByText('חזור להדפסות');
    expect(backLink).toBeDefined();
    expect(backLink.getAttribute('href')).toBe('/operator/manual/printing');
  });

  it('renders all three buttons when pdfUrl is provided', () => {
    renderToolbar('/api/manual-shifts/123/print/picker-sheet.pdf');
    expect(screen.getByText('הדפס')).toBeDefined();
    expect(screen.getByText('פתח PDF')).toBeDefined();
    expect(screen.getByText('חזור להדפסות')).toBeDefined();
  });
});
