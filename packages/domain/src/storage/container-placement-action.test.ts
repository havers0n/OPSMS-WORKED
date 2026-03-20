import { describe, expect, it } from 'vitest';
import {
  moveContainerResultSchema,
  placeContainerResultSchema,
  removeContainerResultSchema
} from './container-placement-action';

describe('container placement action contracts', () => {
  it('parses place_container result', () => {
    expect(
      placeContainerResultSchema.parse({
        action: 'placed',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        placementId: 'b1f61098-69f4-4997-b0a0-ce6e4a52cdc3',
        occurredAt: '2026-03-13T10:00:00.000Z'
      })
    ).toMatchObject({
      action: 'placed'
    });
  });

  it('parses remove_container result', () => {
    expect(
      removeContainerResultSchema.parse({
        action: 'removed',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        placementId: 'b1f61098-69f4-4997-b0a0-ce6e4a52cdc3',
        occurredAt: '2026-03-13T10:30:00.000Z'
      })
    ).toMatchObject({
      action: 'removed'
    });
  });

  it('parses remove_container result for non-rack location (null cellId and placementId)', () => {
    expect(
      removeContainerResultSchema.parse({
        action: 'removed',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        cellId: null,
        placementId: null,
        occurredAt: '2026-03-13T10:30:00.000Z'
      })
    ).toMatchObject({
      action: 'removed',
      cellId: null,
      placementId: null
    });
  });

  it('parses move_container result', () => {
    expect(
      moveContainerResultSchema.parse({
        action: 'moved',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        fromCellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        toCellId: '5c0d7454-fbb6-45b3-89f2-93207abf60a8',
        previousPlacementId: 'd9b74da3-d7e4-4b14-aebc-54c9d807ec18',
        placementId: 'b1f61098-69f4-4997-b0a0-ce6e4a52cdc3',
        occurredAt: '2026-03-13T11:00:00.000Z'
      })
    ).toMatchObject({
      action: 'moved',
      fromCellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2'
    });
  });
});
