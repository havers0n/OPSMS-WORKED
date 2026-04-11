import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { createLayoutDraftFixture } from '@/widgets/warehouse-editor/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { useInteractionStore } from '@/widgets/warehouse-editor/model/interaction-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
import { RightSidePanelSlot } from './right-side-panel-slot';

vi.mock('./task-surface', () => ({
  TaskSurface: () => createElement('div', { 'data-testid': 'task-surface' }, 'task-surface')
}));

vi.mock('./inspector-surface', () => ({
  InspectorSurface: () =>
    createElement('div', { 'data-testid': 'inspector-surface' }, 'inspector-surface')
}));

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
  vi.clearAllMocks();
});

describe('RightSidePanelSlot', () => {
  it('renders task surface when task and selection coexist', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useInteractionStore.getState().setSelection({ type: 'zone', zoneId: 'zone-1' });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeTask: { type: 'rack_creation', rackId }
      });
    });

    const renderer = renderSlot({
      ...createWorkspace(),
      activeDraft: draft
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'task-surface' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'inspector-surface' })).toHaveLength(0);
  });

  it('keeps task surface visible when selection changes during an active task', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useInteractionStore.getState().setSelectedRackId(rackId);
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeTask: { type: 'rack_creation', rackId }
      });
    });

    const renderer = renderSlot({
      ...createWorkspace(),
      activeDraft: draft
    });

    act(() => {
      useInteractionStore.getState().setSelection({ type: 'wall', wallId: 'wall-1' });
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'task-surface' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'inspector-surface' })).toHaveLength(0);
  });

  it('transitions from task surface to inspector after task finish when inspectable selection remains', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useInteractionStore.getState().setSelectedRackId(rackId);
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeTask: { type: 'rack_creation', rackId }
      });
    });

    const renderer = renderSlot({
      ...createWorkspace(),
      activeDraft: draft
    });

    act(() => {
      useEditorStore.getState().clearActiveTask();
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'task-surface' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'inspector-surface' })).toHaveLength(1);
  });

  it('transitions from task surface to closed after task cancel clears selection', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useInteractionStore.getState().setSelectedRackId(rackId);
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeTask: { type: 'rack_creation', rackId }
      });
    });

    const renderer = renderSlot({
      ...createWorkspace(),
      activeDraft: draft
    });

    act(() => {
      useEditorStore.getState().clearActiveTask();
      useInteractionStore.getState().clearSelection();
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'task-surface' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'inspector-surface' })).toHaveLength(0);
  });

  it('keeps non-layout behavior inspector-based', () => {
    act(() => {
      useModeStore.setState({
        viewMode: 'storage',
        editorMode: 'select'
      });
    });

    const renderer = renderSlot();

    expect(renderer.root.findAllByProps({ 'data-testid': 'task-surface' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'inspector-surface' })).toHaveLength(1);
  });

  it('keeps storage workflow ownership out of task surface (storage mode remains inspector-based)', () => {
    act(() => {
      useModeStore.setState({
        viewMode: 'storage',
        editorMode: 'select'
      });
      useInteractionStore.getState().setSelection({ type: 'cell', cellId: 'cell-1' });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeStorageWorkflow: {
          kind: 'place-container',
          status: 'editing',
          cellId: 'cell-1',
          errorMessage: null
        }
      });
    });

    const renderer = renderSlot();

    expect(renderer.root.findAllByProps({ 'data-testid': 'task-surface' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'inspector-surface' })).toHaveLength(1);
  });

  it('keeps storage move workflow out of task surface as well', () => {
    act(() => {
      useModeStore.setState({
        viewMode: 'storage',
        editorMode: 'select'
      });
      useInteractionStore.getState().setSelection({ type: 'cell', cellId: 'cell-2' });
      useEditorStore.setState({
        ...useEditorStore.getState(),
        activeStorageWorkflow: {
          kind: 'move-container',
          status: 'targeting',
          containerId: 'container-1',
          sourceCellId: 'cell-1',
          targetCellId: 'cell-2',
          errorMessage: null
        }
      });
    });

    const renderer = renderSlot();

    expect(renderer.root.findAllByProps({ 'data-testid': 'task-surface' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'inspector-surface' })).toHaveLength(1);
  });
});
