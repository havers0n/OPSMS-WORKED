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

function clickGeometryAdvancedToggle(renderer: TestRenderer.ReactTestRenderer) {
  const button = renderer.root.findByProps({ 'data-testid': 'geometry-advanced-toggle' });
  act(() => {
    button.props.onClick();
  });
}

function clickTopologyOption(
  renderer: TestRenderer.ReactTestRenderer,
  topology: 'single' | 'mirrored' | 'independent'
) {
  const control = renderer.root.findByProps({
    'data-testid': `structure-topology-option-${topology}`
  });
  act(() => {
    control.props.onClick();
  });
}

function clickAddressingDirection(
  renderer: TestRenderer.ReactTestRenderer,
  side: 'A' | 'B',
  direction: 'ltr' | 'rtl'
) {
  const control = renderer.root.findByProps({
    'data-testid': `addressing-direction-${side}-${direction}`
  });
  act(() => {
    control.props.onClick();
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
    expect(hasText(renderer, 'Position X')).toBe(false);
    expect(hasText(renderer, 'Rotate 90°')).toBe(false);
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-advanced-toggle' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-advanced-panel' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-quick-actions' })).toHaveLength(1);
    expect(summaryText(renderer)).toContain('Faces');
    expect(summaryText(renderer)).toContain('Single');
    expect(summaryText(renderer)).toContain('Cells');
    expect(summaryText(renderer)).toContain('Levels');
    expect(summaryText(renderer)).toContain('Validation:');
    expect(summaryText(renderer)).toContain('0');
    expect(summaryText(renderer)).toContain('errors');
    expect(summaryText(renderer)).toContain('warnings');
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-header-display-code-button' })).toHaveLength(1);
    expect(hasText(renderer, 'Generate structure')).toBe(false);
    expect(hasText(renderer, 'Preview Addresses')).toBe(false);
    expect(hasText(renderer, 'Face B Relationship')).toBe(false);
    expect(summaryText(renderer)).not.toContain('Policies');
    expect(summaryText(renderer)).not.toContain('Face Config');
    expect(summaryText(renderer)).not.toContain('rotation');
    expect(summaryText(renderer)).not.toContain('Default roles');
  });

  it('renders truthful geometry preview rotation, in-SVG labels, and arrow ownership', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));

    const svg = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-svg' });
    const rackGroupBefore = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-rack-group' });
    const rackRectBefore = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-rack-rect' });
    const arrowBefore = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-arrow-group' });
    const lengthLabelBefore = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-length-label' });
    const depthLabelBefore = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-depth-label' });
    const rotationLabelBefore = renderer.root.findByProps({
      'data-testid': 'geometry-blueprint-rotation-label'
    });

    expect(svg.type).toBe('svg');
    expect(rackGroupBefore.props.transform).toContain('rotate(0 ');
    expect(arrowBefore.parent?.props['data-testid']).toBe('geometry-blueprint-rack-group');
    expect(nodeText(lengthLabelBefore)).toContain('m');
    expect(nodeText(depthLabelBefore)).toContain('m');
    expect(nodeText(rotationLabelBefore)).toContain('Rotation:');
    expect(nodeText(rotationLabelBefore)).toContain('0°');

    const rackShapeBefore = {
      x: rackRectBefore.props.x,
      y: rackRectBefore.props.y,
      width: rackRectBefore.props.width,
      height: rackRectBefore.props.height
    };

    const rotateButton = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-rotation-action' });
    act(() => {
      rotateButton.props.onClick();
    });

    const rackGroupAfter = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-rack-group' });
    const rackRectAfter = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-rack-rect' });
    const arrowAfter = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-arrow-group' });
    const rotationLabelAfter = renderer.root.findByProps({
      'data-testid': 'geometry-blueprint-rotation-label'
    });

    expect(rackGroupAfter.props.transform).toContain('rotate(90 ');
    expect(arrowAfter.parent?.props['data-testid']).toBe('geometry-blueprint-rack-group');
    expect(nodeText(rotationLabelAfter)).toContain('Rotation:');
    expect(nodeText(rotationLabelAfter)).toContain('90°');
    expect({
      x: rackRectAfter.props.x,
      y: rackRectAfter.props.y,
      width: rackRectAfter.props.width,
      height: rackRectAfter.props.height
    }).toEqual(rackShapeBefore);
  });

  it('edits length/depth from SVG and keeps only one inline editor active', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));

    const lengthAction = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-length-action' });
    act(() => {
      lengthAction.props.onClick();
    });
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-blueprint-inline-editor' })).toHaveLength(1);

    let inlineInput = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-inline-input' });
    act(() => {
      inlineInput.props.onChange({ target: { value: '6.7' } });
    });
    act(() => {
      inlineInput.props.onKeyDown({ key: 'Enter', preventDefault: () => undefined });
    });
    expect(useEditorStore.getState().draft?.racks[rackId].totalLength).toBe(6.7);
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-blueprint-inline-editor' })).toHaveLength(0);

    const depthAction = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-depth-action' });
    act(() => {
      depthAction.props.onClick();
    });
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-blueprint-inline-editor' })).toHaveLength(1);

    // Opening another field replaces prior editor (single active editor invariant).
    act(() => {
      lengthAction.props.onClick();
    });
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-blueprint-inline-editor' })).toHaveLength(1);

    inlineInput = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-inline-input' });
    act(() => {
      inlineInput.props.onChange({ target: { value: '2.9' } });
    });
    act(() => {
      inlineInput.props.onBlur();
    });
    expect(useEditorStore.getState().draft?.racks[rackId].totalLength).toBe(2.9);
  });

  it('blocks invalid inline commit and rotation still applies while closing stale editor', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    const startingLength = useEditorStore.getState().draft?.racks[rackId].totalLength;
    const lengthAction = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-length-action' });
    act(() => {
      lengthAction.props.onClick();
    });

    const inlineInput = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-inline-input' });
    act(() => {
      inlineInput.props.onChange({ target: { value: '' } });
    });
    act(() => {
      inlineInput.props.onBlur();
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-blueprint-inline-error' })).toHaveLength(1);
    expect(useEditorStore.getState().draft?.racks[rackId].totalLength).toBe(startingLength);

    const rotationAction = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-rotation-action' });
    act(() => {
      rotationAction.props.onClick();
    });

    expect(useEditorStore.getState().draft?.racks[rackId].rotationDeg).toBe(90);
    expect(useEditorStore.getState().draft?.racks[rackId].totalLength).toBe(startingLength);
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-blueprint-inline-editor' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-blueprint-inline-error' })).toHaveLength(0);
  });

  it('keeps advanced geometry form collapsed by default and expandable with position fields', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-advanced-panel' })).toHaveLength(0);
    expect(hasText(renderer, 'Position X')).toBe(false);
    expect(hasText(renderer, 'Rotate 90°')).toBe(false);

    clickGeometryAdvancedToggle(renderer);
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-advanced-panel' })).toHaveLength(1);
    expect(hasText(renderer, 'Position X')).toBe(true);
    expect(hasText(renderer, 'Position Y')).toBe(true);
    expect(hasText(renderer, 'Rotate 90°')).toBe(true);

    clickGeometryAdvancedToggle(renderer);
    expect(renderer.root.findAllByProps({ 'data-testid': 'geometry-advanced-panel' })).toHaveLength(0);
    expect(hasText(renderer, 'Position X')).toBe(false);
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

    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-topology-face-configuration' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-topology-option-single' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-topology-option-mirrored' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-topology-option-independent' })).toHaveLength(1);

    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-policies-face-defaults' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-policies-rack-apply' })).toHaveLength(1);
    expect(hasText(renderer, 'Display Code')).toBe(false);
    expect(hasText(renderer, 'Kind')).toBe(false);
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
    expect(hasText(renderer, 'Mirror A')).toBe(false);
    expect(hasText(renderer, 'Remove Face B')).toBe(false);
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

  it('switches to Addressing task with canonical SVG control and secondary preview', () => {
    const draft = createLayoutDraftFixture();
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(draft.rackIds[0]);
    });

    const renderer = renderInspector(createWorkspace(draft));

    clickTab(renderer, 'addressing');

    expect(useEditorStore.getState().objectWorkContext).toBe('addressing');
    expect(hasText(renderer, 'Numbering')).toBe(true);
    expect(renderer.root.findAllByProps({ 'data-testid': 'addressing-direction-control-A' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'addressing-direction-control-B' })).toHaveLength(0);
    expect(hasText(renderer, 'Preview Addresses')).toBe(true);
    expect(hasText(renderer, 'derived from the current draft')).toBe(true);
    expect(hasText(renderer, 'Address Format')).toBe(false);
    expect(hasText(renderer, '1 -> N')).toBe(false);
    expect(hasText(renderer, 'N -> 1')).toBe(false);
    // structure content should not be in addressing
    expect(hasText(renderer, 'Generate structure')).toBe(false);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-header-display-code-button' })).toHaveLength(1);
    // geometry not in addressing
    expect(hasText(renderer, 'Position X')).toBe(false);
  });

  it('uses SVG click targets as the only numbering direction editor', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'addressing');

    const faceA = () =>
      useEditorStore.getState().draft?.racks[rackId].faces.find((face) => face.side === 'A');

    expect(faceA()?.slotNumberingDirection).toBe('ltr');
    expect(
      renderer.root.findByProps({ 'data-testid': 'addressing-direction-A-ltr' }).props['data-active']
    ).toBe(true);
    expect(
      renderer.root.findByProps({ 'data-testid': 'addressing-direction-A-rtl' }).props['data-active']
    ).toBe(false);

    clickAddressingDirection(renderer, 'A', 'rtl');
    expect(faceA()?.slotNumberingDirection).toBe('rtl');
    expect(
      renderer.root.findByProps({ 'data-testid': 'addressing-direction-A-ltr' }).props['data-active']
    ).toBe(false);
    expect(
      renderer.root.findByProps({ 'data-testid': 'addressing-direction-A-rtl' }).props['data-active']
    ).toBe(true);

    clickAddressingDirection(renderer, 'A', 'ltr');
    expect(faceA()?.slotNumberingDirection).toBe('ltr');
  });

  it('keeps per-face addressing ownership by topology mode', () => {
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
        levels: [{ id: 'level-b-1', ordinal: 1, slotCount: 3 }]
      }
    ];

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'addressing');

    expect(renderer.root.findAllByProps({ 'data-testid': 'addressing-direction-control-A' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'addressing-direction-control-B' })).toHaveLength(1);
    expect(hasText(renderer, 'Face B mirrors Face A and uses reversed numbering automatically.')).toBe(false);

    act(() => {
      useEditorStore.getState().setFaceBRelationship(rackId, 'mirrored');
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'addressing-direction-control-A' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'addressing-direction-control-B' })).toHaveLength(0);
    expect(hasText(renderer, 'Face B mirrors Face A and uses reversed numbering automatically.')).toBe(true);
  });

  it('renders read-only SVG state but blocks direction writes when layout is not editable', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    draft.state = 'published';
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'addressing');

    const faceA = () =>
      useEditorStore.getState().draft?.racks[rackId].faces.find((face) => face.side === 'A');

    expect(faceA()?.slotNumberingDirection).toBe('ltr');
    expect(
      renderer.root.findByProps({ 'data-testid': 'addressing-direction-A-ltr' }).props['data-disabled']
    ).toBe(true);
    expect(
      renderer.root.findByProps({ 'data-testid': 'addressing-direction-A-rtl' }).props['data-disabled']
    ).toBe(true);

    clickAddressingDirection(renderer, 'A', 'rtl');
    expect(faceA()?.slotNumberingDirection).toBe('ltr');
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
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-header-display-code-button' })).toHaveLength(1);
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

    const rotateButton = renderer.root.findByProps({ 'data-testid': 'geometry-blueprint-rotation-action' });
    act(() => {
      rotateButton.props.onClick();
    });

    const displayCodeButton = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-button'
    });
    act(() => {
      displayCodeButton.props.onClick();
    });
    const displayCodeInput = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-input'
    });
    act(() => {
      displayCodeInput.props.onChange({ target: { value: '77' } });
    });
    act(() => {
      displayCodeInput.props.onKeyDown({ key: 'Enter', preventDefault: () => undefined });
    });

    expect(useEditorStore.getState().draft?.racks[rackId].rotationDeg).toBe(90);
    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('77');

    clickTab(renderer, 'geometry');
    expect(useEditorStore.getState().draft?.racks[rackId].rotationDeg).toBe(90);
    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('77');
  });

  it('runs rack quick actions from inspector header and preserves delete confirmation flow', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    const initialRackCount = useEditorStore.getState().draft?.rackIds.length ?? 0;

    const rotateButton = renderer.root.findByProps({ 'data-testid': 'rack-inspector-action-rotate' });
    act(() => {
      rotateButton.props.onClick();
    });
    expect(useEditorStore.getState().draft?.racks[rackId].rotationDeg).toBe(90);

    const duplicateButton = renderer.root.findByProps({ 'data-testid': 'rack-inspector-action-duplicate' });
    act(() => {
      duplicateButton.props.onClick();
    });
    expect(useEditorStore.getState().draft?.rackIds.length).toBe(initialRackCount + 1);

    const deleteButton = renderer.root.findByProps({ 'data-testid': 'rack-inspector-action-delete' });
    act(() => {
      deleteButton.props.onClick();
    });
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-delete-confirm' })).toHaveLength(1);

    const cancelDelete = renderer.root.findByProps({ 'data-testid': 'rack-inspector-delete-cancel' });
    act(() => {
      cancelDelete.props.onClick();
    });
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-delete-confirm' })).toHaveLength(0);

    const deleteButtonAgain = renderer.root.findByProps({ 'data-testid': 'rack-inspector-action-delete' });
    act(() => {
      deleteButtonAgain.props.onClick();
    });
    const confirmDelete = renderer.root.findByProps({
      'data-testid': 'rack-inspector-delete-confirm-button'
    });
    act(() => {
      confirmDelete.props.onClick();
    });
    expect(useEditorStore.getState().draft?.rackIds.length).toBe(initialRackCount);
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
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-quick-actions' })).toHaveLength(0);
    expect(hasText(renderer, 'Position X')).toBe(false);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-header-display-code-readonly' })).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-header-display-code-button' })).toHaveLength(0);
    expect(hasText(renderer, 'Face A')).toBe(true);
  });

  it('uses canonical topology control only and preserves locked transition semantics', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    const rack = draft.racks[rackId];
    rack.faces[0].sections = [
      {
        id: 'section-a-1',
        ordinal: 1,
        length: 2.5,
        levels: [{ id: 'level-a-1', ordinal: 1, slotCount: 5 }]
      },
      {
        id: 'section-a-2',
        ordinal: 2,
        length: 2.5,
        levels: [{ id: 'level-a-2', ordinal: 2, slotCount: 7 }]
      }
    ];

    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    clickTab(renderer, 'structure');

    expect(hasText(renderer, 'Kind')).toBe(false);
    expect(hasText(renderer, 'Mirror A')).toBe(false);
    expect(hasText(renderer, 'Remove Face B')).toBe(false);

    clickTopologyOption(renderer, 'independent');
    let updatedRack = useEditorStore.getState().draft?.racks[rackId];
    let updatedFaceB = updatedRack?.faces.find((face) => face.side === 'B');
    expect(updatedRack?.kind).toBe('paired');
    expect(updatedFaceB?.enabled).toBe(true);
    expect(updatedFaceB?.relationshipMode).toBe('independent');
    expect(updatedFaceB?.sections).toHaveLength(1);
    expect(updatedFaceB?.sections[0]?.levels).toHaveLength(1);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(1);

    const independentSnapshot = structuredClone(updatedRack);
    clickTopologyOption(renderer, 'independent');
    updatedRack = useEditorStore.getState().draft?.racks[rackId];
    expect(updatedRack).toEqual(independentSnapshot);

    clickTopologyOption(renderer, 'mirrored');
    updatedRack = useEditorStore.getState().draft?.racks[rackId];
    updatedFaceB = updatedRack?.faces.find((face) => face.side === 'B');
    expect(updatedRack?.kind).toBe('paired');
    expect(updatedFaceB?.relationshipMode).toBe('mirrored');
    expect(updatedFaceB?.sections).toEqual([]);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(0);

    clickTopologyOption(renderer, 'independent');
    updatedRack = useEditorStore.getState().draft?.racks[rackId];
    const updatedFaceA = updatedRack?.faces.find((face) => face.side === 'A');
    updatedFaceB = updatedRack?.faces.find((face) => face.side === 'B');
    expect(updatedFaceB?.relationshipMode).toBe('independent');
    expect(updatedFaceB?.sections).toHaveLength(updatedFaceA?.sections.length ?? 0);
    expect(updatedFaceB?.sections[0]?.levels.length).toBe(updatedFaceA?.sections[0]?.levels.length);
    expect(updatedFaceB?.sections[0]?.id).not.toBe(updatedFaceA?.sections[0]?.id);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(1);

    clickTopologyOption(renderer, 'single');
    updatedRack = useEditorStore.getState().draft?.racks[rackId];
    updatedFaceB = updatedRack?.faces.find((face) => face.side === 'B');
    expect(updatedRack?.kind).toBe('single');
    expect(updatedFaceB?.enabled).toBe(false);
    expect(updatedFaceB?.sections).toEqual([]);
    expect(renderer.root.findAllByProps({ 'data-testid': 'structure-face-switcher' })).toHaveLength(0);
  });

  it('supports header display code enter/blur commit and escape cancel', () => {
    const draft = createLayoutDraftFixture();
    const rackId = draft.rackIds[0];
    act(() => {
      useEditorStore.getState().initializeDraft(draft);
      useEditorStore.getState().setSelectedRackId(rackId);
    });

    const renderer = renderInspector(createWorkspace(draft));
    expect(hasText(renderer, 'Display Code')).toBe(false);

    const displayCodeButton = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-button'
    });
    act(() => {
      displayCodeButton.props.onClick();
    });
    let displayCodeInput = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-input'
    });

    act(() => {
      displayCodeInput.props.onChange({ target: { value: '11' } });
    });
    act(() => {
      displayCodeInput.props.onKeyDown({ key: 'Enter', preventDefault: () => undefined });
    });
    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('11');

    const displayCodeButtonAfterEnter = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-button'
    });
    act(() => {
      displayCodeButtonAfterEnter.props.onClick();
    });
    displayCodeInput = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-input'
    });
    act(() => {
      displayCodeInput.props.onChange({ target: { value: '22' } });
    });
    act(() => {
      displayCodeInput.props.onBlur();
    });
    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('22');

    const displayCodeButtonAfterBlur = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-button'
    });
    act(() => {
      displayCodeButtonAfterBlur.props.onClick();
    });
    displayCodeInput = renderer.root.findByProps({
      'data-testid': 'rack-inspector-header-display-code-input'
    });
    act(() => {
      displayCodeInput.props.onChange({ target: { value: '99' } });
    });
    act(() => {
      displayCodeInput.props.onKeyDown({ key: 'Escape', preventDefault: () => undefined });
    });
    expect(useEditorStore.getState().draft?.racks[rackId].displayCode).toBe('22');
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-header-display-code-input' })).toHaveLength(0);
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
    expect(hasText(renderer, 'Position X')).toBe(false);

    const collapseButton = renderer.root.findByProps({ title: 'Collapse summary' });
    act(() => {
      collapseButton.props.onClick();
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-summary' })).toHaveLength(0);
    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-summary-collapsed' })).toHaveLength(1);
    expect(hasText(renderer, 'Position X')).toBe(false);

    const expandButton = renderer.root.findByProps({ title: 'Expand summary' });
    act(() => {
      expandButton.props.onClick();
    });

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-inspector-summary' })).toHaveLength(1);
    expect(hasText(renderer, 'Position X')).toBe(false);
  });
});
