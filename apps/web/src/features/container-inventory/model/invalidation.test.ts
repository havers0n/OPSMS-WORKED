import { describe, expect, it, vi } from 'vitest';
import { invalidateContainerInventoryQueries } from './invalidation';

describe('invalidateContainerInventoryQueries', () => {
  it('invalidates the container snapshot, container-list prefix, and workspace storage/layout queries', async () => {
    const invalidateQueries = vi.fn(async () => undefined);

    await invalidateContainerInventoryQueries(
      { invalidateQueries } as never,
      {
        floorId: 'floor-uuid',
        sourceCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f'
      }
    );

    expect(invalidateQueries).toHaveBeenCalledTimes(7);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'storage', '188ed1eb-c44d-47f8-a8b1-94c7e20db85f']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: [
        'container',
        'current-location',
        '188ed1eb-c44d-47f8-a8b1-94c7e20db85f'
      ]
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'storage']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'containers']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'storage-by-floor', 'floor-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'occupancy-by-floor', 'floor-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['layout-version', 'workspace', 'floor-uuid']
    });
  });

  it('still invalidates location storage and container-list queries when there is no selected cell or floor', async () => {
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
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['location', 'storage'] });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['location', 'containers'] });
  });

  it('add inventory invalidates containerKeys.storage(containerId)', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidateContainerInventoryQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', sourceCellId: null, containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'storage', 'c1']
    });
  });

  it('add inventory preserves required floor storage invalidation', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidateContainerInventoryQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', sourceCellId: null, containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'storage-by-floor', 'floor-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'storage']
    });
  });

  it('container current-location key remains invalidated', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidateContainerInventoryQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', sourceCellId: null, containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'current-location', 'c1']
    });
  });

  it('prefix is not accidentally broad across unrelated domains', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidateContainerInventoryQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', sourceCellId: null, containerId: 'c1' }
    );
    const allCalls = invalidateQueries.mock.calls.map((c: unknown[]) => (c[0] as { queryKey: unknown[] }).queryKey);
    const unrelatedPrefixes = allCalls.filter(
      (key: unknown[]) =>
        key[0] !== 'location' && key[0] !== 'container' && key[0] !== 'layout-version'
    );
    expect(unrelatedPrefixes).toEqual([]);
  });
});
