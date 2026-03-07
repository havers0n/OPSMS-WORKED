import type { LayoutDraft, Rack, RackFace, RackLevel, RackSection } from '@wos/domain';
import type { LayoutDraftRowBundle, RackFaceRow, RackLevelRow, RackRow, RackSectionRow } from './types';

function mapRackLevel(row: RackLevelRow): RackLevel {
  return {
    id: row.id,
    ordinal: row.ordinal,
    slotCount: row.slot_count
  };
}

function mapRackSection(row: RackSectionRow, allLevels: RackLevelRow[]): RackSection {
  return {
    id: row.id,
    ordinal: row.ordinal,
    length: row.length,
    levels: allLevels
      .filter((level) => level.rack_section_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(mapRackLevel)
  };
}

function mapRackFace(row: RackFaceRow, allSections: RackSectionRow[], allLevels: RackLevelRow[]): RackFace {
  return {
    id: row.id,
    side: row.side,
    enabled: row.enabled,
    anchor: row.anchor,
    slotNumberingDirection: row.slot_numbering_direction,
    isMirrored: row.is_mirrored,
    mirrorSourceFaceId: row.mirror_source_face_id,
    sections: allSections
      .filter((section) => section.rack_face_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((section) => mapRackSection(section, allLevels))
  };
}

function mapRack(row: RackRow, allFaces: RackFaceRow[], allSections: RackSectionRow[], allLevels: RackLevelRow[]): Rack {
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
      .map((face) => mapRackFace(face, allSections, allLevels))
  };
}

export function mapLayoutDraftBundleToDomain(bundle: LayoutDraftRowBundle): LayoutDraft {
  const racks = bundle.racks
    .sort((a, b) => a.display_code.localeCompare(b.display_code))
    .map((row) => mapRack(row, bundle.rackFaces, bundle.rackSections, bundle.rackLevels));

  return {
    layoutVersionId: bundle.layoutVersion.id,
    floorId: bundle.layoutVersion.floor_id,
    rackIds: racks.map((rack) => rack.id),
    racks: Object.fromEntries(racks.map((rack) => [rack.id, rack]))
  };
}
