import React, { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace } from '@wos/domain';
import { createLayoutDraftFixture } from '@/widgets/warehouse-editor/model/__fixtures__/layout-draft.fixture';
import { useEditorStore } from '@/widgets/warehouse-editor/model/editor-store';
import { useInteractionStore } from '@/widgets/warehouse-editor/model/interaction-store';
import { useModeStore } from '@/widgets/warehouse-editor/model/mode-store';
import { RackInspector } from './rack-inspector';

vi.mock('@/features/layout-validate/model/use-layout-validation', () => ({
  useCachedLayoutValidation: () => ({ data: null })
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
  return {
    floorId: draft.floorId,
    activeDraft: draft,
    latestPublished: null
  };
}

function renderInspector(workspace: FloorWorkspace = createWorkspace()) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(RackInspector, {
        workspace,
        onClose: () => undefined
      })
    );
  });
  return renderer;
}

function hasText(renderer: TestRenderer.ReactTestRenderer, text: string) {
  return JSON.stringify(renderer.toJSON()).includes(text);
}

afterEach(() => {
  resetStores();
  vi.clearAllMocks();
});

describe('RackInspector geometry vs structure', () => {
  it('shows the Geometry | Structure switch only in layout mode and defaults to geometry content', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector({
      ...createWorkspace(),
      activeDraft: draft
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(1);
    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');
    expect(hasText(renderer, 'Position X')).toBe(true);
    expect(hasText(renderer, 'Rotate 90°')).toBe(true);
    expect(hasText(renderer, 'Display Code')).toBe(false);
    expect(hasText(renderer, 'Address Preview')).toBe(false);
  });

  it('switches to structure content without duplicating geometry fields', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector({
      ...createWorkspace(),
      activeDraft: draft
    });

    const structureButton = renderer.root.findAll((node) =>
      node.type === 'button' && node.children.some((child) => child === 'Structure')
    )[0];

    act(() => {
      structureButton.props.onClick();
    });

    expect(useEditorStore.getState().objectWorkContext).toBe('structure');
    expect(hasText(renderer, 'Display Code')).toBe(true);
    expect(hasText(renderer, 'Kind')).toBe(true);
    expect(hasText(renderer, 'Face A')).toBe(true);
    expect(hasText(renderer, 'Address Preview')).toBe(true);
    expect(hasText(renderer, 'Position X')).toBe(false);
    expect(hasText(renderer, 'Rotate 90°')).toBe(false);
  });

  it('keeps geometry editing functional through the inspector and keeps structure editing in structure context', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector({
      ...createWorkspace(),
      activeDraft: draft
    });

    const rotateButton = renderer.root.findAll((node) =>
      node.type === 'button' && node.children.some((child) => child === 'Rotate 90°')
    )[0];

    act(() => {
      rotateButton.props.onClick();
    });

    expect(useEditorStore.getState().draft?.racks[rackId].rotationDeg).toBe(90);

    const structureButton = renderer.root.findAll((node) =>
      node.type === 'button' && node.children.some((child) => child === 'Structure')
    )[0];

    act(() => {
      structureButton.props.onClick();
    });

    const displayCodeInput = renderer.root.findAll(
      (node) => node.type === 'input' && node.props.value === '01'
    )[0];
    const kindSelect = renderer.root.findAll(
      (node) => node.type === 'select' && node.props.value === 'single'
    )[0];

    act(() => {
      displayCodeInput.props.onChange({ target: { value: '77' } });
      kindSelect.props.onChange({ target: { value: 'paired' } });
    });

    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('77');
    expect(useEditorStore.getState().draft?.racks[rackId].kind).toBe('paired');
    expect(
      renderer.root.findAll((node) => node.type === 'input' && node.props.value === '77')
    ).toHaveLength(1);
    expect(
      renderer.root.findAll((node) => node.type === 'select' && node.props.value === 'paired')
    ).toHaveLength(1);
    expect(hasText(renderer, 'Numbering')).toBe(true);
    expect(hasText(renderer, 'Address Preview')).toBe(true);
  });

  it('keeps non-layout rack inspection stable and does not show the work-context switch', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
      useModeStore.setState({
        viewMode: 'storage',
        editorMode: 'select'
      });
    });

    const renderer = renderInspector({
      floorId: draft.floorId,
      activeDraft: draft,
      latestPublished: draft
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-work-context-switch' })).toHaveLength(0);
    expect(hasText(renderer, 'Position X')).toBe(true);
    expect(hasText(renderer, 'Display Code')).toBe(true);
    expect(hasText(renderer, 'Face A')).toBe(true);
  });
});
