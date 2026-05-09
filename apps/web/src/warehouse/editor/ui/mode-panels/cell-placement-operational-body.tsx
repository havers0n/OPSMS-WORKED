import type { LocationStorageSnapshotRow } from '@wos/domain';
import { getProductImageUrl, getProductLabel, getProductMeta } from '@/entities/product/lib/display';
import {
  getContainerDisplayLabel,
  getContainerDisplaySecondary,
  summarizeInventory
} from './cell-placement-inspector.lib';
import { useLocationProductAssignments } from '@/entities/product-location-role/api/use-location-product-assignments';
import {
  CurrentContainersSectionView,
  CurrentInventorySectionView,
  LocationPolicySummarySectionView,
  type CurrentContainerCardViewModel,
  type CurrentInventorySummaryItemViewModel
} from '../storage-location-detail-sections-view';

type ContainerGroup = {
  containerId: string;
  systemCode: string;
  externalCode: string | null;
  containerType: string;
  containerStatus: string;
  placedAt: string;
  items: Array<{ itemRef: string; product: LocationStorageSnapshotRow['product']; quantity: number; uom: string }>;
};

function groupByContainer(rows: LocationStorageSnapshotRow[]): ContainerGroup[] {
  const map = new Map<string, ContainerGroup>();
  for (const row of rows) {
    if (!map.has(row.containerId)) {
      map.set(row.containerId, {
        containerId: row.containerId,
        systemCode: row.systemCode,
        externalCode: row.externalCode,
        containerType: row.containerType,
        containerStatus: row.containerStatus,
        placedAt: row.placedAt,
        items: []
      });
    }
    if (row.itemRef !== null && row.quantity !== null && row.uom !== null) {
      map.get(row.containerId)!.items.push({
        itemRef: row.itemRef,
        product: row.product,
        quantity: row.quantity,
        uom: row.uom
      });
    }
  }
  return [...map.values()];
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function mapContainersToView(containers: ContainerGroup[]): CurrentContainerCardViewModel[] {
  return containers.map((group) => ({
    containerId: group.containerId,
    title: getContainerDisplayLabel(group),
    secondaryText: getContainerDisplaySecondary({
      externalCode: group.externalCode,
      containerType: group.containerType,
      placedAt: formatDate(group.placedAt)
    }),
    status: group.containerStatus,
    inventoryEntryCount: group.items.length
  }));
}

function mapInventoryToView(rows: LocationStorageSnapshotRow[]): CurrentInventorySummaryItemViewModel[] {
  return summarizeInventory(rows).map((item) => ({
    key: item.key,
    imageUrl: getProductImageUrl(item.product),
    title: getProductLabel(item.itemRef, item.product),
    meta: getProductMeta(item.itemRef, item.product),
    totalQuantity: item.totalQuantity,
    uom: item.uom,
    containerCount: item.containerCount
  }));
}

type OperationalCell = {
  id: string;
  address: { raw: string };
};

export function CellPlacementOperationalBody({
  selectedCell,
  locationId,
  rows
}: {
  selectedCell: OperationalCell;
  locationId: string;
  rows: LocationStorageSnapshotRow[];
}) {
  const containers = groupByContainer(rows);
  const containerCards = mapContainersToView(containers);
  const inventoryItems = mapInventoryToView(rows);
  const isOccupied = containers.length > 0;
  const { data: assignments = [], isPending } = useLocationProductAssignments(locationId);

  return (
    <>
      <CurrentContainersSectionView
        containers={containerCards}
        sourceCellId={selectedCell.id}
        onContainerClick={() => undefined}
      />
      <CurrentInventorySectionView inventoryItems={inventoryItems} hasContainers={isOccupied} />
      <LocationPolicySummarySectionView
        isPending={isPending}
        assignments={assignments.map((a) => ({
          id: a.id,
          productName: a.product.name,
          productSku: a.product.sku,
          role: a.role
        }))}
      />
    </>
  );
}
