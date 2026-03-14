/**
 * Pure routing logic for the inspector router.
 * No React, no store, no @/ aliases — testable in isolation.
 */
import type { EditorSelection, ViewMode } from '../../../entities/layout-version/model/editor-types';

export type InspectorKind =
  | 'rack-creation-wizard'   // layout + rack being created
  | 'rack-structure'         // layout + rack selected (existing)
  | 'layout-empty'           // layout + nothing selected
  | 'semantics-placeholder'  // semantics mode (not yet implemented)
  | 'placement-placeholder'  // placement mode (not yet implemented)
  | 'flow-placeholder';      // flow mode (not yet implemented)

/**
 * Maps (viewMode, selection, creatingRackId) → InspectorKind.
 * This is the single source of truth for inspector routing decisions.
 */
export function resolveInspectorKind(
  viewMode: ViewMode,
  selection: EditorSelection,
  creatingRackId: string | null
): InspectorKind {
  if (viewMode === 'layout') {
    if (selection.type === 'rack') {
      const primaryId = selection.rackIds[0];
      if (primaryId && primaryId === creatingRackId) {
        return 'rack-creation-wizard';
      }
      return 'rack-structure';
    }
    return 'layout-empty';
  }

  if (viewMode === 'semantics') return 'semantics-placeholder';
  if (viewMode === 'placement') return 'placement-placeholder';
  if (viewMode === 'flow') return 'flow-placeholder';

  // Unreachable with the current ViewMode union, but exhaustive fallback.
  return 'layout-empty';
}
