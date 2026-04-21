import type { Cell, LocationStorageSnapshotRow, Product, Rack } from '@wos/domain';
import type { MoveTaskState, TaskKind } from './mode';
import type { LocationEffectiveRole } from '@/entities/product-location-role/api/queries';
import {
  INVENTORY_PREVIEW_LIMIT,
  effectiveRoleSourceLabel,
  groupByContainer,
  resolveStructuralDefaultFromPublishedLayout,
  semanticRoleLabel
} from './helpers';

export function resolveRackDisplayCode(
  rackId: string | null,
  racks: Record<string, Rack> | undefined
): string {
  return rackId ? (racks?.[rackId]?.displayCode ?? rackId) : '-';
}

export function resolveSelectedCellAddress(publishedCells: Cell[], cellId: string | null): string | null {
  return publishedCells.find((cell) => cell.id === cellId)?.address.raw ?? null;
}

export function resolveLocationCode(params: {
  storageRows: LocationStorageSnapshotRow[];
  selectedCellAddress: string | null;
  cellId: string | null;
}): string {
  const { storageRows, selectedCellAddress, cellId } = params;
  return storageRows[0]?.locationCode ?? selectedCellAddress ?? cellId ?? '-';
}

function resolveEffectiveRoleContainerId(params: {
  selectedContainerId: string | null;
  taskKind: TaskKind | null;
}): string | null {
  const { selectedContainerId, taskKind } = params;
  if (!selectedContainerId) return null;
  if (taskKind === 'add-product-to-container') return null;
  if (taskKind === null || taskKind === 'edit-override' || taskKind === 'repair-conflict') {
    return selectedContainerId;
  }
  return null;
}

export function resolveEffectiveRoleProductId(params: {
  selectedContainerId: string | null;
  taskKind: TaskKind | null;
  storageRows: LocationStorageSnapshotRow[];
}): string | null {
  const containerId = resolveEffectiveRoleContainerId(params);
  if (!containerId) return null;
  const rows = params.storageRows.filter((row) => row.containerId === containerId);
  return resolveSingleActiveProduct(rows)?.id ?? null;
}

export function resolveMoveTargetCellId(moveTaskState: MoveTaskState | null): string | null {
  return moveTaskState?.targetCellId ?? null;
}

export function resolveCellOverview(params: {
  storageRows: LocationStorageSnapshotRow[];
}): {
  isOccupied: boolean;
  containers: Array<{ containerId: string; rows: LocationStorageSnapshotRow[] }>;
  inventoryPreviewRows: LocationStorageSnapshotRow[];
  inventoryOverflow: number;
} {
  const { storageRows } = params;
  const inventoryRows = storageRows.filter((row) => row.itemRef !== null || row.quantity !== null);
  return {
    isOccupied: storageRows.length > 0,
    containers: groupByContainer(storageRows),
    inventoryPreviewRows: inventoryRows.slice(0, INVENTORY_PREVIEW_LIMIT),
    inventoryOverflow: Math.max(0, inventoryRows.length - INVENTORY_PREVIEW_LIMIT)
  };
}

export type ContainerDetailProjection = {
  containerRows: LocationStorageSnapshotRow[];
  firstRow: LocationStorageSnapshotRow | undefined;
  displayCode: string;
  items: LocationStorageSnapshotRow[];
  isEmptyContainer: boolean;
  selectedProduct: Product | null;
  selectedProductId: string | null;
};

function hasActiveInventoryProduct(
  row: LocationStorageSnapshotRow
): row is LocationStorageSnapshotRow & { product: Product } {
  return (
    row.product != null &&
    row.product.isActive &&
    row.quantity !== null &&
    row.quantity > 0 &&
    row.uom !== null &&
    row.uom.trim().length > 0 &&
    row.itemRef !== null &&
    row.itemRef.trim().length > 0
  );
}

function resolveSingleActiveProduct(rows: LocationStorageSnapshotRow[]): Product | null {
  const byId = new Map<string, Product>();
  for (const row of rows) {
    if (!hasActiveInventoryProduct(row)) continue;
    if (!byId.has(row.product.id)) {
      byId.set(row.product.id, row.product);
    }
  }

  if (byId.size !== 1) return null;
  return Array.from(byId.values())[0];
}

export function projectContainerDetail(storageRows: LocationStorageSnapshotRow[], containerId: string): ContainerDetailProjection {
  const containerRows = storageRows.filter((row) => row.containerId === containerId);
  const firstRow = containerRows[0];
  const items = containerRows.filter((row) => row.itemRef !== null || row.quantity !== null);
  const selectedProduct = resolveSingleActiveProduct(containerRows);

  return {
    containerRows,
    firstRow,
    displayCode: firstRow ? (firstRow.externalCode ?? firstRow.systemCode) : containerId,
    items,
    isEmptyContainer: items.length === 0,
    selectedProduct,
    selectedProductId: selectedProduct?.id ?? null
  };
}

export type ContainerRolePresentation = {
  structuralDefaultText: string;
  effectiveRoleText: string;
  sourceText: string;
  isConflict: boolean;
  showNoneExplanation: boolean;
};

export function projectContainerRolePresentation(params: {
  hasProductContext: boolean;
  effectiveRoleLoading: boolean;
  effectiveRoleContext: LocationEffectiveRole | null | undefined;
  structuralDefaultFromLayout: 'primary_pick' | 'reserve' | 'none' | null;
}): ContainerRolePresentation {
  const { hasProductContext, effectiveRoleLoading, effectiveRoleContext, structuralDefaultFromLayout } = params;
  const structuralDefaultRole = effectiveRoleContext?.structuralDefaultRole ?? structuralDefaultFromLayout;
  const isConflict = effectiveRoleContext?.effectiveRoleSource === 'conflict';

  const effectiveRoleText = hasProductContext
    ? effectiveRoleLoading
      ? 'Loading...'
      : isConflict
        ? 'Conflict'
        : effectiveRoleContext
          ? semanticRoleLabel(effectiveRoleContext.effectiveRole ?? 'none')
          : 'Unknown'
    : 'Not computed';

  const sourceText = hasProductContext
    ? effectiveRoleLoading
      ? 'Loading...'
      : effectiveRoleContext
        ? effectiveRoleSourceLabel(effectiveRoleContext.effectiveRoleSource)
        : 'Unknown'
    : 'Not computed';

  const structuralDefaultText =
    structuralDefaultRole === null ? 'Unknown' : semanticRoleLabel(structuralDefaultRole);

  const showNoneExplanation =
    effectiveRoleContext?.structuralDefaultRole === 'none' &&
    effectiveRoleContext.effectiveRoleSource === 'none' &&
    effectiveRoleContext.effectiveRole === 'none';

  return {
    structuralDefaultText,
    effectiveRoleText,
    sourceText,
    isConflict,
    showNoneExplanation
  };
}

export function resolveStructuralDefaultFromLayout(params: {
  cellId: string | null;
  publishedCells: Cell[];
  racks: Record<string, Rack> | undefined;
}): 'primary_pick' | 'reserve' | 'none' | null {
  return resolveStructuralDefaultFromPublishedLayout(params.cellId, params.publishedCells, params.racks);
}
