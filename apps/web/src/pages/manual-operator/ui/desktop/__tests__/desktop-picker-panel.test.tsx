import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopPickerPanel } from '../desktop-picker-panel';
import { emptyCheckQueue, mockCheckQueue, mockPickers } from './fixtures';

describe('DesktopPickerPanel', () => {
  it('renders a row for each picker', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={emptyCheckQueue} />);

    expect(screen.getByText('דוד')).toBeTruthy();
    expect(screen.getByText('שרה')).toBeTruthy();
  });

  it('renders pickers in order provided (sorted by totalLineCount desc from selector)', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={emptyCheckQueue} />);

    const names = screen.getAllByText(/^(דוד|שרה)$/);
    // fixtures already sorted: דוד (30 lines) before שרה (15 lines)
    expect(names[0].textContent).toBe('דוד');
    expect(names[1].textContent).toBe('שרה');
  });

  it('shows empty state when pickers array is empty', () => {
    render(<DesktopPickerPanel pickers={[]} checkQueue={emptyCheckQueue} />);

    expect(screen.getByText('אין מלקטים פעילים')).toBeTruthy();
  });

  it('shows check queue alert when count > 0', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={mockCheckQueue} />);

    expect(screen.getByText('1 ממתינים לבדיקה')).toBeTruthy();
  });

  it('does not show check queue alert when count is 0', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={emptyCheckQueue} />);

    expect(screen.queryByText(/ממתינים לבדיקה/)).toBeNull();
  });

  it('shows oldest waiting age in check queue alert', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={mockCheckQueue} />);

    // oldestOrder.waitingSeconds = 600 → 10 minutes → "10ד"
    expect(screen.getByText(/10ד/)).toBeTruthy();
  });

  it('shows waitingCheck badge on picker with pending checks', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={emptyCheckQueue} />);

    // דוד has waitingCheck=1
    expect(screen.getByText('1✓')).toBeTruthy();
  });

  it('renders unassigned picker name as "לא משויך"', () => {
    const unassigned = [
      {
        ...mockPickers[0],
        pickerKey: '__unassigned__',
        pickerName: null
      }
    ];
    render(<DesktopPickerPanel pickers={unassigned} checkQueue={emptyCheckQueue} />);

    expect(screen.getByText('לא משויך')).toBeTruthy();
  });

  it('shows totalLineCount as primary workload metric', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={emptyCheckQueue} />);

    // דוד has totalLineCount=30, שרה has totalLineCount=15
    expect(screen.getByText(/30 שורות/)).toBeTruthy();
    expect(screen.getByText(/15 שורות/)).toBeTruthy();
  });

  it('shows wipCount labeled as "פעיל" when wipCount is non-zero', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={emptyCheckQueue} />);

    // דוד has wipCount=5
    expect(screen.getByText(/5 פעיל/)).toBeTruthy();
  });

  it('shows done count labeled as "הסתיימו" when done is non-zero', () => {
    const pickerWithDone = [{ ...mockPickers[0], done: 3 }];
    render(<DesktopPickerPanel pickers={pickerWithDone} checkQueue={emptyCheckQueue} />);

    expect(screen.getByText(/3 הסתיימו/)).toBeTruthy();
  });

  it('does not show "הסתיימו" when done is zero', () => {
    // mockPickers[1] (שרה) has done=0
    render(<DesktopPickerPanel pickers={[mockPickers[1]]} checkQueue={emptyCheckQueue} />);

    expect(screen.queryByText(/הסתיימו/)).toBeNull();
  });
});
