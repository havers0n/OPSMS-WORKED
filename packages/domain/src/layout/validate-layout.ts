import type { LayoutClientPrecheckResult, LayoutValidationIssue } from './validation';
import type { LayoutDraft } from './layout-draft';
import { generatePreviewCells } from './generate-cells';
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

// Local editor precheck only. Server validation remains authoritative for saved drafts and publish.
export function validateLayoutDraft(layoutDraft: LayoutDraft): LayoutClientPrecheckResult {
  const issues: LayoutValidationIssue[] = [];
  const generatedCells = generatePreviewCells(layoutDraft);
  const addressSet = new Set<string>();

  for (const rackId of layoutDraft.rackIds) {
    const rack = layoutDraft.racks[rackId];
    const faceA = rack.faces.find((face) => face.side === 'A');
    const faceB = rack.faces.find((face) => face.side === 'B');
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

    if (rack.kind === 'single' && faceB && faceB.enabled && (faceB.isMirrored || faceB.sections.length > 0)) {
      issues.push({
        code: 'rack.single_face_b_forbidden',
        severity: 'error',
        message: `Rack ${rack.displayCode} is single but Face B is configured.`,
        entityId: rack.id
      });
    }

    if (rack.kind === 'paired' && !faceB) {
      issues.push({
        code: 'rack.paired_face_b_required',
        severity: 'error',
        message: `Rack ${rack.displayCode} is paired but Face B is missing.`,
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

      // Per-face length overrides rack.totalLength for paired racks with asymmetric faces
      const expectedLength = face.faceLength ?? rack.totalLength;
      if (sections.length > 0 && !compareLength(expectedLength, sectionLengthSum)) {
        issues.push({
          code: 'rack_face.section_length_mismatch',
          severity: 'error',
          message: `Face ${face.side} section length sum (${sectionLengthSum.toFixed(2)} m) does not match face length (${expectedLength.toFixed(2)} m).`,
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

  for (const wallId of layoutDraft.wallIds) {
    const wall = layoutDraft.walls[wallId];
    if (!wall) {
      continue;
    }

    const isHorizontal = wall.y1 === wall.y2;
    const isVertical = wall.x1 === wall.x2;

    if (!isHorizontal && !isVertical) {
      issues.push({
        code: 'wall.axis_alignment_required',
        severity: 'error',
        message: `Wall ${wall.code} must be axis-aligned.`,
        entityId: wall.id
      });
    }

    if (wall.x1 === wall.x2 && wall.y1 === wall.y2) {
      issues.push({
        code: 'wall.zero_length_forbidden',
        severity: 'error',
        message: `Wall ${wall.code} must have non-zero length.`,
        entityId: wall.id
      });
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
