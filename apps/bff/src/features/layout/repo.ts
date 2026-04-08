import type { SupabaseClient } from '@supabase/supabase-js';
import type { Cell, LayoutDraft, PublishedLayoutSummary } from '@wos/domain';
import { mapCellRowToDomain, mapLayoutBundleJsonToDomain, mapLayoutDraftBundleToDomain } from '../../mappers.js';

export type LayoutVersionRow = {
  id: string;
  floor_id: string;
  draft_version?: number | null;
  version_no: number;
  state: 'draft' | 'published' | 'archived';
  published_at?: string | null;
};

type SaveDraftResult = {
  layoutVersionId: string;
  draftVersion: number | null;
};

type CellRow = {
  id: string;
  layout_version_id: string;
  rack_id: string;
  rack_face_id: string;
  rack_section_id: string;
  rack_level_id: string;
  slot_no: number;
  address: string;
  address_sort_key: string;
  cell_code: string;
  x: number;
  y: number;
  status: 'active' | 'inactive';
};

type RackRow = {
  id: string;
  layout_version_id: string;
  display_code: string;
  kind: 'single' | 'double';
  axis: 'NS' | 'WE';
  x: number;
  y: number;
  total_length: number;
  depth: number;
  rotation_deg: 0 | 90 | 180 | 270;
};

type RackFaceRow = {
  id: string;
  rack_id: string;
  side: 'A' | 'B';
  enabled: boolean;
  slot_numbering_direction: 'ltr' | 'rtl';
  is_mirrored: boolean;
  mirror_source_face_id: string | null;
  face_length: number | null;
};

type RackSectionRow = {
  id: string;
  rack_face_id: string;
  ordinal: number;
  length: number;
};

type RackLevelRow = {
  id: string;
  rack_section_id: string;
  ordinal: number;
  slot_count: number;
};

