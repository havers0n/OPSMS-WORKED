import { describe, expect, it } from 'vitest';
import type { Rack, RackFace } from '@wos/domain';
import {
  collectFaceSemanticLevels,
  collectRackSemanticLevels,
  resolveIndexForSemanticLevel,
  resolveSemanticLevelForIndex
} from './storage-level-mapping';

function createFace(side: 'A' | 'B', enabled: boolean, sectionLevels: number[][]): RackFace {
  return {
    id: `face-${side}`,
    side,
    enabled,
    slotNumberingDirection: 'ltr',
    isMirrored: false,
    mirrorSourceFaceId: null,
    sections: sectionLevels.map((levels, sectionIndex) => ({
      id: `section-${side}-${sectionIndex + 1}`,
      ordinal: sectionIndex + 1,
      length: 2,
      levels: levels.map((ordinal, levelIndex) => ({
        id: `level-${side}-${sectionIndex + 1}-${levelIndex + 1}`,
        ordinal,
        slotCount: 2
      }))
    }))
  };
}

function createRack(faces: RackFace[]): Rack {
  return {
    id: 'rack-1',
    displayCode: '01',
    kind: 'single',
    x: 0,
    y: 0,
    rotationDeg: 0,
    axis: 'WE',
    totalLength: 2,
    depth: 1,
    faces
  };
}

describe('storage-level-mapping', () => {
  it('collectRackSemanticLevels builds union across enabled faces and sections with dedupe + ASC sort', () => {
    const rack = createRack([
      createFace('A', true, [[3, 1], [5]]),
      createFace('B', true, [[5, 7], [3]])
    ]);

    expect(collectRackSemanticLevels(rack)).toEqual([1, 3, 5, 7]);
  });

  it('collectFaceSemanticLevels ignores disabled faces', () => {
    const faces = [
      createFace('A', true, [[3, 1]]),
      createFace('B', false, [[2, 4]])
    ];

    expect(collectFaceSemanticLevels(faces)).toEqual([1, 3]);
  });

  it('supports sparse semantic levels without continuity assumptions', () => {
    const levels = [1, 3, 5];

    expect(resolveSemanticLevelForIndex(levels, 0)).toBe(1);
    expect(resolveSemanticLevelForIndex(levels, 1)).toBe(3);
    expect(resolveSemanticLevelForIndex(levels, 2)).toBe(5);
    expect(resolveIndexForSemanticLevel(levels, 3)).toBe(1);
    expect(resolveIndexForSemanticLevel(levels, 2)).toBeNull();
  });
});
