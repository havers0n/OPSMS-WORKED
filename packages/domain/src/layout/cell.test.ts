import { describe, expect, it } from 'vitest';
import { buildCellStructureKey, parseCellAddress } from './cell';

describe('cell helpers', () => {
  it('builds a stable structural key for physical or preview cells', () => {
    expect(
      buildCellStructureKey({
        rackId: 'rack-1',
        rackFaceId: 'face-a',
        rackSectionId: 'section-1',
        rackLevelId: 'level-2',
        slotNo: 4
      })
    ).toBe('rack-1:face-a:section-1:level-2:4');
  });

  it('parses canonical cell addresses', () => {
    expect(parseCellAddress('03-A.02.03.04')).toMatchObject({
      parts: {
        rackCode: '03',
        face: 'A',
        section: 2,
        level: 3,
        slot: 4
      }
    });
  });
});
