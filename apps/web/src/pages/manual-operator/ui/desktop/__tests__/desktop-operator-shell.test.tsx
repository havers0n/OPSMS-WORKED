import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopOperatorShell } from '../desktop-operator-shell';
import {
  emptyCheckQueue,
  mockActiveOrders,
  mockCheckQueue,
  mockKpi,
  mockLines,
  mockPickers,
  mockShift
} from './fixtures';

const defaultProps = {
  shift: mockShift,
  isLoading: false,
  kpi: mockKpi,
  lineSummaries: mockLines,
  activeOrders: mockActiveOrders,
  pickerWorkloads: mockPickers,
  checkQueue: emptyCheckQueue,
  onCreateShift: vi.fn(),
  isCreatingShift: false
};

describe('DesktopOperatorShell', () => {
  it('renders loading skeleton when isLoading is true', () => {
    render(<DesktopOperatorShell {...defaultProps} isLoading={true} />);

    expect(screen.getByLabelText('טוען נתונים')).toBeTruthy();
    expect(screen.queryByText('משמרת בוקר')).toBeNull();
  });

  it('renders empty state when shift is null', () => {
    render(<DesktopOperatorShell {...defaultProps} shift={null} isLoading={false} />);

    expect(screen.getByText('אין משמרת פעילה')).toBeTruthy();
    expect(screen.getByText('פתח משמרת להיום')).toBeTruthy();
  });

  it('calls onCreateShift when create button is clicked in empty state', async () => {
    const onCreateShift = vi.fn();
    render(
      <DesktopOperatorShell
        {...defaultProps}
        shift={null}
        isLoading={false}
        onCreateShift={onCreateShift}
      />
    );

    screen.getByText('פתח משמרת להיום').click();
    expect(onCreateShift).toHaveBeenCalledOnce();
  });

  it('renders shift name in header when shift is active', () => {
    render(<DesktopOperatorShell {...defaultProps} />);

    expect(screen.getByText('משמרת בוקר')).toBeTruthy();
  });

  it('renders all three panel sections', () => {
    render(<DesktopOperatorShell {...defaultProps} />);

    // Line panel header
    expect(screen.getByText('קווים')).toBeTruthy();
    // Orders panel header
    expect(screen.getByText(`הזמנות פעילות (${mockActiveOrders.length})`)).toBeTruthy();
    // Picker panel header
    expect(screen.getByText('מלקטים')).toBeTruthy();
  });

  it('renders KPI row when kpi is provided', () => {
    render(<DesktopOperatorShell {...defaultProps} />);

    expect(screen.getByRole('region', { name: 'סיכום משמרת' })).toBeTruthy();
  });

  it('shows KPI skeleton when kpi is undefined', () => {
    render(<DesktopOperatorShell {...defaultProps} kpi={undefined} />);

    // KPI row should not render; header still shows shift name
    expect(screen.getByText('משמרת בוקר')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'סיכום משמרת' })).toBeNull();
  });

  it('passes check queue data to picker panel', () => {
    render(<DesktopOperatorShell {...defaultProps} checkQueue={mockCheckQueue} />);

    expect(screen.getByText('1 ממתינים לבדיקה')).toBeTruthy();
  });
});
