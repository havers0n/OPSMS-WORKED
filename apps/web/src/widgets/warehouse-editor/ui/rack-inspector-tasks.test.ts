import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FloorWorkspace, LayoutDraft } from '@wos/domain';
import { createLayoutDraftFixture } from '../model/__fixtures__/layout-draft.fixture';
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
    selectedRackActiveLevel: 0,
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

function createWorkspace(draft?: LayoutDraft): FloorWorkspace {
  const d = draft ?? createLayoutDraftFixture();
  return {
    floorId: d.floorId,
    activeDraft: d,
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

function clickTab(
  renderer: TestRenderer.ReactTestRenderer,
  tab: 'geometry' | 'structure' | 'addressing' | 'face-mode'
) {
  const btn = renderer.root.findByProps({ 'data-testid': `rack-inspector-task-${tab}` });
  act(() => {
    btn.props.onClick();
  });
}

afterEach(() => {
  resetStores();
  vi.clearAllMocks();
});

describe('RackInspector tasks', () => {
  it('shows the 4-tab task nav only in layout mode', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-task-nav' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-task-geometry' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-task-structure' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-task-addressing' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-task-face-mode' })).toHaveLength(1);
  });

  it('defaults to Geometry task on rack select', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');
    expect(hasText(renderer, 'Position X')).toBe(true);
    expect(hasText(renderer, 'Rotate 90°')).toBe(true);
    expect(hasText(renderer, 'Display Code')).toBe(false);
    expect(hasText(renderer, 'Preset Generator')).toBe(false);
    expect(hasText(renderer, 'Preview Addresses')).toBe(false);
    expect(hasText(renderer, 'Face B Relationship')).toBe(false);
  });

  it('switches to Structure task and shows only section editing content', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    clickTab(renderer, 'structure');

    expect(useEditorStore.getState().objectWorkContext).toBe('structure');
    expect(hasText(renderer, 'Display Code')).toBe(true);
    expect(hasText(renderer, 'Kind')).toBe(true);
    expect(hasText(renderer, 'Face A')).toBe(true);
    expect(hasText(renderer, 'Preset Generator')).toBe(true);
    // addressing moved out
    expect(hasText(renderer, 'Numbering direction')).toBe(false);
    expect(hasText(renderer, 'Preview Addresses')).toBe(false);
    // face-mode moved out
    expect(hasText(renderer, 'Face B Relationship')).toBe(false);
    // geometry not in structure
    expect(hasText(renderer, 'Position X')).toBe(false);
    expect(hasText(renderer, 'Rotate 90°')).toBe(false);
  });

  it('switches to Addressing task and shows numbering + preview only', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    clickTab(renderer, 'addressing');

    expect(useEditorStore.getState().objectWorkContext).toBe('addressing');
    expect(hasText(renderer, 'Numbering')).toBe(true);
    expect(hasText(renderer, 'Preview Addresses')).toBe(true);
    // structure content should not be in addressing
    expect(hasText(renderer, 'Preset Generator')).toBe(false);
    expect(hasText(renderer, 'Display Code')).toBe(false);
    // geometry not in addressing
    expect(hasText(renderer, 'Position X')).toBe(false);
  });

  it('switches to Face Mode task and shows mode init controls when Face B is unconfigured', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    clickTab(renderer, 'face-mode');

    expect(useEditorStore.getState().objectWorkContext).toBe('face-mode');
    // Face B is unconfigured in fixture, so we should see init options
    expect(hasText(renderer, 'Mirror Face A')).toBe(true);
    expect(hasText(renderer, 'Start from Scratch')).toBe(true);
    // structure/addressing content should not be here
    expect(hasText(renderer, 'Preset Generator')).toBe(false);
    expect(hasText(renderer, 'Preview Addresses')).toBe(false);
  });

  it('task switch preserves draft edits made in a previous task', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));

    const rotateButton = renderer.root.findAll(
      (node) => node.type === 'button' && node.children.some((child) => child === 'Rotate 90°')
    )[0];
    act(() => {
      rotateButton.props.onClick();
    });

    clickTab(renderer, 'structure');
    const displayCodeInput = renderer.root.findAll(
      (node) => node.type === 'input' && node.props.value === '01'
    )[0];
    act(() => {
      displayCodeInput.props.onChange({ target: { value: '77' } });
    });

    expect(useEditorStore.getState().draft?.racks[rackId].rotationDeg).toBe(90);
    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('77');

    clickTab(renderer, 'geometry');
    expect(useEditorStore.getState().draft?.racks[rackId].rotationDeg).toBe(90);
    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('77');
  });

  it('rack-change resets task back to Geometry', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
      useEditorStore.getState().setObjectWorkContext('face-mode');
    });

    expect(useEditorStore.getState().objectWorkContext).toBe('face-mode');

    act(() => {
      useEditorStore.getState().setSelectedRackId(null);
    });

    expect(useEditorStore.getState().objectWorkContext).toBe('geometry');
  });

  it('non-layout viewMode hides task nav and stacks geometry + structure', () => {
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

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-task-nav' })).toHaveLength(0);
    expect(hasText(renderer, 'Position X')).toBe(true);
    expect(hasText(renderer, 'Display Code')).toBe(true);
    expect(hasText(renderer, 'Face A')).toBe(true);
  });

  it('does not render level pager in rack inspector', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-level-pager' })).toHaveLength(0);
  });

  it('shows rack-level apply panel in Structure task', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    clickTab(renderer, 'structure');

    expect(hasText(renderer, 'Apply to Whole Rack Level')).toBe(true);
    expect(hasText(renderer, 'This action applies the selected role to all editable faces at this level.')).toBe(true);
    expect(hasText(renderer, 'Reapplying at rack level overwrites face-level differences for this level.')).toBe(true);
    expect(hasText(renderer, 'Pick')).toBe(true);
    expect(hasText(renderer, 'Res')).toBe(true);
    expect(hasText(renderer, 'None')).toBe(true);
  });

  it('shows mixed row state when face overrides diverge', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    draft.racks[rackId].kind = 'paired';
    draft.racks[rackId].faces[1].enabled = true;
    draft.racks[rackId].faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3, structuralDefaultRole: 'reserve' }]
      }
    ];
    draft.racks[rackId].faces[0].sections[0].levels[0].structuralDefaultRole = 'primary_pick';

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));

    clickTab(renderer, 'structure');

    expect(hasText(renderer, 'Mixed')).toBe(true);
  });

  it('shows read-only inherited Level Defaults for mirrored Face B', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.kind = 'paired';
    rack.faces[1].enabled = true;
    rack.faces[1].isMirrored = true;
    rack.faces[1].relationshipMode = 'mirrored';
    rack.faces[1].mirrorSourceFaceId = rack.faces[0].id;

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));

    clickTab(renderer, 'structure');

    expect(hasText(renderer, 'Face B mirrors Face A')).toBe(true);
    expect(hasText(renderer, 'Face B is mirrored; edits apply through Face A.')).toBe(true);
    expect(hasText(renderer, 'Face B overrides are inherited from Face A while mirrored.')).toBe(true);
  });
});
