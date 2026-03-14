import { describe, expect, it } from 'vitest';
// Import from the pure logic module — avoids pulling in React components and @/ path aliases.
import { resolveInspectorKind } from './inspector-router-logic';
import type { EditorSelection } from '../../../entities/layout-version/model/editor-types';

// ─── helpers ──────────────────────────────────────────────────────────────────

const noSelection: EditorSelection = { type: 'none' };
const rackSelection = (ids: string[]): EditorSelection => ({ type: 'rack', rackIds: ids });

// ─── layout mode ──────────────────────────────────────────────────────────────

describe('resolveInspectorKind — layout mode', () => {
  it('returns rack-creation-wizard when the selected rack is the creating rack', () => {
    const id = 'rack-1';
    expect(resolveInspectorKind('layout', rackSelection([id]), id)).toBe('rack-creation-wizard');
  });

  it('returns rack-structure when rack is selected but not being created', () => {
    const id = 'rack-1';
    expect(resolveInspectorKind('layout', rackSelection([id]), null)).toBe('rack-structure');
    expect(resolveInspectorKind('layout', rackSelection([id]), 'rack-other')).toBe('rack-structure');
  });

  it('returns rack-structure for multi-rack selection (primary id not the creating rack)', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), 'r3')).toBe('rack-structure');
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

  it('returns rack-creation-wizard only when primary rackId matches creatingRackId', () => {
    // Multi-select: primary is r1, creating is r2 — should not trigger wizard
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']), 'r2')).toBe('rack-structure');
  });
});

// ─── placeholder modes ────────────────────────────────────────────────────────

describe('resolveInspectorKind — non-layout modes', () => {
  it('returns semantics-placeholder for semantics mode regardless of selection', () => {
    expect(resolveInspectorKind('semantics', noSelection, null)).toBe('semantics-placeholder');
    expect(resolveInspectorKind('semantics', rackSelection(['r1']), null)).toBe('semantics-placeholder');
  });

  it('returns placement-placeholder for placement mode regardless of selection', () => {
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
});
