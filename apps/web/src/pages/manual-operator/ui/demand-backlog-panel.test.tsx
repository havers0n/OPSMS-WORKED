// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { DemandBacklogPanel, DemandBacklogStatusBadge } from './demand-backlog-panel';

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return { ...actual, useQuery: vi.fn() };
});

const item = {
  orderNumber: 'SO-100', customerName: 'לקוח א', plannedDeliveryDate: '2026-07-01',
  distributionArea: 'צפון', distributionLine: 'קו 1', rowCount: 2, skuCount: 2,
  totalQuantity: 100, publishedQuantity: 40, availableQuantity: 60,
  status: 'partially_published' as const, firstSeenAt: '2026-06-01T10:00:00.000Z',
  lastSeenAt: '2026-06-30T10:00:00.000Z', latestBatchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  latestBatchName: 'batch.xlsx'
};

function LocationProbe() {
  return <output data-testid="location">{useLocation().search}</output>;
}
function renderPanel(entry = '/operator/manual/lines?mode=demand&intent=backlog') {
  return render(<MemoryRouter initialEntries={[entry]}><DemandBacklogPanel /><LocationProbe /></MemoryRouter>);
}
function mockQuery(overrides: Record<string, unknown>) {
  vi.mocked(useQuery).mockReturnValue({
    data: undefined, isLoading: false, isError: false, isFetching: false, refetch: vi.fn(),
    ...overrides
  } as unknown as ReturnType<typeof useQuery>);
}

describe('DemandBacklogPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [{ isLoading: true }, 'טוען הזמנות ביקוש…'],
    [{ isError: true }, 'לא ניתן לטעון את מאגר הביקוש. נסו לרענן.'],
    [{ data: { items: [], pagination: { page: 1, limit: 50, total: 0, totalPages: 0 } } }, 'לא נמצאו הזמנות התואמות למסננים.']
  ])('renders an explicit state', (state, text) => {
    mockQuery(state);
    renderPanel();
    expect(screen.getByText(text)).toBeTruthy();
  });

  it('renders successful rows and status badges', () => {
    mockQuery({ data: { items: [item], pagination: { page: 1, limit: 50, total: 1, totalPages: 1 } } });
    renderPanel();
    expect(screen.getByText('SO-100')).toBeTruthy();
    expect(screen.getAllByText('פורסם חלקית')).toHaveLength(2);
    expect(screen.getByText('batch.xlsx')).toBeTruthy();
  });

  it('writes filters to URL parameters and resets the page', () => {
    mockQuery({ isLoading: true });
    renderPanel('/operator/manual/lines?mode=demand&intent=backlog&page=3');
    fireEvent.change(screen.getByLabelText('מק״ט'), { target: { value: 'SKU-9' } });
    expect(screen.getByTestId('location').textContent).toContain('sku=SKU-9');
    expect(screen.getByTestId('location').textContent).toContain('page=1');
  });

  it('moves to the next page', () => {
    mockQuery({ data: { items: [item], pagination: { page: 1, limit: 50, total: 51, totalPages: 2 } } });
    renderPanel();
    fireEvent.click(screen.getByLabelText('העמוד הבא'));
    expect(screen.getByTestId('location').textContent).toContain('page=2');
  });
});

describe('DemandBacklogStatusBadge', () => {
  it.each([
    ['available', 'זמין'], ['partially_published', 'פורסם חלקית'], ['fully_published', 'פורסם במלואו'],
    ['review_needed', 'נדרשת בדיקה'], ['excluded', 'לא נכלל'], ['over_published', 'פורסם ביתר']
  ] as const)('renders %s', (status, label) => {
    const { unmount } = render(<DemandBacklogStatusBadge status={status} />);
    expect(screen.getByText(label)).toBeTruthy();
    unmount();
  });
});
