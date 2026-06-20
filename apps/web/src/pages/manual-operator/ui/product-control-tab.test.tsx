import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProductControlTab } from './product-control-tab';

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

    // 100001 has no shortage - should show em dash
    const emDashes = screen.getAllByText('—');
    expect(emDashes.length).toBeGreaterThan(0);
  });
});
