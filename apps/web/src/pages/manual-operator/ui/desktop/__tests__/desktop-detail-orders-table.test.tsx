import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});