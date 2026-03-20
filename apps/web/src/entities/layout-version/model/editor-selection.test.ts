import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editor-store';
import type { EditorSelection } from './editor-types';

function resetStore() {
  useEditorStore.setState({
    selection: { type: 'none' },
    placementInteraction: { type: 'idle' },
    hoveredRackId: null,
    creatingRackId: null,
    zoom: 1,
    minRackDistance: 0,
    draft: null,
    draftSourceVersionId: null,
    isDraftDirty: false
  });
}

afterEach(() => {
  resetStore();
});

describe('EditorSelection — canonical store field', () => {
  it('defaults to { type: none }', () => {
    const { selection } = useEditorStore.getState();
    expect(selection).toEqual({ type: 'none' });
  });

  it('setSelectedRackIds([]) produces { type: none }', () => {
    useEditorStore.getState().setSelectedRackIds([]);
    expect(useEditorStore.getState().selection).toEqual({ type: 'none' });
  });

  it('setSelectedRackIds([...]) produces { type: rack, rackIds }', () => {
    useEditorStore.getState().setSelectedRackIds(['r1', 'r2']);
    expect(useEditorStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['r1', 'r2']
    });
  });

  it('setSelectedRackId(id) produces a single-rack selection', () => {
    useEditorStore.getState().setSelectedRackId('rack-abc');
    expect(useEditorStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['rack-abc']
    });
  });

  it('setSelectedRackId(null) clears selection', () => {
    useEditorStore.getState().setSelectedRackId('rack-abc');
    useEditorStore.getState().setSelectedRackId(null);
    expect(useEditorStore.getState().selection).toEqual({ type: 'none' });
  });

  it('setSelection() accepts any EditorSelection variant', () => {
    const sel: EditorSelection = { type: 'rack', rackIds: ['x', 'y', 'z'] };
    useEditorStore.getState().setSelection(sel);
    expect(useEditorStore.getState().selection).toEqual(sel);
  });

  it('clearSelection() resets to { type: none }', () => {
    useEditorStore.getState().setSelectedRackId('r1');
    useEditorStore.getState().clearSelection();
    expect(useEditorStore.getState().selection).toEqual({ type: 'none' });
  });

  it('toggleRackSelection builds a multi-rack selection', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r2');
    expect(useEditorStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['r1', 'r2']
    });
  });

  it('toggleRackSelection removes a rack from multi-selection', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r2');
    useEditorStore.getState().toggleRackSelection('r1');
    expect(useEditorStore.getState().selection).toEqual<EditorSelection>({
      type: 'rack',
      rackIds: ['r2']
    });
  });

  it('toggleRackSelection collapses to { type: none } when last rack is removed', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r1');
    expect(useEditorStore.getState().selection).toEqual({ type: 'none' });
  });

  it('selection rackIds[0] is still the primary rack id', () => {
    useEditorStore.getState().setSelectedRackIds(['primary', 'secondary']);
    const sel = useEditorStore.getState().selection;
    expect(sel.type === 'rack' ? sel.rackIds[0] : null).toBe('primary');
  });

  it('setSelectedContainerId can retain the source physical cell context for placement actions', () => {
    useEditorStore
      .getState()
      .setSelectedContainerId('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    expect(useEditorStore.getState().selection).toEqual<EditorSelection>({
      type: 'container',
      containerId: 'container-uuid',
      sourceCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398'
    });
  });

  it('startPlacementMove stores explicit source and pending target state', () => {
    useEditorStore
      .getState()
      .startPlacementMove('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');

    expect(useEditorStore.getState().placementInteraction).toEqual({
      type: 'move-container',
      containerId: 'container-uuid',
      fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      targetCellId: null
    });
  });

  it('setPlacementMoveTargetCellId updates the explicit move target', () => {
    useEditorStore
      .getState()
      .startPlacementMove('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    useEditorStore
      .getState()
      .setPlacementMoveTargetCellId('f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce');

    expect(useEditorStore.getState().placementInteraction).toEqual({
      type: 'move-container',
      containerId: 'container-uuid',
      fromCellId: '216f2dd6-8f17-4de4-aaba-657f9e0e1398',
      targetCellId: 'f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce'
    });
  });

  it('setSelectedCellId clears any active placement interaction', () => {
    useEditorStore
      .getState()
      .startPlacementMove('container-uuid', '216f2dd6-8f17-4de4-aaba-657f9e0e1398');
    useEditorStore.getState().setSelectedCellId('f06fbcba-a9eb-48df-bfa5-ee09c34dc1ce');

    expect(useEditorStore.getState().placementInteraction).toEqual({ type: 'idle' });
  });
});