type LayoutZoneRow = {
  id: string;
  layout_version_id: string;
  code: string;
  name: string;
  category: 'generic' | 'storage' | 'staging' | 'packing' | 'receiving' | 'custom' | null;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutWallRow = {
  id: string;
  layout_version_id: string;
  code: string;
  name: string | null;
  wall_type: 'generic' | 'partition' | 'safety' | 'perimeter' | 'custom' | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocks_rack_placement: boolean;
};

const publishedCellSelectColumns =
  'id,layout_version_id,rack_id,rack_face_id,rack_section_id,rack_level_id,slot_no,address,address_sort_key,cell_code,x,y,status';

export type LayoutRepo = {
  findVersion(layoutVersionId: string): Promise<LayoutVersionRow | null>;
  findActiveDraft(floorId: string): Promise<LayoutDraft | null>;
  findDraftByVersionId(layoutVersionId: string): Promise<LayoutDraft | null>;
  findLatestPublished(floorId: string): Promise<LayoutDraft | null>;
  findPublishedLayoutSummary(floorId: string): Promise<PublishedLayoutSummary | null>;
  listPublishedCells(floorId: string): Promise<Cell[]>;
  createDraft(floorId: string, actorId: string): Promise<string>;
  saveDraft(layoutDraft: unknown, actorId: string): Promise<SaveDraftResult>;
  validateVersion(layoutVersionId: string): Promise<unknown>;
  publishVersion(layoutVersionId: string, actorId: string): Promise<unknown>;
};

function omitVersionNo(layout: LayoutDraft | null): LayoutDraft | null {
  if (!layout) {
    return null;
  }

  const { versionNo: _versionNo, ...withoutVersionNo } = layout;
  return withoutVersionNo;
}

async function findLatestLayoutVersionByState(
  supabase: SupabaseClient,
  floorId: string,
  state: LayoutVersionRow['state']
) {
  const { data, error } = await supabase
    .from('layout_versions')
    .select('id,floor_id,draft_version,version_no,state,published_at')
    .eq('floor_id', floorId);

  if (error) {
    throw error;
  }

  return ((data ?? []) as LayoutVersionRow[])
    .filter((row) => row.state === state)
    .sort((left, right) => right.version_no - left.version_no)[0] ?? null;
}

async function fetchLayoutVersionBundle(
  supabase: SupabaseClient,
  layoutVersion: LayoutVersionRow | null
) {
  if (!layoutVersion) {
    return null;
  }

  const rpcResponse = await supabase.rpc('get_layout_bundle', {
    layout_version_uuid: layoutVersion.id
  });

  if (!rpcResponse || typeof rpcResponse !== 'object' || !('data' in rpcResponse) || !('error' in rpcResponse)) {
    return fetchLayoutVersionBundleFromTables(supabase, layoutVersion);
  }

  const { data, error } = rpcResponse;

  if (error) {
    throw error;
  }

  // Test stubs sometimes return { data: null, error: null } for unknown RPCs.
  // Fall back to table reads so runtime contracts stay verifiable in isolated tests.
  if (data === null) {
    return fetchLayoutVersionBundleFromTables(supabase, layoutVersion);
  }

  return mapLayoutBundleJsonToDomain(data);
}

async function fetchLayoutVersionBundleFromTables(
  supabase: SupabaseClient,
  layoutVersion: LayoutVersionRow
) {
  const { data: racksData, error: racksError } = await supabase
    .from('racks')
    .select('id,layout_version_id,display_code,kind,axis,x,y,total_length,depth,rotation_deg')
    .eq('layout_version_id', layoutVersion.id);

  if (racksError) {
    throw racksError;
  }

  const racks = (racksData ?? []) as RackRow[];
  const rackIds = racks.map((rack) => rack.id);

  const { data: facesData, error: facesError } = rackIds.length === 0
    ? { data: [] as RackFaceRow[], error: null }
    : await supabase
      .from('rack_faces')
      .select('id,rack_id,side,enabled,slot_numbering_direction,is_mirrored,mirror_source_face_id,face_length')
      .in('rack_id', rackIds);

  if (facesError) {
    throw facesError;
  }

  const rackFaces = (facesData ?? []) as RackFaceRow[];
  const faceIds = rackFaces.map((face) => face.id);

  const { data: sectionsData, error: sectionsError } = faceIds.length === 0
    ? { data: [] as RackSectionRow[], error: null }
    : await supabase
      .from('rack_sections')
      .select('id,rack_face_id,ordinal,length')
      .in('rack_face_id', faceIds);

  if (sectionsError) {
    throw sectionsError;
  }

  const rackSections = (sectionsData ?? []) as RackSectionRow[];
  const sectionIds = rackSections.map((section) => section.id);

  const { data: levelsData, error: levelsError } = sectionIds.length === 0
    ? { data: [] as RackLevelRow[], error: null }
    : await supabase
      .from('rack_levels')
      .select('id,rack_section_id,ordinal,slot_count')
      .in('rack_section_id', sectionIds);

  if (levelsError) {
    throw levelsError;
  }

  const rackLevels = (levelsData ?? []) as RackLevelRow[];

  const { data: zonesData, error: zonesError } = await supabase
    .from('layout_zones')
    .select('id,layout_version_id,code,name,category,color,x,y,width,height')
    .eq('layout_version_id', layoutVersion.id);

  if (zonesError) {
    throw zonesError;
  }

  const zones = (zonesData ?? []) as LayoutZoneRow[];

  const { data: wallsData, error: wallsError } = await supabase
    .from('layout_walls')
    .select('id,layout_version_id,code,name,wall_type,x1,y1,x2,y2,blocks_rack_placement')
    .eq('layout_version_id', layoutVersion.id);

  if (wallsError) {
    throw wallsError;
  }

  const walls = (wallsData ?? []) as LayoutWallRow[];

  return mapLayoutDraftBundleToDomain({
    layoutVersion: layoutVersion as never,
    racks: racks as never,
    rackFaces: rackFaces as never,
    rackSections: rackSections as never,
    rackLevels: rackLevels as never,
    zones: zones as never,
    walls: walls as never
  });
}

export function createLayoutRepo(supabase: SupabaseClient): LayoutRepo {
  return {
    async findVersion(layoutVersionId) {
      const { data, error } = await supabase
        .from('layout_versions')
        .select('id,floor_id,draft_version,version_no,state,published_at')
        .eq('id', layoutVersionId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return (data as LayoutVersionRow | null) ?? null;
    },

    async findActiveDraft(floorId) {
      const activeDraft = await findLatestLayoutVersionByState(supabase, floorId, 'draft');
      return omitVersionNo(await fetchLayoutVersionBundle(supabase, activeDraft));
    },

    async findDraftByVersionId(layoutVersionId) {
      const layoutVersion = await (async () => {
        const { data, error } = await supabase
          .from('layout_versions')
          .select('id,floor_id,draft_version,version_no,state,published_at')
          .eq('id', layoutVersionId)
          .maybeSingle();

        if (error) {
          throw error;
        }

        return (data as LayoutVersionRow | null) ?? null;
      })();

      if (!layoutVersion || layoutVersion.state !== 'draft') {
        return null;
      }

      return omitVersionNo(await fetchLayoutVersionBundle(supabase, layoutVersion));
    },

    async findLatestPublished(floorId) {
      const latestPublished = await findLatestLayoutVersionByState(supabase, floorId, 'published');
      return omitVersionNo(await fetchLayoutVersionBundle(supabase, latestPublished));
    },

    async findPublishedLayoutSummary(floorId) {
      const publishedVersion = await findLatestLayoutVersionByState(supabase, floorId, 'published');

      if (!publishedVersion) {
        return null;
      }

      const { data: sampleCells, count, error } = await supabase
        .from('cells')
        .select('address,address_sort_key', { count: 'exact' })
        .eq('layout_version_id', publishedVersion.id)
        .order('address_sort_key', { ascending: true })
        .limit(4);

      if (error) {
        throw error;
      }

      return {
        layoutVersionId: publishedVersion.id,
        floorId: publishedVersion.floor_id,
        versionNo: publishedVersion.version_no,
        publishedAt: publishedVersion.published_at ?? new Date(0).toISOString(),
        cellCount: count ?? sampleCells?.length ?? 0,
        sampleAddresses: (sampleCells ?? []).map((cell) => cell.address)
      };
    },

    async listPublishedCells(floorId) {
      const publishedVersion = await findLatestLayoutVersionByState(supabase, floorId, 'published');

      if (!publishedVersion) {
        return [];
      }

      const { data, error } = await supabase
        .from('cells')
        .select(publishedCellSelectColumns)
        .eq('layout_version_id', publishedVersion.id)
        .order('address_sort_key', { ascending: true });

      if (error) {
        throw error;
      }

      return ((data ?? []) as CellRow[]).map(mapCellRowToDomain);
    },

    async createDraft(floorId, actorId) {
      const { data, error } = await supabase.rpc('create_layout_draft', {
        floor_uuid: floorId,
        actor_uuid: actorId
      });

      if (error) {
        throw error;
      }

      return data as string;
    },

    async saveDraft(layoutDraft, actorId) {
      const { data, error } = await supabase.rpc('save_layout_draft', {
        layout_payload: layoutDraft,
        actor_uuid: actorId
      });

      if (error) {
        throw error;
      }

      // save_layout_draft returns either a plain uuid (legacy) or a jsonb
      // object { layoutVersionId, draftVersion }. Normalize both shapes.
      if (data !== null && typeof data === 'object' && 'layoutVersionId' in (data as object)) {
        const result = data as { layoutVersionId: string; draftVersion?: number | null };
        return {
          layoutVersionId: result.layoutVersionId,
          draftVersion: result.draftVersion ?? null
        };
      }
      return {
        layoutVersionId: data as string,
        draftVersion: null
      };
    },

    async validateVersion(layoutVersionId) {
      const { data, error } = await supabase.rpc('validate_layout_version', {
        layout_version_uuid: layoutVersionId
      });

      if (error) {
        throw error;
      }

      return data ?? { isValid: false, issues: [] };
    },

    async publishVersion(layoutVersionId, actorId) {
      const { data, error } = await supabase.rpc('publish_layout_version', {
        layout_version_uuid: layoutVersionId,
        actor_uuid: actorId
      });

      if (error) {
        throw error;
      }

      return data;
    }
  };
}
