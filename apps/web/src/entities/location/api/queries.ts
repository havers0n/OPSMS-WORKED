import type {
  LocationOccupancyRow,
  LocationReference,
  LocationStorageSnapshotRow,
  NonRackLocationRef,
  OperationsCellRuntime
} from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const locationKeys = {
  all: ['location'] as const,
  byCellAll: () => [...locationKeys.all, 'by-cell'] as const,
  byCell: (cellId: string | null) =>
    [...locationKeys.byCellAll(), cellId ?? 'none'] as const,
  containers: (locationId: string | null) =>
    [...locationKeys.all, 'containers', locationId ?? 'none'] as const,
  storageAll: () => [...locationKeys.all, 'storage'] as const,
  storage: (locationId: string | null) =>
    [...locationKeys.storageAll(), locationId ?? 'none'] as const,
  occupancyByFloor: (floorId: string | null) =>
    [...locationKeys.all, 'occupancy-by-floor', floorId ?? 'none'] as const,
  operationsCellsByFloor: (floorId: string | null) =>
    [...locationKeys.all, 'operations-cells-by-floor', floorId ?? 'none'] as const,
  nonRackByFloor: (floorId: string | null) =>
    [...locationKeys.all, 'non-rack-by-floor', floorId ?? 'none'] as const
};

async function fetchLocationByCell(cellId: string): Promise<LocationReference> {
  return bffRequest<LocationReference>(`/api/locations/by-cell/${cellId}`);
}

async function fetchLocationContainers(locationId: string): Promise<LocationOccupancyRow[]> {
  return bffRequest<LocationOccupancyRow[]>(`/api/locations/${locationId}/containers`);
}

async function fetchLocationStorage(locationId: string): Promise<LocationStorageSnapshotRow[]> {
  return bffRequest<LocationStorageSnapshotRow[]>(`/api/locations/${locationId}/storage`);
}

async function fetchFloorLocationOccupancy(floorId: string): Promise<LocationOccupancyRow[]> {
  return bffRequest<LocationOccupancyRow[]>(`/api/floors/${floorId}/location-occupancy`);
}

async function fetchFloorOperationsCells(floorId: string): Promise<OperationsCellRuntime[]> {
  return bffRequest<OperationsCellRuntime[]>(`/api/floors/${floorId}/operations-cells`);
}

export function locationByCellQueryOptions(cellId: string | null) {
  return queryOptions({
    queryKey: locationKeys.byCell(cellId),
    queryFn: () => fetchLocationByCell(cellId as string),
    enabled: Boolean(cellId)
  });
}

export function locationContainersQueryOptions(locationId: string | null) {
  return queryOptions({
    queryKey: locationKeys.containers(locationId),
    queryFn: () => fetchLocationContainers(locationId as string),
    enabled: Boolean(locationId)
  });
}

export function locationStorageQueryOptions(locationId: string | null) {
  return queryOptions({
    queryKey: locationKeys.storage(locationId),
    queryFn: () => fetchLocationStorage(locationId as string),
    enabled: Boolean(locationId)
  });
}

export function floorLocationOccupancyQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: locationKeys.occupancyByFloor(floorId),
    queryFn: () => fetchFloorLocationOccupancy(floorId as string),
    enabled: Boolean(floorId)
  });
}

export function floorOperationsCellsQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: locationKeys.operationsCellsByFloor(floorId),
    queryFn: () => fetchFloorOperationsCells(floorId as string),
    enabled: Boolean(floorId)
  });
}

async function fetchFloorNonRackLocations(floorId: string): Promise<NonRackLocationRef[]> {
  return bffRequest<NonRackLocationRef[]>(`/api/floors/${floorId}/non-rack-locations`);
}

export function floorNonRackLocationsQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: locationKeys.nonRackByFloor(floorId),
    queryFn: () => fetchFloorNonRackLocations(floorId as string),
    enabled: Boolean(floorId)
  });
}
