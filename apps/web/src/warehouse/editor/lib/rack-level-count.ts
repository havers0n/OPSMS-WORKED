import type { Rack } from '@wos/domain';

/**
 * Derives the displayable level count from Face A, matching the rack-cells render source.
 * Uses max section level depth to cover asymmetric section configurations.
 */
export function getRackFaceALevelCount(rack: Rack | null | undefined): number {
  if (!rack) return 0;

  const faceA = rack.faces.find((face) => face.side === 'A');
  if (!faceA || faceA.sections.length === 0) return 0;

  return faceA.sections.reduce(
    (maxLevelCount, section) => Math.max(maxLevelCount, section.levels.length),
    0
  );
}
