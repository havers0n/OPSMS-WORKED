import { describe, expect, it, vi } from 'vitest';
import {
  ActivePlacementNotFoundError,
  ContainerAlreadyPlacedError,
  ContainerNotFoundError,
  CrossFloorPlacementMoveNotAllowedError,
  PlacementSourceMismatchError,
  PublishedLayoutNotFoundError,
  TargetCellNotFoundError,
  TargetCellSameAsSourceError
} from './errors.js';
import { moveContainer } from './move-container.js';
import { placeContainer } from './place-container.js';
import type { PlacementRepo } from './placement-repo.js';
import { removeContainer } from './remove-container.js';

function createRepoStub(): PlacementRepo {
  return {
    resolveContainer: vi.fn(async () => ({ id: 'container-uuid', externalCode: 'PLT-23901' })),
    resolvePlaceTarget: vi.fn(async () => ({
      id: 'cell-uuid',
      address: '07-A.01.01.03',
      floorId: 'floor-uuid'
    })),
    resolveSourceCells: vi.fn(async () => [{
      id: 'cell-uuid',
      address: '07-A.01.01.03',
      floorId: 'floor-uuid'
    }]),
    resolveExecutableLocationForCell: vi.fn(async () => ({
      locationId: 'location-uuid',
      code: '07-A.01.01.03',
      floorId: 'floor-uuid',
      cellId: 'cell-uuid'
    })),
    getActivePlacement: vi.fn(async () => ({ placementId: 'placement-uuid', cellId: 'cell-uuid' })),
    placeContainer: vi.fn(async () => undefined),
    removeContainerFromCells: vi.fn(async () => undefined),
    moveContainerFromCell: vi.fn(async () => undefined)
  };
}

describe('placement command services', () => {
  it('places an existing container into an explicit physical cell', async () => {
    const repo = createRepoStub();
    const targetCellId = '216f2dd6-8f17-4de4-aaba-657f9e0e1398';

    await expect(
      placeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'PLT-23901',
        targetCellId,
        actorId: 'actor-uuid'
      })
    ).resolves.toEqual({
      ok: true,
      containerId: 'PLT-23901',
      targetCellId
    });

    expect(repo.placeContainer).toHaveBeenCalledWith('container-uuid', 'cell-uuid', 'actor-uuid');
  });

  it('rejects place when the container reference does not resolve', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.resolveContainer).mockResolvedValueOnce(null);

    await expect(
      placeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'PLT-404',
        targetCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      })
    ).rejects.toBeInstanceOf(ContainerNotFoundError);
  });

  it('rejects place when the explicit target cell does not resolve', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.resolvePlaceTarget).mockResolvedValueOnce(null);

    await expect(
      placeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'PLT-23901',
        targetCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      })
    ).rejects.toBeInstanceOf(TargetCellNotFoundError);
  });

  it('rejects place when the container is already actively placed', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.placeContainer).mockRejectedValueOnce(new ContainerAlreadyPlacedError());

    await expect(
      placeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'PLT-23901',
        targetCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      })
    ).rejects.toBeInstanceOf(ContainerAlreadyPlacedError);
  });

  it('rejects place when the floor has no published layout', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.placeContainer).mockRejectedValueOnce(new PublishedLayoutNotFoundError());

    await expect(
      placeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'PLT-23901',
        targetCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      })
    ).rejects.toBeInstanceOf(PublishedLayoutNotFoundError);
  });

  it('closes the active placement when remove matches the current source cell', async () => {
    const repo = createRepoStub();
    const fromCellId = '216f2dd6-8f17-4de4-aaba-657f9e0e1398';

    await expect(
      removeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'container-uuid',
        fromCellId,
        actorId: 'actor-uuid'
      })
    ).resolves.toEqual({
      ok: true,
      containerId: 'container-uuid',
      fromCellId
    });

    expect(repo.removeContainerFromCells).toHaveBeenCalledWith('container-uuid', ['cell-uuid'], 'actor-uuid');
  });

  it('rejects remove when no active placement exists', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.getActivePlacement).mockResolvedValueOnce(null);

    await expect(
      removeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'container-uuid',
        fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      })
    ).rejects.toBeInstanceOf(ActivePlacementNotFoundError);
  });

  it('rejects remove when the requested source cell does not match the active placement', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.resolveSourceCells).mockResolvedValueOnce([{
      id: 'other-cell',
      address: '07-A.01.01.04',
      floorId: 'floor-uuid'
    }]);

    await expect(
      removeContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'container-uuid',
        fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
      })
    ).rejects.toBeInstanceOf(PlacementSourceMismatchError);
  });

  it('moves a container between explicit physical cells', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.resolvePlaceTarget).mockResolvedValueOnce({
      id: 'target-cell-uuid',
      address: '07-A.01.01.04',
      floorId: 'floor-uuid'
    });

    await expect(
      moveContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'container-uuid',
        fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        toCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
        actorId: 'actor-uuid'
      })
    ).resolves.toEqual({
      ok: true,
      containerId: 'container-uuid',
      fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      toCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
    });

    expect(repo.moveContainerFromCell).toHaveBeenCalledWith(
      'container-uuid',
      'cell-uuid',
      'target-cell-uuid',
      'actor-uuid'
    );
  });

  it('rejects move when the explicit source cell does not match the active placement', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.resolveSourceCells).mockResolvedValueOnce([{
      id: 'other-cell',
      address: '07-A.01.01.04',
      floorId: 'floor-uuid'
    }]);

    await expect(
      moveContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'container-uuid',
        fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        toCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
      })
    ).rejects.toBeInstanceOf(PlacementSourceMismatchError);
  });

  it('rejects move when target equals source', async () => {
    const repo = createRepoStub();

    await expect(
      moveContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'container-uuid',
        fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        toCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
      })
    ).rejects.toBeInstanceOf(TargetCellSameAsSourceError);
  });

  it('rejects move when target is on a different floor', async () => {
    const repo = createRepoStub();
    vi.mocked(repo.resolvePlaceTarget).mockResolvedValueOnce({
      id: 'target-cell-uuid',
      address: '08-A.01.01.01',
      floorId: 'other-floor-uuid'
    });

    await expect(
      moveContainer(repo, {
        tenantId: 'tenant-uuid',
        containerId: 'container-uuid',
        fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
        toCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
      })
    ).rejects.toBeInstanceOf(CrossFloorPlacementMoveNotAllowedError);
  });
});
