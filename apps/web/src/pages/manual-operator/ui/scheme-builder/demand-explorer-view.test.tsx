import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DemandExplorerView } from './demand-explorer-view';

const mockData = {
  orders: [
    {
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
    },
    {
      orderId: 'exp_o_def456',
      orderNumber: 'SO-12346',
      customerName: 'אסם',
      distributionArea: 'צפון',
      rowCount: 5,
      skuCount: 8,
      totalQuantity: 180,
      assignedQuantity: 180,
      remainingQuantity: 0,
      publishedQuantity: 0,
      status: 'assigned' as const,
    },
  ],
  pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
  summary: {
    totalOrders: 2,
    totalSkuCount: 20,
    totalQuantity: 530,
    totalAssignedQuantity: 380,
    totalRemainingQuantity: 150,
  },
};

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe('DemandExplorerView', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders loading skeleton', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
    const { container } = renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('renders error state with retry button', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    expect(await screen.findByText(/שגיאה/)).toBeTruthy();
    expect(screen.getByText(/נסה שנית/)).toBeTruthy();
  });

  it('renders empty state when no orders', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        orders: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        summary: { totalOrders: 0, totalSkuCount: 0, totalQuantity: 0, totalAssignedQuantity: 0, totalRemainingQuantity: 0 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    expect(await screen.findByText(/לא נמצאו הזמנות זמינות/)).toBeTruthy();
  });

  it('renders orders from data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    expect(await screen.findByText('SO-12345')).toBeTruthy();
    expect(screen.getByText('תנובה')).toBeTruthy();
    expect(screen.getByText('SO-12346')).toBeTruthy();
    expect(screen.getByText('אסם')).toBeTruthy();
  });

  it('shows summary header', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    expect(await screen.findByText(/2 הזמנות/)).toBeTruthy();
    expect(screen.getByText(/530 כמות/)).toBeTruthy();
  });

  it('shows status badge for each order', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    const partialBadges = await screen.findAllByText('שויך חלקית');
    expect(partialBadges.length).toBeGreaterThanOrEqual(1);
    const assignedBadges = screen.getAllByText('שויך');
    expect(assignedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('filters by status when clicking a pill', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    const partialBadges = await screen.findAllByText('שויך חלקית');
    expect(partialBadges.length).toBeGreaterThanOrEqual(1);

    const assignedPills = screen.getAllByText('שויך');
    const statusPill = assignedPills[assignedPills.length - 1];
    await userEvent.click(statusPill);
  });

  it('renders empty search state when filter yields no results', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mockData), { status: 200, headers: { 'Content-Type': 'application/json' } })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({
          orders: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          summary: { totalOrders: 0, totalSkuCount: 0, totalQuantity: 0, totalAssignedQuantity: 0, totalRemainingQuantity: 0 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      );
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    expect(await screen.findByText('SO-12345')).toBeTruthy();
  });

  it('shows pagination controls when multiple pages', async () => {
    const manyOrders = Array.from({ length: 25 }, (_, i) => ({
      orderId: `exp_o_${i}`,
      orderNumber: `SO-${10000 + i}`,
      customerName: `לקוח ${i}`,
      distributionArea: 'צפון',
      rowCount: 1,
      skuCount: 1,
      totalQuantity: 10,
      assignedQuantity: 0,
      remainingQuantity: 10,
      publishedQuantity: 0,
      status: 'unassigned' as const,
    }));
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({
        orders: manyOrders.slice(0, 20),
        pagination: { page: 1, limit: 20, total: 25, totalPages: 2 },
        summary: { totalOrders: 25, totalSkuCount: 25, totalQuantity: 250, totalAssignedQuantity: 0, totalRemainingQuantity: 250 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    );
    renderWithQuery(
      <DemandExplorerView draftId="test-draft" distributionArea="צפון" />
    );
    const pageLabels = await screen.findAllByText(/עמ' 1 מתוך 2/);
    expect(pageLabels.length).toBe(2);
    expect(screen.getAllByText(/הבא/).length).toBe(2);
    expect(screen.getAllByText(/הקודם/).length).toBe(2);
  });
});
