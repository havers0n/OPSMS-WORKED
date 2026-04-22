import type { Cell, Rack, RackFace } from '@wos/domain';

function normalizeSemanticLevels(levels: number[]) {
  return Array.from(new Set(levels)).sort((left, right) => left - right);
}

export function collectFaceSemanticLevels(faces: RackFace[]) {
  return normalizeSemanticLevels(
    faces
      .filter((face) => face.enabled)
      .flatMap((face) =>
        face.sections.flatMap((section) =>
          section.levels
            .map((level) => level.ordinal)
            .filter((ordinal): ordinal is number => Number.isFinite(ordinal))
        )
      )
  );
}

export function collectRackSemanticLevels(rack: Rack) {
  return collectFaceSemanticLevels(rack.faces);
}

export function collectRackPublishedSemanticLevels(
  publishedCells: Iterable<Cell>,
  rackId: string | null
) {
  if (!rackId) return [];

  const levels: number[] = [];
  for (const cell of publishedCells) {
    if (cell.rackId !== rackId || cell.status !== 'active') continue;
    const semanticLevel = cell.address.parts.level;
    if (Number.isFinite(semanticLevel)) {
      levels.push(semanticLevel);
    }
  }

  return normalizeSemanticLevels(levels);
}

export function resolveInitialRackSemanticLevel(
  publishedCells: Iterable<Cell>,
  rackId: string | null
) {
  return collectRackPublishedSemanticLevels(publishedCells, rackId)[0] ?? null;
}

export function resolveSemanticLevelForIndex(
  semanticLevels: number[],
  activeLevelIndex: number | null
) {
  if (typeof activeLevelIndex !== 'number' || !Number.isFinite(activeLevelIndex)) return null;
  const safeIndex = Math.max(0, Math.floor(activeLevelIndex));
  return semanticLevels[safeIndex] ?? null;
}

export function resolveIndexForSemanticLevel(
  semanticLevels: number[],
  semanticLevel: number
) {
  if (!Number.isFinite(semanticLevel)) return null;
  const idx = semanticLevels.indexOf(semanticLevel);
  return idx >= 0 ? idx : null;
}
