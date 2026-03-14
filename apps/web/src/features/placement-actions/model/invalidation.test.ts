import { describe, expect, it, vi } from 'vitest';
import { invalidatePlacementQueries } from './invalidation';

describe('invalidatePlacementQueries', () => {
  it('invalidates explicit cell storage, container storage, and floor workspace keys', async () => {
    const invalidateQueries = vi.fn(async () => undefined);

    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      {
        floorId: 'floor-uuid',
        sourceCellId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
        targetCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
        containerId: 'container-uuid'
      }
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(4);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cell', 'storage', '188ed1eb-c44d-47f8-a8b1-94c7e20db85f']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cell', 'storage', 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'storage', 'container-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['layout-version', 'workspace', 'floor-uuid']
    });
  });

  it('skips cell invalidation when there is no source cell id', async () => {
    const invalidateQueries = vi.fn(async () => undefined);

    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      {
        floorId: 'floor-uuid',
        sourceCellId: null,
        targetCellId: null,
        containerId: null
      }
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['layout-version', 'workspace', 'floor-uuid']
    });
  });
});
