import { afterEach, describe, expect, it } from 'vitest';
import { useEditorStore } from './editor-store';
import type { EditorSelection } from './editor-types';

/**
 * Mirror of the useEditorSelection selector logic — tested here without React.
 * If the logic in editor-selectors.ts changes, update this too.
 */
function deriveSelection(selectedRackIds: string[]): EditorSelection {
  if (selectedRackIds.length > 0) {
    return { type: 'rack', rackIds: selectedRackIds };
  }
  return { type: 'none' };
}

function resetStore() {
  useEditorStore.setState({
    selectedRackIds: [],
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

describe('EditorSelection derivation from store state', () => {
  it('derives { type: none } when no racks are selected', () => {
    useEditorStore.setState({ selectedRackIds: [] });
    const { selectedRackIds } = useEditorStore.getState();
    expect(deriveSelection(selectedRackIds)).toEqual({ type: 'none' });
  });

  it('derives { type: rack, rackIds } when racks are selected', () => {
    useEditorStore.setState({ selectedRackIds: ['r1', 'r2'] });
    const { selectedRackIds } = useEditorStore.getState();
    expect(deriveSelection(selectedRackIds)).toEqual({ type: 'rack', rackIds: ['r1', 'r2'] });
  });

  it('derives { type: rack } with a single rack after setSelectedRackId', () => {
    useEditorStore.getState().setSelectedRackId('rack-abc');
    const { selectedRackIds } = useEditorStore.getState();
    expect(selectedRackIds).toEqual(['rack-abc']);
    expect(deriveSelection(selectedRackIds)).toEqual({ type: 'rack', rackIds: ['rack-abc'] });
  });

  it('derives { type: none } after setSelectedRackId(null)', () => {
    useEditorStore.getState().setSelectedRackId('rack-abc');
    useEditorStore.getState().setSelectedRackId(null);
    const { selectedRackIds } = useEditorStore.getState();
    expect(selectedRackIds).toEqual([]);
    expect(deriveSelection(selectedRackIds)).toEqual({ type: 'none' });
  });

  it('toggleRackSelection builds a multi-rack selection', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r2');
    const { selectedRackIds } = useEditorStore.getState();
    expect(selectedRackIds).toEqual(['r1', 'r2']);
    expect(deriveSelection(selectedRackIds)).toEqual({ type: 'rack', rackIds: ['r1', 'r2'] });
  });

  it('toggleRackSelection removes a rack from multi-selection', () => {
    useEditorStore.getState().toggleRackSelection('r1');
    useEditorStore.getState().toggleRackSelection('r2');
    useEditorStore.getState().toggleRackSelection('r1');
    const { selectedRackIds } = useEditorStore.getState();
    expect(selectedRackIds).toEqual(['r2']);
    expect(deriveSelection(selectedRackIds)).toEqual({ type: 'rack', rackIds: ['r2'] });
  });

  it('selectedRackIds[0] shortcut preserved for backward compatibility', () => {
    useEditorStore.setState({ selectedRackIds: ['primary', 'secondary'] });
    expect(useEditorStore.getState().selectedRackIds[0]).toBe('primary');
  });

  it('setSelectedRackIds replaces the full selection array', () => {
    useEditorStore.getState().setSelectedRackIds(['x', 'y', 'z']);
    const { selectedRackIds } = useEditorStore.getState();
    expect(selectedRackIds).toEqual(['x', 'y', 'z']);
    expect(deriveSelection(selectedRackIds)).toEqual({ type: 'rack', rackIds: ['x', 'y', 'z'] });
  });
});
