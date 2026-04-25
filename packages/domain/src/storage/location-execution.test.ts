import { describe, expect, it } from 'vitest';
import {
  canonicalMoveContainerResultSchema,
  canonicalSwapContainersResultSchema,
  canonicalTransferInventoryResultSchema,
  moveContainerToLocationBodySchema,
  pickPartialInventoryUnitBodySchema,
  swapContainersBodySchema,
  transferInventoryUnitBodySchema
} from './location-execution';

describe('location execution contracts', () => {
  it('parses move-to-location request bodies', () => {
    expect(moveContainerToLocationBodySchema.parse({
      targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64'
    }).targetLocationId).toBe('88b79cb6-24f0-4edb-9af7-8902e9f0fb64');
  });

  it('parses canonical move results', () => {
    expect(canonicalMoveContainerResultSchema.parse({
      containerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
      movementId: 'c1411420-4f31-4427-9d8d-e6c779d6cc0f',
      occurredAt: '2026-03-13T12:45:00.000Z'
    }).targetLocationId).toBe('88b79cb6-24f0-4edb-9af7-8902e9f0fb64');
  });

  it('parses canonical swap bodies and results', () => {
    expect(swapContainersBodySchema.parse({
      targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2'
    }).targetContainerId).toBe('4f8a33c1-c803-4515-b8d4-0144f788e5d2');

    expect(canonicalSwapContainersResultSchema.parse({
      sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
      sourceContainerNewLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
      targetContainerNewLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      sourceMovementId: 'c1411420-4f31-4427-9d8d-e6c779d6cc0f',
      targetMovementId: 'a3c0ab55-7711-4d03-b6f0-efdf66dffbc3',
      occurredAt: '2026-03-13T12:45:00.000Z'
    }).sourceContainerNewLocationId).toBe('88b79cb6-24f0-4edb-9af7-8902e9f0fb64');
  });

  it('parses canonical transfer bodies and results', () => {
    expect(transferInventoryUnitBodySchema.parse({
      targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
      quantity: 2
    }).quantity).toBe(2);

    expect(pickPartialInventoryUnitBodySchema.parse({
      pickContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
      quantity: 1
    }).quantity).toBe(1);

    expect(canonicalTransferInventoryResultSchema.parse({
      sourceInventoryUnitId: 'e7555d1b-f3f4-4c72-b2c8-8e6bc8f2cd7c',
      targetInventoryUnitId: '4173ae09-8e9d-4bb3-bb15-d32a8f95b041',
      sourceContainerId: '188ed1eb-c44d-47f8-a8b1-94c7e20db85f',
      targetContainerId: '4f8a33c1-c803-4515-b8d4-0144f788e5d2',
      sourceLocationId: 'f932d7de-7350-42b9-9dd6-df11e34b3ea1',
      targetLocationId: '88b79cb6-24f0-4edb-9af7-8902e9f0fb64',
      quantity: 2,
      uom: 'pcs',
      mergeApplied: false,
      sourceQuantity: 3,
      targetQuantity: 2,
      movementId: 'a3c0ab55-7711-4d03-b6f0-efdf66dffbc3',
      splitMovementId: 'a3c0ab55-7711-4d03-b6f0-efdf66dffbc3',
      transferMovementId: '4cf433cc-d771-4fd6-9042-b23e848f5225',
      occurredAt: '2026-03-13T13:00:00.000Z'
    }).mergeApplied).toBe(false);
  });
});
