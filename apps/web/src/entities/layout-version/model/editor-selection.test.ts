import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editor-store';
import type { EditorSelection } from './editor-types';

function resetStore() {
  useEditorStore.setState({
    selection: { type: 'none' },
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
});
