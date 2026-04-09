import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { createLayoutDraftFixture } from '@/entities/layout-version/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/entities/layout-version/model/editor-store';
import { useInteractionStore } from '@/entities/layout-version/model/interaction-store';
import { useModeStore } from '@/entities/layout-version/model/mode-store';
import { RackCreationWizard } from './rack-creation-wizard';

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

function findButtonByText(root: TestRenderer.ReactTestInstance, text: string) {
  return root.findAll(
    (node) =>
      node.type === 'button' &&
      node.children.some((child) => typeof child === 'string' && child.includes(text))
  )[0];
}

afterEach(() => {
  resetStores();
});

describe('RackCreationWizard', () => {
  it('finish clears the active rack_creation task and keeps the rack selected', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.setState({
      ...useEditorStore.getState(),
      activeTask: { type: 'rack_creation', rackId }
    });
    useInteractionStore.getState().setSelectedRackId(rackId);

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(RackCreationWizard, { rack }));
    });

    act(() => {
      findButtonByText(renderer.root, 'Next: Configure sections').props.onClick();
    });
    act(() => {
      findButtonByText(renderer.root, 'Finish setup').props.onClick();
    });
    act(() => {
      findButtonByText(renderer.root, 'Open in inspector').props.onClick();
    });

    expect(useEditorStore.getState().activeTask).toBeNull();
    expect(useInteractionStore.getState().selection).toEqual({
      type: 'rack',
      rackIds: [rackId],
      focus: { type: 'body' }
    });
  });

  it('cancel clears the active rack_creation task and removes the rack', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];

    useEditorStore.getState().initializeDraft(draft);
    useEditorStore.setState({
      ...useEditorStore.getState(),
      activeTask: { type: 'rack_creation', rackId }
    });
    useInteractionStore.getState().setSelectedRackId(rackId);

    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(createElement(RackCreationWizard, { rack }));
    });

    act(() => {
      findButtonByText(renderer.root, 'Cancel').props.onClick();
    });

    expect(useEditorStore.getState().activeTask).toBeNull();
    expect(useEditorStore.getState().draft?.racks[rackId]).toBeUndefined();
    expect(useEditorStore.getState().draft?.rackIds).not.toContain(rackId);
    expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
  });
});
