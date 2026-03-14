export type EditorMode = 'select' | 'place';

/** Top-level editing perspective — controls which tools, overlays and inspector sections are active */
export type ViewMode = 'layout' | 'semantics' | 'placement' | 'flow';

/**
 * Typed selection state for the editor.
 *
 * - 'rack'      — one or more racks selected (layout mode)
 * - 'cell'      — a single cell selected (placement mode, future)
 * - 'container' — a container selected (placement mode, future)
 * - 'none'      — nothing selected
 *
 * Note: EditorMode 'place' (the rack-placement tool within layout) is unrelated
 * to ViewMode 'placement' (the storage-occupancy view). They are different axes.
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
