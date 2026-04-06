import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editor-store';
import { useInteractionStore } from './interaction-store';
import { useModeStore } from './mode-store';
import { resolveInteractionScope, type EditorSelection } from './editor-types';

function resetStore() {
  // Reset mode-store
  useModeStore.setState({
    viewMode: 'layout',
    editorMode: 'select'
  });

  // Reset editor-store
  useEditorStore.setState({
    activeStorageWorkflow: null,
    minRackDistance: 0,
    draft: null,
    draftSourceVersionId: null,
    isDraftDirty: false
  });

  // Reset interaction-store
  useInteractionStore.setState({ selection: { type: 'none' }, hoveredRackId: null, creatingRackId: null, highlightedCellIds: [], contextPanelMode: 'compact' });
}

afterEach(() => {
  resetStore();
});

describe('EditorSelection — canonical store field', () => {
  it('defaults to { type: none }', () => {
    const { selection } = useInteractionStore.getState();
    expect(selection).toEqual({ type: 'none' });
  });

  it('setSelectedRackIds([]) produces { type: none }', () => {
    useEditorStore.getState().setSelectedRackIds([]);
    expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
  });

  it('setSelectedRackIds([...]) produces { type: rack, rackIds }', () => {
    useEditorStore.getState().setSelectedRackIds(['r1', 'r2']);
    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['r1', 'r2'],
      focus: { type: 'body' }
    });
  });

  it('setSelectedRackId(id) produces a single-rack selection', () => {
    useEditorStore.getState().setSelectedRackId('rack-abc');
    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['rack-abc'],
      focus: { type: 'body' }
    });
  });

  it('setSelectedRackSide(id, side) produces a side-focused single-rack selection', () => {
    useEditorStore.getState().setSelectedRackSide('rack-abc', 'east');
    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['rack-abc'],
      focus: { type: 'side', side: 'east' }
    });
  });

  it('setSelectedRackId(null) clears selection', () => {
    useEditorStore.getState().setSelectedRackId('rack-abc');
    useEditorStore.getState().setSelectedRackId(null);
    expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
  });

  it('setSelection() accepts any EditorSelection variant', () => {
    const sel: EditorSelection = { type: 'rack', rackIds: ['x', 'y', 'z'] };
    useEditorStore.getState().setSelection(sel);
    expect(useInteractionStore.getState().selection).toEqual(sel);
  });

  it('setSelectedWallId(id) produces a wall selection', () => {
    useEditorStore.getState().setSelectedWallId('wall-abc');
    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'wall',
      wallId: 'wall-abc'
    });
  });

  it('clearSelection() resets to { type: none }', () => {
    useEditorStore.getState().setSelectedRackId('r1');
    useEditorStore.getState().clearSelection();
    expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
  });

  it('preserves Context Panel mode across selection and workflow changes', () => {
    useInteractionStore.getState().setContextPanelMode('expanded');

    useEditorStore.getState().setSelectedRackId('rack-abc');
    expect(useInteractionStore.getState().contextPanelMode).toBe('expanded');

    useEditorStore.getState().clearSelection();
    expect(useInteractionStore.getState().contextPanelMode).toBe('expanded');

    useEditorStore.getState().setViewMode('storage');
    useEditorStore.getState().startPlaceContainerWorkflow('cell-1');
    expect(useInteractionStore.getState().contextPanelMode).toBe('expanded');
  });

  it('toggleRackSelection builds a multi-rack selection', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r2');
    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['r1', 'r2'],
      focus: { type: 'body' }
    });
  });

  it('toggleRackSelection removes a rack from multi-selection', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r2');
    useEditorStore.getState().toggleRackSelection('r1');
    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['r2'],
      focus: { type: 'body' }
    });
  });

  it('toggleRackSelection collapses to { type: none } when last rack is removed', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r1');
    expect(useInteractionStore.getState().selection).toEqual({ type: 'none' });
  });

  it('selection rackIds[0] is still the primary rack id', () => {
    useEditorStore.getState().setSelectedRackIds(['primary', 'secondary']);
    const sel = useInteractionStore.getState().selection;
    expect(sel.type === 'rack' ? sel.rackIds[0] : null).toBe('primary');
  });

  it('setSelectedContainerId can retain the source physical cell context for placement actions', () => {
    useEditorStore
      .getState()
      .setSelectedContainerId('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'container',
      containerId: 'container-uuid',
      sourceCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
    });
  });

  it('startPlacementMove stores explicit source and pending target state', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore
      .getState()
      .startPlacementMove('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'move-container',
      containerId: 'container-uuid',
      sourceCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      targetCellId: null,
      status: 'targeting',
      errorMessage: null
    });
  });

  it('setPlacementMoveTargetCellId updates the explicit move target', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore
      .getState()
      .startPlacementMove('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    useEditorStore
      .getState()
      .setPlacementMoveTargetCellId('f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce');

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'move-container',
      containerId: 'container-uuid',
      sourceCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      targetCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
      status: 'targeting',
      errorMessage: null
    });
  });

  it('setSelectedCellId clears any active placement interaction', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore
      .getState()
      .startPlacementMove('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    useEditorStore.getState().setSelectedCellId('f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce');

    expect(useEditorStore.getState().activeStorageWorkflow).toBeNull();
  });

  it('starts place-container workflow from a selected cell in storage mode', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore
      .getState()
      .startPlaceContainerWorkflow('f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce');

    expect(useInteractionStore.getState().selection).toEqual<EditorSelection>({
      type: 'cell',
      cellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
    });
    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'place-container',
      cellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
      status: 'editing',
      errorMessage: null
    });
  });

  it('starts create-and-place workflow from a selected cell in storage mode', () => {
    useEditorStore.getState().setViewMode('storage');
    useEditorStore
      .getState()
      .startCreateAndPlaceWorkflow('f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce');

    expect(useEditorStore.getState().activeStorageWorkflow).toEqual({
      kind: 'create-and-place',
      cellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce',
      status: 'editing',
      errorMessage: null,
      createdContainer: null
    });
  });

  it('derives idle/object/workflow scope from selection plus placement interaction', () => {
    expect(resolveInteractionScope({ type: 'none' }, null)).toBe('idle');
    expect(
      resolveInteractionScope({ type: 'rack', rackIds: ['rack-1'] }, null)
    ).toBe('object');
    expect(
      resolveInteractionScope(
        { type: 'cell', cellId: 'cell-1' },
        {
          kind: 'place-container',
          cellId: 'cell-1',
          status: 'editing',
          errorMessage: null
        }
      )
    ).toBe('workflow');
    expect(
      resolveInteractionScope(
        { type: 'container', containerId: 'container-1', sourceCellId: 'cell-1' },
        {
          kind: 'move-container',
          containerId: 'container-1',
          sourceCellId: 'cell-1',
          targetCellId: null
          ,
          status: 'targeting',
          errorMessage: null
        }
      )
    ).toBe('workflow');
  });
});
