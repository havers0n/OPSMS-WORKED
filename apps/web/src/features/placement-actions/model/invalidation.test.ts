import { describe, expect, it, vi } from 'vitest';
import { invalidatePlacementQueries } from './invalidation';

describe('invalidatePlacementQueries', () => {
  it('invalidates location storage, location container-list, floor storage snapshot, floor occupancy, container storage, container current-location, and floor workspace keys', async () => {
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

    expect(invalidateQueries).toHaveBeenCalledTimes(7);
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
      queryKey: ['container', 'storage', 'container-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'current-location', 'container-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'occupancy-by-floor', 'floor-uuid']
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['layout-version', 'workspace', 'floor-uuid']
    });
  });

  it('invalidates container-list prefix even when there is no container id', async () => {
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

    expect(invalidateQueries).toHaveBeenCalledTimes(5);
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

  it('place invalidates location container-list prefix', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'containers']
    });
  });

  it('remove invalidates location container-list prefix', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'containers']
    });
  });

  it('move invalidates location container-list prefix', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', sourceCellId: 'cell-a', containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'containers']
    });
  });

  it('swap invalidates location container-list prefix', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      {
        floorId: 'floor-uuid',
        sourceCellId: 'cell-a',
        targetCellId: 'cell-b',
        containerId: 'c1',
        targetContainerId: 'c2'
      }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'containers']
    });
  });

  it('invalidates container current-location after placement mutations', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['container', 'current-location', 'c1']
    });
  });

  it('invalidates occupancyByFloor where required', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', containerId: 'c1' }
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['location', 'occupancy-by-floor', 'floor-uuid']
    });
  });

  it('container-list prefix is not accidentally so broad that it refetches unrelated domains', async () => {
    const invalidateQueries = vi.fn(async () => undefined);
    await invalidatePlacementQueries(
      { invalidateQueries } as never,
      { floorId: 'floor-uuid', containerId: 'c1' }
    );
    const allCalls = invalidateQueries.mock.calls.map((c: unknown[]) => (c[0] as { queryKey: unknown[] }).queryKey);
    const unrelatedPrefixes = allCalls.filter(
      (key: unknown[]) =>
        key[0] !== 'location' && key[0] !== 'container' && key[0] !== 'layout-version'
    );
    expect(unrelatedPrefixes).toEqual([]);
  });
});
