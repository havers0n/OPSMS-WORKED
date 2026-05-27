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
});