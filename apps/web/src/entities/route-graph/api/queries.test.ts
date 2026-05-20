import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffRequest } from '@/shared/api/bff/client';
import { getRouteGraph, routeGraphKeys } from './queries';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('route graph query api', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
    vi.mocked(bffRequest).mockResolvedValue({ nodes: [], edges: [] } as never);
  });

  it('builds GET /api/floors/:floorId/routing/graph', async () => {
    await getRouteGraph('floor-1');

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/routing/graph'
    );
  });

  it('builds floor-scoped query keys', () => {
    expect(routeGraphKeys.byFloor('floor-1')).toEqual([
      'route-graph',
      'by-floor',
      'floor-1'
    ]);
  });
});
