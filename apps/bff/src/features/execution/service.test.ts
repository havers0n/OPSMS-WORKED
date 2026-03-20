import { describe, expect, it, vi } from 'vitest';
import { createExecutionServiceFromRepo } from './service.js';
import type { ExecutionRepo } from './execution-repo.js';

function createRepoStub(): ExecutionRepo {
  return {
    moveContainerCanonical: vi.fn(async () => ({
      containerId: 'container-uuid',
      sourceLocationId: 'source-location-uuid',
      targetLocationId: 'target-location-uuid',
      movementId: 'movement-uuid',
      occurredAt: '2026-03-16T08:00:00.000Z'
    })),
    splitInventoryUnit: vi.fn(async () => ({
      sourceInventoryUnitId: 'source-unit-uuid',
      targetInventoryUnitId: 'target-unit-uuid',
      sourceContainerId: 'source-container-uuid',
      targetContainerId: 'target-container-uuid',
      sourceLocationId: 'source-location-uuid',
      targetLocationId: null,
      quantity: 2,
      uom: 'pcs',
      mergeApplied: false,
      sourceQuantity: 8,
      targetQuantity: 2,
      movementId: 'split-movement-uuid',
      occurredAt: '2026-03-16T08:05:00.000Z'
    })),
    transferInventoryUnit: vi.fn(async () => ({
      sourceInventoryUnitId: 'source-unit-uuid',
      targetInventoryUnitId: 'target-unit-uuid',
      sourceContainerId: 'source-container-uuid',
      targetContainerId: 'target-container-uuid',
      sourceLocationId: 'source-location-uuid',
      targetLocationId: null,
      quantity: 1,
      uom: 'pcs',
      mergeApplied: false,
      sourceQuantity: 7,
      targetQuantity: 1,
      movementId: 'split-movement-uuid',
      splitMovementId: 'split-movement-uuid',
      transferMovementId: 'transfer-movement-uuid',
      occurredAt: '2026-03-16T08:10:00.000Z'
    })),
    pickPartialInventoryUnit: vi.fn(async () => ({
      sourceInventoryUnitId: 'source-unit-uuid',
      targetInventoryUnitId: 'pick-unit-uuid',
      sourceContainerId: 'source-container-uuid',
      targetContainerId: 'pick-container-uuid',
      sourceLocationId: 'source-location-uuid',
      targetLocationId: null,
      quantity: 1,
      uom: 'pcs',
      mergeApplied: false,
      sourceQuantity: 6,
      targetQuantity: 1,
      movementId: 'split-movement-uuid',
      splitMovementId: 'split-movement-uuid',
      transferMovementId: 'pick-movement-uuid',
      occurredAt: '2026-03-16T08:15:00.000Z'
    }))
  };
}

describe('execution service', () => {
  it('delegates canonical container moves by target location id', async () => {
    const repo = createRepoStub();
    const service = createExecutionServiceFromRepo(repo);

    await expect(
      service.moveContainerCanonical({
        containerId: 'container-uuid',
        targetLocationId: 'target-location-uuid',
        actorId: 'actor-uuid'
      })
    ).resolves.toMatchObject({
      containerId: 'container-uuid',
      targetLocationId: 'target-location-uuid'
    });

    expect(repo.moveContainerCanonical).toHaveBeenCalledWith(
      'container-uuid',
      'target-location-uuid',
      'actor-uuid'
    );
  });

  it('delegates canonical split semantics without changing public DTO shape', async () => {
    const repo = createRepoStub();
    const service = createExecutionServiceFromRepo(repo);

    await expect(
      service.splitInventoryUnit({
        inventoryUnitId: 'source-unit-uuid',
        quantity: 2,
        targetContainerId: 'target-container-uuid'
      })
    ).resolves.toMatchObject({
      targetContainerId: 'target-container-uuid',
      mergeApplied: false,
      quantity: 2
    });

    expect(repo.splitInventoryUnit).toHaveBeenCalledWith(
      'source-unit-uuid',
      2,
      'target-container-uuid',
      undefined
    );
  });

  it('delegates transfer stock and pick partial flows through canonical repo methods', async () => {
    const repo = createRepoStub();
    const service = createExecutionServiceFromRepo(repo);

    await expect(
      service.transferStock({
        inventoryUnitId: 'source-unit-uuid',
        quantity: 1,
        targetContainerId: 'target-container-uuid',
        actorId: 'actor-uuid'
      })
    ).resolves.toMatchObject({
      transferMovementId: 'transfer-movement-uuid'
    });

    await expect(
      service.pickPartial({
        inventoryUnitId: 'source-unit-uuid',
        quantity: 1,
        pickContainerId: 'pick-container-uuid',
        actorId: 'actor-uuid'
      })
    ).resolves.toMatchObject({
      transferMovementId: 'pick-movement-uuid'
    });

    expect(repo.transferInventoryUnit).toHaveBeenCalledWith(
      'source-unit-uuid',
      1,
      'target-container-uuid',
      'actor-uuid'
    );
    expect(repo.pickPartialInventoryUnit).toHaveBeenCalledWith(
      'source-unit-uuid',
      1,
      'pick-container-uuid',
      'actor-uuid'
    );
  });
});
