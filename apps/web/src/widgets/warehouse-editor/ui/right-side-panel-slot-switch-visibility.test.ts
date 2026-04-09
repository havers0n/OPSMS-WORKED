import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { createLayoutDraftFixture } from '../../../entities/layout-version/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '../../../entities/layout-version/model/editor-store';
import { useInteractionStore } from '../../../entities/layout-version/model/interaction-store';
import { useModeStore } from '../../../entities/layout-version/model/mode-store';
import { RightSidePanelSlot } from './right-side-panel-slot';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function resetStores() {
  useModeStore.setState({
    viewMode: 'layout',
    editorMode: 'select'
  });

  useInteractionStore.setState({
    selection: { type: 'none' },
    hoveredRackId: null,
    highlightedCellIds: [],
    contextPanelMode: 'compact'
  });

  useEditorStore.setState({
    objectWorkContext: 'geometry',
    activeTask: null,
    activeStorageWorkflow: null,
    minRackDistance: 0,
    draft: null,
    draftSourceVersionId: null,
    isDraftDirty: false,
    persistenceStatus: 'idle',
    lastSaveErrorMessage: null,
    lastChangeClass: null
  });
}

function createWorkspace(): FloorWorkspace {
  const draft = createLayoutDraftFixture();
  draft.rackIds.push('rack-2');
  draft.racks['rack-2'] = {
    ...draft.racks[draft.rackIds[0]],
    id: 'rack-2',
    displayCode: '02'
  };
  draft.zoneIds = ['zone-1'];
  draft.zones['zone-1'] = {
    id: 'zone-1',
    code: 'Z01',
    name: 'Inbound',
    category: 'staging',
    color: '#34d399',
    x: 0,
    y: 0,
    width: 100,
    height: 80
  };
  draft.wallIds = ['wall-1'];
  draft.walls['wall-1'] = {
    id: 'wall-1',
    code: 'W01',
    name: 'Divider',
    wallType: 'generic',
    blocksRackPlacement: false,
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 0
  };

  return {
    floorId: draft.floorId,
    activeDraft: draft,
    latestPublished: null
  };
}

function renderSlot(workspace: FloorWorkspace = createWorkspace()) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RightSidePanelSlot, {
        workspace,
        onCloseInspector: () => useInteractionStore.getState().clearSelection()
      })
    );
  });
  return renderer;
}

afterEach(() => {
  resetStores();
});

describe('RightSidePanelSlot work-context switch visibility', () => {
  it('does not show the work-context switch for multi-rack selection', () => {
    const workspace = createWorkspace();
    act(() => {
      useEditorStore.getState().initializeDraft(workspace.activeDraft!);
      useEditorStore.getState().setSelectedRackIds(['rack-1', 'rack-2']);
    });

    const renderer = renderSlot(workspace);

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(0);
  });

  it('does not show the work-context switch for zone or wall inspectors', () => {
    const workspace = createWorkspace();
    act(() => {
      useEditorStore.getState().initializeDraft(workspace.activeDraft!);
      useEditorStore.getState().setSelectedZoneId('zone-1');
    });
    const zoneRenderer = renderSlot(workspace);
    expect(zoneRenderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(0);

    act(() => {
      useEditorStore.getState().setSelectedWallId('wall-1');
    });
    const wallRenderer = renderSlot(workspace);
    expect(wallRenderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(0);
  });

  it('does not show the work-context switch while the task surface is active', () => {
    const workspace = createWorkspace();
    const rackId = workspace.activeDraft!.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(workspace.activeDraft!);
      useEditorStore.getState().setSelectedRackId(rackId);
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeTask: { type: 'rack_creation', rackId }
      });
    });

    const renderer = renderSlot(workspace);

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(0);
  });
});
