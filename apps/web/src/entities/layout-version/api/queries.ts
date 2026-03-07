import type { LayoutDraft } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/shared/api/supabase/client';
import { mapLayoutDraftBundleToDomain } from './mappers';
import type { LayoutDraftRowBundle, LayoutVersionRow, RackFaceRow, RackLevelRow, RackRow, RackSectionRow } from './types';

export const layoutVersionKeys = {
  all: ['layout-version'] as const,
  activeDraft: (floorId: string | null) => [...layoutVersionKeys.all, 'active-draft', floorId ?? 'none'] as const
};

async function fetchRows<T>(table: string, columns: string, filterColumn: string, filterValue: string | string[]) {
  let query = supabase.from(table).select(columns);

  if (Array.isArray(filterValue)) {
    query = query.in(filterColumn, filterValue);
  } else {
    query = query.eq(filterColumn, filterValue);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data ?? []) as T[];
}

async function fetchActiveLayoutDraft(floorId: string): Promise<LayoutDraft | null> {
  const layoutVersions = await fetchRows<LayoutVersionRow>('layout_versions', 'id,floor_id,version_no,state', 'floor_id', floorId);
  const activeDraft = layoutVersions.filter((row) => row.state === 'draft').sort((a, b) => b.version_no - a.version_no)[0];

  if (!activeDraft) {
    return null;
  }

  const racks = await fetchRows<RackRow>('racks', 'id,layout_version_id,display_code,kind,axis,x,y,total_length,depth,rotation_deg', 'layout_version_id', activeDraft.id);

  if (racks.length === 0) {
    return {
      layoutVersionId: activeDraft.id,
      floorId: activeDraft.floor_id,
      rackIds: [],
      racks: {}
    };
  }

  const rackIds = racks.map((rack) => rack.id);
  const rackFaces = await fetchRows<RackFaceRow>('rack_faces', 'id,rack_id,side,enabled,anchor,slot_numbering_direction,is_mirrored,mirror_source_face_id', 'rack_id', rackIds);
  const faceIds = rackFaces.map((face) => face.id);
  const rackSections = faceIds.length > 0 ? await fetchRows<RackSectionRow>('rack_sections', 'id,rack_face_id,ordinal,length', 'rack_face_id', faceIds) : [];
  const sectionIds = rackSections.map((section) => section.id);
  const rackLevels = sectionIds.length > 0 ? await fetchRows<RackLevelRow>('rack_levels', 'id,rack_section_id,ordinal,slot_count', 'rack_section_id', sectionIds) : [];

  const bundle: LayoutDraftRowBundle = {
    layoutVersion: activeDraft,
    racks,
    rackFaces,
    rackSections,
    rackLevels
  };

  return mapLayoutDraftBundleToDomain(bundle);
}

export function activeLayoutDraftQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: layoutVersionKeys.activeDraft(floorId),
    queryFn: () => fetchActiveLayoutDraft(floorId as string),
    enabled: Boolean(floorId)
  });
}
