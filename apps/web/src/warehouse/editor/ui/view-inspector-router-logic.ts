import type { EditorSelection } from '@/warehouse/editor/model/editor-types';

export type ViewInspectorKind =
  | 'rack-view'
  | 'placement-cell'
  | 'placement-container'
  | 'placement-placeholder';

export function hasInspectableViewSelection(selection: EditorSelection): boolean {
  if (selection.type === 'rack') return selection.rackIds.length > 0;
  return selection.type === 'cell' || selection.type === 'container' || selection.type === 'zone';
}

export function resolveViewInspectorKind(
  selection: EditorSelection
): ViewInspectorKind {
  if (selection.type === 'rack' && selection.rackIds[0]) return 'rack-view';
  if (selection.type === 'cell') return 'placement-cell';
  if (selection.type === 'container') return 'placement-container';
  return 'placement-placeholder';
}
