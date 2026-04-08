import {
  splitLayoutDraft,
  type LayoutDraft,
  type RackGeometry,
  type RackStructure,
  type WallType,
  type ZoneCategory
} from '@wos/domain';

type SaveRackLevelPayload = {
  id: string;
  ordinal: number;
  slotCount: number;
};

type SaveRackSectionPayload = {
  id: string;
  ordinal: number;
  length: number;
  levels: SaveRackLevelPayload[];
};

type SaveRackFacePayload = {
  id: string;
  side: string;
  enabled: boolean;
  slotNumberingDirection: string;
  isMirrored: boolean;
  mirrorSourceFaceId: string | null;
  faceLength?: number;
  sections: SaveRackSectionPayload[];
};

type SaveRackPayload = {
  id: string;
  displayCode: string;
  kind: string;
  axis: string;
  x: number;
  y: number;
  totalLength: number;
  depth: number;
  rotationDeg: number;
  faces: SaveRackFacePayload[];
};

type SaveZonePayload = {
  id: string;
  code: string;
  name: string;
  category?: ZoneCategory | null;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type SaveWallPayload = {
  id: string;
  code: string;
  name?: string | null;
  wallType?: WallType | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocksRackPlacement: boolean;
};

export type SaveLayoutDraftPayload = {
  layoutVersionId: string;
  draftVersion?: number | null;
  racks: SaveRackPayload[];
  zones: SaveZonePayload[];
  walls: SaveWallPayload[];
};

function serializeRackSavePayload(id: string, geometry: RackGeometry, structure: RackStructure): SaveRackPayload {
  return {
    id,
    displayCode: structure.displayCode,
    kind: structure.kind,
    axis: structure.axis,
    x: geometry.x,
    y: geometry.y,
    totalLength: geometry.totalLength,
    depth: geometry.depth,
    rotationDeg: geometry.rotationDeg,
    faces: structure.faces.map((face) => ({
      id: face.id,
      side: face.side,
      enabled: face.enabled,
      slotNumberingDirection: face.slotNumberingDirection,
      isMirrored: face.isMirrored,
      mirrorSourceFaceId: face.mirrorSourceFaceId,
      faceLength: face.faceLength,
      sections: face.sections.map((section) => ({
        id: section.id,
        ordinal: section.ordinal,
        length: section.length,
        levels: section.levels.map((level) => ({
          id: level.id,
          ordinal: level.ordinal,
          slotCount: level.slotCount
        }))
      }))
    }))
  };
}

export function mapLayoutDraftToSavePayload(draft: LayoutDraft): SaveLayoutDraftPayload {
  const splitDraft = splitLayoutDraft(draft);

  return {
    layoutVersionId: splitDraft.lifecycle.layoutVersionId,
    draftVersion: splitDraft.lifecycle.draftVersion ?? null,
    racks: splitDraft.racks.map((rack) => serializeRackSavePayload(rack.id, rack.geometry, rack.structure)),
    zones: splitDraft.zones.map((zone) => {
      return {
        id: zone.id,
        code: zone.code,
        name: zone.name,
        category: zone.category,
        color: zone.color,
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height
      };
    }),
    walls: splitDraft.walls.map((wall) => {
      return {
        id: wall.id,
        code: wall.code,
        name: wall.name,
        wallType: wall.wallType,
        x1: wall.x1,
        y1: wall.y1,
        x2: wall.x2,
        y2: wall.y2,
        blocksRackPlacement: wall.blocksRackPlacement
      };
    })
  };
}
