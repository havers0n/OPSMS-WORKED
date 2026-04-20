import { describe, expect, it } from 'vitest';
import { resolveRightSideRoute } from './right-side-routing-logic';
import type {
  ActiveLayoutTask,
  EditorSelection
} from '@/widgets/warehouse-editor/model/editor-types';

const noSelection: EditorSelection = { type: 'none' };
const rackSelection = (ids: string[]): EditorSelection => ({ type: 'rack', rackIds: ids });
const zoneSelection = (zoneId: string): EditorSelection => ({ type: 'zone', zoneId });
const wallSelection = (wallId: string): EditorSelection => ({ type: 'wall', wallId });
const cellSelection = (cellId: string): EditorSelection => ({ type: 'cell', cellId });
const containerSelection = (containerId: string): EditorSelection => ({ type: 'container', containerId });
const rackCreationTask = (rackId: string): ActiveLayoutTask => ({ type: 'rack_creation', rackId });

describe('resolveRightSideRoute', () => {
  it('gives active task precedence over selection in layout mode', () => {
    expect(resolveRightSideRoute('layout', rackSelection(['rack-1']), rackCreationTask('rack-2'))).toBe(
      'task-surface'
    );
    expect(resolveRightSideRoute('layout', zoneSelection('zone-1'), rackCreationTask('rack-1'))).toBe(
      'task-surface'
    );
  });

  it('routes inspectable layout selection to inspector when no task is active', () => {
    expect(resolveRightSideRoute('layout', rackSelection(['rack-1']), null)).toBe(
      'inspector-surface'
    );
    expect(resolveRightSideRoute('layout', zoneSelection('zone-1'), null)).toBe(
      'inspector-surface'
    );
    expect(resolveRightSideRoute('layout', wallSelection('wall-1'), null)).toBe(
      'inspector-surface'
    );
  });

  it('preserves current contract: layout mode closes slot when there is no task and no inspectable selection', () => {
    expect(resolveRightSideRoute('layout', noSelection, null)).toBe('closed');
    expect(resolveRightSideRoute('layout', rackSelection([]), null)).toBe('closed');
    expect(resolveRightSideRoute('layout', cellSelection('cell-1'), null)).toBe('closed');
    expect(resolveRightSideRoute('layout', containerSelection('container-1'), null)).toBe(
      'closed'
    );
  });

  it('closes view mode by default and keeps storage mode inspector-based', () => {
    expect(resolveRightSideRoute('view', noSelection, null)).toBe('closed');
    expect(resolveRightSideRoute('storage', noSelection, null)).toBe('inspector-surface');
    expect(resolveRightSideRoute('view', cellSelection('cell-1'), null)).toBe('inspector-surface');
    expect(resolveRightSideRoute('view', containerSelection('container-1'), null)).toBe(
      'inspector-surface'
    );
    expect(resolveRightSideRoute('view', rackSelection(['rack-1']), rackCreationTask('rack-1'))).toBe(
      'inspector-surface'
    );
  });
});
