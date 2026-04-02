/**
 * Pure routing logic for the inspector router.
 * No React, no store, no @/ aliases — testable in isolation.
 */
import type { EditorSelection, ViewMode } from '../../../entities/layout-version/model/editor-types';

export type InspectorKind =
  | 'rack-creation-wizard'   // layout + single rack being created
  | 'rack-structure'         // layout/view + single rack selected (existing)
  | 'rack-multi'             // layout + 2+ racks selected → spacing/alignment
  | 'layout-empty'           // layout + nothing selected
  | 'placement-placeholder'  // view/storage mode + no selection
  | 'placement-cell'         // view/storage mode + cell selected
  | 'placement-container';   // view/storage mode + container selected

/**
 * Maps (viewMode, selection, creatingRackId) → InspectorKind.
 * This is the single source of truth for inspector routing decisions.
 *
 * Layout routing contract:
 *   layout + none               → layout-empty
 *   layout + rack(1) + creating → rack-creation-wizard
 *   layout + rack(1)            → rack-structure
 *   layout + rack(≥2)           → rack-multi
 *
 * View routing contract:
 *   view + rack                 → rack-structure
 *   view + cell                 → placement-cell
 *   view + container            → placement-container
 *   view + none                 → placement-placeholder
 *
 * Storage routing contract:
 *   storage + cell              → placement-cell
 *   storage + container         → placement-container
 *   storage + anything else     → placement-placeholder
 */
export function resolveInspectorKind(
  viewMode: ViewMode,
  selection: EditorSelection,
  creatingRackId: string | null
): InspectorKind {
  if (viewMode === 'layout') {
    if (selection.type === 'rack') {
      if (selection.rackIds.length >= 2) return 'rack-multi';
      const primaryId = selection.rackIds[0];
      if (primaryId && primaryId === creatingRackId) return 'rack-creation-wizard';
      return 'rack-structure';
    }
    return 'layout-empty';
  }

  if (viewMode === 'view' && selection.type === 'rack') {
    return selection.rackIds[0] ? 'rack-structure' : 'placement-placeholder';
  }

  // viewMode === 'view' | 'storage'
  if (selection.type === 'cell') return 'placement-cell';
  if (selection.type === 'container') return 'placement-container';
  return 'placement-placeholder';
}
