import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopLinePanel } from '../desktop-line-panel';
import { mockLines } from './fixtures';

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

  it('shows WIP count when wipCount is non-zero', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    // line-1 has wipCount=7
    expect(screen.getByText(/7 פעיל/)).toBeTruthy();
  });

  it('does not show WIP text when wipCount is zero', () => {
    render(<DesktopLinePanel lines={[mockLines[1]]} />);

    // line-2 has wipCount=0 — "פעיל" should not appear
    expect(screen.queryByText(/פעיל/)).toBeNull();
  });

  it('shows error count for lines with errors', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    expect(screen.getByText(/1 תקלות/)).toBeTruthy();
  });
});
