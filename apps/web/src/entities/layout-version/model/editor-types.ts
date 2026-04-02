export type EditorMode = 'select' | 'place';

/** Top-level editing perspective — controls which tools, overlays and inspector sections are active */
export type ViewMode = 'view' | 'storage' | 'layout';
export type LegacyViewMode = 'placement' | 'operations';
export type AnyViewMode = ViewMode | LegacyViewMode;

export function normalizeViewMode(mode: AnyViewMode): ViewMode {
  if (mode === 'placement') return 'storage';
  if (mode === 'operations') return 'view';
  return mode;
}

/**
 * Typed selection state for the editor.
 *
 * - 'rack'      — one or more racks selected (layout mode)
 * - 'cell'      — a single cell selected (view/storage mode)
 * - 'container' — a container selected (view/storage mode)
 * - 'none'      — nothing selected
 *
 * Note: EditorMode 'place' (the rack-placement tool within layout) is unrelated
 * to ViewMode 'storage' (the storage-occupancy mode). They are different axes.
 */
export type EditorSelection =
  | { type: 'none' }
  | { type: 'rack'; rackIds: string[] }
  | { type: 'cell'; cellId: string }
  | { type: 'container'; containerId: string; sourceCellId?: string | null };

export type PlacementInteraction =
  | { type: 'idle' }
  | {
      type: 'move-container';
      containerId: string;
      fromCellId: string;
      targetCellId: string | null;
    };
