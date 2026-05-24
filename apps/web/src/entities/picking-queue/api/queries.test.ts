import { describe, expect, it, vi } from 'vitest';
import type { OrderSummary, WaveSummary } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';
import { fetchPickingQueue } from './queries';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('fetchPickingQueue', () => {
  it('maps ready/released orders and waves to queue items', async () => {
    vi.mocked(bffRequest)
      .mockResolvedValueOnce([
        {
          id: 'order-1',
          tenantId: 't-1',
          externalNumber: 'ORD-001',
          status: 'ready',
          priority: 1,
          waveId: null,
          waveName: null,
          lineCount: 2,
          unitCount: 10,
          pickedUnitCount: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          releasedAt: null,
          closedAt: null
        }
      ] satisfies OrderSummary[])
      .mockResolvedValueOnce([
        {
          id: 'wave-1',
          tenantId: 't-1',
          name: 'WAVE-001',
          status: 'released',
          totalOrders: 3,
          readyOrders: 3,
          blockingOrderCount: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          releasedAt: null,
          closedAt: null
        }
      ] satisfies WaveSummary[]);

    await expect(fetchPickingQueue()).resolves.toEqual([
      {
        kind: 'order',
        id: 'order-1',
        displayCode: 'ORD-001',
        status: 'ready',
        lineCount: 2
      },
      {
        kind: 'wave',
        id: 'wave-1',
        displayCode: 'WAVE-001',
        status: 'ready',
        orderCount: 3
      }
    ]);
  });
});
