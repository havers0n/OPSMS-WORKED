import { composeLayoutDraft, type LayoutDraft } from '@wos/domain';
import { describe, expect, it } from 'vitest';
import {
  areOverlayLayersEqual,
  areRackGeometryLayersEqual,
  areRackStructureLayersEqual,
  classifyLayoutDraftChange
} from './change-classification.js';

function createBaseDraft(): LayoutDraft {
  return composeLayoutDraft({
    lifecycle: {
      layoutVersionId: '11111111-1111-1111-1111-111111111111',
      draftVersion: 7,
      floorId: '22222222-2222-2222-2222-222222222222',
      state: 'draft',
      versionNo: 3
    },
    racks: [
      {
        id: '33333333-3333-3333-3333-333333333333',
        geometry: {
          x: 10,
          y: 20,
          totalLength: 5,
          depth: 1.2,
          rotationDeg: 0
        },
        structure: {
          displayCode: 'R-01',
          kind: 'paired',
          axis: 'NS',
          faces: [
            {
              id: '44444444-4444-4444-4444-444444444444',
              side: 'A',
              enabled: true,
              slotNumberingDirection: 'ltr',
              relationshipMode: 'independent',
              isMirrored: false,
              mirrorSourceFaceId: null,
              faceLength: 5,
              sections: [
                {
                  id: '55555555-5555-5555-5555-555555555555',
                  ordinal: 1,
                  length: 5,
                  levels: [
                    {
                      id: '66666666-6666-6666-6666-666666666666',
                      ordinal: 1,
                      slotCount: 3,
                      structuralDefaultRole: 'none'
                    }
                  ]
                }
              ]
            }
          ]
        }
      }
    ],
    zones: [
      {
        id: '77777777-7777-7777-7777-777777777777',
        code: 'Z-01',
        name: 'Inbound',
        category: 'staging',
        color: '#38bdf8',
        x: 100,
        y: 120,
        width: 50,
        height: 30
      }
    ],
    walls: [
      {
        id: '88888888-8888-8888-8888-888888888888',
        code: 'W-01',
        name: 'Divider',
        wallType: 'partition',
        x1: 20,
        y1: 20,
        x2: 20,
        y2: 120,
        blocksRackPlacement: true
      }
    ]
  });
}

function cloneDraft(draft: LayoutDraft): LayoutDraft {
  return structuredClone(draft);
}

describe('layout save change classification', () => {
  it('classifies semantically equal normalized drafts as no_changes', () => {
    const persistedDraft = createBaseDraft();
    const incomingDraft = cloneDraft(persistedDraft);

    incomingDraft.draftVersion = 99;
    incomingDraft.versionNo = 42;

    expect(areRackGeometryLayersEqual(persistedDraft, incomingDraft)).toBe(true);
    expect(areRackStructureLayersEqual(persistedDraft, incomingDraft)).toBe(true);
    expect(areOverlayLayersEqual(persistedDraft, incomingDraft)).toBe(true);
    expect(classifyLayoutDraftChange(persistedDraft, incomingDraft)).toBe('no_changes');
  });

  it('classifies rack geometry-only edits as geometry_only', () => {
    const persistedDraft = createBaseDraft();
    const incomingDraft = cloneDraft(persistedDraft);

    incomingDraft.racks[incomingDraft.rackIds[0] as string]!.x = 15;
    incomingDraft.racks[incomingDraft.rackIds[0] as string]!.rotationDeg = 90;

    expect(classifyLayoutDraftChange(persistedDraft, incomingDraft)).toBe('geometry_only');
  });

  it('classifies rack structure-only edits as structure_changed', () => {
    const persistedDraft = createBaseDraft();
    const incomingDraft = cloneDraft(persistedDraft);

    incomingDraft.racks[incomingDraft.rackIds[0] as string]!.faces[0]!.slotNumberingDirection = 'rtl';

    expect(classifyLayoutDraftChange(persistedDraft, incomingDraft)).toBe('structure_changed');
  });

  it('classifies overlay-only edits as zones_or_walls_changed', () => {
    const persistedDraft = createBaseDraft();
    const incomingDraft = cloneDraft(persistedDraft);

    incomingDraft.zones[incomingDraft.zoneIds[0] as string]!.width = 65;

    expect(classifyLayoutDraftChange(persistedDraft, incomingDraft)).toBe('zones_or_walls_changed');
  });

  it('classifies cross-layer edits as mixed', () => {
    const persistedDraft = createBaseDraft();
    const incomingDraft = cloneDraft(persistedDraft);

    incomingDraft.racks[incomingDraft.rackIds[0] as string]!.y = 30;
    incomingDraft.walls[incomingDraft.wallIds[0] as string]!.y2 = 140;

    expect(classifyLayoutDraftChange(persistedDraft, incomingDraft)).toBe('mixed');
  });

  it('classifies rack add/remove as structure_changed', () => {
    const persistedDraft = createBaseDraft();
    const incomingDraft = cloneDraft(persistedDraft);

    delete incomingDraft.racks[incomingDraft.rackIds[0] as string];
    incomingDraft.rackIds = [];

    expect(classifyLayoutDraftChange(persistedDraft, incomingDraft)).toBe('structure_changed');
  });

  it('classifies zone add/remove as zones_or_walls_changed', () => {
    const persistedDraft = createBaseDraft();
    const incomingDraft = cloneDraft(persistedDraft);

    delete incomingDraft.zones[incomingDraft.zoneIds[0] as string];
    incomingDraft.zoneIds = [];

    expect(classifyLayoutDraftChange(persistedDraft, incomingDraft)).toBe('zones_or_walls_changed');
  });
});
