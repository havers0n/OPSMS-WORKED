import type { LocationOccupancyRow, LocationType } from '@wos/domain';
import type { QueryClient } from '@tanstack/react-query';
import { locationKeys } from '@/entities/location/api/queries';

const UNKNOWN_UUID = '00000000-0000-4000-8000-000000000000';

type FloorOccupancyTarget = {
  cellId: string;
  containerId: string;
  floorId: string;
  locationId: string;
  locationCode: string;
  locationType: LocationType;
  externalCode?: string | null;
  containerType?: string;
  containerStatus?: LocationOccupancyRow['containerStatus'];
  placedAt?: string;
  tenantId?: string;
};

export type FloorOccupancyReconciliation =
  | {
      kind: 'move';
      containerId: string;
      target: FloorOccupancyTarget;
    }
  | {
      kind: 'remove';
      containerId: string;
    }
  | {
      kind: 'add';
      target: FloorOccupancyTarget;
    };

function buildFallbackOccupancyRow(target: FloorOccupancyTarget): LocationOccupancyRow {
  return {
    tenantId: target.tenantId ?? UNKNOWN_UUID,
    floorId: target.floorId,
    locationId: target.locationId,
    locationCode: target.locationCode,
    locationType: target.locationType,
    cellId: target.cellId,
    containerId: target.containerId,
    externalCode: target.externalCode ?? null,
    containerType: target.containerType ?? 'unknown',
    containerStatus: target.containerStatus ?? 'active',
    placedAt: target.placedAt ?? new Date().toISOString()
  };
}

function upsertContainerOccupancyRow(
  rows: LocationOccupancyRow[],
  nextRow: LocationOccupancyRow
): LocationOccupancyRow[] {
  const kept = rows.filter((row) => row.containerId !== nextRow.containerId);
  return [...kept, nextRow];
}

export function reconcileFloorOccupancyRows(
  rows: LocationOccupancyRow[],
  reconciliation: FloorOccupancyReconciliation
): LocationOccupancyRow[] {
  if (reconciliation.kind === 'remove') {
    return rows.filter((row) => row.containerId !== reconciliation.containerId);
  }

  const existingRow =
    rows.find((row) => row.containerId === reconciliation.target.containerId) ?? null;
  const targetRow = existingRow
    ? {
        ...existingRow,
        cellId: reconciliation.target.cellId,
        locationId: reconciliation.target.locationId,
        locationCode: reconciliation.target.locationCode,
        locationType: reconciliation.target.locationType
      }
    : buildFallbackOccupancyRow(reconciliation.target);

  return upsertContainerOccupancyRow(rows, targetRow);
}

export function applyFloorOccupancyReconciliation(
  queryClient: QueryClient,
  floorId: string,
  reconciliation: FloorOccupancyReconciliation
) {
  queryClient.setQueryData<LocationOccupancyRow[]>(
    locationKeys.occupancyByFloor(floorId),
    (current = []) => reconcileFloorOccupancyRows(current, reconciliation)
  );
}

export async function reconcileFloorOccupancyAfterPlacementMutation(
  queryClient: QueryClient,
  args: {
    floorId: string | null;
    reconciliation: FloorOccupancyReconciliation | null;
    invalidate: () => Promise<unknown>;
  }
) {
  const { floorId, reconciliation, invalidate } = args;

  if (floorId && reconciliation) {
    await queryClient.cancelQueries({
      queryKey: locationKeys.occupancyByFloor(floorId),
      exact: true
    });
    applyFloorOccupancyReconciliation(queryClient, floorId, reconciliation);
  }

  await invalidate();

  if (floorId && reconciliation) {
    applyFloorOccupancyReconciliation(queryClient, floorId, reconciliation);
  }
}
