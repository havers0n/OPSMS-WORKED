import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/warehouse/editor/model/editor-store';
import { useInteractionStore } from '@/warehouse/editor/model/interaction-store';
import { useModeStore } from '@/warehouse/editor/model/mode-store';
import { ViewSidePanelSlot } from './view-side-panel-slot';

vi.mock('./view-inspector-surface', () => ({
  ViewInspectorSurface: () =>
    createElement('div', { 'data-testid': 'view-inspector-surface' }, 'view-inspector-surface')
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function resetStores() {
  useModeStore.setState({
    viewMode: 'view',
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
      createElement(ViewSidePanelSlot, {
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

describe('ViewSidePanelSlot', () => {
  it('stays closed with no view selection', () => {
    const renderer = renderSlot();

    const slot = renderer.root.findByProps({ 'data-testid': 'view-side-panel-slot' });
    expect(slot.props.style.width).toBe('0px');
    expect(renderer.root.findAllByProps({ 'data-testid': 'view-inspector-surface' })).toHaveLength(0);
  });

  it('opens a narrower view inspector for rack selection', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useInteractionStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderSlot({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: null
    });

    const slot = renderer.root.findByProps({ 'data-testid': 'view-side-panel-slot' });
    expect(slot.props.style.width).toBe('min(400px, 100vw)');
    expect(renderer.root.findAllByProps({ 'data-testid': 'view-inspector-surface' })).toHaveLength(1);
  });
});
