import { describe, expect, it } from 'vitest';
import type { LocationOccupancyRow } from '@wos/domain';
import {
  reconcileFloorOccupancyRows,
  type FloorOccupancyReconciliation
} from './floor-occupancy-reconciliation';

function makeRow(input: {
  cellId: string;
  containerId: string;
  locationId: string;
  locationCode: string;
}): LocationOccupancyRow {
  return {
    tenantId: 'tenant-1',
    floorId: 'floor-1',
    locationId: input.locationId,
    locationCode: input.locationCode,
    locationType: 'rack_slot',
    cellId: input.cellId,
    containerId: input.containerId,
    externalCode: null,
    containerType: 'pallet',
    containerStatus: 'active',
    placedAt: '2026-06-03T12:00:00.000Z'
  };
}

describe('floor occupancy reconciliation helpers', () => {
  it('move reconciliation is idempotent and leaves exactly one target row', () => {
    const move: FloorOccupancyReconciliation = {
      kind: 'move',
      containerId: 'c-1',
      target: {
        floorId: 'floor-1',
        cellId: 'cell-2',
        containerId: 'c-1',
        locationId: 'loc-target',
        locationCode: 'LOC-TGT',
        locationType: 'rack_slot'
      }
    };
    const initialRows = [
      makeRow({ cellId: 'cell-1', containerId: 'c-1', locationId: 'loc-source', locationCode: 'LOC-SRC' }),
      makeRow({ cellId: 'cell-9', containerId: 'c-9', locationId: 'loc-9', locationCode: 'LOC-9' })
    ];

    const once = reconcileFloorOccupancyRows(initialRows, move);
    const twice = reconcileFloorOccupancyRows(once, move);

    expect(once).toEqual(twice);
    expect(twice.filter((row) => row.containerId === 'c-1')).toEqual([
      makeRow({ cellId: 'cell-2', containerId: 'c-1', locationId: 'loc-target', locationCode: 'LOC-TGT' })
    ]);
  });

  it('remove reconciliation is idempotent and keeps the container absent', () => {
    const remove: FloorOccupancyReconciliation = {
      kind: 'remove',
      containerId: 'c-1'
    };
    const initialRows = [
      makeRow({ cellId: 'cell-1', containerId: 'c-1', locationId: 'loc-source', locationCode: 'LOC-SRC' }),
      makeRow({ cellId: 'cell-9', containerId: 'c-9', locationId: 'loc-9', locationCode: 'LOC-9' })
    ];

    const once = reconcileFloorOccupancyRows(initialRows, remove);
    const twice = reconcileFloorOccupancyRows(once, remove);

    expect(once).toEqual(twice);
    expect(twice.some((row) => row.containerId === 'c-1')).toBe(false);
  });

  it('add reconciliation is idempotent and does not duplicate an already-correct target row', () => {
    const add: FloorOccupancyReconciliation = {
      kind: 'add',
      target: {
        floorId: 'floor-1',
        cellId: 'cell-2',
        containerId: 'c-1',
        locationId: 'loc-target',
        locationCode: 'LOC-TGT',
        locationType: 'rack_slot',
        containerType: 'pallet'
      }
    };
    const initialRows = [
      makeRow({ cellId: 'cell-2', containerId: 'c-1', locationId: 'loc-target', locationCode: 'LOC-TGT' }),
      makeRow({ cellId: 'cell-9', containerId: 'c-9', locationId: 'loc-9', locationCode: 'LOC-9' })
    ];

    const once = reconcileFloorOccupancyRows(initialRows, add);
    const twice = reconcileFloorOccupancyRows(once, add);

    expect(once).toEqual(twice);
    expect(twice.filter((row) => row.containerId === 'c-1')).toHaveLength(1);
    expect(twice.find((row) => row.containerId === 'c-1')?.cellId).toBe('cell-2');
  });
});
