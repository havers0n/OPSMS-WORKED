import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductControlTab } from './product-control-tab';
import { CoverageStatusBadge } from '@/entities/product-control/coverage-status-badge';
import type { ProductControlStatus } from '@/entities/product-control/product-control-types';

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
  it('renders the main title', () => {
    render(<ProductControlTab />);
    expect(screen.getByText('חוסרים להיום + כיסוי בונדד')).toBeTruthy();
  });

  it('renders subtitle describing the view', () => {
    render(<ProductControlTab />);
    expect(screen.getByText(/סקירת מלאי זמין מול דרישות/)).toBeTruthy();
  });

  it('renders KPI cards with derived counts', () => {
    render(<ProductControlTab />);

    expect(screen.getByText('סה״כ מק״טים')).toBeTruthy();
    expect(screen.getByText('בחוסר')).toBeTruthy();
    expect(screen.getByText('ניתן לכיסוי')).toBeTruthy();

    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
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
    expect(screen.getByText('כיסוי מלא')).toBeTruthy();
    expect(screen.getByText('כיסוי חלקי')).toBeTruthy();
    expect(screen.getAllByText('ללא כיסוי').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('בעיית נתונים')).toBeTruthy();
  });

  it('highlights data_issue row distinctly', () => {
    render(<ProductControlTab />);

    expect(screen.getByText('999999')).toBeTruthy();
    expect(screen.getByText('?!? נתונים לא תקינים')).toBeTruthy();
  });

  it('renders table header columns matching prototype', () => {
    render(<ProductControlTab />);

    const headers = ['תיאור פריט', 'קטגוריה', 'כמות בהזמנה', 'כמות במחסן', 'חסר', 'זמין בבונדד', 'סטטוס כיסוי', 'שורות מושפעות'];
    for (const h of headers) {
      expect(screen.getByText(h)).toBeTruthy();
    }
  });

  it('opens drawer when clicking a product row', () => {
    render(<ProductControlTab />);

    expect(screen.queryByText('פריט נבחר')).toBeNull();

    fireEvent.click(screen.getByText('100002'));

    expect(screen.getByText('פריט נבחר')).toBeTruthy();
    expect(screen.getAllByText('טונר דיו שחור HP 85A').length).toBeGreaterThanOrEqual(2);
  });

  it('drawer shows selected SKU and bonded coverage details', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100003'));

    expect(screen.getAllByText('קלסר טבעות 5 ס"מ כחול').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('100003').length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText('במחסן')).toBeTruthy();
    expect(screen.getByText('כמות חסרה להיום')).toBeTruthy();
    expect(screen.getByText('כרגע בבונדד')).toBeTruthy();

    expect(screen.getByText('פעולות משיכה מבונדד')).toBeTruthy();
    expect(screen.getByText('השפעה על הפצה')).toBeTruthy();
  });

  it('closes drawer when clicking close button', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('סגור פרטי מוצר'));
    expect(screen.queryByText('פריט נבחר')).toBeNull();
  });

  it('toggles row selection on re-click', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();

    const skuCells = screen.getAllByText('100002');
    fireEvent.click(skuCells[0]);
    expect(screen.queryByText('פריט נבחר')).toBeNull();
  });

  it('does not open drawer for data_issue row', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('999999'));

    expect(screen.queryByText('פריט נבחר')).toBeNull();
  });

  it('closes drawer with בטל וסגור button', () => {
    render(<ProductControlTab />);

    fireEvent.click(screen.getByText('100002'));
    expect(screen.getByText('פריט נבחר')).toBeTruthy();

    fireEvent.click(screen.getByText('בטל וסגור'));
    expect(screen.queryByText('פריט נבחר')).toBeNull();
  });
});
