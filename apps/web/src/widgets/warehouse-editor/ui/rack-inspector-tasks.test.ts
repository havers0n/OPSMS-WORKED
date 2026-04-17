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

function nodeText(node: TestRenderer.ReactTestInstance) {
  const textParts: string[] = [];
  const walk = (next: TestRenderer.ReactTestInstance) => {
    for (const child of next.children) {
      if (typeof child === 'string') {
        textParts.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(node);
  return textParts.join(' ');
}

function summaryText(renderer: TestRenderer.ReactTestRenderer) {
  const summary = renderer.root.findByProps({ 'data-testid': 'rack-inspector-summary' });
  const textParts: string[] = [];
  const walk = (node: TestRenderer.ReactTestInstance) => {
    for (const child of node.children) {
      if (typeof child === 'string') {
        textParts.push(child);
      } else {
        walk(child);
      }
    }
  };
  walk(summary);
  return textParts.join(' ');
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

function findOrdinalRow(scope: TestRenderer.ReactTestInstance, ordinal: number) {
  const label = String(ordinal).padStart(2, '0');
  const ordinalNode = scope.findAll(
    (node) =>
      node.type === 'span' &&
      typeof node.props.className === 'string' &&
      node.props.className.includes('font-mono') &&
      nodeText(node).trim() === label
  )[0];

  if (!ordinalNode?.parent) {
    throw new Error(`Could not find row for ordinal ${label}`);
  }

  return ordinalNode.parent;
}

function findRoleButton(row: TestRenderer.ReactTestInstance, label: 'Pick' | 'Res' | 'None') {
  const button = row.findAll(
    (node) => node.type === 'button' && node.children.some((child) => child === label)
  )[0];
  if (!button) {
    throw new Error(`Could not find "${label}" role button`);
  }
  return button;
}

function isRoleButtonActive(button: TestRenderer.ReactTestInstance) {
  return typeof button.props.className === 'string' && button.props.className.includes('ring-1 ring-black/5');
}

afterEach(() => {
  resetStores();
  vi.clearAllMocks();
});

describe('RackInspector tasks', () => {
  it('shows the 3-tab task nav only in layout mode', () => {
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
    expect(summaryText(renderer)).toContain('Faces');
    expect(summaryText(renderer)).toContain('Single');
    expect(summaryText(renderer)).toContain('Cells');
    expect(summaryText(renderer)).toContain('Levels');
    expect(summaryText(renderer)).toContain('Validation:');
    expect(summaryText(renderer)).toContain('0');
    expect(summaryText(renderer)).toContain('errors');
    expect(summaryText(renderer)).toContain('warnings');
    expect(hasText(renderer, 'Display Code')).toBe(false);
    expect(hasText(renderer, 'Generate structure')).toBe(false);
    expect(hasText(renderer, 'Preview Addresses')).toBe(false);
    expect(hasText(renderer, 'Face B Relationship')).toBe(false);
    expect(summaryText(renderer)).not.toContain('Policies');
    expect(summaryText(renderer)).not.toContain('Face Config');
    expect(summaryText(renderer)).not.toContain('rotation');
    expect(summaryText(renderer)).not.toContain('Default roles');
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
    const sectionOrder = renderer.root
      .findAll(
        (node) =>
          typeof node.props['data-testid'] === 'string' &&
          node.props['data-testid'].startsWith('structure-section-')
      )
      .map((node) => node.props['data-testid']);
    expect(sectionOrder).toEqual([
      'structure-section-topology',
      'structure-section-face-structure',
      'structure-section-policies'
    ]);

    const topologyOrder = renderer.root
      .findAll(
        (node) =>
          node.props['data-testid'] === 'structure-topology-identity' ||
          node.props['data-testid'] === 'structure-topology-face-b-control'
      )
      .map((node) => node.props['data-testid']);
    expect(topologyOrder).toEqual([
      'structure-topology-identity',
      'structure-topology-face-b-control'
    ]);

    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-policies-face-defaults' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-policies-rack-apply' })).toHaveLength(1);
    expect(hasText(renderer, 'Display Code')).toBe(true);
    expect(hasText(renderer, 'Kind')).toBe(true);
    expect(hasText(renderer, 'Face A')).toBe(true);
    const faceStructureOrder = renderer.root
      .findAll(
        (node) =>
          node.props['data-testid'] === 'structure-face-manual-sections' ||
          node.props['data-testid'] === 'structure-face-generate-structure'
      )
      .map((node) => node.props['data-testid']);
    expect(faceStructureOrder).toEqual([
      'structure-face-manual-sections',
      'structure-face-generate-structure'
    ]);

    expect(hasText(renderer, 'Manual sections')).toBe(true);
    expect(hasText(renderer, 'Generate structure')).toBe(true);
    expect(hasText(renderer, 'Creates or replaces structure for this face using preset values.')).toBe(true);

    const manualSections = renderer.root.findByProps({ 'data-testid': 'structure-face-manual-sections' });
    const generatorSection = renderer.root.findByProps({ 'data-testid': 'structure-face-generate-structure' });
    expect(nodeText(manualSections)).toContain('Current persisted structure for this face.');
    expect(nodeText(manualSections)).toContain('Sections (');
    expect(nodeText(generatorSection)).toContain('Generate structure');
    expect(nodeText(generatorSection)).toContain('Preset values');
    expect(generatorSection.findAllByProps({ 'data-testid': 'structure-face-manual-preview' })).toHaveLength(0);
    expect(manualSections.findAllByProps({ 'data-testid': 'structure-face-manual-preview' })).toHaveLength(1);

    expect(hasText(renderer, 'Face-level defaults')).toBe(true);
    expect(hasText(renderer, 'Editing Face A defaults. Applies only to this face at this level.')).toBe(true);
    // addressing moved out
    expect(hasText(renderer, 'Numbering direction')).toBe(false);
    expect(hasText(renderer, 'Preview Addresses')).toBe(false);
    // face-mode moved out
    expect(hasText(renderer, 'Face B Relationship')).toBe(false);
    // geometry not in structure
    expect(hasText(renderer, 'Position X')).toBe(false);
    expect(hasText(renderer, 'Rotate 90°')).toBe(false);
  });

  it('keeps one active face switcher and does not duplicate face selection in Policies', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.kind = 'paired';
    rack.faces[1].enabled = true;
    rack.faces[1].relationshipMode = 'independent';
    rack.faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3, structuralDefaultRole: 'reserve' }]
      }
    ];

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'structure');

    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(1);

    const policiesSection = renderer.root.findByProps({ 'data-testid': 'structure-section-policies' });
    const policyFaceButtons = policiesSection.findAll(
      (node) =>
        node.type === 'button' &&
        (node.children.includes('Face A') || node.children.includes('Face B'))
    );
    expect(policyFaceButtons).toHaveLength(0);

    const faceBButton = renderer.root.findByProps({ 'data-testid': 'structure-face-switch-B' });
    act(() => {
      faceBButton.props.onClick();
    });

    expect(hasText(renderer, 'Face B')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-manual-sections' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-generate-structure' })).toHaveLength(1);
    expect(hasText(renderer, 'Face-level defaults')).toBe(true);
    expect(hasText(renderer, 'Editing Face B defaults. Applies only to this face at this level.')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(1);
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
    expect(hasText(renderer, 'Generate structure')).toBe(false);
    expect(hasText(renderer, 'Display Code')).toBe(false);
    // geometry not in addressing
    expect(hasText(renderer, 'Position X')).toBe(false);
  });

  it('falls back to Structure task when objectWorkContext is face-mode', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
      useEditorStore.getState().setObjectWorkContext('face-mode');
    });

    const renderer = renderInspector(createWorkspace(draft));

    expect(useEditorStore.getState().objectWorkContext).toBe('face-mode');
    expect(hasText(renderer, 'Display Code')).toBe(true);
    expect(hasText(renderer, 'Generate structure')).toBe(true);
    expect(hasText(renderer, 'Preview Addresses')).toBe(false);
    expect(hasText(renderer, 'Face B Relationship')).toBe(false);
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

    expect(hasText(renderer, 'Apply role to all faces at this level')).toBe(true);
    expect(hasText(renderer, 'Applies the selected role to all editable faces that include this level.')).toBe(true);
    expect(hasText(renderer, 'Reapplying here replaces differing face-level defaults at this level.')).toBe(true);
    expect(hasText(renderer, 'Default-role state')).toBe(true);
    expect(hasText(renderer, 'Aligned')).toBe(true);
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
    expect(summaryText(renderer)).toContain('Paired / Independent');
    expect(summaryText(renderer)).toContain('Default roles');
    expect(summaryText(renderer)).toContain('Mixed');
  });

  it('shows aligned default roles when independent paired faces match', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.kind = 'paired';
    rack.faces[1].enabled = true;
    rack.faces[1].relationshipMode = 'independent';
    rack.faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3, structuralDefaultRole: 'primary_pick' }]
      }
    ];
    rack.faces[0].sections[0].levels[0].structuralDefaultRole = 'primary_pick';

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    expect(summaryText(renderer)).toContain('Paired / Independent');
    expect(summaryText(renderer)).toContain('Default roles');
    expect(summaryText(renderer)).toContain('Aligned');
  });

  it('single-face bulk apply sets aligned row with highlighted selected role', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'structure');

    const rackApply = renderer.root.findByProps({ 'data-testid': 'structure-policies-rack-apply' });
    const row01 = findOrdinalRow(rackApply, 1);
    const resButton = findRoleButton(row01, 'Res');
    act(() => {
      resButton.props.onClick();
    });

    const updatedRack = useEditorStore.getState().draft?.racks[rackId];
    const faceA = updatedRack?.faces.find((face) => face.side === 'A');
    const level1 = faceA?.sections.flatMap((section) => section.levels).find((level) => level.ordinal === 1);
    expect(level1?.structuralDefaultRole).toBe('reserve');

    const updatedRow01 = findOrdinalRow(rackApply, 1);
    expect(nodeText(updatedRow01)).toContain('Aligned');
    expect(nodeText(updatedRow01)).not.toContain('Mixed');
    expect(isRoleButtonActive(findRoleButton(updatedRow01, 'Res'))).toBe(true);
  });

  it('mirrored bulk apply uses Face A scope and keeps aligned highlighted state', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.kind = 'paired';
    rack.faces[1].enabled = true;
    rack.faces[1].isMirrored = true;
    rack.faces[1].relationshipMode = 'mirrored';
    rack.faces[1].mirrorSourceFaceId = rack.faces[0].id;
    rack.faces[1].sections = [];

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'structure');

    const rackApply = renderer.root.findByProps({ 'data-testid': 'structure-policies-rack-apply' });
    const row01 = findOrdinalRow(rackApply, 1);
    const resButton = findRoleButton(row01, 'Res');
    act(() => {
      resButton.props.onClick();
    });

    const updatedRack = useEditorStore.getState().draft?.racks[rackId];
    const faceA = updatedRack?.faces.find((face) => face.side === 'A');
    const faceB = updatedRack?.faces.find((face) => face.side === 'B');
    const level1 = faceA?.sections.flatMap((section) => section.levels).find((level) => level.ordinal === 1);
    expect(level1?.structuralDefaultRole).toBe('reserve');
    expect(faceB?.sections).toEqual([]);

    const updatedRow01 = findOrdinalRow(rackApply, 1);
    expect(nodeText(updatedRow01)).toContain('Aligned');
    expect(isRoleButtonActive(findRoleButton(updatedRow01, 'Res'))).toBe(true);
  });

  it('independent shared ordinal divergence becomes aligned and highlighted after bulk apply', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.kind = 'paired';
    rack.faces[1].enabled = true;
    rack.faces[1].relationshipMode = 'independent';
    rack.faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3, structuralDefaultRole: 'reserve' }]
      }
    ];
    rack.faces[0].sections[0].levels[0].structuralDefaultRole = 'primary_pick';

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'structure');

    const rackApply = renderer.root.findByProps({ 'data-testid': 'structure-policies-rack-apply' });
    const row01 = findOrdinalRow(rackApply, 1);
    expect(nodeText(row01)).toContain('Mixed');
    expect(isRoleButtonActive(findRoleButton(row01, 'Pick'))).toBe(false);
    expect(isRoleButtonActive(findRoleButton(row01, 'Res'))).toBe(false);
    expect(isRoleButtonActive(findRoleButton(row01, 'None'))).toBe(false);

    act(() => {
      findRoleButton(row01, 'None').props.onClick();
    });

    const updatedRack = useEditorStore.getState().draft?.racks[rackId];
    const faceA = updatedRack?.faces.find((face) => face.side === 'A');
    const faceB = updatedRack?.faces.find((face) => face.side === 'B');
    const faceALevel1 = faceA?.sections.flatMap((section) => section.levels).find((level) => level.ordinal === 1);
    const faceBLevel1 = faceB?.sections.flatMap((section) => section.levels).find((level) => level.ordinal === 1);
    expect(faceALevel1?.structuralDefaultRole).toBe('none');
    expect(faceBLevel1?.structuralDefaultRole).toBe('none');

    const updatedRow01 = findOrdinalRow(rackApply, 1);
    expect(nodeText(updatedRow01)).toContain('Aligned');
    expect(nodeText(updatedRow01)).not.toContain('Mixed');
    expect(isRoleButtonActive(findRoleButton(updatedRow01, 'None'))).toBe(true);
  });

  it('independent asymmetric ordinal excludes missing face from aggregate and stays alignable', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.kind = 'paired';
    rack.faces[1].enabled = true;
    rack.faces[1].relationshipMode = 'independent';
    rack.faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 2, slotCount: 3, structuralDefaultRole: 'reserve' }]
      }
    ];
    rack.faces[0].sections[0].levels[0].structuralDefaultRole = 'reserve';

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'structure');

    const rackApply = renderer.root.findByProps({ 'data-testid': 'structure-policies-rack-apply' });
    const row01 = findOrdinalRow(rackApply, 1);
    expect(nodeText(row01)).toContain('Aligned');
    expect(nodeText(row01)).not.toContain('Mixed');
    expect(isRoleButtonActive(findRoleButton(row01, 'Res'))).toBe(true);

    act(() => {
      findRoleButton(row01, 'Pick').props.onClick();
    });

    const updatedRack = useEditorStore.getState().draft?.racks[rackId];
    const faceA = updatedRack?.faces.find((face) => face.side === 'A');
    const faceB = updatedRack?.faces.find((face) => face.side === 'B');
    const faceALevel1 = faceA?.sections.flatMap((section) => section.levels).find((level) => level.ordinal === 1);
    const faceBLevel1 = faceB?.sections.flatMap((section) => section.levels).find((level) => level.ordinal === 1);
    expect(faceALevel1?.structuralDefaultRole).toBe('primary_pick');
    expect(faceBLevel1).toBeUndefined();

    const updatedRow01 = findOrdinalRow(rackApply, 1);
    expect(nodeText(updatedRow01)).toContain('Aligned');
    expect(isRoleButtonActive(findRoleButton(updatedRow01, 'Pick'))).toBe(true);
  });

  it('local face-level defaults still reflect active face truth while bulk row stays aggregate-based', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.kind = 'paired';
    rack.faces[1].enabled = true;
    rack.faces[1].relationshipMode = 'independent';
    rack.faces[1].sections = [
      {
        id: 'section-b-1',
        ordinal: 1,
        length: 5,
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3, structuralDefaultRole: 'reserve' }]
      }
    ];
    rack.faces[0].sections[0].levels[0].structuralDefaultRole = 'primary_pick';

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'structure');

    const faceBButton = renderer.root.findByProps({ 'data-testid': 'structure-face-switch-B' });
    act(() => {
      faceBButton.props.onClick();
    });

    const bulkPanel = renderer.root.findByProps({ 'data-testid': 'structure-policies-rack-apply' });
    const bulkRow01 = findOrdinalRow(bulkPanel, 1);
    expect(nodeText(bulkRow01)).toContain('Mixed');
    expect(isRoleButtonActive(findRoleButton(bulkRow01, 'Pick'))).toBe(false);
    expect(isRoleButtonActive(findRoleButton(bulkRow01, 'Res'))).toBe(false);

    const localPanel = renderer.root.findByProps({ 'data-testid': 'structure-policies-face-defaults' });
    const localRow01 = findOrdinalRow(localPanel, 1);
    expect(isRoleButtonActive(findRoleButton(localRow01, 'Res'))).toBe(true);
    expect(isRoleButtonActive(findRoleButton(localRow01, 'Pick'))).toBe(false);
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

    expect(summaryText(renderer)).toContain('Paired / Mirrored');
    expect(summaryText(renderer)).not.toContain('Default roles');

    clickTab(renderer, 'structure');

    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-policies-mirrored-face-b' })).toHaveLength(1);
    const policiesSection = renderer.root.findByProps({ 'data-testid': 'structure-section-policies' });
    expect(nodeText(policiesSection)).toContain(
      'Face B mirrors Face A. Face B defaults are inherited and read-only in mirrored mode.'
    );
    expect(nodeText(policiesSection)).toContain(
      'Inherited from Face A. Edit Face A to change mirrored defaults.'
    );
    expect(nodeText(policiesSection)).toContain(
      'Face B is mirrored, so editable defaults are applied through Face A.'
    );

    expect(hasText(renderer, 'Face B inherited defaults')).toBe(true);
    expect(
      hasText(renderer, 'Face B mirrors Face A. Face B defaults are inherited and read-only in mirrored mode.')
    ).toBe(true);
    expect(hasText(renderer, 'Inherited from Face A. Edit Face A to change mirrored defaults.')).toBe(true);
    expect(hasText(renderer, 'Face B is mirrored, so editable defaults are applied through Face A.')).toBe(true);
  });

  it('keeps task body stable when summary is collapsed and expanded', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));
    expect(hasText(renderer, 'Position X')).toBe(true);

    const collapseButton = renderer.root.findByProps({ title: 'Collapse summary' });
    act(() => {
      collapseButton.props.onClick();
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-summary' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-summary-collapsed' })).toHaveLength(1);
    expect(hasText(renderer, 'Position X')).toBe(true);

    const expandButton = renderer.root.findByProps({ title: 'Expand summary' });
    act(() => {
      expandButton.props.onClick();
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-summary' })).toHaveLength(1);
    expect(hasText(renderer, 'Position X')).toBe(true);
  });
});
