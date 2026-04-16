import { describe, expect, it } from 'vitest';
import { mapLayoutDraftBundleToDomain } from '../../../entities/layout-version/api/mappers';
import type { LayoutDraftRowBundle } from '../../../entities/layout-version/api/types';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { mapLayoutDraftToSavePayload } from './mappers';

describe('mapLayoutDraftToSavePayload', () => {
  it('keeps rack-face faceLength through load and save round-trips', () => {
    const draft = mapLayoutDraftBundleToDomain({
      layoutVersion: {
        id: '11111111-1111-1111-1111-111111111111',
        archived_at: null,
        created_at: '2026-03-13T00:00:00.000Z',
        created_by: null,
        draft_version: 1,
        floor_id: '22222222-2222-2222-2222-222222222222',
        parent_published_version_id: null,
        published_at: null,
        published_by: null,
        version_no: 1,
        state: 'draft',
        updated_at: '2026-03-13T00:00:00.000Z'
      },
      racks: [
        {
          id: '33333333-3333-3333-3333-333333333333',
          layout_version_id: '11111111-1111-1111-1111-111111111111',
          created_at: '2026-03-13T00:00:00.000Z',
          display_code: '03',
          kind: 'paired',
          axis: 'NS',
          x: 10,
          y: 20,
          total_length: 5,
          depth: 1.1,
          rotation_deg: 0,
          state: 'draft',
          updated_at: '2026-03-13T00:00:00.000Z'
        }
      ],
      rackFaces: [
        {
          id: '44444444-4444-4444-4444-444444444444',
          rack_id: '33333333-3333-3333-3333-333333333333',
          created_at: '2026-03-13T00:00:00.000Z',
          side: 'A',
          enabled: true,
          face_length: 4.5,
          face_mode: 'independent',
          slot_numbering_direction: 'ltr',
          is_mirrored: false,
          mirror_source_face_id: null,
          updated_at: '2026-03-13T00:00:00.000Z'
        }
      ],
      rackSections: [
        {
          id: '55555555-5555-5555-5555-555555555555',
          created_at: '2026-03-13T00:00:00.000Z',
          rack_face_id: '44444444-4444-4444-4444-444444444444',
          ordinal: 1,
          length: 5,
          updated_at: '2026-03-13T00:00:00.000Z'
        }
      ],
      rackLevels: [
        {
          id: '66666666-6666-6666-6666-666666666666',
          created_at: '2026-03-13T00:00:00.000Z',
          rack_section_id: '55555555-5555-5555-5555-555555555555',
          ordinal: 1,
          slot_count: 2,
          structural_default_role: 'none',
          updated_at: '2026-03-13T00:00:00.000Z'
        }
      ],
      zones: [
        {
          id: '99999999-9999-9999-9999-999999999999',
          layout_version_id: '11111111-1111-1111-1111-111111111111',
          code: 'Z01',
          name: 'Inbound staging',
          category: 'staging',
          color: '#38bdf8',
          x: 40,
          y: 80,
          width: 200,
          height: 120
        }
      ],
      walls: [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          layout_version_id: '11111111-1111-1111-1111-111111111111',
          code: 'W01',
          name: 'Divider',
          wall_type: 'partition',
          x1: 120,
          y1: 160,
          x2: 320,
          y2: 160,
          blocks_rack_placement: true
        }
      ]
    } satisfies LayoutDraftRowBundle);

    useEditorStore.getState().initializeDraft(draft);

    const payload = mapLayoutDraftToSavePayload(useEditorStore.getState().draft ?? draft);

    expect(useEditorStore.getState().draft?.state).toBe('draft');
    expect(payload.racks[0]?.faces[0]).toEqual(
      expect.objectContaining({
        slotNumberingDirection: 'ltr',
        isMirrored: false,
        mirrorSourceFaceId: null,
        faceLength: 4.5
      })
    );
    expect(payload.draftVersion).toBe(1);
    expect(payload.racks[0]?.faces[0]).not.toHaveProperty('anchor');
    expect(payload.zones[0]).toEqual({
      id: '99999999-9999-9999-9999-999999999999',
      code: 'Z01',
      name: 'Inbound staging',
      category: 'staging',
      color: '#38bdf8',
      x: 40,
      y: 80,
      width: 200,
      height: 120
    });
    expect(payload.walls[0]).toEqual({
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      code: 'W01',
      name: 'Divider',
      wallType: 'partition',
      x1: 120,
      y1: 160,
      x2: 320,
      y2: 160,
      blocksRackPlacement: true
    });
  });
});
