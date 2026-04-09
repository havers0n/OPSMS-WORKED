import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { EditorMode, InteractionScope } from '@/widgets/warehouse-editor/model/editor-types';

type UseCanvasKeyboardShortcutsParams = {
  isLayoutEditable: boolean;
  isPlacingRef: MutableRefObject<boolean>;
  isDrawingZoneRef: MutableRefObject<boolean>;
  isDrawingWallRef: MutableRefObject<boolean>;
  interactionScopeRef: MutableRefObject<InteractionScope>;
  cancelPlacementInteractionRef: MutableRefObject<() => void>;
  clearSelectionRef: MutableRefObject<() => void>;
  selectedRackIdsRef: MutableRefObject<string[]>;
  selectedZoneIdRef: MutableRefObject<string | null>;
  selectedWallIdRef: MutableRefObject<string | null>;
  deleteZoneRef: MutableRefObject<(id: string) => void>;
  deleteWallRef: MutableRefObject<(id: string) => void>;
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
  interactionScopeRef,
  cancelPlacementInteractionRef,
  clearSelectionRef,
  selectedRackIdsRef,
  selectedZoneIdRef,
  selectedWallIdRef,
  deleteZoneRef,
  deleteWallRef,
  cancelDrawZone,
  cancelDrawWall,
  setEditorMode,
  clearHighlightedCellIds
}: UseCanvasKeyboardShortcutsParams) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
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
    clearHighlightedCellIds,
    clearSelectionRef,
    deleteWallRef,
    deleteZoneRef,
    interactionScopeRef,
    isDrawingWallRef,
    isDrawingZoneRef,
    isLayoutEditable,
    isPlacingRef,
    selectedRackIdsRef,
    selectedWallIdRef,
    selectedZoneIdRef,
    setEditorMode
  ]);
}
