import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { ActiveLayoutTask, EditorSelection } from '@/entities/layout-version/model/editor-types';
import { createLayoutDraftFixture } from '@/entities/layout-version/model/__fixtures__/layout-draft.fixture';
import type { CanvasCapabilities } from './use-canvas-capabilities';
import { useCanvasHudState } from './use-canvas-hud-state';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

const baseCapabilities: CanvasCapabilities = {
  isViewMode: false,
  isStorageMode: false,
  isLayoutMode: true,
  isPlacing: false,
  isDrawingZone: false,
  isDrawingWall: false,
  isLayoutDrawToolActive: false,
  isPlacementMoveMode: false,
  canSelectRack: true,
  canSelectZone: true,
  canSelectWall: true,
  canSelectCells: false,
  lod: 1,
  interactionLevel: 'L1'
};

type HarnessResult = ReturnType<typeof useCanvasHudState>;

function rackSelection(rackIds: string[]): EditorSelection {
  return { type: 'rack', rackIds };
}

function zoneSelection(zoneId: string): EditorSelection {
  return { type: 'zone', zoneId };
}

function wallSelection(wallId: string): EditorSelection {
  return { type: 'wall', wallId };
}

function renderHudState(options?: {
  selection?: EditorSelection;
  activeTask?: ActiveLayoutTask;
  capabilities?: CanvasCapabilities;
}) {
  const {
    selection = rackSelection(['rack-1']),
    activeTask = null,
    capabilities = baseCapabilities
  } = options ?? {};

  const draft = createLayoutDraftFixture();
  draft.zoneIds = ['zone-1'];
  draft.zones['zone-1'] = {
    id: 'zone-1',
    code: 'Z01',
    name: 'Inbound',
    category: 'staging',
    color: '#34d399',
    x: 4,
    y: 6,
    width: 10,
    height: 8
  };
  draft.wallIds = ['wall-1'];
  draft.walls['wall-1'] = {
    id: 'wall-1',
    code: 'W01',
    name: 'Divider',
    wallType: 'generic',
    blocksRackPlacement: false,
    x1: 4,
    y1: 6,
    x2: 12,
    y2: 6
  };

  let result!: HarnessResult;

  function Harness() {
    result = useCanvasHudState({
      activeTask,
      activeStorageWorkflow: null,
      canvasOffset: { x: 0, y: 0 },
      capabilities,
      interactionScope: selection.type === 'none' ? 'idle' : 'object',
      isLayoutEditable: capabilities.isLayoutMode,
      layoutDraft: draft,
      placementLayout: null,
      publishedCellsById: new Map(),
      selectedCellId: null,
      selectedRackFocus: { type: 'body' },
      selectedRackId: selection.type === 'rack' ? selection.rackIds[0] ?? null : null,
      selectedRackIds: selection.type === 'rack' ? selection.rackIds : [],
      selectedWallId: selection.type === 'wall' ? selection.wallId : null,
      selectedZoneId: selection.type === 'zone' ? selection.zoneId : null,
      selection,
      zoom: 1
    });

    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });

  return { result, renderer };
}

describe('useCanvasHudState rack geometry affordance visibility', () => {
  it('shows only for a single selected rack in layout mode with no active task', () => {
    const { result } = renderHudState();

    expect(result.hud.shouldShowLayoutRackGeometryBar).toBe(true);
    expect(result.hud.shouldShowLayoutZoneBar).toBe(false);
    expect(result.hud.shouldShowLayoutWallBar).toBe(false);
  });

  it('does not show for multi-rack, zone, wall, no selection, or non-layout capabilities', () => {
    expect(
      renderHudState({ selection: rackSelection(['rack-1', 'rack-2']) }).result.hud
        .shouldShowLayoutRackGeometryBar
    ).toBe(false);

    expect(
      renderHudState({ selection: zoneSelection('zone-1') }).result.hud
        .shouldShowLayoutRackGeometryBar
    ).toBe(false);

    expect(
      renderHudState({ selection: wallSelection('wall-1') }).result.hud
        .shouldShowLayoutRackGeometryBar
    ).toBe(false);

    expect(
      renderHudState({ selection: { type: 'none' } }).result.hud.shouldShowLayoutRackGeometryBar
    ).toBe(false);

    expect(
      renderHudState({
        capabilities: {
          ...baseCapabilities,
          isLayoutMode: false,
          isViewMode: true,
          canSelectZone: false,
          canSelectWall: false
        }
      }).result.hud.shouldShowLayoutRackGeometryBar
    ).toBe(false);
  });

  it('does not show while an active layout task is present', () => {
    const { result } = renderHudState({
      activeTask: { type: 'rack_creation', rackId: 'rack-1' }
    });

    expect(result.hud.shouldShowLayoutRackGeometryBar).toBe(false);
  });
});
