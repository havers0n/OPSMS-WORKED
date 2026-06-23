import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrintToolbar } from './PrintToolbar';

function renderToolbar(pdfUrl?: string) {
  return render(
    <MemoryRouter>
      <PrintToolbar pdfUrl={pdfUrl} />
    </MemoryRouter>
  );
}

describe('PrintToolbar', () => {
  it('renders הדפס button that calls window.print()', () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    renderToolbar();
    const btn = screen.getByText('הדפס');
    btn.click();
    expect(printSpy).toHaveBeenCalledOnce();
    printSpy.mockRestore();
  });

  it('renders פתח PDF link when pdfUrl is provided', () => {
    renderToolbar('/api/manual-shifts/123/print/picker-sheet.pdf?scope=line');
    const pdfLink = screen.getByText('פתח PDF');
    expect(pdfLink).toBeDefined();
    expect(pdfLink.getAttribute('href')).toBe('/api/manual-shifts/123/print/picker-sheet.pdf?scope=line');
  });

  it('does not render פתח PDF when pdfUrl is undefined', () => {
    renderToolbar();
    expect(screen.queryByText('פתח PDF')).toBeNull();
  });

  it('opens PDF link in new tab with noopener', () => {
    renderToolbar('/api/manual-shifts/123/print/picker-sheet.pdf?scope=line');
    const pdfLink = screen.getByText('פתח PDF');
    expect(pdfLink.getAttribute('target')).toBe('_blank');
    expect(pdfLink.getAttribute('rel')).toBe('noopener noreferrer');
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
