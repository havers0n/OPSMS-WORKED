import type { ContainerType, LocationStorageSnapshotRow } from '@wos/domain';

/**
 * Returns only the container types that support storage placement.
 * Used to filter the type selector in storage-side container creation flows so
 * pick-only types (supportsStorage = false) are never offered as storage containers.
 */
export function filterStorableTypes(types: ContainerType[]): ContainerType[] {
  return types.filter((t) => t.supportsStorage);
}

export type InventorySummaryRow = {
  key: string;
  itemRef: string;
  product: LocationStorageSnapshotRow['product'];
  totalQuantity: number;
  uom: string;
  containerCount: number;
};

/**
 * Groups current location inventory into product-level rows so the inspector
 * can present "current inventory" separately from the physical container list.
 */
export function summarizeInventory(
  rows: LocationStorageSnapshotRow[]
): InventorySummaryRow[] {
  const summary = new Map<string, InventorySummaryRow>();
  const containerIdsByKey = new Map<string, Set<string>>();

  for (const row of rows) {
    if (row.itemRef === null || row.quantity === null || row.uom === null) {
      continue;
    }

    const key = [row.product?.id ?? row.itemRef, row.uom].join('::');
    const existing = summary.get(key);

    if (existing) {
      existing.totalQuantity += row.quantity;
      const containerIds = containerIdsByKey.get(key)!;
      containerIds.add(row.containerId);
      existing.containerCount = containerIds.size;
      continue;
    }

    containerIdsByKey.set(key, new Set([row.containerId]));
    summary.set(key, {
      key,
      itemRef: row.itemRef,
      product: row.product,
      totalQuantity: row.quantity,
      uom: row.uom,
      containerCount: 1
    });
  }

  return [...summary.values()];
}

export function getContainerDisplayLabel(container: {
  systemCode: string;
  externalCode: string | null;
}): string {
  return container.systemCode;
}

export function getContainerDisplaySecondary(container: {
  externalCode: string | null;
  containerType: string;
  placedAt: string;
}): string {
  return container.externalCode
    ? `${container.externalCode} · ${container.containerType} · placed ${container.placedAt}`
    : `${container.containerType} · placed ${container.placedAt}`;
}

type CreateAndPlaceDisabledArgs = {
  isActionPending: boolean;
  locationId: string | null;
  containerTypeId: string;
  storableTypeCount: number;
};

export function getCreateAndPlaceDisabledReasons({
  isActionPending,
  locationId,
  containerTypeId,
  storableTypeCount
}: CreateAndPlaceDisabledArgs): string[] {
  const disabledReasons: string[] = [];

  if (isActionPending) disabledReasons.push('action pending');
  if (!locationId) disabledReasons.push('no active location');
  if (containerTypeId.length === 0) disabledReasons.push('missing type');
  if (storableTypeCount === 0) disabledReasons.push('no storable types loaded');

  return disabledReasons;
}

export function formatCreateAndPlacePlacementFailure(
  systemCode: string,
  placementErrorMessage: string
): string {
  return `Container ${systemCode} was created, but it could not be placed into this cell and remains unplaced. ${placementErrorMessage}`;
}
