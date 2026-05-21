import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bffRequest } from '@/shared/api/bff/client';
import { aisleTopologyKeys, getFloorAisleTopology } from './queries';

vi.mock('@/shared/api/bff/client', () => ({
  bffRequest: vi.fn()
}));

describe('aisle topology query api', () => {
  beforeEach(() => {
    vi.mocked(bffRequest).mockReset();
    vi.mocked(bffRequest).mockResolvedValue({
      floorId: 'floor-1',
      aisles: [],
      faceAccess: []
    } as never);
  });

  it('builds GET /api/floors/:floorId/aisle-topology', async () => {
    await getFloorAisleTopology('floor-1');

    expect(bffRequest).toHaveBeenCalledWith(
      '/api/floors/floor-1/aisle-topology'
    );
  });

  it('builds floor-scoped query keys', () => {
    expect(aisleTopologyKeys.byFloor('floor-1')).toEqual([
      'aisle-topology',
      'by-floor',
      'floor-1'
    ]);
  });
});
