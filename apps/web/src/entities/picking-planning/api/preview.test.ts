import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffRequest } from '@/shared/api/bff/client';
import {
  previewExplicitPickingPlan,
  previewPickingPlanFromOrders,
  previewPickingPlanFromWave
} from './preview';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('picking planning preview api', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
    vi.mocked(bffRequest).mockResolvedValue({} as never);
  });

  it('posts orders preview payload', async () => {
    await previewPickingPlanFromOrders({ orderIds: ['order-1', 'order-2'] });

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/picking-planning/preview/orders',
      {
        method: 'POST',
        body: JSON.stringify({ orderIds: ['order-1', 'order-2'] })
      }
    );
  });

  it('posts wave preview payload', async () => {
    await previewPickingPlanFromWave({ waveId: 'wave-1' });

    expect(bffRequest).toHaveBeenCalledWith('/api/picking-planning/preview/wave', {
      method: 'POST',
      body: JSON.stringify({ waveId: 'wave-1' })
    });
  });

  it('posts explicit preview payload', async () => {
    await previewExplicitPickingPlan({
      routeMode: 'hybrid',
      tasks: []
    });

    expect(bffRequest).toHaveBeenCalledWith('/api/picking-planning/preview', {
      method: 'POST',
      body: JSON.stringify({ routeMode: 'hybrid', tasks: [] })
    });
  });
});
