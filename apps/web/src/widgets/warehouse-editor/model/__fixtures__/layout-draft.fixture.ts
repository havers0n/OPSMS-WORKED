import type { LayoutDraft } from '@wos/domain';

export function createLayoutDraftFixture(): LayoutDraft {
  const rackId = 'rack-1';
  const faceAId = 'face-a-1';
  const faceBId = 'face-b-1';

  return {
    layoutVersionId: 'layout-version-1',
    draftVersion: 1,
    floorId: 'floor-1',
    state: 'draft',
    versionNo: 1,
    zoneIds: [],
    zones: {},
    wallIds: [],
    walls: {},
    rackIds: [rackId],
    racks: {
      [rackId]: {
        id: rackId,
        displayCode: '01',
        kind: 'single',
        axis: 'NS',
        x: 20,
        y: 30,
        totalLength: 5,
        depth: 1.2,
        rotationDeg: 0,
        faces: [
          {
            id: faceAId,
            side: 'A',
            enabled: true,

            slotNumberingDirection: 'ltr',
            isMirrored: false,
            mirrorSourceFaceId: null,
            sections: [
              {
                id: 'section-a-1',
                ordinal: 1,
                length: 5,
                levels: [{ id: 'level-a-1', ordinal: 1, slotCount: 3 }]
              }
            ]
          },
          {
            id: faceBId,
            side: 'B',
            enabled: false,

            slotNumberingDirection: 'ltr',
            isMirrored: false,
            mirrorSourceFaceId: null,
            sections: []
          }
        ]
      }
    }
  };
}
