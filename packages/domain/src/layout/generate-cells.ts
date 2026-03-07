import type { Cell } from './cell';
import { buildCellAddress } from './cell';
import type { LayoutDraft } from './layout-draft';
import type { Rack, RackFace, RackLevel, RackSection } from './rack';

function orderSlots(level: RackLevel, face: RackFace): number[] {
  const slots = Array.from({ length: level.slotCount }, (_, index) => index + 1);
  return face.slotNumberingDirection === 'rtl' ? slots.reverse() : slots;
}

function resolveSections(face: RackFace, sourceRack: Rack): RackSection[] {
  if (!face.isMirrored || !face.mirrorSourceFaceId) {
    return face.sections;
  }

  const sourceFace = sourceRack.faces.find((candidate) => candidate.id === face.mirrorSourceFaceId);
  if (!sourceFace) {
    return face.sections;
  }

  return sourceFace.sections;
}

function createCell(args: {
  layoutVersionId: string;
  rack: Rack;
  face: RackFace;
  section: RackSection;
  level: RackLevel;
  slotNo: number;
}): Cell {
  const { layoutVersionId, rack, face, section, level, slotNo } = args;
  const address = buildCellAddress({
    rackCode: rack.displayCode,
    face: face.side,
    section: section.ordinal,
    level: level.ordinal,
    slot: slotNo
  });

  return {
    id: `${rack.id}:${face.id}:${section.id}:${level.id}:${slotNo}`,
    layoutVersionId,
    rackId: rack.id,
    rackFaceId: face.id,
    rackSectionId: section.id,
    rackLevelId: level.id,
    slotNo,
    address,
    status: 'active'
  };
}

export function generateRackCells(layoutVersionId: string, rack: Rack): Cell[] {
  return rack.faces.flatMap((face) => {
    if (!face.enabled) {
      return [];
    }

    const sections = resolveSections(face, rack);

    return sections.flatMap((section) =>
      section.levels.flatMap((level) =>
        orderSlots(level, face).map((slotNo) =>
          createCell({
            layoutVersionId,
            rack,
            face,
            section,
            level,
            slotNo
          })
        )
      )
    );
  });
}

export function generateLayoutCells(layoutDraft: LayoutDraft): Cell[] {
  return layoutDraft.rackIds.flatMap((rackId) => generateRackCells(layoutDraft.layoutVersionId, layoutDraft.racks[rackId]));
}
