import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopDetailOrdersTable } from '../desktop-detail-orders-table';

describe('DesktopDetailOrdersTable', () => {
  it('renders dash when ageSeconds is null', () => {
    render(
      <DesktopDetailOrdersTable
        mode="line"
        rows={[
          {
            orderId: 'o1',
            status: 'returned',
            pointName: 'נקודה',
            customerName: null,
            orderNumber: 'ORD-1',
            pickerName: 'דוד',
            size: 'M',
            lineCount: 2,
            palletCount: 1,
            ageSeconds: null
          }
        ]}
      />
    );

    expect(screen.getByText('—')).toBeTruthy();
  });

  it('clicking a line detail row triggers onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    render(
      <DesktopDetailOrdersTable
        mode="line"
        onSelectOrder={onSelectOrder}
        rows={[
          {
            orderId: 'line-order-1',
            status: 'picking',
            pointName: 'נקודה',
            customerName: null,
            orderNumber: 'L-1',
            pickerName: 'דוד',
            size: 'M',
            lineCount: 2,
            palletCount: 1,
            ageSeconds: 10
          }
        ]}
      />
    );

    fireEvent.click(screen.getByTestId('detail-order-row-line-order-1'));
    expect(onSelectOrder).toHaveBeenCalledWith('line-order-1');
  });

  it('clicking a picker detail row triggers onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    render(
      <DesktopDetailOrdersTable
        mode="picker"
        onSelectOrder={onSelectOrder}
        rows={[
          {
            orderId: 'picker-order-1',
            status: 'waiting_check',
            lineId: 'line-1',
            lineName: 'קו צפון',
            pointName: 'נקודה',
            customerName: null,
            orderNumber: 'P-1',
            size: 'L',
            lineCount: 3,
            palletCount: 2,
            ageSeconds: 30
          }
        ]}
      />
    );

    fireEvent.click(screen.getByTestId('detail-order-row-picker-order-1'));
    expect(onSelectOrder).toHaveBeenCalledWith('picker-order-1');
  });
});
