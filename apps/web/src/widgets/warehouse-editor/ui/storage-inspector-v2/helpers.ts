import type { LocationStorageSnapshotRow } from '@wos/domain';
import type { LocationProductAssignment } from '@/entities/product-location-role/api/queries';

export const INVENTORY_PREVIEW_LIMIT = 3;

export type PolicyRoleChoice = 'primary_pick' | 'reserve' | 'none';
export type PolicyRole = 'primary_pick' | 'reserve';

export type ActiveContainerProduct = {
  id: string;
  name: string;
  sku: string | null;
};

export type ContainerPolicySummaryState =
  | { kind: 'no-policy' }
  | { kind: 'single-role'; role: PolicyRole }
  | { kind: 'legacy-conflict'; roles: PolicyRole[] };

/** Group snapshot rows by containerId. */
export function groupByContainer(
  rows: LocationStorageSnapshotRow[]
): Array<{ containerId: string; rows: LocationStorageSnapshotRow[] }> {
  const map = new Map<string, LocationStorageSnapshotRow[]>();

  for (const row of rows) {
    const existing = map.get(row.containerId);
    if (existing) {
      existing.push(row);
    } else {
      map.set(row.containerId, [row]);
    }
  }

  return Array.from(map.entries()).map(([containerId, groupedRows]) => ({
    containerId,
    rows: groupedRows
  }));
}

const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuidLike(value: string): boolean {
  return uuidLikePattern.test(value);
}

function isActiveProductRow(row: LocationStorageSnapshotRow): boolean {
  if (row.product == null) return false;
  if (!row.product.isActive) return false;
  if (typeof row.product.id !== 'string' || !isUuidLike(row.product.id)) return false;
  if (row.quantity === null || row.quantity <= 0) return false;
  if (row.uom === null || row.uom.trim().length === 0) return false;
  if (row.itemRef === null || row.itemRef.trim().length === 0) return false;
  return true;
}

export function getActiveProducts(rows: LocationStorageSnapshotRow[]): ActiveContainerProduct[] {
  const products = new Map<string, ActiveContainerProduct>();

  for (const row of rows) {
    if (!isActiveProductRow(row) || row.product === null) continue;
    if (!products.has(row.product.id)) {
      products.set(row.product.id, {
        id: row.product.id,
        name: row.product.name,
        sku: row.product.sku
      });
    }
  }

  return Array.from(products.values());
}

function roleLabel(role: PolicyRole): string {
  return role === 'primary_pick' ? 'Primary pick' : 'Reserve';
}

export function resolvePolicySummaryState(
  assignments: LocationProductAssignment[],
  productId: string
): ContainerPolicySummaryState {
  const published = assignments.filter(
    (assignment) => assignment.state === 'published' && assignment.productId === productId
  );
  const hasPrimaryPick = published.some((assignment) => assignment.role === 'primary_pick');
  const hasReserve = published.some((assignment) => assignment.role === 'reserve');

  if (hasPrimaryPick && hasReserve) {
    return { kind: 'legacy-conflict', roles: ['primary_pick', 'reserve'] };
  }
  if (hasPrimaryPick) return { kind: 'single-role', role: 'primary_pick' };
  if (hasReserve) return { kind: 'single-role', role: 'reserve' };
  return { kind: 'no-policy' };
}

export function policySummaryText(state: ContainerPolicySummaryState): string {
  if (state.kind === 'no-policy') return 'No policy';
  if (state.kind === 'single-role') return roleLabel(state.role);
  return `Legacy conflict: ${state.roles.map(roleLabel).join(' + ')}`;
}

export function getPolicyEditGuardReason(activeProducts: ActiveContainerProduct[]): string | null {
  if (activeProducts.length === 1) return null;
  if (activeProducts.length === 0) {
    return 'Policy editing is unavailable because this container does not resolve to one active SKU.';
  }
  return 'Policy editing is unavailable because this container resolves to multiple active SKUs.';
}

export function hasInventoryRows(
  rows: Array<{ itemRef: string | null; quantity: number | null }>
): boolean {
  return rows.some((row) => row.itemRef !== null || row.quantity !== null);
}
