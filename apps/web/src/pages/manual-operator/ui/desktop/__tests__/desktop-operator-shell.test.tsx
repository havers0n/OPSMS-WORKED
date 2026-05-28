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
  mockOrderDetail,
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
  orderDetail: null,
  selectedDetailType: null as 'line' | 'picker' | 'order' | null,
  onSelectLine: vi.fn(),
  onSelectPicker: vi.fn(),
  onSelectOrder: vi.fn(),
  onCloseDetail: vi.fn(),
  onCreateShift: vi.fn(),
  isCreatingShift: false,
  selectedDate: '2026-05-28',
  todayDate: '2026-05-29',
  onChangeDate: vi.fn(),
  onOpenDatePicker: vi.fn()
};

describe('DesktopOperatorShell', () => {
  it('renders loading skeleton when isLoading is true', () => {
    render(<DesktopOperatorShell {...defaultProps} isLoading={true} />);
    expect(screen.getByLabelText(/טוען|loading/i)).toBeTruthy();
  });

  it('renders empty state when shift is null', () => {
    render(<DesktopOperatorShell {...defaultProps} shift={null} isLoading={false} />);
    expect(screen.getAllByText('אין משמרת פעילה').length).toBeGreaterThan(0);
    expect(screen.getByText('פתח משמרת להיום')).toBeTruthy();
  });

  it('passes check queue data to picker panel', () => {
    render(<DesktopOperatorShell {...defaultProps} checkQueue={mockCheckQueue} />);
    expect(screen.getByText(/ממתינים לבדיקה/)).toBeTruthy();
  });

  it('renders line detail drawer when line detail is selected', () => {
    render(<DesktopOperatorShell {...defaultProps} selectedDetailType="line" lineDetail={mockLineDetail} />);
    expect(screen.getByRole('button', { name: /סגור|close/i })).toBeTruthy();
  });

  it('renders picker detail drawer when picker detail is selected', () => {
    render(<DesktopOperatorShell {...defaultProps} selectedDetailType="picker" pickerDetail={mockPickerDetail} />);
    expect(screen.getByRole('button', { name: /סגור|close/i })).toBeTruthy();
  });

  it('renders order detail drawer when order detail is selected', () => {
    render(<DesktopOperatorShell {...defaultProps} selectedDetailType="order" orderDetail={mockOrderDetail} />);
    expect(screen.getByTestId('order-detail-view')).toBeTruthy();
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

    fireEvent.click(screen.getByRole('button', { name: /סגור|close/i }));
    expect(onCloseDetail).toHaveBeenCalledOnce();
  });

  it('clicking active order row calls onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    render(<DesktopOperatorShell {...defaultProps} onSelectOrder={onSelectOrder} />);
    fireEvent.click(screen.getByTestId(`active-order-row-${mockActiveOrders[0].orderId}`));
    expect(onSelectOrder).toHaveBeenCalledWith(mockActiveOrders[0].orderId);
  });

  it('clicking line detail order row calls onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    render(
      <DesktopOperatorShell
        {...defaultProps}
        selectedDetailType="line"
        lineDetail={mockLineDetail}
        onSelectOrder={onSelectOrder}
      />
    );
    fireEvent.click(screen.getByTestId(`detail-order-row-${mockLineDetail.orders[0].orderId}`));
    expect(onSelectOrder).toHaveBeenCalledWith(mockLineDetail.orders[0].orderId);
  });

  it('clicking picker detail order row calls onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    render(
      <DesktopOperatorShell
        {...defaultProps}
        selectedDetailType="picker"
        pickerDetail={mockPickerDetail}
        onSelectOrder={onSelectOrder}
      />
    );
    fireEvent.click(screen.getByTestId(`detail-order-row-${mockPickerDetail.orders[0].orderId}`));
    expect(onSelectOrder).toHaveBeenCalledWith(mockPickerDetail.orders[0].orderId);
  });

  it('date navigation buttons call onChangeDate', () => {
    const onChangeDate = vi.fn();
    render(<DesktopOperatorShell {...defaultProps} onChangeDate={onChangeDate} />);
    fireEvent.click(screen.getByRole('button', { name: 'תאריך קודם' }));
    fireEvent.click(screen.getByRole('button', { name: 'תאריך הבא' }));
    fireEvent.click(screen.getByRole('button', { name: 'היום' }));
    expect(onChangeDate).toHaveBeenCalledWith('2026-05-27');
    expect(onChangeDate).toHaveBeenCalledWith('2026-05-29');
    expect(onChangeDate).toHaveBeenCalledTimes(3);
  });

  it('clicking date label calls onOpenDatePicker', () => {
    const onOpenDatePicker = vi.fn();
    render(<DesktopOperatorShell {...defaultProps} onOpenDatePicker={onOpenDatePicker} />);
    fireEvent.click(screen.getByRole('button', { name: 'פתח לוח שנה' }));
    expect(onOpenDatePicker).toHaveBeenCalledOnce();
  });
});
