import type { ContainerType, LocationStorageSnapshotRow } from '@wos/domain';
import type { LocationProductAssignment } from '@/entities/product-location-role/api/queries';

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

export type UnassignedStockPolicyCandidate = {
  product: NonNullable<LocationStorageSnapshotRow['product']>;
  rowCount: number;
  containerCount: number;
  missingPrimaryPick: boolean;
  missingReserve: boolean;
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

/**
 * Returns a single safe role-gap candidate for physically present stock.
 * The helper stays product-unambiguous, but tracks which role(s) are missing
 * for that one product so the bridge can expose only valid quick actions.
 */
export function getUnassignedStockPolicyCandidate(
  rows: LocationStorageSnapshotRow[],
  assignments: LocationProductAssignment[]
): UnassignedStockPolicyCandidate | null {
  const publishedRolesByProductId = new Map<
    string,
    Set<LocationProductAssignment['role']>
  >();

  for (const assignment of assignments) {
    if (assignment.state !== 'published') {
      continue;
    }

    const roles = publishedRolesByProductId.get(assignment.productId);
    if (roles) {
      roles.add(assignment.role);
      continue;
    }

    publishedRolesByProductId.set(assignment.productId, new Set([assignment.role]));
  }

  const candidatesByProductId = new Map<
    string,
    {
      product: NonNullable<LocationStorageSnapshotRow['product']>;
      rowCount: number;
      containerIds: Set<string>;
    }
  >();

  for (const row of rows) {
    if (
      row.product === null ||
      !row.product.isActive ||
      row.quantity === null ||
      row.quantity <= 0
    ) {
      continue;
    }

    const candidate = candidatesByProductId.get(row.product.id);
    if (candidate) {
      candidate.rowCount += 1;
      candidate.containerIds.add(row.containerId);
      continue;
    }

    candidatesByProductId.set(row.product.id, {
      product: row.product,
      rowCount: 1,
      containerIds: new Set([row.containerId])
    });
  }

  if (candidatesByProductId.size !== 1) {
    return null;
  }

  const [candidate] = candidatesByProductId.values();
  const publishedRoles = publishedRolesByProductId.get(candidate.product.id) ?? new Set();
  const missingPrimaryPick = !publishedRoles.has('primary_pick');
  const missingReserve = !publishedRoles.has('reserve');

  if (!missingPrimaryPick && !missingReserve) {
    return null;
  }

  return {
    product: candidate.product,
    rowCount: candidate.rowCount,
    containerCount: candidate.containerIds.size,
    missingPrimaryPick,
    missingReserve
  };
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
  return `Container created, but placement failed. ${systemCode} remains unplaced. ${placementErrorMessage}`;
}
