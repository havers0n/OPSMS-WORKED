import type { LayoutDraft } from '@wos/domain';
import type { WallType, ZoneCategory } from '@wos/domain';

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
  racks: SaveRackPayload[];
  zones: SaveZonePayload[];
  walls: SaveWallPayload[];
};

export function mapLayoutDraftToSavePayload(draft: LayoutDraft): SaveLayoutDraftPayload {
  return {
    layoutVersionId: draft.layoutVersionId,
    racks: draft.rackIds.map((id) => {
      const rack = draft.racks[id];
      return {
        id: rack.id,
        displayCode: rack.displayCode,
        kind: rack.kind,
        axis: rack.axis,
        x: rack.x,
        y: rack.y,
        totalLength: rack.totalLength,
        depth: rack.depth,
        rotationDeg: rack.rotationDeg,
        faces: rack.faces.map((face) => ({
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
    }),
    zones: draft.zoneIds.map((id) => {
      const zone = draft.zones[id];
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
    walls: draft.wallIds.map((id) => {
      const wall = draft.walls[id];
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
