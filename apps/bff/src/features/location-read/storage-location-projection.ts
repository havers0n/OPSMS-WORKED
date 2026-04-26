import type { StorageLocationProjection } from '@wos/domain';

type SideOfAisle = 'left' | 'right';

export type StorageLocationProjectionRow = {
  id: string;
  tenant_id: string;
  floor_id: string;
  warehouse_id?: string | null;
  code: string | null;
  sort_order?: number | null;
  route_sequence?: number | null;
  pick_sequence?: number | null;
  geometry_slot_id?: string | null;
  floor_x?: number | null;
  floor_y?: number | null;
  zone_id?: string | null;
  pick_zone_id?: string | null;
  task_zone_id?: string | null;
  allocation_zone_id?: string | null;
  access_aisle_id?: string | null;
  side_of_aisle?: SideOfAisle | null;
  position_along_aisle?: number | null;
  travel_node_id?: string | null;
};

export type StorageLocationProjectionHints = {
  cellAddress?: string | null;
  rackId?: string | null;
  faceId?: string | null;
  sectionId?: string | null;
  levelSlotId?: string | null;
  warehouseId?: string;
};

/**
 * Read-model mapper for future route planning services.
 *
 * This is additive only:
 * - executable identity remains locations.id
 * - sort_order is preserved and used as fallback for routeSequence
 * - geometry/canvas coordinates are optional hints
 */
export function mapStorageLocationProjection(
  row: StorageLocationProjectionRow,
  hints: StorageLocationProjectionHints = {}
): StorageLocationProjection {
  const warehouseId = hints.warehouseId ?? row.warehouse_id ?? row.floor_id ?? row.tenant_id;

  return {
    id: row.id,
    warehouseId,
    zoneId: row.zone_id ?? undefined,
    pickZoneId: row.pick_zone_id ?? undefined,
    taskZoneId: row.task_zone_id ?? undefined,
    allocationZoneId: row.allocation_zone_id ?? undefined,
    rackId: hints.rackId ?? undefined,
    faceId: hints.faceId ?? undefined,
    sectionId: hints.sectionId ?? undefined,
    levelSlotId: hints.levelSlotId ?? undefined,
    cellId: row.geometry_slot_id ?? undefined,
    addressLabel: row.code ?? hints.cellAddress ?? row.id,
    pickSequence: row.pick_sequence ?? undefined,
    routeSequence: row.route_sequence ?? row.sort_order ?? undefined,
    accessAisleId: row.access_aisle_id ?? undefined,
    sideOfAisle: row.side_of_aisle ?? undefined,
    positionAlongAisle: row.position_along_aisle ?? undefined,
    travelNodeId: row.travel_node_id ?? undefined,
    x: row.floor_x ?? undefined,
    y: row.floor_y ?? undefined
  };
}
