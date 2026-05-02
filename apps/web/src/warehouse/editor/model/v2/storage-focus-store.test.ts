import { afterEach, describe, expect, it } from 'vitest';
import { resetStorageFocusStore, useStorageFocusStore } from './storage-focus-store';

afterEach(() => {
  resetStorageFocusStore();
});

// ── selectCell ─────────────────────────────────────────────────────────────────

describe('selectCell', () => {
  it('sets cell, rack, and level atomically', () => {
    useStorageFocusStore.getState().selectCell({ cellId: 'cell-1', rackId: 'rack-1', level: 2 });
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBe('cell-1');
    expect(s.selectedRackId).toBe('rack-1');
    expect(s.activeLevel).toBe(2);
  });

  it('accepts null level', () => {
    useStorageFocusStore.getState().selectCell({ cellId: 'cell-1', rackId: 'rack-1', level: null });
    expect(useStorageFocusStore.getState().activeLevel).toBeNull();
  });

  it('resets _consecutiveEmptyCanvasClicks to 0', () => {
    useStorageFocusStore.setState({ _consecutiveEmptyCanvasClicks: 3 });
    useStorageFocusStore.getState().selectCell({ cellId: 'cell-1', rackId: 'rack-1', level: 1 });
    expect(useStorageFocusStore.getState()._consecutiveEmptyCanvasClicks).toBe(0);
  });
});

// ── selectRack ─────────────────────────────────────────────────────────────────

describe('selectRack', () => {
  it('clears selectedCellId and sets rack', () => {
    useStorageFocusStore.setState({ selectedCellId: 'cell-1', selectedRackId: 'rack-1', activeLevel: 1 });
    useStorageFocusStore.getState().selectRack({ rackId: 'rack-2', level: 3 });
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBe('rack-2');
    expect(s.activeLevel).toBe(3);
  });

  it('defaults level to null when not provided', () => {
    useStorageFocusStore.getState().selectRack({ rackId: 'rack-1' });
    expect(useStorageFocusStore.getState().activeLevel).toBeNull();
  });

  it('resets _consecutiveEmptyCanvasClicks to 0', () => {
    useStorageFocusStore.setState({ _consecutiveEmptyCanvasClicks: 2 });
    useStorageFocusStore.getState().selectRack({ rackId: 'rack-1' });
    expect(useStorageFocusStore.getState()._consecutiveEmptyCanvasClicks).toBe(0);
  });
});

// ── setActiveLevel ─────────────────────────────────────────────────────────────

describe('setActiveLevel', () => {
  it('updates level and clears cell, preserves rack', () => {
    useStorageFocusStore.setState({ selectedCellId: 'cell-1', selectedRackId: 'rack-1', activeLevel: 1 });
    useStorageFocusStore.getState().setActiveLevel(2);
    const s = useStorageFocusStore.getState();
    expect(s.activeLevel).toBe(2);
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBe('rack-1');
  });

  it('resets _consecutiveEmptyCanvasClicks to 0', () => {
    useStorageFocusStore.setState({ _consecutiveEmptyCanvasClicks: 1 });
    useStorageFocusStore.getState().setActiveLevel(2);
    expect(useStorageFocusStore.getState()._consecutiveEmptyCanvasClicks).toBe(0);
  });
});

// ── handleEmptyCanvasClick ─────────────────────────────────────────────────────

describe('handleEmptyCanvasClick', () => {
  it('click #1 with cell selected: clears cell, keeps rack+level, counter becomes 1', () => {
    useStorageFocusStore.setState({
      selectedCellId: 'cell-1',
      selectedRackId: 'rack-1',
      activeLevel: 2,
      _consecutiveEmptyCanvasClicks: 0,
    });
    useStorageFocusStore.getState().handleEmptyCanvasClick();
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBe('rack-1');    // rack preserved
    expect(s.activeLevel).toBe(2);             // level preserved
    expect(s._consecutiveEmptyCanvasClicks).toBe(1);
  });

  it('click #2 consecutive (counter=1, no cell): clears all focus, counter resets to 0', () => {
    useStorageFocusStore.setState({
      selectedCellId: null,
      selectedRackId: 'rack-1',
      activeLevel: 2,
      _consecutiveEmptyCanvasClicks: 1,
    });
    useStorageFocusStore.getState().handleEmptyCanvasClick();
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBeNull();
    expect(s.activeLevel).toBeNull();
    expect(s._consecutiveEmptyCanvasClicks).toBe(0);
  });

  it('when already fully cleared (counter=0, no cell): no state change', () => {
    useStorageFocusStore.setState({
      selectedCellId: null,
      selectedRackId: null,
      activeLevel: null,
      _consecutiveEmptyCanvasClicks: 0,
    });
    useStorageFocusStore.getState().handleEmptyCanvasClick();
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBeNull();
    expect(s.activeLevel).toBeNull();
    expect(s._consecutiveEmptyCanvasClicks).toBe(0);
  });
});

// ── clearCell ──────────────────────────────────────────────────────────────────

describe('clearCell', () => {
  it('clears selectedCellId and increments counter', () => {
    useStorageFocusStore.setState({ selectedCellId: 'cell-1', selectedRackId: 'rack-1', _consecutiveEmptyCanvasClicks: 0 });
    useStorageFocusStore.getState().clearCell();
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBe('rack-1'); // rack preserved
    expect(s._consecutiveEmptyCanvasClicks).toBe(1);
  });
});

// ── clearAllFocus ──────────────────────────────────────────────────────────────

describe('clearAllFocus', () => {
  it('resets all fields to null and counter to 0', () => {
    useStorageFocusStore.setState({
      selectedCellId: 'cell-1',
      selectedRackId: 'rack-1',
      activeLevel: 2,
      _consecutiveEmptyCanvasClicks: 1,
    });
    useStorageFocusStore.getState().clearAllFocus();
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBeNull();
    expect(s.activeLevel).toBeNull();
    expect(s._consecutiveEmptyCanvasClicks).toBe(0);
  });
});

// ── resetStorageFocusStore ─────────────────────────────────────────────────────

describe('resetStorageFocusStore', () => {
  it('restores initial state', () => {
    useStorageFocusStore.setState({
      selectedCellId: 'cell-1',
      selectedRackId: 'rack-1',
      activeLevel: 5,
      _consecutiveEmptyCanvasClicks: 3,
    });
    resetStorageFocusStore();
    const s = useStorageFocusStore.getState();
    expect(s.selectedCellId).toBeNull();
    expect(s.selectedRackId).toBeNull();
    expect(s.activeLevel).toBeNull();
    expect(s._consecutiveEmptyCanvasClicks).toBe(0);
  });
});
