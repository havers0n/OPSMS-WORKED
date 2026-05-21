import type { SupabaseClient } from '@supabase/supabase-js';
import {
  floorAisleTopologySchema,
  type FaceAccess,
  type FloorAisleTopology,
  type PickAisle
} from '@wos/domain';

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

type FloorTenantRow = {
  id: string;
  sites?: { tenant_id?: string | null } | { tenant_id?: string | null }[] | null;
};

type RequiredFaceAccessNormalRow = FaceAccessRow & {
  face_id: string;
  aisle_id: string;
  normal_x: number | null;
  normal_y: number | null;
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

function isVisibleFloorRow(row: FloorTenantRow | null, tenantId: string): boolean {
  if (!row) return false;
  const site = Array.isArray(row.sites) ? row.sites[0] : row.sites;
  return site?.tenant_id === tenantId;
}

function mapTopologyAisle(row: PickAisleRow) {
  return {
    id: row.id,
    floorId: row.floor_id,
    code: row.code,
    name: row.name ?? null
  };
}

function mapTopologyFaceAccess(row: RequiredFaceAccessNormalRow) {
  if (!Number.isFinite(row.normal_x) || !Number.isFinite(row.normal_y)) {
    return null;
  }

  return {
    faceId: row.face_id,
    aisleId: row.aisle_id,
    normalX: row.normal_x,
    normalY: row.normal_y
  };
}

export type AisleTopologyRepo = {
  getFloorAisleTopology(tenantId: string, floorId: string): Promise<FloorAisleTopology | null>;
};

export function createAisleTopologyRepo(supabase: SupabaseClient): AisleTopologyRepo {
  return {
    async getFloorAisleTopology(tenantId, floorId) {
      const { data: floorRow, error: floorError } = await supabase
        .from('floors')
        .select('id,sites!inner(tenant_id)')
        .eq('id', floorId)
        .eq('sites.tenant_id', tenantId)
        .maybeSingle();

      if (floorError) {
        throw floorError;
      }

      if (!isVisibleFloorRow(floorRow as FloorTenantRow | null, tenantId)) {
        return null;
      }

      const { data: aisleRows, error: aisleError } = await supabase
        .from('pick_aisles')
        .select('id,tenant_id,floor_id,code,name,status')
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .eq('status', 'active')
        .order('route_sequence', { ascending: true, nullsFirst: false })
        .order('code', { ascending: true });

      if (aisleError) {
        throw aisleError;
      }

      const aisles = ((aisleRows ?? []) as PickAisleRow[]).map(mapTopologyAisle);
      const aisleIds = aisles.map((aisle) => aisle.id);
      if (aisleIds.length === 0) {
        return floorAisleTopologySchema.parse({
          floorId,
          aisles: [],
          faceAccess: []
        });
      }

      const { data: faceAccessRows, error: faceAccessError } = await supabase
        .from('face_access')
        .select('face_id,aisle_id,normal_x,normal_y')
        .in('aisle_id', aisleIds)
        .not('normal_x', 'is', null)
        .not('normal_y', 'is', null);

      if (faceAccessError) {
        throw faceAccessError;
      }

      const faceAccess = ((faceAccessRows ?? []) as RequiredFaceAccessNormalRow[])
        .map(mapTopologyFaceAccess)
        .filter((row): row is NonNullable<ReturnType<typeof mapTopologyFaceAccess>> => row !== null);

      return floorAisleTopologySchema.parse({
        floorId,
        aisles,
        faceAccess
      });
    }
  };
}
