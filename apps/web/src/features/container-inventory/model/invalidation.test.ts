import { describe, expect, it, vi } from 'vitest';
import { invalidateContainerInventoryQueries } from './invalidation';

describe('invalidateContainerInventoryQueries', () => {
  it('invalidates the container snapshot, parent cell snapshot, slot storage caches, and workspace queries', async () => {
    const invalidateQueries = vi.fn(async () => undefined);

    await invalidateContainerInventoryQueries(
      { invalidateQueries } as never,
      {
        floorId: 'floor-uuid',
        sourceCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f'
      }
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(5);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'storage', '188ed1eb-c44d-47f8-a8b1-94c7e20db85f']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'storage']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cell', 'slot-storage']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'occupancy-by-floor', 'floor-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['layout-version', 'workspace', 'floor-uuid']
    });
  });

  it('still invalidates slot storage caches when there is no selected cell or floor', async () => {
    const invalidateQueries = vi.fn(async () => undefined);

    await invalidateContainerInventoryQueries(
      { invalidateQueries } as never,
      {
        floorId: null,
        sourceCellId: null,
        containerId: null
      }
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'storage']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['cell', 'slot-storage']
    });
  });
});
