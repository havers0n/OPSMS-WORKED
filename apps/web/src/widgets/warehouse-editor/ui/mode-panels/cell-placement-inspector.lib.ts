import type { ContainerType } from '@wos/domain';

/**
 * Returns only the container types that support storage placement.
 * Used to filter the type selector in storage-side container creation flows so
 * pick-only types (supportsStorage = false) are never offered as storage containers.
 */
export function filterStorableTypes(types: ContainerType[]): ContainerType[] {
  return types.filter((t) => t.supportsStorage);
}
