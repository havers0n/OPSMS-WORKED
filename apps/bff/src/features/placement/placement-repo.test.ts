import { describe, expect, it, vi } from 'vitest';
import { createPlacementRepo } from './placement-repo.js';

describe('placement repo executable location bridge', () => {
  it('resolves an executable location by published cell id', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'location-uuid',
        code: 'R1-A.01.01.01',
        floor_id: 'floor-uuid',
        geometry_slot_id: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      },
      error: null
    }));
    const eqGeometrySlot = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: eqGeometrySlot }));
    const from = vi.fn(() => ({ select }));

    const repo = createPlacementRepo({ from } as never);

    await expect(
      repo.resolveExecutableLocationForCell('216f2dd6-8f17-4de4-aaba-657f9e0e1398')
    ).resolves.toEqual({
      locationId: 'location-uuid',
      code: 'R1-A.01.01.01',
      floorId: 'floor-uuid',
      cellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
    });

    expect(from).toHaveBeenCalledWith('locations');
    expect(eqGeometrySlot).toHaveBeenCalledWith('geometry_slot_id', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
  });

  it('returns null for unknown or invalid cell ids', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: null
    }));
    const eqGeometrySlot = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq: eqGeometrySlot }));
    const from = vi.fn(() => ({ select }));

    const repo = createPlacementRepo({ from } as never);

    await expect(repo.resolveExecutableLocationForCell('not-a-uuid')).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();

    await expect(
      repo.resolveExecutableLocationForCell('216f2dd6-8f17-4de4-aaba-657f9e0e1398')
    ).resolves.toBeNull();
  });
});
