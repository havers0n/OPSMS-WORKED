import { describe, expect, it } from 'vitest';
import { containerPlacementSchema } from './container-placement';

describe('container placement contracts', () => {
  it('parses an active container placement timeline row', () => {
    expect(
      containerPlacementSchema.parse({
        id: 'b1f61098-69f4-4997-b0a0-ce6e4a52cdc3',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        placedAt: '2026-03-13T10:00:00.000Z',
        removedAt: null,
        placedBy: '945e796c-1fd6-471d-8992-a7810fd3567f',
        removedBy: null
      })
    ).toMatchObject({
      removedAt: null
    });
  });

  it('parses a closed placement history row', () => {
    expect(
      containerPlacementSchema.parse({
        id: 'b1f61098-69f4-4997-b0a0-ce6e4a52cdc3',
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        placedAt: '2026-03-13T10:00:00.000Z',
        removedAt: '2026-03-13T11:00:00.000Z',
        placedBy: null,
        removedBy: '945e796c-1fd6-471d-8992-a7810fd3567f'
      })
    ).toMatchObject({
      removedAt: '2026-03-13T11:00:00.000Z'
    });
  });
});
