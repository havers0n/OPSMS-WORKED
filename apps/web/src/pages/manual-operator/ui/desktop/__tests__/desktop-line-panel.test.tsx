import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopLinePanel } from '../desktop-line-panel';
import { mockLines } from './fixtures';

// mockLines[0] (line-1): picking=4, waitingCheck=2, returned=1, wipCount=7, errorCount=1, done=0/10
// mockLines[1] (line-2): all counts zero

describe('DesktopLinePanel', () => {
  it('renders a row for each line', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    expect(screen.getByText('קו צפון')).toBeTruthy();
    expect(screen.getByText('קו דרום')).toBeTruthy();
  });

  it('shows empty state when lines array is empty', () => {
    render(<DesktopLinePanel lines={[]} />);

    expect(screen.getByText('אין קווים פעילים')).toBeTruthy();
  });

  it('shows picking count labeled as "בליקוט" when picking is non-zero', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    // line-1 has picking=4
    expect(screen.getByText(/4 בליקוט/)).toBeTruthy();
  });

  it('does not render wipCount as "בליקוט" — only picking count gets that label', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    // line-1 wipCount=7, picking=4 — "7 בליקוט" must not appear
    expect(screen.queryByText('7 בליקוט')).toBeNull();
  });

  it('shows waitingCheck count labeled as "בדיקה" when waitingCheck is non-zero', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    // line-1 has waitingCheck=2
    expect(screen.getByText(/2 בדיקה/)).toBeTruthy();
  });

  it('shows returned count labeled as "הוחזר" when returned is non-zero', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    // line-1 has returned=1
    expect(screen.getByText(/1 הוחזר/)).toBeTruthy();
  });

  it('shows error count labeled as "תקלות" when errorCount is non-zero', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    // line-1 has errorCount=1
    expect(screen.getByText(/1 תקלות/)).toBeTruthy();
  });

  it('does not show picking/waitingCheck/returned/error labels when all counts are zero', () => {
    render(<DesktopLinePanel lines={[mockLines[1]]} />);

    // line-2 has all counts zero
    expect(screen.queryByText(/בליקוט/)).toBeNull();
    expect(screen.queryByText(/בדיקה/)).toBeNull();
    expect(screen.queryByText(/הוחזר/)).toBeNull();
    expect(screen.queryByText(/תקלות/)).toBeNull();
  });

  it('renders a progress bar for each line', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    const bars = screen.getAllByRole('progressbar');
    expect(bars.length).toBe(mockLines.length);
  });

  it('shows done/total count for each line', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    // both lines have done=0, totalOrders=10 — two cells with "0/10"
    expect(screen.getAllByText('0/10').length).toBe(2);
  });
});
