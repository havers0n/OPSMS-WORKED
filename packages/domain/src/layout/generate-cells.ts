import type { Cell } from './cell';
import { buildCellCode } from './cell';
import { buildCellAddress } from './cell';
import type { LayoutDraft } from './layout-draft';
import type { Rack, RackFace, RackLevel, RackSection } from './rack';

function orderSlots(level: RackLevel, face: RackFace): number[] {
  const slots = Array.from({ length: level.slotCount }, (_, index) => index + 1);
  return face.slotNumberingDirection === 'rtl' ? slots.reverse() : slots;
}

/**
 * Returns sections in address-generation order together with the
 * address ordinal (1-based) to use for each section.
 *
 * slotNumberingDirection='ltr' — section 1 is at the left/near end (default)
 * slotNumberingDirection='rtl' — section 1 is at the right/far end; sections
 *   are visited in reverse so the rightmost section is address ordinal 1.
 *
 * Both section ordering and slot numbering always follow slotNumberingDirection,
 * keeping addresses consistent across the full rack length.
 */
function resolveSections(
  face: RackFace,
  sourceRack: Rack
): Array<{ section: RackSection; addressOrdinal: number }> {
  let sections: RackSection[];

  if (face.isMirrored && face.mirrorSourceFaceId) {
    const sourceFace = sourceRack.faces.find((candidate) => candidate.id === face.mirrorSourceFaceId);
    sections = sourceFace ? sourceFace.sections : face.sections;
  } else {
    sections = face.sections;
  }

  if (face.slotNumberingDirection === 'rtl') {
    // RTL: the far/right end of the rack is address ordinal 1 — reverse section order
    return [...sections]
      .reverse()
      .map((section, i) => ({ section, addressOrdinal: i + 1 }));
  }

  return sections.map((section, i) => ({ section, addressOrdinal: i + 1 }));
}

function createCell(args: {
  layoutVersionId: string;
  rack: Rack;
  face: RackFace;
  section: RackSection;
  /** Address-level section number in effective generation order, which may differ from section.ordinal. */
  sectionAddressOrdinal: number;
  level: RackLevel;
  slotNo: number;
}): Cell {
  const { layoutVersionId, rack, face, section, sectionAddressOrdinal, level, slotNo } = args;
  const address = buildCellAddress({
    rackCode: rack.displayCode,
    face: face.side,
    section: sectionAddressOrdinal,
    level: level.ordinal,
    slot: slotNo
  });

  return {
    id: `${rack.id}:${face.id}:${section.id}:${level.id}:${slotNo}`,
    cellCode: buildCellCode({
      rackId: rack.id,
      face: face.side,
      section: sectionAddressOrdinal,
      level: level.ordinal,
      slot: slotNo
    }),
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

    const orderedSections = resolveSections(face, rack);

    return orderedSections.flatMap(({ section, addressOrdinal }) =>
      section.levels.flatMap((level) =>
        orderSlots(level, face).map((slotNo) =>
          createCell({
            layoutVersionId,
            rack,
            face,
            section,
            sectionAddressOrdinal: addressOrdinal,
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
