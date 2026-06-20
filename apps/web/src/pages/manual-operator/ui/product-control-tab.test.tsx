import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductControlTab } from './product-control-tab';
import { CoverageStatusBadge } from '@/entities/product-control/coverage-status-badge';
import type { ProductControlStatus } from '@/entities/product-control/product-control-types';

describe('CoverageStatusBadge', () => {
  const cases: { status: ProductControlStatus; expected: string }[] = [
    { status: 'ok', expected: 'תקין' },
    { status: 'covered_by_bonded', expected: 'מכוסה מבונדד' },
    { status: 'partial_bonded', expected: 'כיסוי חלקי' },
    { status: 'unresolved', expected: 'חוסר לא פתור' },
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
  it('renders the main title', () => {
    render(<ProductControlTab />);
    expect(screen.getByText('בקרת מוצרים וחוסרים')).toBeTruthy();
  });

  it('renders subtitle describing fixture mode', () => {
    render(<ProductControlTab />);
    expect(screen.getByText(/נתוני דמו בשלב זה/)).toBeTruthy();
  });

  it('renders KPI cards with derived counts', () => {
    render(<ProductControlTab />);

    expect(screen.getByText('סה״כ מק״טים')).toBeTruthy();
    expect(screen.getByText('מק״טים בחוסר')).toBeTruthy();
    expect(screen.getByText('מכוסים מבונדד')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('renders product rows with SKU and description', () => {
    render(<ProductControlTab />);

    expect(screen.getByText('100001')).toBeTruthy();
    expect(screen.getByText('מחברת A4 100 דפים')).toBeTruthy();
    expect(screen.getByText('100002')).toBeTruthy();
    expect(screen.getByText('טונר דיו שחור HP 85A')).toBeTruthy();
  });

  it('renders status badges for all fixture rows', () => {
    render(<ProductControlTab />);

    expect(screen.getByText('תקין')).toBeTruthy();
    expect(screen.getByText('מכוסה מבונדד')).toBeTruthy();
    expect(screen.getByText('כיסוי חלקי')).toBeTruthy();
    expect(screen.getAllByText('חוסר לא פתור').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('בעיית נתונים')).toBeTruthy();
  });

  it('highlights data_issue row distinctly', () => {
    render(<ProductControlTab />);

    expect(screen.getByText('999999')).toBeTruthy();
    expect(screen.getByText('?!? נתונים לא תקינים')).toBeTruthy();
  });

  it('renders table header columns', () => {
    render(<ProductControlTab />);

    expect(screen.getByText('מק״ט')).toBeTruthy();
    expect(screen.getByText('תיאור')).toBeTruthy();
    expect(screen.getByText('קטגוריה')).toBeTruthy();
    expect(screen.getByText('דרישה')).toBeTruthy();
    expect(screen.getByText('מלאי')).toBeTruthy();
    expect(screen.getByText('חוסר')).toBeTruthy();
    expect(screen.getByText('זמין בבונדד')).toBeTruthy();
    expect(screen.getByText('כיסוי מבונדד')).toBeTruthy();
    expect(screen.getByText('חוסר סופי')).toBeTruthy();
    expect(screen.getByText('סטטוס')).toBeTruthy();
  });

  it('shows shortage values only for rows with shortage', () => {
    render(<ProductControlTab />);

    const emDashes = screen.getAllByText('—');
    expect(emDashes.length).toBeGreaterThan(0);
  });

  it('opens detail panel when clicking a product row', () => {
    render(<ProductControlTab />);

    expect(screen.queryByText('פרטי מוצר')).toBeNull();

    fireEvent.click(screen.getByText('100002'));

    expect(screen.getByText('פרטי מוצר')).toBeTruthy();
    expect(screen.getByText('כמויות')).toBeTruthy();
  });

  it('detail panel shows selected SKU in header', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100003'));

    const skuElements = screen.getAllByText('100003');
    expect(skuElements.length).toBeGreaterThanOrEqual(2);
  });

  it('detail panel shows summary cards', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100002'));

    expect(screen.getByText('השפעת חוסר')).toBeTruthy();
    expect(screen.getByText('זמין לבונדד')).toBeTruthy();
    expect(screen.getByText('מכסה מבונדד')).toBeTruthy();
  });

  it('detail panel shows fixture notes when present', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100002'));

    expect(screen.getByText(/בוצעה הזמנת רכש חלופית/)).toBeTruthy();
  });

  it('closes detail panel when clicking close button', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פרטי מוצר')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('סגור פרטי מוצר'));
    expect(screen.queryByText('פרטי מוצר')).toBeNull();
  });

  it('toggles row selection on re-click', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פרטי מוצר')).toBeTruthy();

    const skuCells = screen.getAllByText('100002');
    fireEvent.click(skuCells[0]);
    expect(screen.queryByText('פרטי מוצר')).toBeNull();
  });

  it('does not open detail panel for data_issue row', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('999999'));

    expect(screen.queryByText('פרטי מוצר')).toBeNull();
  });
});
