import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type Konva from 'konva';
import type { LayoutDraft } from '@wos/domain';
import type { InteractionScope } from '@/widgets/warehouse-editor/model/editor-types';
import {
  type CanvasRect,
  getRackGeometry,
  GRID_SIZE,
  WORLD_SCALE
} from '@/entities/layout-version/lib/canvas-geometry';
import { MIN_ZONE_SIZE } from './zone-layer';

type MarqueeRect = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type DraftWallLine = {
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
  createFreeWall: (x1: number, y1: number, x2: number, y2: number) => void;
  interactionScope: InteractionScope;
  isDrawingWall: boolean;
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
  createFreeWall,
  interactionScope,
  isDrawingWall,
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
  const [draftWallLine, setDraftWallLine] = useState<DraftWallLine | null>(null);
  const draftWallLineRef = useRef<DraftWallLine | null>(null);
  const draftWallStartRef = useRef<{ x: number; y: number } | null>(null);
  // Set to true on the first mousemove past threshold; cleared by click.canvas handler.
  const dragDidHappenRef = useRef(false);

  const isPlacingRef = useRef(isPlacing);
  isPlacingRef.current = isPlacing;
  const isDrawingZoneRef = useRef(isDrawingZone);
  isDrawingZoneRef.current = isDrawingZone;
  const isDrawingWallRef = useRef(isDrawingWall);
  isDrawingWallRef.current = isDrawingWall;
  const interactionScopeRef = useRef(interactionScope);
  interactionScopeRef.current = interactionScope;
  const createRackRef = useRef(createRack);
  createRackRef.current = createRack;
  const createZoneRef = useRef(createZone);
  createZoneRef.current = createZone;
  const createFreeWallRef = useRef(createFreeWall);
  createFreeWallRef.current = createFreeWall;
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

  const cancelDrawWall = useCallback(() => {
    draftWallStartRef.current = null;
    draftWallLineRef.current = null;
    setDraftWallLine(null);
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
        // Convert canvas pixels → metres, snapped to 1 m grid
        createRackRef.current(
          Math.round(pos.x / WORLD_SCALE),
          Math.round(pos.y / WORLD_SCALE)
        );
      } else if (isDrawingZoneRef.current || isDrawingWallRef.current) {
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
    // Empty-canvas drags in layout mode are either zone/wall creation or marquee selection.
    // Rack/zone/wall groups suppress this via cancelBubble on their own onMouseDown.
    if (event.evt.button !== 0 || !isLayoutMode || isPlacing) return;
    const pos = stageRef.current?.getRelativePointerPosition();
    if (!pos) return;

    if (isDrawingZone) {
      // snap to 1 m grid in metres
      const x = Math.round(pos.x / WORLD_SCALE);
      const y = Math.round(pos.y / WORLD_SCALE);
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

    if (isDrawingWall) {
      // snap to 1 m grid in metres
      const x = Math.round(pos.x / WORLD_SCALE);
      const y = Math.round(pos.y / WORLD_SCALE);
      draftWallStartRef.current = { x, y };
      dragDidHappenRef.current = false;
      return;
    }

    marqueeStartRef.current = { x: pos.x, y: pos.y };
    dragDidHappenRef.current = false;
  }, [isDrawingWall, isDrawingZone, isLayoutMode, isPlacing, stageRef]);

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
      // metres, snapped to 1 m grid
      const x2 = Math.round(pos.x / WORLD_SCALE);
      const y2 = Math.round(pos.y / WORLD_SCALE);
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

    if (draftWallStartRef.current) {
      const pos = stageRef.current?.getRelativePointerPosition();
      if (!pos) return;
      const dx = pos.x - draftWallStartRef.current.x;
      const dy = pos.y - draftWallStartRef.current.y;
      if (!dragDidHappenRef.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) return;
      dragDidHappenRef.current = true;
      // metres, snapped to 1 m grid
      const snapX2 = Math.round(pos.x / WORLD_SCALE);
      const snapY2 = Math.round(pos.y / WORLD_SCALE);
      const absDx = Math.abs(snapX2 - draftWallStartRef.current.x);
      const absDy = Math.abs(snapY2 - draftWallStartRef.current.y);
      const isHorizontal = absDx >= absDy;
      const nextLine: DraftWallLine = isHorizontal
        ? { x1: draftWallStartRef.current.x, y1: draftWallStartRef.current.y, x2: snapX2, y2: draftWallStartRef.current.y }
        : { x1: draftWallStartRef.current.x, y1: draftWallStartRef.current.y, x2: draftWallStartRef.current.x, y2: snapY2 };
      draftWallLineRef.current = nextLine;
      setDraftWallLine(nextLine);
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

    if (draftWallStartRef.current) {
      draftWallStartRef.current = null;
      const line = draftWallLineRef.current;
      draftWallLineRef.current = null;
      setDraftWallLine(null);
      if (!dragDidHappenRef.current || !line) return;
      createFreeWallRef.current(line.x1, line.y1, line.x2, line.y2);
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
    cancelDrawWall,
    cancelDrawZone,
    draftWallLine,
    draftZoneRect,
    marquee,
    onMouseDown,
    onMouseMove,
    onMouseUp
  };
}
