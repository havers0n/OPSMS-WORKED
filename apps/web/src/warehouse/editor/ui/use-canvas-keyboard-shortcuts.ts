import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { EditorMode, InteractionScope } from '@/warehouse/editor/model/editor-types';
import type { RouteGraphSelection } from '@/features/route-graph-canvas/model/route-graph-canvas-store';

type UseCanvasKeyboardShortcutsParams = {
  isLayoutEditable: boolean;
  isPlacingRef: MutableRefObject<boolean>;
  isDrawingZoneRef: MutableRefObject<boolean>;
  isDrawingWallRef: MutableRefObject<boolean>;
  isRouteGraphModeRef: MutableRefObject<boolean>;
  isPickingPlanRouteStartPlacementModeRef: MutableRefObject<boolean>;
  interactionScopeRef: MutableRefObject<InteractionScope>;
  cancelPickingPlanRouteStartPlacementRef: MutableRefObject<() => void>;
  cancelPlacementInteractionRef: MutableRefObject<() => void>;
  clearSelectionRef: MutableRefObject<() => void>;
  selectedRackIdsRef: MutableRefObject<string[]>;
  selectedZoneIdRef: MutableRefObject<string | null>;
  selectedWallIdRef: MutableRefObject<string | null>;
  deleteZoneRef: MutableRefObject<(id: string) => void>;
  deleteWallRef: MutableRefObject<(id: string) => void>;
  selectedRouteGraphElementRef: MutableRefObject<RouteGraphSelection>;
  clearRouteGraphInteractionRef: MutableRefObject<() => void>;
  deleteRouteGraphNodeRef: MutableRefObject<(id: string) => void>;
  deleteRouteGraphEdgeRef: MutableRefObject<(id: string) => void>;
  cancelDrawZone: () => void;
  cancelDrawWall: () => void;
  setEditorMode: (mode: EditorMode) => void;
  clearHighlightedCellIds: () => void;
};

function isEditableDomTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.tagName === 'SELECT'
  );
}

export function useCanvasKeyboardShortcuts({
  isLayoutEditable,
  isPlacingRef,
  isDrawingZoneRef,
  isDrawingWallRef,
  isRouteGraphModeRef,
  isPickingPlanRouteStartPlacementModeRef,
  interactionScopeRef,
  cancelPickingPlanRouteStartPlacementRef,
  cancelPlacementInteractionRef,
  clearSelectionRef,
  selectedRackIdsRef,
  selectedZoneIdRef,
  selectedWallIdRef,
  deleteZoneRef,
  deleteWallRef,
  selectedRouteGraphElementRef,
  clearRouteGraphInteractionRef,
  deleteRouteGraphNodeRef,
  deleteRouteGraphEdgeRef,
  cancelDrawZone,
  cancelDrawWall,
  setEditorMode,
  clearHighlightedCellIds
}: UseCanvasKeyboardShortcutsParams) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isRouteGraphModeRef.current) {
          if (isEditableDomTarget(event.target)) {
            return;
          }
          clearRouteGraphInteractionRef.current();
          return;
        }

        if (isPickingPlanRouteStartPlacementModeRef.current) {
          cancelPickingPlanRouteStartPlacementRef.current();
          return;
        }

        if (isPlacingRef.current || isDrawingZoneRef.current || isDrawingWallRef.current) {
          setEditorMode('select');
          cancelDrawZone();
          cancelDrawWall();
          return;
        }

        if (isEditableDomTarget(event.target)) {
          return;
        }

        if (interactionScopeRef.current === 'workflow') {
          cancelPlacementInteractionRef.current();
          clearHighlightedCellIds();
          return;
        }

        if (interactionScopeRef.current === 'object') {
          clearSelectionRef.current();
          clearHighlightedCellIds();
        }

        return;
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        isRouteGraphModeRef.current &&
        !isEditableDomTarget(event.target)
      ) {
        const selectedElement = selectedRouteGraphElementRef.current;
        if (selectedElement?.type === 'node') {
          deleteRouteGraphNodeRef.current(selectedElement.id);
          clearRouteGraphInteractionRef.current();
        } else if (selectedElement?.type === 'edge') {
          deleteRouteGraphEdgeRef.current(selectedElement.id);
          clearRouteGraphInteractionRef.current();
        }
        return;
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        !isPlacingRef.current &&
        !isDrawingZoneRef.current &&
        !isDrawingWallRef.current &&
        isLayoutEditable &&
        !isEditableDomTarget(event.target)
      ) {
        const rackId = selectedRackIdsRef.current[0];
        if (rackId) {
          window.dispatchEvent(new CustomEvent('rack:request-delete', { detail: { rackId } }));
          return;
        }

        const zoneId = selectedZoneIdRef.current;
        if (zoneId) {
          deleteZoneRef.current(zoneId);
          return;
        }

        const wallId = selectedWallIdRef.current;
        if (wallId) {
          deleteWallRef.current(wallId);
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    cancelPlacementInteractionRef,
    cancelDrawWall,
    cancelDrawZone,
    cancelPickingPlanRouteStartPlacementRef,
    clearHighlightedCellIds,
    clearRouteGraphInteractionRef,
    clearSelectionRef,
    deleteRouteGraphEdgeRef,
    deleteRouteGraphNodeRef,
    deleteWallRef,
    deleteZoneRef,
    interactionScopeRef,
    isDrawingWallRef,
    isDrawingZoneRef,
    isLayoutEditable,
    isPickingPlanRouteStartPlacementModeRef,
    isPlacingRef,
    isRouteGraphModeRef,
    selectedRackIdsRef,
    selectedRouteGraphElementRef,
    selectedWallIdRef,
    selectedZoneIdRef,
    setEditorMode
  ]);
}
