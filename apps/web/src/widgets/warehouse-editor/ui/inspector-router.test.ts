import { describe, expect, it } from 'vitest';
// Import from the pure logic module — avoids pulling in React components and @/ path aliases.
import { resolveInspectorKind } from './inspector-router-logic';
import type { EditorSelection } from '../../../entities/layout-version/model/editor-types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const noSelection: EditorSelection = { type: 'none' };
const rackSelection = (ids: string[]): EditorSelection => ({ type: 'rack', rackIds: ids });
const cellSelection = (cellId: string): EditorSelection => ({ type: 'cell', cellId });

// ─── layout mode — single-rack ────────────────────────────────────────────────

describe('resolveInspectorKind — layout mode, single-rack', () => {
  it('returns rack-creation-wizard when the selected rack is the creating rack', () => {
    const id = 'rack-1';
    expect(resolveInspectorKind('layout', rackSelection([id]), id)).toBe('rack-creation-wizard');
  });

  it('returns rack-structure when rack is selected but not being created', () => {
    const id = 'rack-1';
    expect(resolveInspectorKind('layout', rackSelection([id]), null)).toBe('rack-structure');
    expect(resolveInspectorKind('layout', rackSelection([id]), 'rack-other')).toBe('rack-structure');
  });

  it('returns layout-empty when nothing is selected', () => {
    expect(resolveInspectorKind('layout', noSelection, null)).toBe('layout-empty');
    expect(resolveInspectorKind('layout', noSelection, 'rack-1')).toBe('layout-empty');
  });

  it('returns layout-empty for non-rack selection types in layout mode', () => {
    const cellSel: EditorSelection = { type: 'cell', cellId: 'c-1' };
    const containerSel: EditorSelection = { type: 'container', containerId: 'ct-1' };
    expect(resolveInspectorKind('layout', cellSel, null)).toBe('layout-empty');
    expect(resolveInspectorKind('layout', containerSel, null)).toBe('layout-empty');
  });
});

// ─── layout mode — multi-rack ────────────────────────────────────────────────

describe('resolveInspectorKind — layout mode, multi-rack', () => {
  it('returns rack-multi for 2-rack selection', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), null)).toBe('rack-multi');
  });

  it('returns rack-multi for 3+ rack selection', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2', 'r3']), null)).toBe('rack-multi');
  });

  it('returns rack-multi even when creatingRackId matches one of the selected racks', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), 'r1')).toBe('rack-multi');
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), 'r2')).toBe('rack-multi');
  });

  it('returns rack-multi regardless of creatingRackId value', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), 'r3')).toBe('rack-multi');
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), null)).toBe('rack-multi');
  });
});

// ─── placeholder modes ────────────────────────────────────────────────────────

describe('resolveInspectorKind — non-layout modes', () => {
  it('returns semantics-placeholder for semantics mode regardless of selection', () => {
    expect(resolveInspectorKind('semantics', noSelection, null)).toBe('semantics-placeholder');
    expect(resolveInspectorKind('semantics', rackSelection(['r1']), null)).toBe('semantics-placeholder');
  });

  it('returns placement-placeholder for placement mode with no selection or rack selection', () => {
    expect(resolveInspectorKind('placement', noSelection, null)).toBe('placement-placeholder');
    expect(resolveInspectorKind('placement', rackSelection(['r1']), null)).toBe('placement-placeholder');
  });

  it('returns flow-placeholder for flow mode regardless of selection', () => {
    expect(resolveInspectorKind('flow', noSelection, null)).toBe('flow-placeholder');
    expect(resolveInspectorKind('flow', rackSelection(['r1']), null)).toBe('flow-placeholder');
  });

  it('non-layout modes are unaffected by creatingRackId', () => {
    expect(resolveInspectorKind('semantics', rackSelection(['r1']), 'r1')).toBe('semantics-placeholder');
    expect(resolveInspectorKind('placement', rackSelection(['r1']), 'r1')).toBe('placement-placeholder');
    expect(resolveInspectorKind('flow', rackSelection(['r1']), 'r1')).toBe('flow-placeholder');
  });
});

// ─── placement mode — cell selection (B1) ────────────────────────────────────

describe('resolveInspectorKind — placement mode, cell selection', () => {
  it('returns placement-cell when a cell is selected in placement mode', () => {
    const cellSel = cellSelection('rack-1:sec-abc:0');
    expect(resolveInspectorKind('placement', cellSel, null)).toBe('placement-cell');
  });

  it('returns placement-cell regardless of creatingRackId', () => {
    const cellSel = cellSelection('rack-1:sec-abc:2');
    expect(resolveInspectorKind('placement', cellSel, 'rack-1')).toBe('placement-cell');
    expect(resolveInspectorKind('placement', cellSel, null)).toBe('placement-cell');
  });

  it('returns placement-placeholder when no cell is selected', () => {
    expect(resolveInspectorKind('placement', noSelection, null)).toBe('placement-placeholder');
  });

  it('returns placement-placeholder for rack selection in placement mode (not cell)', () => {
    expect(resolveInspectorKind('placement', rackSelection(['r1']), null)).toBe('placement-placeholder');
  });

  it('cell selection in layout mode still returns layout-empty (layout ignores cell)', () => {
    const cellSel = cellSelection('rack-1:sec-abc:0');
    expect(resolveInspectorKind('layout', cellSel, null)).toBe('layout-empty');
  });

  it('cell selection in semantics mode is ignored (semantics has own placeholder)', () => {
    const cellSel = cellSelection('rack-1:sec-abc:0');
    expect(resolveInspectorKind('semantics', cellSel, null)).toBe('semantics-placeholder');
  });

  it('cell selection in flow mode is ignored (flow has own placeholder)', () => {
    const cellSel = cellSelection('rack-1:sec-abc:0');
    expect(resolveInspectorKind('flow', cellSel, null)).toBe('flow-placeholder');
  });
});

// ─── invariants ───────────────────────────────────────────────────────────────

describe('resolveInspectorKind — invariants', () => {
  it('never returns rack-creation-wizard for an empty rackIds array', () => {
    const emptyRackSel: EditorSelection = { type: 'rack', rackIds: [] };
    // rackIds[0] is undefined, so primaryId is falsy — should not match creatingRackId
    expect(resolveInspectorKind('layout', emptyRackSel, 'rack-1')).toBe('rack-structure');
  });

  it('never returns rack-creation-wizard when creatingRackId is null', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1']), null)).toBe('rack-structure');
  });

  it('rack-multi takes precedence over rack-creation-wizard for multi-rack selection', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), 'r1')).toBe('rack-multi');
  });
});
