/**
 * Pure routing logic for the inspector router.
 * No React, no store, no @/ aliases — testable in isolation.
 */
import type { EditorSelection, ViewMode } from '../../../entities/layout-version/model/editor-types';

export type InspectorKind =
  | 'rack-creation-wizard'   // layout + single rack being created
  | 'rack-structure'         // layout + single rack selected (existing)
  | 'rack-multi'             // layout + 2+ racks selected → spacing/alignment
  | 'layout-empty'           // layout + nothing selected
  | 'semantics-placeholder'  // semantics mode (not yet implemented)
  | 'placement-placeholder'  // placement mode + no/rack selection
  | 'placement-cell'         // placement mode + cell selected
  | 'placement-container'    // placement mode + container selected (B3)
  | 'flow-placeholder';      // flow mode (not yet implemented)

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
 * Placement routing contract:
 *   placement + cell            → placement-cell
 *   placement + container       → placement-container
 *   placement + anything else   → placement-placeholder
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

  if (viewMode === 'semantics') return 'semantics-placeholder';

  if (viewMode === 'placement') {
    if (selection.type === 'cell') return 'placement-cell';
    if (selection.type === 'container') return 'placement-container';
    return 'placement-placeholder';
  }

  if (viewMode === 'flow') return 'flow-placeholder';

  // Unreachable with the current ViewMode union, but exhaustive fallback.
  return 'layout-empty';
}
