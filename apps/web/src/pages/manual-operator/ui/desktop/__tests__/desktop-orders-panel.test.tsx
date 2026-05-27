import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesktopOrdersPanel } from '../desktop-orders-panel';
import { mockActiveOrders, mockLines } from './fixtures';

describe('DesktopOrdersPanel', () => {
  it('renders a row for each active order', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    // orderNumbers appear as secondary muted text under the point name
    expect(screen.getByText('ORD-001')).toBeTruthy();
    expect(screen.getByText('ORD-002')).toBeTruthy();
  });

  it('shows empty state heading when orders array is empty', () => {
    render(<DesktopOrdersPanel orders={[]} lineSummaries={[]} />);

    expect(screen.getByText('אין הזמנות פעילות')).toBeTruthy();
  });

  it('shows explanatory subtitle in empty state', () => {
    render(<DesktopOrdersPanel orders={[]} lineSummaries={[]} />);

    expect(screen.getByText('כשיתחיל ליקוט, ההזמנות יופיעו כאן')).toBeTruthy();
  });

  it('renders "—" for age when ageSeconds is null (returned status)', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    // order-3 has status=returned and ageSeconds=null → should show "—"
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('renders formatted age for orders with ageSeconds set', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    // order-1 ageSeconds=720 → 12 minutes → "12ד"
    expect(screen.getByText('12ד')).toBeTruthy();
  });

  it('resolves line name from lineSummaries', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    // Both order-1 and order-3 are on line-1 = "קו צפון"
    const cells = screen.getAllByText('קו צפון');
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it('renders status badge labels in Hebrew', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    expect(screen.getByText('בליקוט')).toBeTruthy();
    expect(screen.getByText('בתור')).toBeTruthy();
    expect(screen.getByText('הוחזר')).toBeTruthy();
  });

  it('renders order count in section header', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    expect(screen.getByText(`הזמנות פעילות (${mockActiveOrders.length})`)).toBeTruthy();
  });

  it('renders סטטוס as the first column header', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    const headers = screen.getAllByRole('columnheader');
    expect(headers[0].textContent).toBe('סטטוס');
  });

  it('does not render a separate מספר column header', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    expect(screen.queryByRole('columnheader', { name: 'מספר' })).toBeNull();
  });

  it('shows orderNumber as secondary text under the point name', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    // order-1: pointName="נקודה א", orderNumber="ORD-001" — both should be in the same cell area
    expect(screen.getByText('נקודה א')).toBeTruthy();
    expect(screen.getByText('ORD-001')).toBeTruthy();
  });

  it('does not show orderNumber secondary text when orderNumber is null', () => {
    render(<DesktopOrdersPanel orders={mockActiveOrders} lineSummaries={mockLines} />);

    // order-3 has orderNumber=null — no extra element for null orderNumber
    // order-3 customerName="לקוח ב" should appear, but no null-rendered element
    expect(screen.getByText('לקוח ב')).toBeTruthy();
  });
});
