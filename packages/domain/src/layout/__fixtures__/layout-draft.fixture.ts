import type { LayoutDraft } from '../layout-draft';

export function createValidLayoutDraftFixture(): LayoutDraft {
  return {
    layoutVersionId: '11111111-1111-1111-1111-111111111111',
    floorId: '22222222-2222-2222-2222-222222222222',
    rackIds: ['33333333-3333-3333-3333-333333333333'],
    racks: {
      '33333333-3333-3333-3333-333333333333': {
        id: '33333333-3333-3333-3333-333333333333',
        displayCode: '03',
        kind: 'paired',
        axis: 'NS',
        x: 10,
        y: 20,
        totalLength: 5,
        depth: 1.1,
        rotationDeg: 0,
        faces: [
          {
            id: '44444444-4444-4444-4444-444444444444',
            side: 'A',
            enabled: true,
            anchor: 'start',
            slotNumberingDirection: 'ltr',
            isMirrored: false,
            mirrorSourceFaceId: null,
            sections: [
              {
                id: '55555555-5555-5555-5555-555555555555',
                ordinal: 1,
                length: 5,
                levels: [
                  {
                    id: '66666666-6666-6666-6666-666666666666',
                    ordinal: 1,
                    slotCount: 2
                  },
                  {
                    id: '77777777-7777-7777-7777-777777777777',
                    ordinal: 2,
                    slotCount: 2
                  }
                ]
              }
            ]
          },
          {
            id: '88888888-8888-8888-8888-888888888888',
            side: 'B',
            enabled: true,
            anchor: 'end',
            slotNumberingDirection: 'rtl',
            isMirrored: true,
            mirrorSourceFaceId: '44444444-4444-4444-4444-444444444444',
            sections: []
          }
        ]
      }
    }
  };
}
