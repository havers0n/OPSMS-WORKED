import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemandBacklogOrderQuery } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';
import { demandBacklogKeys, demandBacklogOrdersQueryOptions } from './queries';

vi.mock('@/shared/api/bff/client', () => ({ bffRequest: vi.fn() }));

const filters: DemandBacklogOrderQuery = {
  dateFrom: '2026-06-01', dateTo: '2026-06-30', status: 'available', q: 'SO-1', sku: 'SKU-1',
  customer: 'לקוח', distributionArea: 'צפון', distributionLine: '1',
  sourceBatchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', page: 2, limit: 25
};

describe('demand backlog order query', () => {
  beforeEach(() => vi.clearAllMocks());

  it('includes every filter in the query key', () => {
    expect(demandBacklogKeys.orders(filters)).toEqual(['demand-backlog', 'orders', filters]);
  });

  it('sends every filter to the backlog-orders endpoint', async () => {
    const queryFn = demandBacklogOrdersQueryOptions(filters).queryFn;
    await queryFn?.({} as never);
    const url = vi.mocked(bffRequest).mock.calls[0]?.[0] ?? '';
    expect(url.startsWith('/api/demand-planning/backlog-orders?')).toBe(true);
    const search = new URL(url, 'http://localhost').searchParams;
    Object.entries(filters).forEach(([key, value]) => expect(search.get(key)).toBe(String(value)));
  });
});
