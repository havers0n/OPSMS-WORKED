/**
 * Pure routing logic for the inspector router.
 * No React, no store, no @/ aliases — testable in isolation.
 */
import type {
  EditorSelection,
  ViewMode
} from '@/widgets/warehouse-editor/model/editor-types';

export type InspectorKind =
  | 'rack-structure'         // layout/view + single rack selected (existing)
  | 'storage-shell'          // storage + none/rack/cell/resolved-container (persistent storage hierarchy shell)
  | 'rack-multi'             // layout + 2+ racks selected → spacing/alignment
  | 'zone-detail'            // layout + single zone selected → editable inspector
  | 'zone-readonly'          // view/storage + zone selected → context-only, no actions
  | 'wall-detail'            // layout + single wall selected
  | 'placement-placeholder'  // view/storage mode + no selection
  | 'placement-cell'         // view/storage mode + cell selected
  | 'placement-container';   // view/storage mode + container selected

type ResolveInspectorKindContext = {
  hasResolvedStorageContainerRackContext: boolean;
  /**
   * Legacy storage inspector routing is disabled by default.
   * PublishedViewer is the only runtime path that should enable this.
   */
  enableLegacyStorageRouting: boolean;
};

/**
 * Maps (viewMode, selection) → InspectorKind | null.
 * This is the single source of truth for inspector routing decisions.
 *
 * Layout routing contract:
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
 *   storage + none/rack/cell    → storage-shell
 *   storage + zone              → zone-readonly  (zone is not a placement target)
 *   storage + container (resolved source context)   → storage-shell
 *   storage + container (unresolved/no-source)      → placement-container
 *   storage + anything else     → storage-shell
 *
 * Note: canSelectZone in use-canvas-scene-model.ts currently prevents zone
 * selection outside layout mode, so zone-readonly is unreachable in practice.
 * It is declared here to make the contract explicit and guard against future
 * changes that allow zone selection in view/storage modes.
 */
export function resolveInspectorKind(
  viewMode: ViewMode,
  selection: EditorSelection,
  context: ResolveInspectorKindContext = {
    hasResolvedStorageContainerRackContext: false,
    enableLegacyStorageRouting: false
  }
): InspectorKind | null {
  if (viewMode === 'layout') {
    if (selection.type === 'rack') {
      if (selection.rackIds.length >= 2) return 'rack-multi';
      return selection.rackIds[0] ? 'rack-structure' : null;
    }
    if (selection.type === 'zone') {
      return 'zone-detail';
    }
    if (selection.type === 'wall') {
      return 'wall-detail';
    }
    return null;
  }

  if (viewMode === 'view' && selection.type === 'rack') {
    return selection.rackIds[0] ? 'rack-structure' : 'placement-placeholder';
  }
  if (viewMode === 'storage') {
    if (!context.enableLegacyStorageRouting) return null;
    if (selection.type === 'zone') return 'zone-readonly';
    if (selection.type === 'container') {
      return context.hasResolvedStorageContainerRackContext ? 'storage-shell' : 'placement-container';
    }
    return 'storage-shell';
  }

  // viewMode === 'view' | 'storage'
  // Zone is a spatial context area, not a placement target.
  // Show a readonly context panel rather than the storage placeholder.
  if (selection.type === 'zone') return 'zone-readonly';
  if (selection.type === 'cell') return 'placement-cell';
  if (selection.type === 'container') return 'placement-container';
  return 'placement-placeholder';
}
