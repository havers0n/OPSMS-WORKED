import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopOrdersPanel } from '../desktop-orders-panel';
import { mockActiveOrders, mockLines } from './fixtures';

describe('DesktopOrdersPanel', () => {
  it('renders a row for each active order', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    expect(screen.getByText('ORD-001')).toBeTruthy();
    expect(screen.getByText('ORD-002')).toBeTruthy();
  });

  it('shows empty state heading when orders array is empty', () => {
    render(<DesktopOrdersPanel orders={[]} lineSummaries={[]} />);

    expect(screen.getByText('אין הזמנות פעילות')).toBeTruthy();
  });

  it('renders dash for null age (returned)', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('resolves line name from lineSummaries', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    expect(screen.getAllByText('קו צפון').length).toBeGreaterThan(0);
  });
});
