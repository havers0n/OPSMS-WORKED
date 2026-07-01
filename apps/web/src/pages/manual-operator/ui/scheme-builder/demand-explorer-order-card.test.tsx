import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemandExplorerOrderCard } from './demand-explorer-order-card';

const mockOrder = {
  orderId: 'exp_o_abc123',
  orderNumber: 'SO-12345',
  customerName: 'תנובה',
  distributionArea: 'צפון',
  rowCount: 8,
  skuCount: 12,
  totalQuantity: 350,
  assignedQuantity: 200,
  remainingQuantity: 150,
  publishedQuantity: 0,
  status: 'partial' as const,
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('DemandExplorerOrderCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders order info when collapsed', () => {
    renderWithQuery(
      <DemandExplorerOrderCard order={mockOrder} draftId="test-draft" />
    );
    expect(screen.getByText('SO-12345')).toBeTruthy();
    expect(screen.getByText('תנובה')).toBeTruthy();
    expect(screen.getByText('שויך חלקית')).toBeTruthy();
    expect(screen.getByText('צפון')).toBeTruthy();
    expect(screen.getByText(/פתח פריטים/)).toBeTruthy();
  });

  it('shows stats in collapsed state', () => {
    renderWithQuery(
      <DemandExplorerOrderCard order={mockOrder} draftId="test-draft" />
    );
    expect(screen.getByText(/350/)).toBeTruthy();
    expect(screen.getByText(/200/)).toBeTruthy();
    expect(screen.getByText(/150/)).toBeTruthy();
    expect(screen.getByText(/8/)).toBeTruthy();
    const skuEls = screen.getAllByText(/12/);
    expect(skuEls.length).toBeGreaterThanOrEqual(1);
  });

  it('expands and shows items table on click', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    renderWithQuery(
      <DemandExplorerOrderCard order={mockOrder} draftId="test-draft" />
    );
    const expandBtn = screen.getByText(/פתח פריטים/);
    await userEvent.click(expandBtn);
    expect(screen.getByText(/טוען פרטים/)).toBeTruthy();
  });
});
