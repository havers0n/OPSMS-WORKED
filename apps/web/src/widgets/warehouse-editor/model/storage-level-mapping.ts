import type { Rack, RackFace } from '@wos/domain';

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

export function resolveSemanticLevelForIndex(
  semanticLevels: number[],
  activeLevelIndex: number
) {
  const safeIndex = Number.isFinite(activeLevelIndex) ? Math.max(0, Math.floor(activeLevelIndex)) : 0;
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
