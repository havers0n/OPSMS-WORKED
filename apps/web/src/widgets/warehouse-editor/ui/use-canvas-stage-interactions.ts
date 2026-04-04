import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type Konva from 'konva';
import type { LayoutDraft } from '@wos/domain';
import type { InteractionScope } from '@/entities/layout-version/model/editor-types';
import {
  type CanvasRect,
  getRackGeometry,
  GRID_SIZE
} from '../lib/canvas-geometry';
import { MIN_ZONE_SIZE } from './zone-layer';

type MarqueeRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type UseCanvasStageInteractionsParams = {
  cancelPlacementInteraction: () => void;
  clearHighlightedCellIds: () => void;
  clearSelection: () => void;
  createRack: (x: number, y: number) => void;
  createZone: (rect: CanvasRect) => void;
  interactionScope: InteractionScope;
  isDrawingZone: boolean;
  isLayoutMode: boolean;
  isPlacing: boolean;
  layoutDraft: LayoutDraft | null;
  setSelectedRackIds: (rackIds: string[]) => void;
  stageRef: MutableRefObject<Konva.Stage | null>;
  viewport: { width: number; height: number };
};

export function useCanvasStageInteractions({
  cancelPlacementInteraction,
  clearHighlightedCellIds,
  clearSelection,
  createRack,
  createZone,
  interactionScope,
  isDrawingZone,
  isLayoutMode,
  isPlacing,
  layoutDraft,
  setSelectedRackIds,
  stageRef,
  viewport
}: UseCanvasStageInteractionsParams) {
  // marquee drives the Konva Rect visual; marqueeRef is readable in event handlers
  // without stale closure issues.
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const marqueeRef = useRef<MarqueeRect | null>(null);
  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [draftZoneRect, setDraftZoneRect] = useState<CanvasRect | null>(null);
  const draftZoneRectRef = useRef<CanvasRect | null>(null);
  const draftZoneStartRef = useRef<{ x: number; y: number } | null>(null);
  // Set to true on the first mousemove past threshold; cleared by click.canvas handler.
  const dragDidHappenRef = useRef(false);

  const isPlacingRef = useRef(isPlacing);
  isPlacingRef.current = isPlacing;
  const isDrawingZoneRef = useRef(isDrawingZone);
  isDrawingZoneRef.current = isDrawingZone;
  const interactionScopeRef = useRef(interactionScope);
  interactionScopeRef.current = interactionScope;
  const createRackRef = useRef(createRack);
  createRackRef.current = createRack;
  const createZoneRef = useRef(createZone);
  createZoneRef.current = createZone;
  const setSelectedRackIdsRef = useRef(setSelectedRackIds);
  setSelectedRackIdsRef.current = setSelectedRackIds;
  const clearSelectionRef = useRef(clearSelection);
  clearSelectionRef.current = clearSelection;
  const cancelPlacementInteractionRef = useRef(cancelPlacementInteraction);
  cancelPlacementInteractionRef.current = cancelPlacementInteraction;

  const cancelDrawZone = useCallback(() => {
    draftZoneStartRef.current = null;
    draftZoneRectRef.current = null;
    setDraftZoneRect(null);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const handler = () => {
      // A marquee drag just completed — mouseup already applied the selection.
      // Suppress this click so we don't immediately clear it.
      if (dragDidHappenRef.current) {
        dragDidHappenRef.current = false;
        return;
      }

      const pos = stage.getRelativePointerPosition();
      if (!pos) return;

      if (isPlacingRef.current) {
        createRackRef.current(
          Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
          Math.round(pos.y / GRID_SIZE) * GRID_SIZE
        );
      } else if (isDrawingZoneRef.current) {
        return;
      } else {
        if (interactionScopeRef.current === 'workflow') {
          cancelPlacementInteractionRef.current();
          clearHighlightedCellIds();
          return;
        }

        clearSelectionRef.current();
        clearHighlightedCellIds();
      }
    };

    stage.on('click.canvas', handler);
    return () => {
      stage.off('click.canvas');
    };
  }, [viewport]);

  const onMouseDown = useCallback((event: Konva.KonvaEventObject<MouseEvent>) => {
    // Empty-canvas drags in layout mode are either zone creation or marquee selection.
    // Rack/zone groups suppress this via cancelBubble on their own onMouseDown.
    if (event.evt.button !== 0 || !isLayoutMode || isPlacing) return;
    const pos = stageRef.current?.getRelativePointerPosition();
    if (!pos) return;

    if (isDrawingZone) {
      const x = Math.round(pos.x / GRID_SIZE) * GRID_SIZE;
      const y = Math.round(pos.y / GRID_SIZE) * GRID_SIZE;
      draftZoneStartRef.current = { x, y };
      const initialRect = {
        x,
        y,
        width: MIN_ZONE_SIZE,
        height: MIN_ZONE_SIZE
      };
      draftZoneRectRef.current = initialRect;
      setDraftZoneRect(initialRect);
      dragDidHappenRef.current = false;
      return;
    }

    marqueeStartRef.current = { x: pos.x, y: pos.y };
    dragDidHappenRef.current = false;
  }, [isDrawingZone, isLayoutMode, isPlacing, stageRef]);

  const onMouseMove = useCallback(() => {
    if (draftZoneStartRef.current) {
      const pos = stageRef.current?.getRelativePointerPosition();
      if (!pos) return;
      const dx = pos.x - draftZoneStartRef.current.x;
      const dy = pos.y - draftZoneStartRef.current.y;
      if (!dragDidHappenRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) {
        return;
      }
      dragDidHappenRef.current = true;
      const x2 = Math.round(pos.x / GRID_SIZE) * GRID_SIZE;
      const y2 = Math.round(pos.y / GRID_SIZE) * GRID_SIZE;
      const nextRect = {
        x: Math.min(draftZoneStartRef.current.x, x2),
        y: Math.min(draftZoneStartRef.current.y, y2),
        width: Math.max(MIN_ZONE_SIZE, Math.abs(x2 - draftZoneStartRef.current.x)),
        height: Math.max(MIN_ZONE_SIZE, Math.abs(y2 - draftZoneStartRef.current.y))
      };
      draftZoneRectRef.current = nextRect;
      setDraftZoneRect(nextRect);
      return;
    }

    if (!marqueeStartRef.current) return;
    const pos = stageRef.current?.getRelativePointerPosition();
    if (!pos) return;
    const dx = pos.x - marqueeStartRef.current.x;
    const dy = pos.y - marqueeStartRef.current.y;
    if (!dragDidHappenRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
    dragDidHappenRef.current = true;
    const next = { x1: marqueeStartRef.current.x, y1: marqueeStartRef.current.y, x2: pos.x, y2: pos.y };
    marqueeRef.current = next;
    setMarquee(next);
  }, [stageRef]);

  const onMouseUp = useCallback(() => {
    if (draftZoneStartRef.current) {
      draftZoneStartRef.current = null;
      const createdRect = draftZoneRectRef.current;
      draftZoneRectRef.current = null;
      setDraftZoneRect(null);
      if (!dragDidHappenRef.current || !createdRect) return;
      createZoneRef.current(createdRect);
      return;
    }

    if (!marqueeStartRef.current) return;
    marqueeStartRef.current = null;
    const current = marqueeRef.current;
    marqueeRef.current = null;
    setMarquee(null);
    if (!dragDidHappenRef.current || !current || !layoutDraft) return;
    const nx = Math.min(current.x1, current.x2);
    const ny = Math.min(current.y1, current.y2);
    const nw = Math.abs(current.x2 - current.x1);
    const nh = Math.abs(current.y2 - current.y1);
    if (nw < 4 || nh < 4) return;
    const matched = Object.values(layoutDraft.racks)
      .filter((rack) => {
        const g = getRackGeometry(rack);
        return g.x < nx + nw && g.x + g.width > nx && g.y < ny + nh && g.y + g.height > ny;
      })
      .map((rack) => rack.id);
    setSelectedRackIdsRef.current(matched);
  }, [layoutDraft]);

  return {
    cancelDrawZone,
    draftZoneRect,
    marquee,
    onMouseDown,
    onMouseMove,
    onMouseUp
  };
}
