export type EditorMode = 'select' | 'place' | 'draw-zone' | 'draw-wall';

/** Top-level editing perspective — controls which tools, overlays and inspector sections are active */
export type ViewMode = 'view' | 'storage' | 'layout';
export type RackSideFocus = 'north' | 'east' | 'south' | 'west';
export type ObjectWorkContext = 'geometry' | 'structure';

export type RackSelectionFocus =
  | { type: 'body' }
  | { type: 'side'; side: RackSideFocus };

/**
 * Typed selection state for the editor.
 *
 * - 'rack'      — one or more racks selected (layout mode)
 * - 'zone'      — a single floor zone selected (layout mode)
 * - 'wall'      — a single floor wall selected (layout mode)
 * - 'cell'      — a single cell selected (view/storage mode)
 * - 'container' — a container selected (view/storage mode)
 * - 'none'      — nothing selected
 *
 * Note: EditorMode 'place' (the rack-placement tool within layout) is unrelated
 * to ViewMode 'storage' (the storage-occupancy mode). They are different axes.
 */
export type EditorSelection =
  | { type: 'none' }
  | {
      type: 'rack';
      rackIds: string[];
      focus?: RackSelectionFocus;
    }
  | { type: 'zone'; zoneId: string }
  | { type: 'wall'; wallId: string }
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

export type ActiveStorageWorkflow =
  | {
      kind: 'move-container';
      containerId: string;
      sourceCellId: string;
      targetCellId: string | null;
      status: 'targeting' | 'submitting' | 'error';
      errorMessage: string | null;
    }
  | {
      kind: 'place-container';
      cellId: string;
      status: 'editing' | 'submitting' | 'error';
      errorMessage: string | null;
    }
  | {
      kind: 'create-and-place';
      cellId: string;
      status: 'editing' | 'submitting' | 'error' | 'placement-retry';
      errorMessage: string | null;
      createdContainer: null | {
        id: string;
        code: string;
      };
    }
  | null;

export type ActiveLayoutTask =
  | null
  | {
      type: 'rack_creation';
      rackId: string;
    };

export type InteractionScope = 'idle' | 'object' | 'workflow';
export type ContextPanelMode = 'compact' | 'expanded';
export type CellPlacementTaskRequest = 'place-existing' | 'create-and-place';

export function resolveInteractionScope(
  selection: EditorSelection,
  activeStorageWorkflow: ActiveStorageWorkflow
): InteractionScope {
  if (activeStorageWorkflow !== null) {
    return 'workflow';
  }

  return selection.type === 'none' ? 'idle' : 'object';
}
