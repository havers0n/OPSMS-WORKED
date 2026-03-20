import { describe, expect, it, vi } from 'vitest';
import {
  ExecutionTargetContainerSameAsSourceError,
  ExecutionTargetLocationOccupiedError,
  ExecutionTargetLocationSameAsSourceError
} from './errors.js';
import { createExecutionRepo } from './execution-repo.js';

const ids = {
  container: '11111111-1111-4111-8111-111111111111',
  sourceLocation: '22222222-2222-4222-8222-222222222222',
  targetLocation: '33333333-3333-4333-8333-333333333333',
  movement: '44444444-4444-4444-8444-444444444444',
  sourceInventoryUnit: '55555555-5555-4555-8555-555555555555',
  targetInventoryUnit: '66666666-6666-4666-8666-666666666666',
  targetContainer: '77777777-7777-4777-8777-777777777777',
  pickContainer: '88888888-8888-4888-8888-888888888888',
  splitMovement: '99999999-9999-4999-8999-999999999999',
  transferMovement: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  pickMovement: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  occupiedLocation: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  sameLocation: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
};

describe('execution repo', () => {
  it('calls canonical move RPC with target_location_uuid rather than target cell', async () => {
    const rpc = vi.fn(async () => ({
      data: {
        containerId: ids.container,
        sourceLocationId: ids.sourceLocation,
        targetLocationId: ids.targetLocation,
        movementId: ids.movement,
        occurredAt: '2026-03-16T09:00:00.000Z'
      },
      error: null
    }));
    const repo = createExecutionRepo({ rpc } as never);

    await expect(
      repo.moveContainerCanonical(ids.container, ids.targetLocation, 'actor-uuid')
    ).resolves.toMatchObject({
      targetLocationId: ids.targetLocation
    });

    expect(rpc).toHaveBeenCalledWith('move_container_canonical', {
      container_uuid: ids.container,
      target_location_uuid: ids.targetLocation,
      actor_uuid: 'actor-uuid'
    });
  });

  it('maps canonical split and move RPC errors to execution-specific failures', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'P0001',
          message: 'TARGET_CONTAINER_SAME_AS_SOURCE_CONTAINER'
        }
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'P0001',
          message: 'TARGET_LOCATION_OCCUPIED'
        }
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'P0001',
          message: 'CONTAINER_ALREADY_IN_TARGET_CELL'
        }
      });
    const repo = createExecutionRepo({ rpc } as never);

    await expect(
      repo.splitInventoryUnit(ids.sourceInventoryUnit, 1, ids.container)
    ).rejects.toBeInstanceOf(ExecutionTargetContainerSameAsSourceError);

    await expect(
      repo.moveContainerCanonical(ids.container, ids.occupiedLocation)
    ).rejects.toBeInstanceOf(ExecutionTargetLocationOccupiedError);

    await expect(
      repo.moveContainerCanonical(ids.container, ids.sameLocation)
    ).rejects.toBeInstanceOf(ExecutionTargetLocationSameAsSourceError);
  });

  it('parses canonical transfer and pick payloads unchanged', async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          sourceInventoryUnitId: ids.sourceInventoryUnit,
          targetInventoryUnitId: ids.targetInventoryUnit,
          sourceContainerId: ids.container,
          targetContainerId: ids.targetContainer,
          sourceLocationId: ids.sourceLocation,
          targetLocationId: null,
          quantity: 1,
          uom: 'pcs',
          mergeApplied: false,
          sourceQuantity: 4,
          targetQuantity: 1,
          movementId: ids.splitMovement,
          splitMovementId: ids.splitMovement,
          transferMovementId: ids.transferMovement,
          occurredAt: '2026-03-16T09:10:00.000Z'
        },
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          sourceInventoryUnitId: ids.sourceInventoryUnit,
          targetInventoryUnitId: ids.targetInventoryUnit,
          sourceContainerId: ids.container,
          targetContainerId: ids.pickContainer,
          sourceLocationId: ids.sourceLocation,
          targetLocationId: null,
          quantity: 1,
          uom: 'pcs',
          mergeApplied: false,
          sourceQuantity: 3,
          targetQuantity: 1,
          movementId: ids.splitMovement,
          splitMovementId: ids.splitMovement,
          transferMovementId: ids.pickMovement,
          occurredAt: '2026-03-16T09:15:00.000Z'
        },
        error: null
      });
    const repo = createExecutionRepo({ rpc } as never);

    await expect(
      repo.transferInventoryUnit(ids.sourceInventoryUnit, 1, ids.targetContainer)
    ).resolves.toMatchObject({
      transferMovementId: ids.transferMovement
    });

    await expect(
      repo.pickPartialInventoryUnit(ids.sourceInventoryUnit, 1, ids.pickContainer)
    ).resolves.toMatchObject({
      transferMovementId: ids.pickMovement
    });
  });
});
