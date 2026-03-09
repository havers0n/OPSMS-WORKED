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
 * anchor='start' (default) — section 1 is at the near/left end:
 *   physical order kept, ordinal = stored ordinal
 * anchor='end' — section 1 is at the far/right end:
 *   sections are visited right-to-left, but address ordinal is
 *   reassigned 1..N from the right so the rightmost section is "01".
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

  if (face.anchor === 'end') {
    // Reverse physical order so the rightmost section becomes address ordinal 1
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
  /** Address-level section number (respects anchor direction, may differ from section.ordinal) */
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
