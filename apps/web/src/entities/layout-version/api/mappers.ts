import { layoutDraftSchema, type LayoutDraft } from '@wos/domain';
import type { LayoutDraftRowBundle, RackFaceRow, RackLevelRow, RackRow, RackSectionRow } from './types';

function buildRackLevel(row: RackLevelRow) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    slotCount: row.slot_count
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
  return {
    id: row.id,
    side: row.side,
    enabled: row.enabled,
    slotNumberingDirection: row.slot_numbering_direction,
    isMirrored: row.is_mirrored,
    mirrorSourceFaceId: row.mirror_source_face_id,
    faceLength: row.face_length ?? undefined,
    sections: allSections
      .filter((section) => section.rack_face_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((section) => buildRackSection(section, allLevels))
  };
}

function buildRack(row: RackRow, allFaces: RackFaceRow[], allSections: RackSectionRow[], allLevels: RackLevelRow[]) {
  return {
    id: row.id,
    displayCode: row.display_code,
    kind: row.kind,
    axis: row.axis,
    x: row.x,
    y: row.y,
    totalLength: row.total_length,
    depth: row.depth,
    rotationDeg: row.rotation_deg,
    faces: allFaces
      .filter((face) => face.rack_id === row.id)
      .sort((a, b) => a.side.localeCompare(b.side))
      .map((face) => buildRackFace(face, allSections, allLevels))
  };
}

export function mapLayoutDraftBundleToDomain(bundle: LayoutDraftRowBundle): LayoutDraft {
  const racks = bundle.racks
    .sort((a, b) => a.display_code.localeCompare(b.display_code))
    .map((row) => buildRack(row, bundle.rackFaces, bundle.rackSections, bundle.rackLevels));

  return layoutDraftSchema.parse({
    layoutVersionId: bundle.layoutVersion.id,
    floorId: bundle.layoutVersion.floor_id,
    state: bundle.layoutVersion.state,
    versionNo: bundle.layoutVersion.version_no,
    rackIds: racks.map((rack) => rack.id),
    racks: Object.fromEntries(racks.map((rack) => [rack.id, rack]))
  });
}
