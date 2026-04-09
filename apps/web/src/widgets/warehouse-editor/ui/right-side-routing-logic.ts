import type {
  ActiveLayoutTask,
  EditorSelection,
  ViewMode
} from '../../../entities/layout-version/model/editor-types';

export type RightSideRoute = 'task-surface' | 'inspector-surface' | 'closed';

export function hasInspectableLayoutSelection(selection: EditorSelection): boolean {
  if (selection.type === 'rack') return selection.rackIds.length > 0;
  return selection.type === 'zone' || selection.type === 'wall';
}

export function resolveRightSideRoute(
  viewMode: ViewMode,
  selection: EditorSelection,
  activeTask: ActiveLayoutTask
): RightSideRoute {
  if (viewMode === 'layout') {
    if (activeTask !== null) return 'task-surface';
    return hasInspectableLayoutSelection(selection) ? 'inspector-surface' : 'closed';
  }

  return 'inspector-surface';
}
