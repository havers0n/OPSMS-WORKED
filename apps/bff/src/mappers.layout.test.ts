import { describe, expect, it } from 'vitest';
import { mapLayoutBundleJsonToDomain, mapLayoutDraftBundleToDomain } from './mappers.js';

describe('layout boundary mapping', () => {
  it('hydrates SQL/table bundles through lifecycle plus rack geometry/structure into the existing LayoutDraft shape', () => {
    const draft = mapLayoutDraftBundleToDomain({
      layoutVersion: {
        id: '11111111-1111-1111-1111-111111111111',
        floor_id: '22222222-2222-2222-2222-222222222222',
        draft_version: 3,
        version_no: 7,
        state: 'draft'
      },
      racks: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          layout_version_id: '11111111-1111-1111-1111-111111111111',
          display_code: 'R-01',
          kind: 'paired',
          axis: 'NS',
          x: 10,
          y: 20,
          total_length: 5,
          depth: 1.2,
          rotation_deg: 90
        }
      ],
      rackFaces: [
        {
          id: '44444444-4444-4444-4444-444444444444',
          rack_id: '33333333-3333-3333-3333-333333333333',
          side: 'A',
          enabled: true,
          slot_numbering_direction: 'ltr',
          face_mode: 'independent',
          is_mirrored: false,
          mirror_source_face_id: null,
          face_length: 4.5
        }
      ],
      rackSections: [
        {
          id: '55555555-5555-5555-5555-555555555555',
          rack_face_id: '44444444-4444-4444-4444-444444444444',
          ordinal: 1,
          length: 4.5
        }
      ],
      rackLevels: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          rack_section_id: '55555555-5555-5555-5555-555555555555',
          ordinal: 1,
          slot_count: 3,
          structural_default_role: 'none'
        }
      ],
      zones: [],
      walls: []
    });

    expect(draft).toMatchObject({
      layoutVersionId: '11111111-1111-1111-1111-111111111111',
      draftVersion: 3,
      floorId: '22222222-2222-2222-2222-222222222222',
      state: 'draft',
      versionNo: 7
    });
    expect(draft.racks[draft.rackIds[0] as string]).toMatchObject({
      displayCode: 'R-01',
      kind: 'paired',
      axis: 'NS',
      x: 10,
      y: 20,
      totalLength: 5,
      depth: 1.2,
      rotationDeg: 90
    });
    expect(draft.racks[draft.rackIds[0] as string]?.faces[0]?.faceLength).toBe(4.5);
  });

  it('hydrates RPC bundle JSON into the same runtime draft shape while preserving lifecycle fields', () => {
    const draft = mapLayoutBundleJsonToDomain({
      layoutVersionId: '11111111-1111-1111-1111-111111111111',
      draftVersion: 4,
      floorId: '22222222-2222-2222-2222-222222222222',
      state: 'draft',
      versionNo: 8,
      racks: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          displayCode: 'R-02',
          kind: 'paired',
          axis: 'WE',
          x: 30,
          y: 40,
          totalLength: 6,
          depth: 1.4,
          rotationDeg: 180,
          faces: [
            {
              id: '44444444-4444-4444-4444-444444444444',
              side: 'A',
              enabled: true,
              slotNumberingDirection: 'rtl',
              relationshipMode: 'independent',
              faceLength: 5.5,
              isMirrored: false,
              mirrorSourceFaceId: null,
              sections: [
                {
                  id: '55555555-5555-5555-5555-555555555555',
                  ordinal: 1,
                  length: 5.5,
                  levels: [
                    {
                      id: '66666666-6666-6666-6666-666666666666',
                      ordinal: 1,
                      slotCount: 2,
                      structuralDefaultRole: 'none'
                    }
                  ]
                }
              ]
            }
          ]
        }
      ],
      zones: [],
      walls: []
    });

    expect(draft).not.toBeNull();
    expect(draft).toMatchObject({
      layoutVersionId: '11111111-1111-1111-1111-111111111111',
      draftVersion: 4,
      floorId: '22222222-2222-2222-2222-222222222222',
      state: 'draft',
      versionNo: 8
    });
    expect(draft?.racks[draft.rackIds[0] as string]).toMatchObject({
      displayCode: 'R-02',
      axis: 'WE',
      x: 30,
      y: 40,
      rotationDeg: 180
    });
    expect(draft?.racks[draft.rackIds[0] as string]?.faces[0]?.slotNumberingDirection).toBe('rtl');
    expect(draft?.racks[draft.rackIds[0] as string]?.faces[0]?.faceLength).toBe(5.5);
  });

  it('propagates Face A sections to mirrored Face B in SQL/table path', () => {
    const draft = mapLayoutDraftBundleToDomain({
      layoutVersion: {
        id: '11111111-1111-1111-1111-111111111111',
        floor_id: '22222222-2222-2222-2222-222222222222',
        draft_version: null,
        version_no: 1,
        state: 'published'
      },
      racks: [
        {
          id: 'rack-1',
          layout_version_id: '11111111-1111-1111-1111-111111111111',
          display_code: 'R-01',
          kind: 'paired',
          axis: 'NS',
          x: 0,
          y: 0,
          total_length: 5,
          depth: 1.2,
          rotation_deg: 0,
          is_locked: false
        }
      ],
      rackFaces: [
        {
          id: 'face-a',
          rack_id: 'rack-1',
          side: 'A',
          enabled: true,
          slot_numbering_direction: 'ltr',
          face_mode: 'independent',
          is_mirrored: false,
          mirror_source_face_id: null,
          face_length: null
        },
        {
          id: 'face-b',
          rack_id: 'rack-1',
          side: 'B',
          enabled: true,
          slot_numbering_direction: 'rtl',
          face_mode: 'mirrored',
          is_mirrored: true,
          mirror_source_face_id: 'face-a',
          face_length: null
        }
      ],
      rackSections: [
        { id: 'section-1', rack_face_id: 'face-a', ordinal: 1, length: 2.5 },
        { id: 'section-2', rack_face_id: 'face-a', ordinal: 2, length: 2.5 }
      ],
      rackLevels: [
        { id: 'level-1', rack_section_id: 'section-1', ordinal: 1, slot_count: 3, structural_default_role: 'primary_pick' }
      ]
    });

    const rack = draft.racks[draft.rackIds[0] as string];
    const faceA = rack?.faces.find((f) => f.side === 'A');
    const faceB = rack?.faces.find((f) => f.side === 'B');

    expect(faceA?.sections).toHaveLength(2);
    expect(faceB?.sections).toHaveLength(2);
    expect(faceB?.sections[0]?.id).toBe('section-1');
    expect(faceB?.sections[1]?.id).toBe('section-2');
    expect(faceB?.sections[0]?.levels[0]?.slotCount).toBe(3);
  });

  it('propagates Face A sections to mirrored Face B in RPC JSON path', () => {
    const draft = mapLayoutBundleJsonToDomain({
      layoutVersionId: '11111111-1111-1111-1111-111111111111',
      draftVersion: null,
      floorId: '22222222-2222-2222-2222-222222222222',
      state: 'published',
      versionNo: 1,
      racks: [
        {
          id: 'rack-1',
          displayCode: 'R-01',
          kind: 'paired',
          axis: 'NS',
          x: 0,
          y: 0,
          totalLength: 5,
          depth: 1.2,
          rotationDeg: 0,
          faces: [
            {
              id: 'face-a',
              side: 'A',
              enabled: true,
              slotNumberingDirection: 'ltr',
              relationshipMode: 'independent' as const,
              isMirrored: false,
              mirrorSourceFaceId: null,
              faceLength: null,
              sections: [
                {
                  id: 'section-1',
                  ordinal: 1,
                  length: 2.5,
                  levels: [{ id: 'level-1', ordinal: 1, slotCount: 3, structuralDefaultRole: 'primary_pick' as const }]
                }
              ]
            },
            {
              id: 'face-b',
              side: 'B',
              enabled: true,
              slotNumberingDirection: 'rtl',
              relationshipMode: 'mirrored' as const,
              isMirrored: true,
              mirrorSourceFaceId: 'face-a',
              faceLength: null,
              sections: []
            }
          ]
        }
      ],
      zones: [],
      walls: []
    });

    const rack = draft?.racks[draft.rackIds[0] as string];
    const faceA = rack?.faces.find((f) => f.side === 'A');
    const faceB = rack?.faces.find((f) => f.side === 'B');

    expect(faceA?.sections).toHaveLength(1);
    expect(faceB?.sections).toHaveLength(1);
    expect(faceB?.sections[0]?.id).toBe('section-1');
    expect(faceB?.sections[0]?.levels[0]?.slotCount).toBe(3);
  });
});
