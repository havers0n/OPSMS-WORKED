import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { ShiftDatePicker } from './shift-date-picker';

describe('ShiftDatePicker', () => {
  const today = '2026-06-27';
  const yesterday = '2026-06-26';
  const tomorrow = '2026-06-28';
  const dayAfterTomorrow = '2026-06-29';
  const nextMonthDate = '2026-07-01';
  const _twoMonthsLater = '2026-08-15';

  const baseProps = {
    selectedDate: today,
    todayDate: today,
    onSelect: () => {},
    onClose: () => {},
  };

  it('defaults maxSelectableDate to todayDate — future dates are disabled', () => {
    render(<ShiftDatePicker {...baseProps} />);

    const tomorrowBtn = screen.getByRole('button', { name: tomorrow });
    expect(tomorrowBtn).toBeDisabled();
  });

  it('past dates are not disabled', () => {
    render(<ShiftDatePicker {...baseProps} />);

    const yesterdayBtn = screen.getByRole('button', { name: yesterday });
    expect(yesterdayBtn).not.toBeDisabled();
  });

  it('today is not disabled', () => {
    render(<ShiftDatePicker {...baseProps} />);

    const todayBtn = screen.getByRole('button', { name: today });
    expect(todayBtn).not.toBeDisabled();
  });

  it('with maxSelectableDate set to future date, dates up to it are enabled, dates after are disabled', () => {
    render(
      <ShiftDatePicker
        {...baseProps}
        maxSelectableDate={tomorrow}
      />
    );

    expect(screen.getByRole('button', { name: tomorrow })).not.toBeDisabled();

    // day after maxSelectableDate but still in same month
    expect(screen.getByRole('button', { name: dayAfterTomorrow })).toBeDisabled();
  });

  it('with maxSelectableDate set 90 days ahead, near-future dates within current month are enabled', () => {
    render(
      <ShiftDatePicker
        {...baseProps}
        maxSelectableDate="2026-09-25"
      />
    );

    expect(screen.getByRole('button', { name: tomorrow })).not.toBeDisabled();
    expect(screen.getByRole('button', { name: dayAfterTomorrow })).not.toBeDisabled();
  });

  it('can navigate to future month within maxSelectableDate and see enabled dates', () => {
    render(
      <ShiftDatePicker
        {...baseProps}
        maxSelectableDate="2026-09-25"
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'חודש הבא' }));
    expect(screen.getByRole('button', { name: nextMonthDate })).not.toBeDisabled();
  });

  it('calls onSelect and onClose when a date is clicked', () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();

    render(
      <ShiftDatePicker
        {...baseProps}
        onSelect={onSelect}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: yesterday }));
    expect(onSelect).toHaveBeenCalledWith(yesterday);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('shows "Go to today" when selectedDate is not today', () => {
    render(
      <ShiftDatePicker
        {...baseProps}
        selectedDate={yesterday}
      />
    );

    expect(screen.getByText('עבור להיום')).toBeTruthy();
  });

  it('does not show "Go to today" when selectedDate is today', () => {
    render(<ShiftDatePicker {...baseProps} />);

    expect(screen.queryByText('עבור להיום')).toBeNull();
  });

  describe('month navigation', () => {
    it('next month button is disabled when viewing max month', () => {
      render(
        <ShiftDatePicker
          {...baseProps}
          selectedDate={today}
          maxSelectableDate={today}
        />
      );

      const nextBtn = screen.getByRole('button', { name: 'חודש הבא' });
      expect(nextBtn).toBeDisabled();
    });

    it('next month button is enabled when maxSelectableDate has future months', () => {
      render(
        <ShiftDatePicker
          {...baseProps}
          selectedDate={today}
          maxSelectableDate="2026-09-25"
        />
      );

      const nextBtn = screen.getByRole('button', { name: 'חודש הבא' });
      expect(nextBtn).not.toBeDisabled();
    });

    it('switching to next month shows future dates', () => {
      render(
        <ShiftDatePicker
          {...baseProps}
          selectedDate={today}
          maxSelectableDate="2026-09-25"
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'חודש הבא' }));

      // July 1 should be visible and enabled
      expect(screen.getByRole('button', { name: nextMonthDate })).not.toBeDisabled();
    });
  });
});
