import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopOperatorShell } from '../desktop-operator-shell';
import {
  emptyCheckQueue,
  mockActiveOrders,
  mockCheckQueue,
  mockKpi,
  mockLineDetail,
  mockLines,
  mockPickerDetail,
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
  lineDetail: null,
  pickerDetail: null,
  selectedDetailType: null as 'line' | 'picker' | null,
  onSelectLine: vi.fn(),
  onSelectPicker: vi.fn(),
  onCloseDetail: vi.fn(),
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

    expect(screen.getByText('קווים')).toBeTruthy();
    expect(screen.getByText(`הזמנות פעילות (${mockActiveOrders.length})`)).toBeTruthy();
    expect(screen.getByText('מלקטים')).toBeTruthy();
  });

  it('renders KPI row when kpi is provided', () => {
    render(<DesktopOperatorShell {...defaultProps} />);

    expect(screen.getByRole('region', { name: 'סיכום משמרת' })).toBeTruthy();
  });

  it('shows KPI skeleton when kpi is undefined', () => {
    render(<DesktopOperatorShell {...defaultProps} kpi={undefined} />);

    expect(screen.getByText('משמרת בוקר')).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'סיכום משמרת' })).toBeNull();
  });

  it('passes check queue data to picker panel', () => {
    render(<DesktopOperatorShell {...defaultProps} checkQueue={mockCheckQueue} />);

    expect(screen.getByText('1 ממתינים לבדיקה')).toBeTruthy();
  });

  it('renders line detail drawer when line detail is selected', () => {
    render(
      <DesktopOperatorShell
        {...defaultProps}
        selectedDetailType="line"
        lineDetail={mockLineDetail}
      />
    );

    expect(screen.getByText('פרטי קו')).toBeTruthy();
  });

  it('renders picker detail drawer when picker detail is selected', () => {
    render(
      <DesktopOperatorShell
        {...defaultProps}
        selectedDetailType="picker"
        pickerDetail={mockPickerDetail}
      />
    );

    expect(screen.getByText('פרטי מלקט')).toBeTruthy();
  });

  it('calls onCloseDetail when close button is clicked', () => {
    const onCloseDetail = vi.fn();
    render(
      <DesktopOperatorShell
        {...defaultProps}
        onCloseDetail={onCloseDetail}
        selectedDetailType="line"
        lineDetail={mockLineDetail}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'סגור' }));
    expect(onCloseDetail).toHaveBeenCalledOnce();
  });
});
