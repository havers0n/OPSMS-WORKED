import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DesktopOrdersPanel } from '../desktop-orders-panel';
import { mockActiveOrders, mockLines } from './fixtures';

describe('DesktopOrdersPanel', () => {
  it('renders a row for each active order', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);
    expect(screen.getByText('ORD-001')).toBeTruthy();
    expect(screen.getByText('ORD-002')).toBeTruthy();
  });

  it('uses זמן בשלב as active table temporal header', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);
    expect(screen.getByText('זמן בשלב')).toBeTruthy();
  });

  it('shows empty state heading when orders array is empty', () => {
    render(<DesktopOrdersPanel orders={[]} lineSummaries={[]} />);
    expect(screen.getByText(/אין|Чђ/i)).toBeTruthy();
  });

  it('renders dash for null age (returned)', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('clicking active order row triggers onSelectOrder', () => {
    const onSelectOrder = vi.fn();
    render(
      <DesktopOrdersPanel
        orders={mockActiveOrders}
        lineSummaries={mockLines}
        onSelectOrder={onSelectOrder}
      />
    );

    fireEvent.click(screen.getByTestId(`active-order-row-${mockActiveOrders[0].orderId}`));
    expect(onSelectOrder).toHaveBeenCalledWith(mockActiveOrders[0].orderId);
  });
});
