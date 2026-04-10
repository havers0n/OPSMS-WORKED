import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { Cell, LayoutDraft, LocationOccupancyRow } from '@wos/domain';
import { createLayoutDraftFixture } from '../model/__fixtures__/layout-draft.fixture';
import type { EditorSelection } from '@/widgets/warehouse-editor/model/editor-types';
import { StorageRackInspector } from './storage-rack-inspector';

let mockLayoutDraft: LayoutDraft | null = null;
let mockSelectedRackId: string | null = null;
let mockSelectedRackActiveLevel = 0;
let mockSelection: EditorSelection = { type: 'rack', rackIds: ['rack-1'] };
let mockPublishedCells: Cell[] = [];
let mockLocationOccupancy: LocationOccupancyRow[] = [];
const setSelectedRackActiveLevelSpy = vi.fn();

vi.mock('../lib/use-workspace-layout', () => ({
  useWorkspaceLayout: () => mockLayoutDraft
}));

vi.mock('@/widgets/warehouse-editor/model/editor-selectors', async () => {
  const actual = await vi.importActual<typeof import('@/widgets/warehouse-editor/model/editor-selectors')>(
    '@/widgets/warehouse-editor/model/editor-selectors'
  );

  return {
    ...actual,
    useSelectedRackId: () => mockSelectedRackId,
    useSelectedRackActiveLevel: () => mockSelectedRackActiveLevel,
    useSetSelectedRackActiveLevel: () => setSelectedRackActiveLevelSpy,
    useEditorSelection: () => mockSelection
  };
});

vi.mock('@/entities/cell/api/use-published-cells', () => ({
  usePublishedCells: () => ({ data: mockPublishedCells })
}));

vi.mock('@/entities/location/api/use-floor-location-occupancy', () => ({
  useFloorLocationOccupancy: () => ({ data: mockLocationOccupancy })
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function createDraftWithLevelCount(levelCount: number): LayoutDraft {
  const draft = createLayoutDraftFixture();
  const rackId = draft.rackIds[0];
  const faceA = draft.racks[rackId]?.faces.find((face) => face.side === 'A');

  if (faceA && faceA.sections[0]) {
    faceA.sections[0].levels = Array.from({ length: levelCount }, (_, index) => ({
      id: `level-a-${index + 1}`,
      ordinal: index + 1,
      slotCount: 3
    }));
  }

  return draft;
}

function renderInspector() {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      React.createElement(StorageRackInspector, { workspace: null, onClose: () => undefined })
    );
  });
  return renderer;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

beforeEach(() => {
  setSelectedRackActiveLevelSpy.mockReset();
  mockLayoutDraft = createDraftWithLevelCount(3);
  mockSelectedRackId = mockLayoutDraft.rackIds[0];
  mockSelectedRackActiveLevel = 1;
  mockSelection = { type: 'rack', rackIds: [mockSelectedRackId] };

  const rackId = mockSelectedRackId;
  mockPublishedCells = [
    {
      id: 'cell-1',
      layoutVersionId: 'lv-1',
      rackId: rackId as string,
      rackFaceId: 'face-a',
      rackSectionId: 'section-a',
      rackLevelId: 'level-2',
      slotNo: 1,
      address: {
        raw: '01-A.01.02.01',
        parts: { rackCode: '01', face: 'A', section: 1, level: 2, slot: 1 },
        sortKey: '0001-A-01-02-01'
      },
      cellCode: 'CELL-1',
      status: 'active'
    },
    {
      id: 'cell-2',
      layoutVersionId: 'lv-1',
      rackId: rackId as string,
      rackFaceId: 'face-a',
      rackSectionId: 'section-a',
      rackLevelId: 'level-2',
      slotNo: 2,
      address: {
        raw: '01-A.01.02.02',
        parts: { rackCode: '01', face: 'A', section: 1, level: 2, slot: 2 },
        sortKey: '0001-A-01-02-02'
      },
      cellCode: 'CELL-2',
      status: 'active'
    }
  ];

  mockLocationOccupancy = [
    {
      tenantId: '11111111-1111-1111-1111-111111111111',
      floorId: '22222222-2222-2222-2222-222222222222',
      locationId: '33333333-3333-3333-3333-333333333333',
      locationCode: 'LOC-1',
      locationType: 'rack_slot',
      cellId: 'cell-1',
      containerId: '44444444-4444-4444-4444-444444444444',
      externalCode: null,
      containerType: 'TOTE',
      containerStatus: 'active',
      placedAt: '2026-01-01T00:00:00.000Z'
    }
  ];
});

describe('StorageRackInspector', () => {
  it('renders storage-owned rack overview and empty location hint', () => {
    const renderer = renderInspector();

    expect(hasText(renderer, 'Storage rack')).toBe(true);
    expect(hasText(renderer, 'Storage summary')).toBe(true);
    expect(hasText(renderer, 'Locations')).toBe(true);
    expect(hasText(renderer, 'Occupied')).toBe(true);
    expect(hasText(renderer, 'Empty')).toBe(true);
    expect(hasText(renderer, 'Select a storage location to see its details.')).toBe(true);
  });

  it('renders pager for multi-level racks and updates active level', () => {
    const renderer = renderInspector();
    const pager = renderer.root.findByProps({ 'data-testid': 'storage-rack-inspector-level-pager' });

    act(() => {
      pager.findByProps({ 'aria-label': 'Next level' }).props.onClick();
      pager.findByProps({ 'aria-label': 'Previous level' }).props.onClick();
    });

    expect(setSelectedRackActiveLevelSpy).toHaveBeenNthCalledWith(1, 2);
    expect(setSelectedRackActiveLevelSpy).toHaveBeenNthCalledWith(2, 0);
  });

  it('does not render layout geometry/structure authoring UI', () => {
    const renderer = renderInspector();

    expect(hasText(renderer, 'Geometry')).toBe(false);
    expect(hasText(renderer, 'Structure')).toBe(false);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(0);
  });
});
