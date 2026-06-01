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

  it('uses זמן בשלב as detail table temporal header', () => {
    render(
      <DesktopDetailOrdersTable
        mode="line"
        rows={[
          {
            orderId: 'o2',
            status: 'queued',
            pointName: 'נקודה',
            customerName: null,
            orderNumber: 'ORD-2',
            pickerName: 'דוד',
            size: 'M',
            lineCount: 2,
            palletCount: 1,
            ageSeconds: 10
          }
        ]}
      />
    );

    expect(screen.getByText('זמן בשלב')).toBeTruthy();
  });

  it('renders done temporal value as נסגר ב־HH:mm', () => {
    render(
      <DesktopDetailOrdersTable
        mode="line"
        rows={[
          {
            orderId: 'done-1',
            status: 'done',
            pointName: 'נקודה',
            customerName: null,
            orderNumber: 'ORD-DONE',
            pickerName: 'דוד',
            size: 'M',
            lineCount: 2,
            palletCount: 1,
            ageSeconds: 9999,
            finishedAt: '2026-05-27T09:45:00.000Z'
          }
        ]}
      />
    );

    expect(screen.getByText(/^נסגר ב־\d{2}:\d{2}$/)).toBeTruthy();
  });

  it('does not render elapsed-style value for done orders', () => {
    render(
      <DesktopDetailOrdersTable
        mode="line"
        rows={[
          {
            orderId: 'done-2',
            status: 'done',
            pointName: 'נקודה',
            customerName: null,
            orderNumber: 'ORD-DONE-2',
            pickerName: 'דוד',
            size: 'M',
            lineCount: 2,
            palletCount: 1,
            ageSeconds: 7260,
            finishedAt: '2026-05-27T09:45:00.000Z'
          }
        ]}
      />
    );

    expect(screen.queryByText('2:01')).toBeNull();
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
