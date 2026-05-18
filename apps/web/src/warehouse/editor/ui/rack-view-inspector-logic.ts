import type {
  Cell,
  OperationsCellRuntime,
  OperationsCellStatus,
  Rack
} from '@wos/domain';
import { resolveRackFaceSections } from '@wos/domain';

export type RackViewContainerSummary = {
  containerId: string;
  displayCode: string;
  containerType: string;
  containerStatus: string;
  itemCount: number;
  totalQuantity: number;
};

export type RackViewInventorySummary = {
  key: string;
  title: string;
  meta: string | null;
  totalQuantity: number;
  uom: string;
  containerCount: number;
};

export type RackViewSummary = {
  cellCount: number;
  occupiedCellCount: number;
  emptyCellCount: number;
  utilizationPercent: number;
  containerCount: number;
  totalQuantity: number;
  statusCounts: Record<OperationsCellStatus, number>;
  activeWorkCellCount: number;
  structure: {
    enabledFaceCount: number;
    sectionCount: number;
    levelCount: number;
    slotCount: number;
  };
  containers: RackViewContainerSummary[];
  inventoryItems: RackViewInventorySummary[];
};

const statusOrder: OperationsCellStatus[] = [
  'quarantined',
  'pick_active',
  'reserved',
  'stocked',
  'empty'
];

const statusPriority = new Map(statusOrder.map((status, index) => [status, index]));

function emptyStatusCounts(): Record<OperationsCellStatus, number> {
  return {
    empty: 0,
    stocked: 0,
    pick_active: 0,
    reserved: 0,
    quarantined: 0
  };
}

export function getRackStructureSummary(rack: Rack): RackViewSummary['structure'] {
  const enabledFaces = rack.faces.filter((face) => face.enabled);
  const sections = enabledFaces.flatMap((face) => resolveRackFaceSections(face, rack));
  const levels = sections.flatMap((section) => section.levels);

  return {
    enabledFaceCount: enabledFaces.length,
    sectionCount: sections.length,
    levelCount: levels.length,
    slotCount: levels.reduce((sum, level) => sum + level.slotCount, 0)
  };
}

function getRuntimeStatus(runtime: OperationsCellRuntime | undefined): OperationsCellStatus {
  return runtime?.status ?? 'empty';
}

function containerDisplayCode(container: OperationsCellRuntime['containers'][number]) {
  return container.externalCode ?? container.containerId;
}

export function buildRackViewSummary(args: {
  rack: Rack;
  publishedCells: Cell[];
  operationsCells: OperationsCellRuntime[];
}): RackViewSummary {
  const { rack, publishedCells, operationsCells } = args;
  const structure = getRackStructureSummary(rack);
  const rackCells = publishedCells.filter((cell) => cell.rackId === rack.id);
  const runtimeByCellId = new Map(operationsCells.map((cell) => [cell.cellId, cell]));
  const statusCounts = emptyStatusCounts();
  const cellCount = rackCells.length > 0 ? rackCells.length : structure.slotCount;
  const containersById = new Map<string, RackViewContainerSummary>();
  const itemsByKey = new Map<string, RackViewInventorySummary & { containerIds: Set<string> }>();
  let activeWorkCellCount = 0;
  let totalQuantity = 0;

  for (const cell of rackCells) {
    const runtime = runtimeByCellId.get(cell.id);
    const status = getRuntimeStatus(runtime);
    statusCounts[status] += 1;

    if (
      status === 'pick_active' ||
      status === 'reserved' ||
      status === 'quarantined' ||
      runtime?.pickActive ||
      runtime?.reserved ||
      runtime?.quarantined
    ) {
      activeWorkCellCount += 1;
    }

    if (!runtime) continue;
    totalQuantity += runtime.totalQuantity;

    for (const container of runtime.containers) {
      containersById.set(container.containerId, {
        containerId: container.containerId,
        displayCode: containerDisplayCode(container),
        containerType: container.containerType,
        containerStatus: container.containerStatus,
        itemCount: container.itemCount,
        totalQuantity: container.totalQuantity
      });

      for (const item of container.items) {
        const key = `${item.productId ?? item.sku ?? item.itemRef ?? item.name ?? container.containerId}::${item.uom}`;
        const existing = itemsByKey.get(key);
        if (existing) {
          existing.totalQuantity += item.quantity;
          existing.containerIds.add(container.containerId);
          existing.containerCount = existing.containerIds.size;
          continue;
        }

        itemsByKey.set(key, {
          key,
          title: item.name ?? item.sku ?? item.itemRef ?? 'Inventory item',
          meta: item.sku ?? item.itemRef ?? null,
          totalQuantity: item.quantity,
          uom: item.uom,
          containerCount: 1,
          containerIds: new Set([container.containerId])
        });
      }
    }
  }

  if (rackCells.length === 0 && structure.slotCount > 0) {
    statusCounts.empty = structure.slotCount;
  }

  const occupiedCellCount = cellCount - statusCounts.empty;
  const utilizationPercent = cellCount > 0 ? Math.round((occupiedCellCount / cellCount) * 100) : 0;

  return {
    cellCount,
    occupiedCellCount,
    emptyCellCount: statusCounts.empty,
    utilizationPercent,
    containerCount: containersById.size,
    totalQuantity,
    statusCounts,
    activeWorkCellCount,
    structure,
    containers: Array.from(containersById.values()).sort((left, right) => {
      const leftPriority = statusPriority.get(left.containerStatus as OperationsCellStatus) ?? 99;
      const rightPriority = statusPriority.get(right.containerStatus as OperationsCellStatus) ?? 99;
      return leftPriority - rightPriority || left.displayCode.localeCompare(right.displayCode);
    }),
    inventoryItems: Array.from(itemsByKey.values())
      .map(({ containerIds: _containerIds, ...item }) => item)
      .sort((left, right) => right.totalQuantity - left.totalQuantity || left.title.localeCompare(right.title))
  };
}

export function getRackViewStatusRows(summary: RackViewSummary) {
  return statusOrder
    .map((status) => ({ status, count: summary.statusCounts[status] }))
    .filter((row) => row.count > 0);
}
