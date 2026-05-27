import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopPickerPanel } from '../desktop-picker-panel';
import { emptyCheckQueue, mockCheckQueue, mockPickers } from './fixtures';

describe('DesktopPickerPanel', () => {
  it('renders a row for each picker', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={emptyCheckQueue} />);

    expect(screen.getByText('דוד')).toBeTruthy();
    expect(screen.getByText('שרה')).toBeTruthy();
  });

  it('shows empty state when pickers array is empty', () => {
    render(<DesktopPickerPanel pickers={[]} checkQueue={emptyCheckQueue} />);

    expect(screen.getByText('אין מלקטים פעילים')).toBeTruthy();
  });

  it('shows check queue alert when count > 0', () => {
    render(<DesktopPickerPanel pickers={mockPickers} checkQueue={mockCheckQueue} />);

    expect(screen.getByText('1 ממתינים לבדיקה')).toBeTruthy();
  });

  it('invokes selection callback when picker row is clicked', () => {
    const onSelectPicker = vi.fn();
    render(
      <DesktopPickerPanel
        pickers={mockPickers}
        checkQueue={emptyCheckQueue}
        onSelectPicker={onSelectPicker}
      />
    );

    fireEvent.click(screen.getByLabelText('פתח פרטי מלקט דוד'));
    expect(onSelectPicker).toHaveBeenCalledWith('דוד');
  });

  it('renders unassigned picker name as "לא משויך"', () => {
    const unassigned = [{ ...mockPickers[0], pickerKey: '__unassigned__', pickerName: null }];
    render(<DesktopPickerPanel pickers={unassigned} checkQueue={emptyCheckQueue} />);

    expect(screen.getByText('לא משויך')).toBeTruthy();
  });
});