/**
 * Pure routing logic for the inspector router.
 * No React, no store, no @/ aliases — testable in isolation.
 */
import type {
  ActiveLayoutTask,
  EditorSelection,
  ViewMode
} from '../../../entities/layout-version/model/editor-types';

export type InspectorKind =
  | 'rack-creation-wizard'   // layout + single rack being created
  | 'rack-structure'         // layout/view + single rack selected (existing)
  | 'rack-multi'             // layout + 2+ racks selected → spacing/alignment
  | 'zone-detail'            // layout + single zone selected → editable inspector
  | 'zone-readonly'          // view/storage + zone selected → context-only, no actions
  | 'wall-detail'            // layout + single wall selected
  | 'layout-empty'           // layout + nothing selected
  | 'placement-placeholder'  // view/storage mode + no selection
  | 'placement-cell'         // view/storage mode + cell selected
  | 'placement-container';   // view/storage mode + container selected

/**
 * Maps (viewMode, selection, activeTask) → InspectorKind.
 * This is the single source of truth for inspector routing decisions.
 *
 * Layout routing contract:
 *   layout + none               → layout-empty
 *   layout + rack(1) + rack_creation task → rack-creation-wizard
 *   layout + rack(1)            → rack-structure
 *   layout + rack(≥2)           → rack-multi
 *   layout + zone               → zone-detail
 *   layout + wall               → wall-detail
 *
 * View routing contract:
 *   view + rack                 → rack-structure
 *   view + zone                 → zone-readonly  (context only, no edit actions)
 *   view + cell                 → placement-cell
 *   view + container            → placement-container
 *   view + none                 → placement-placeholder
 *
 * Storage routing contract:
 *   storage + rack              → rack-structure
 *   storage + zone              → zone-readonly  (zone is not a placement target)
 *   storage + cell              → placement-cell
 *   storage + container         → placement-container
 *   storage + anything else     → placement-placeholder
 *
 * Note: canSelectZone in use-canvas-scene-model.ts currently prevents zone
 * selection outside layout mode, so zone-readonly is unreachable in practice.
 * It is declared here to make the contract explicit and guard against future
 * changes that allow zone selection in view/storage modes.
 */
export function resolveInspectorKind(
  viewMode: ViewMode,
  selection: EditorSelection,
  activeTask: ActiveLayoutTask
): InspectorKind {
  if (viewMode === 'layout') {
    if (selection.type === 'rack') {
      if (selection.rackIds.length >= 2) return 'rack-multi';
      const primaryId = selection.rackIds[0];
      if (
        primaryId &&
        activeTask?.type === 'rack_creation' &&
        primaryId === activeTask.rackId
      ) {
        return 'rack-creation-wizard';
      }
      return 'rack-structure';
    }
    if (selection.type === 'zone') {
      return 'zone-detail';
    }
    if (selection.type === 'wall') {
      return 'wall-detail';
    }
    return 'layout-empty';
  }

  if ((viewMode === 'view' || viewMode === 'storage') && selection.type === 'rack') {
    return selection.rackIds[0] ? 'rack-structure' : 'placement-placeholder';
  }

  // viewMode === 'view' | 'storage'
  // Zone is a spatial context area, not a placement target.
  // Show a readonly context panel rather than the storage placeholder.
  if (selection.type === 'zone') return 'zone-readonly';
  if (selection.type === 'cell') return 'placement-cell';
  if (selection.type === 'container') return 'placement-container';
  return 'placement-placeholder';
}
