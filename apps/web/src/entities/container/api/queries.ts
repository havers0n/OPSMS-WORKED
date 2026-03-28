import type { Container, ContainerCurrentLocation, ContainerOperationalRole, ContainerStorageSnapshotRow, ContainerType } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export type ContainerListFilter = {
  operationalRole?: ContainerOperationalRole;
};

export const containerKeys = {
  all: ['container'] as const,
  list: (filter?: ContainerListFilter) =>
    filter?.operationalRole !== undefined
      ? ([...containerKeys.all, 'list', filter.operationalRole] as const)
      : ([...containerKeys.all, 'list'] as const),
  types: () => [...containerKeys.all, 'types'] as const,
  currentLocation: (containerId: string | null) =>
    [...containerKeys.all, 'current-location', containerId ?? 'none'] as const,
  /**
   * Storage snapshot for a single container (identity + inventory rows).
   * containerId = container UUID from the cell storage snapshot.
   */
  storage: (containerId: string | null) =>
    [...containerKeys.all, 'storage', containerId ?? 'none'] as const
};

async function fetchContainerStorage(
  containerId: string
): Promise<ContainerStorageSnapshotRow[]> {
  return bffRequest<ContainerStorageSnapshotRow[]>(
    `/api/containers/${containerId}/storage`
  );
}

async function fetchContainerCurrentLocation(
  containerId: string
): Promise<ContainerCurrentLocation> {
  return bffRequest<ContainerCurrentLocation>(
    `/api/containers/${containerId}/location`
  );
}

async function fetchContainerTypes(): Promise<ContainerType[]> {
  return bffRequest<ContainerType[]>('/api/container-types');
}

async function fetchContainers(filter?: ContainerListFilter): Promise<Container[]> {
  const url =
    filter?.operationalRole !== undefined
      ? `/api/containers?operationalRole=${encodeURIComponent(filter.operationalRole)}`
      : '/api/containers';
  return bffRequest<Container[]>(url);
}

/**
 * Returns containers for the current tenant, optionally filtered by operationalRole.
 * Caller should filter to `status === 'active'` as needed.
 */
export function containerListQueryOptions(filter?: ContainerListFilter) {
  return queryOptions({
    queryKey: containerKeys.list(filter),
    queryFn: () => fetchContainers(filter)
  });
}

/**
 * Returns the storage snapshot rows for a given container.
 * Each row carries container identity fields + one optional inventory line.
 * An empty array means the container has no inventory items.
 */
export function containerStorageQueryOptions(containerId: string | null) {
  return queryOptions({
    queryKey: containerKeys.storage(containerId),
    queryFn: () => fetchContainerStorage(containerId as string),
    enabled: Boolean(containerId)
  });
}

export function containerCurrentLocationQueryOptions(containerId: string | null) {
  return queryOptions({
    queryKey: containerKeys.currentLocation(containerId),
    queryFn: () => fetchContainerCurrentLocation(containerId as string),
    enabled: Boolean(containerId)
  });
}

export function containerTypesQueryOptions() {
  return queryOptions({
    queryKey: containerKeys.types(),
    queryFn: fetchContainerTypes
  });
}
