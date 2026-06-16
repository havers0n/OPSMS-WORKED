import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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

  it('invokes selection callback when line row is clicked', () => {
    const onSelectLine = vi.fn();
    render(<DesktopLinePanel lines={mockLines} onSelectLine={onSelectLine} />);

    fireEvent.click(screen.getByLabelText('פתח פרטי קו קו צפון'));
    expect(onSelectLine).toHaveBeenCalledWith('line-1');
  });

  it('renders a progress bar for each line', () => {
    render(<DesktopLinePanel lines={mockLines} />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(mockLines.length);
  });

  it('applies selected highlight when selectedLineId matches a line', () => {
    const { container } = render(
      <DesktopLinePanel lines={mockLines} selectedLineId="line-1" />
    );
    const firstRow = container.querySelector('[aria-label="פתח פרטי קו קו צפון"]');
    expect(firstRow?.className).toContain('bg-blue-50');
  });

  it('does not apply selected highlight when selectedLineId does not match', () => {
    const { container } = render(
      <DesktopLinePanel lines={mockLines} selectedLineId="line-1" />
    );
    const secondRow = container.querySelector('[aria-label="פתח פרטי קו קו דרום"]');
    expect(secondRow?.className).not.toContain('bg-blue-50');
  });
});