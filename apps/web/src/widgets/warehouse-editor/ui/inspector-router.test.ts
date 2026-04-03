import { describe, expect, it } from 'vitest';
// Import from the pure logic module — avoids pulling in React components and @/ path aliases.
import { resolveInspectorKind } from './inspector-router-logic';
import type { EditorSelection } from '../../../entities/layout-version/model/editor-types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const noSelection: EditorSelection = { type: 'none' };
const rackSelection = (ids: string[]): EditorSelection => ({ type: 'rack', rackIds: ids });
const zoneSelection = (zoneId: string): EditorSelection => ({ type: 'zone', zoneId });
const wallSelection = (wallId: string): EditorSelection => ({ type: 'wall', wallId });
const cellSelection = (cellId: string): EditorSelection => ({ type: 'cell', cellId });
const containerSelection = (containerId: string): EditorSelection => ({ type: 'container', containerId });

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

  it('returns zone-detail for a zone selection in layout mode', () => {
    expect(resolveInspectorKind('layout', zoneSelection('zone-1'), null)).toBe('zone-detail');
  });

  it('returns wall-detail for a wall selection in layout mode', () => {
    expect(resolveInspectorKind('layout', wallSelection('wall-1'), null)).toBe('wall-detail');
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

// ─── storage mode — placeholder ──────────────────────────────────────────────

describe('resolveInspectorKind — storage mode, placeholder', () => {
  it('returns placement-placeholder for storage mode with no selection', () => {
    expect(resolveInspectorKind('storage', noSelection, null)).toBe('placement-placeholder');
  });

  it('routes rack selection to rack-structure in storage mode', () => {
    expect(resolveInspectorKind('storage', rackSelection(['r1']), null)).toBe('rack-structure');
  });

  it('storage rack routing is unaffected by creatingRackId', () => {
    expect(resolveInspectorKind('storage', rackSelection(['r1']), 'r1')).toBe('rack-structure');
  });
});

// ─── storage mode — cell selection (B1) ──────────────────────────────────────

describe('resolveInspectorKind — storage mode, cell selection', () => {
  it('returns placement-cell when a cell is selected in storage mode', () => {
    const cellSel = cellSelection('rack-1:sec-abc:0');
    expect(resolveInspectorKind('storage', cellSel, null)).toBe('placement-cell');
  });

  it('returns placement-cell regardless of creatingRackId', () => {
    const cellSel = cellSelection('rack-1:sec-abc:2');
    expect(resolveInspectorKind('storage', cellSel, 'rack-1')).toBe('placement-cell');
    expect(resolveInspectorKind('storage', cellSel, null)).toBe('placement-cell');
  });

  it('returns placement-placeholder when no cell is selected', () => {
    expect(resolveInspectorKind('storage', noSelection, null)).toBe('placement-placeholder');
  });

  it('routes rack selection in storage mode to the rack inspector, not the cell inspector', () => {
    expect(resolveInspectorKind('storage', rackSelection(['r1']), null)).toBe('rack-structure');
  });

  it('cell selection in layout mode still returns layout-empty (layout ignores cell)', () => {
    const cellSel = cellSelection('rack-1:sec-abc:0');
    expect(resolveInspectorKind('layout', cellSel, null)).toBe('layout-empty');
  });

});

// ─── storage mode — container selection (B3) ─────────────────────────────────

describe('resolveInspectorKind — storage mode, container selection', () => {
  it('returns placement-container when a container is selected in storage mode', () => {
    const sel = containerSelection('3dbf2a90-b1cb-42f0-afec-57f436a22f5d');
    expect(resolveInspectorKind('storage', sel, null)).toBe('placement-container');
  });

  it('returns placement-container regardless of creatingRackId', () => {
    const sel = containerSelection('3dbf2a90-b1cb-42f0-afec-57f436a22f5d');
    expect(resolveInspectorKind('storage', sel, 'rack-x')).toBe('placement-container');
  });

  it('container selection in layout mode returns layout-empty (layout ignores containers)', () => {
    const sel = containerSelection('3dbf2a90-b1cb-42f0-afec-57f436a22f5d');
    expect(resolveInspectorKind('layout', sel, null)).toBe('layout-empty');
  });

  it('cell and container are distinct routes — cell → placement-cell, container → placement-container', () => {
    const cell = cellSelection('rack-1:sec-abc:1');
    const container = containerSelection('3dbf2a90-b1cb-42f0-afec-57f436a22f5d');
    expect(resolveInspectorKind('storage', cell, null)).toBe('placement-cell');
    expect(resolveInspectorKind('storage', container, null)).toBe('placement-container');
  });
});

// ─── view mode — rack/cell/container selection ───────────────────────────────

describe('resolveInspectorKind — view mode, read-only object routing', () => {
  it('routes rack selection to rack-structure in view mode', () => {
    expect(resolveInspectorKind('view', rackSelection(['r1']), null)).toBe('rack-structure');
  });

  it('routes cell and container selection to placement inspectors in view mode', () => {
    expect(resolveInspectorKind('view', cellSelection('cell-1'), null)).toBe('placement-cell');
    expect(resolveInspectorKind('view', containerSelection('container-1'), null)).toBe(
      'placement-container'
    );
  });

  it('shows the placeholder when nothing is selected in view mode', () => {
    expect(resolveInspectorKind('view', noSelection, null)).toBe('placement-placeholder');
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
