import {
  composeLayoutDraft,
  layoutLifecycleInfoSchema,
  rackGeometrySchema,
  rackStructureSchema,
  type LayoutDraft,
  type LayoutLifecycleInfo,
  type RackGeometry,
  type RackStructure
} from '@wos/domain';
import type {
  LayoutDraftRowBundle,
  LayoutWallRow,
  LayoutZoneRow,
  RackFaceRow,
  RackLevelRow,
  RackRow,
  RackSectionRow
} from './types';

function buildRackLevel(row: RackLevelRow) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    slotCount: row.slot_count,
    structuralDefaultRole: row.structural_default_role ?? 'none'
  };
}

function buildRackSection(row: RackSectionRow, allLevels: RackLevelRow[]) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    length: row.length,
    levels: allLevels
      .filter((level) => level.rack_section_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(buildRackLevel)
  };
}

function buildRackFace(row: RackFaceRow, allSections: RackSectionRow[], allLevels: RackLevelRow[]) {
  const relationshipMode = row.face_mode ?? (row.is_mirrored ? 'mirrored' : 'independent');
  return {
    id: row.id,
    side: row.side,
    enabled: row.enabled,
    slotNumberingDirection: row.slot_numbering_direction,
    relationshipMode,
    isMirrored: row.is_mirrored,
    mirrorSourceFaceId: row.mirror_source_face_id,
    faceLength: row.face_length ?? undefined,
    sections: allSections
      .filter((section) => section.rack_face_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((section) => buildRackSection(section, allLevels))
  };
}

function buildRackGeometry(row: RackRow): RackGeometry {
  return rackGeometrySchema.parse({
    x: row.x,
    y: row.y,
    totalLength: row.total_length,
    depth: row.depth,
    rotationDeg: row.rotation_deg
  });
}

function buildRackStructure(
  row: RackRow,
  allFaces: RackFaceRow[],
  allSections: RackSectionRow[],
  allLevels: RackLevelRow[]
): RackStructure {
  return rackStructureSchema.parse({
    displayCode: row.display_code,
    kind: row.kind,
    axis: row.axis,
    faces: allFaces
      .filter((face) => face.rack_id === row.id)
      .sort((a, b) => a.side.localeCompare(b.side))
      .map((face) => buildRackFace(face, allSections, allLevels))
  });
}

function buildZone(row: LayoutZoneRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    color: row.color,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height
  };
}

function buildWall(row: LayoutWallRow) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    wallType: row.wall_type,
    x1: row.x1,
    y1: row.y1,
    x2: row.x2,
    y2: row.y2,
    blocksRackPlacement: row.blocks_rack_placement
  };
}

export function mapLayoutDraftBundleToDomain(bundle: LayoutDraftRowBundle): LayoutDraft {
  const racks = bundle.racks
    .sort((a, b) => a.display_code.localeCompare(b.display_code))
    .map((row) => ({
      id: row.id,
      geometry: buildRackGeometry(row),
      structure: buildRackStructure(row, bundle.rackFaces, bundle.rackSections, bundle.rackLevels)
    }));
  const zones = (bundle.zones ?? [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(buildZone);
  const walls = (bundle.walls ?? [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(buildWall);

  const lifecycle: LayoutLifecycleInfo = layoutLifecycleInfoSchema.parse({
    layoutVersionId: bundle.layoutVersion.id,
    draftVersion: bundle.layoutVersion.draft_version ?? null,
    floorId: bundle.layoutVersion.floor_id,
    state: bundle.layoutVersion.state,
    versionNo: bundle.layoutVersion.version_no
  });

  return composeLayoutDraft({
    lifecycle,
    racks,
    zones,
    walls
  });
}
