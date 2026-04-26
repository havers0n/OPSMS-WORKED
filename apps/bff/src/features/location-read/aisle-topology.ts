import type { FaceAccess, PickAisle } from '@wos/domain';

type SideOfAisle = 'left' | 'right';
type PickAisleStatus = 'active' | 'inactive';

export type PickAisleRow = {
  id: string;
  tenant_id: string;
  floor_id: string;
  code: string;
  name?: string | null;
  start_x?: number | null;
  start_y?: number | null;
  end_x?: number | null;
  end_y?: number | null;
  width_mm?: number | null;
  route_sequence?: number | null;
  status?: PickAisleStatus | null;
};

export type FaceAccessRow = {
  id?: string | null;
  tenant_id?: string | null;
  rack_id: string;
  face_id: string;
  aisle_id: string;
  side_of_aisle?: SideOfAisle | null;
  position_along_aisle?: number | null;
  normal_x?: number | null;
  normal_y?: number | null;
};

export function mapPickAisleRow(row: PickAisleRow): PickAisle {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    floorId: row.floor_id,
    code: row.code,
    name: row.name ?? undefined,
    startX: row.start_x ?? undefined,
    startY: row.start_y ?? undefined,
    endX: row.end_x ?? undefined,
    endY: row.end_y ?? undefined,
    widthMm: row.width_mm ?? undefined,
    routeSequence: row.route_sequence ?? undefined,
    status: row.status ?? undefined
  };
}

export function mapFaceAccessRow(row: FaceAccessRow): FaceAccess {
  return {
    id: row.id ?? undefined,
    tenantId: row.tenant_id ?? undefined,
    rackId: row.rack_id,
    faceId: row.face_id,
    aisleId: row.aisle_id,
    sideOfAisle: row.side_of_aisle ?? undefined,
    positionAlongAisle: row.position_along_aisle ?? undefined,
    normalX: row.normal_x ?? undefined,
    normalY: row.normal_y ?? undefined
  };
}
