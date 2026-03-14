import { describe, expect, it } from 'vitest';
import {
  cellOccupancyRowSchema,
  floorCellOccupancyResponseSchema
} from './cell-occupancy';

describe('cell occupancy read model contracts', () => {
  it('parses a placement-centric occupancy row', () => {
    expect(
      cellOccupancyRowSchema.parse({
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        externalCode: 'PALLET-001',
        containerType: 'pallet',
        containerStatus: 'active',
        placedAt: '2026-03-13T10:00:00.000Z'
      })
    ).toMatchObject({
      externalCode: 'PALLET-001',
      containerType: 'pallet',
      containerStatus: 'active'
    });
  });

  it('allows containers without external codes', () => {
    expect(
      cellOccupancyRowSchema.parse({
        tenantId: '4caa9e8d-4349-4623-ad98-9e2f2af193c0',
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        containerId: '1e4a2d96-cd70-4881-a73e-aa0c086a9bc8',
        externalCode: null,
        containerType: 'tote',
        containerStatus: 'quarantined',
        placedAt: '2026-03-13T10:00:00.000Z'
      })
    ).toMatchObject({
      externalCode: null,
      containerStatus: 'quarantined'
    });
  });

  it('parses floor-level occupancy summaries for canvas highlighting', () => {
    expect(
      floorCellOccupancyResponseSchema.parse([
        {
          cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
          containerCount: 2
        }
      ])
    ).toEqual([
      {
        cellId: '4dfd5836-37be-4333-9139-e9a8e461c5d2',
        containerCount: 2
      }
    ]);
  });
});
