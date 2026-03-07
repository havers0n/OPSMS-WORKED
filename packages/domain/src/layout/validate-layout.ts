import type { LayoutValidationIssue, LayoutValidationResult } from './validation';
import type { LayoutDraft } from './layout-draft';
import { generateLayoutCells } from './generate-cells';
import type { Rack, RackFace, RackSection } from './rack';

function compareLength(totalLength: number, sectionLengthSum: number) {
  return Math.abs(totalLength - sectionLengthSum) < 0.001;
}

function resolveSections(face: RackFace, rack: Rack): RackSection[] {
  if (!face.isMirrored || !face.mirrorSourceFaceId) {
    return face.sections;
  }

  const sourceFace = rack.faces.find((candidate) => candidate.id === face.mirrorSourceFaceId);
  return sourceFace?.sections ?? face.sections;
}

export function validateLayoutDraft(layoutDraft: LayoutDraft): LayoutValidationResult {
  const issues: LayoutValidationIssue[] = [];
  const generatedCells = generateLayoutCells(layoutDraft);
  const addressSet = new Set<string>();

  for (const rackId of layoutDraft.rackIds) {
    const rack = layoutDraft.racks[rackId];
    const faceA = rack.faces.find((face) => face.side === 'A');
    const enabledFaces = rack.faces.filter((face) => face.enabled);

    if (!faceA || !faceA.enabled) {
      issues.push({
        code: 'rack.face_a_required',
        severity: 'error',
        message: `Rack ${rack.displayCode} must have an enabled Face A.`,
        entityId: rack.id
      });
    }

    if (enabledFaces.length === 0) {
      issues.push({
        code: 'rack.enabled_face_required',
        severity: 'error',
        message: `Rack ${rack.displayCode} must have at least one enabled face.`,
        entityId: rack.id
      });
    }

    for (const face of enabledFaces) {
      const sections = resolveSections(face, rack);
      const sectionLengthSum = sections.reduce((sum, section) => sum + section.length, 0);

      if (sections.length === 0) {
        issues.push({
          code: 'rack_face.sections_required',
          severity: face.side === 'B' ? 'warning' : 'error',
          message: `Face ${face.side} on rack ${rack.displayCode} has no configured sections.`,
          entityId: face.id
        });
      }

      if (sections.length > 0 && !compareLength(rack.totalLength, sectionLengthSum)) {
        issues.push({
          code: 'rack_face.section_length_mismatch',
          severity: 'error',
          message: `Face ${face.side} section length sum (${sectionLengthSum}) does not match rack total length (${rack.totalLength}).`,
          entityId: face.id
        });
      }

      for (const section of sections) {
        if (section.levels.length === 0) {
          issues.push({
            code: 'rack_section.levels_required',
            severity: 'error',
            message: `Section ${section.ordinal} on face ${face.side} must contain at least one level.`,
            entityId: section.id
          });
        }

        for (const level of section.levels) {
          if (level.slotCount < 1) {
            issues.push({
              code: 'rack_level.slot_count_invalid',
              severity: 'error',
              message: `Level ${level.ordinal} on section ${section.ordinal} must contain at least one slot.`,
              entityId: level.id
            });
          }
        }
      }
    }
  }

  for (const cell of generatedCells) {
    if (addressSet.has(cell.address.raw)) {
      issues.push({
        code: 'layout.address_duplicate',
        severity: 'error',
        message: `Duplicate generated address ${cell.address.raw}.`,
        entityId: cell.id
      });
    }
    addressSet.add(cell.address.raw);
  }

  return {
    isValid: issues.every((issue) => issue.severity !== 'error'),
    issues
  };
}
