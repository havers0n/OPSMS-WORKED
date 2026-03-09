import type { LayoutDraft } from '@wos/domain';

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

export type SaveLayoutDraftPayload = {
  layoutVersionId: string;
  racks: SaveRackPayload[];
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
    })
  };
}
