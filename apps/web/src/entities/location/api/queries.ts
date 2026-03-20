import type { LocationOccupancyRow, LocationReference, LocationStorageSnapshotRow } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const locationKeys = {
  all: ['location'] as const,
  byCell: (cellId: string | null) =>
    [...locationKeys.all, 'by-cell', cellId ?? 'none'] as const,
  containers: (locationId: string | null) =>
    [...locationKeys.all, 'containers', locationId ?? 'none'] as const,
  storage: (locationId: string | null) =>
    [...locationKeys.all, 'storage', locationId ?? 'none'] as const,
  occupancyByFloor: (floorId: string | null) =>
    [...locationKeys.all, 'occupancy-by-floor', floorId ?? 'none'] as const
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
