import { describe, expect, it } from 'vitest';
import { resolveInspectorKind } from './inspector-router-logic';
import type { EditorSelection } from '@/widgets/warehouse-editor/model/editor-types';

const noSelection: EditorSelection = { type: 'none' };
const rackSelection = (ids: string[]): EditorSelection => ({ type: 'rack', rackIds: ids });
const zoneSelection = (zoneId: string): EditorSelection => ({ type: 'zone', zoneId });
const wallSelection = (wallId: string): EditorSelection => ({ type: 'wall', wallId });
const cellSelection = (cellId: string): EditorSelection => ({ type: 'cell', cellId });
const containerSelection = (containerId: string, sourceCellId?: string): EditorSelection => (
  sourceCellId
    ? { type: 'container', containerId, sourceCellId }
    : { type: 'container', containerId }
);

describe('resolveInspectorKind — layout mode', () => {
  it('returns rack-structure for a single selected rack', () => {
    expect(resolveInspectorKind('layout', rackSelection(['rack-1']))).toBe('rack-structure');
  });

  it('returns rack-multi for 2+ selected racks', () => {
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2']))).toBe('rack-multi');
    expect(resolveInspectorKind('layout', rackSelection(['r1', 'r2', 'r3']))).toBe('rack-multi');
  });

  it('routes layout zone and wall selections to their detail inspectors', () => {
    expect(resolveInspectorKind('layout', zoneSelection('zone-1'))).toBe('zone-detail');
    expect(resolveInspectorKind('layout', wallSelection('wall-1'))).toBe('wall-detail');
  });

  it('does not own layout empty or non-inspector selection states', () => {
    expect(resolveInspectorKind('layout', noSelection)).toBeNull();
    expect(resolveInspectorKind('layout', cellSelection('cell-1'))).toBeNull();
    expect(resolveInspectorKind('layout', containerSelection('container-1'))).toBeNull();
    expect(resolveInspectorKind('layout', rackSelection([]))).toBeNull();
  });
});

describe('resolveInspectorKind — storage mode', () => {
  it('routes none/rack/cell selection to storage-shell', () => {
    expect(resolveInspectorKind('storage', noSelection)).toBe('storage-shell');
    expect(resolveInspectorKind('storage', rackSelection(['r1']))).toBe('storage-shell');
    expect(resolveInspectorKind('storage', cellSelection('cell-1'))).toBe('storage-shell');
  });

  it('preserves current contract: storage container selection with source cell routes to placement-container', () => {
    expect(resolveInspectorKind('storage', containerSelection('container-1', 'cell-1'))).toBe(
      'placement-container'
    );
  });

  it('characterizes current transitional behavior: storage zone selection routes to zone-readonly', () => {
    expect(resolveInspectorKind('storage', zoneSelection('zone-1'))).toBe('zone-readonly');
  });
});

describe('resolveInspectorKind — view mode', () => {
  it('routes rack selection to rack-structure', () => {
    expect(resolveInspectorKind('view', rackSelection(['r1']))).toBe('rack-structure');
  });

  it('routes cell and container selection to placement inspectors', () => {
    expect(resolveInspectorKind('view', cellSelection('cell-1'))).toBe('placement-cell');
    expect(resolveInspectorKind('view', containerSelection('container-1'))).toBe(
      'placement-container'
    );
  });

  it('shows placeholder when nothing is selected', () => {
    expect(resolveInspectorKind('view', noSelection)).toBe('placement-placeholder');
  });
});
