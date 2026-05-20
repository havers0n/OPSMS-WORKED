import { createElement, useRef } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type Konva from 'konva';
import { useCanvasStageInteractions } from './use-canvas-stage-interactions';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

type ClickHandler = () => void;

function createStageMock(
  relativePointerPosition: { x: number; y: number } = { x: 10, y: 20 }
) {
  const handlers = new Map<string, ClickHandler>();
  let pointerPosition = relativePointerPosition;
  const stage = {
    getPointerPosition: vi.fn(() => ({ x: 410, y: 620 })),
    getRelativePointerPosition: vi.fn(() => pointerPosition),
    on: vi.fn((eventName: string, handler: ClickHandler) => {
      handlers.set(eventName, handler);
    }),
    off: vi.fn((eventName: string) => {
      handlers.delete(eventName);
    })
  };

  return {
    stage: stage as unknown as Konva.Stage,
    setPointerPosition(nextPointerPosition: { x: number; y: number }) {
      pointerPosition = nextPointerPosition;
    },
    trigger(eventName: string) {
      handlers.get(eventName)?.();
    }
  };
}

function renderHookHarness(params: {
  interactionScope: 'idle' | 'object' | 'workflow';
  clearSelection: () => void;
  clearHighlightedCellIds: () => void;
  cancelPlacementInteraction: () => void;
  createFreeWall?: (x1: number, y1: number, x2: number, y2: number) => boolean;
  isDrawingWall?: boolean;
  isLayoutMode?: boolean;
  isObstacleRouteMode?: boolean;
  isRouteGraphMode?: boolean;
  onObstacleRouteEmptyCanvasClick?: (point: { x: number; y: number }) => void;
  onRouteGraphEmptyCanvasClick?: (point: { x: number; y: number }) => void;
}) {
  const stageMock = createStageMock();
  let interactions!: ReturnType<typeof useCanvasStageInteractions>;

  function Harness() {
    const stageRef = useRef<Konva.Stage | null>(stageMock.stage);
    interactions = useCanvasStageInteractions({
      cancelPlacementInteraction: params.cancelPlacementInteraction,
      clearHighlightedCellIds: params.clearHighlightedCellIds,
      clearSelection: params.clearSelection,
      createRack: () => undefined,
      createZone: () => undefined,
      createFreeWall: params.createFreeWall ?? (() => false),
      interactionScope: params.interactionScope,
      isDrawingWall: params.isDrawingWall ?? false,
      isDrawingZone: false,
      isLayoutMode: params.isLayoutMode ?? false,
      isObstacleRouteMode: params.isObstacleRouteMode ?? false,
      isPlacing: false,
      isRouteGraphMode: params.isRouteGraphMode ?? false,
      layoutDraft: null,
      setSelectedRackIds: () => undefined,
      stageRef,
      viewport: { width: 1000, height: 800 },
      onObstacleRouteEmptyCanvasClick: params.onObstacleRouteEmptyCanvasClick,
      onRouteGraphEmptyCanvasClick: params.onRouteGraphEmptyCanvasClick
    });
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });

  return { renderer, stageMock, getInteractions: () => interactions };
}

describe('useCanvasStageInteractions empty canvas clicks', () => {
  it('clears selection and highlights in non-workflow scope', () => {
    const clearSelection = vi.fn();
    const clearHighlightedCellIds = vi.fn();
    const cancelPlacementInteraction = vi.fn();

    const { stageMock } = renderHookHarness({
      interactionScope: 'object',
      clearSelection,
      clearHighlightedCellIds,
      cancelPlacementInteraction
    });

    act(() => {
      stageMock.trigger('click.canvas');
    });

    expect(clearSelection).toHaveBeenCalledTimes(1);
    expect(clearHighlightedCellIds).toHaveBeenCalledTimes(1);
    expect(cancelPlacementInteraction).not.toHaveBeenCalled();
  });

  it('cancels workflow and clears highlights in workflow scope', () => {
    const clearSelection = vi.fn();
    const clearHighlightedCellIds = vi.fn();
    const cancelPlacementInteraction = vi.fn();

    const { stageMock } = renderHookHarness({
      interactionScope: 'workflow',
      clearSelection,
      clearHighlightedCellIds,
      cancelPlacementInteraction
    });

    act(() => {
      stageMock.trigger('click.canvas');
    });

    expect(cancelPlacementInteraction).toHaveBeenCalledTimes(1);
    expect(clearHighlightedCellIds).toHaveBeenCalledTimes(1);
    expect(clearSelection).not.toHaveBeenCalled();
  });

  it('routes empty canvas clicks to route graph creation with world coordinates', () => {
    const clearSelection = vi.fn();
    const clearHighlightedCellIds = vi.fn();
    const cancelPlacementInteraction = vi.fn();
    const onRouteGraphEmptyCanvasClick = vi.fn();

    const { stageMock } = renderHookHarness({
      interactionScope: 'object',
      clearSelection,
      clearHighlightedCellIds,
      cancelPlacementInteraction,
      isRouteGraphMode: true,
      onRouteGraphEmptyCanvasClick
    });

    act(() => {
      stageMock.trigger('click.canvas');
    });

    expect(onRouteGraphEmptyCanvasClick).toHaveBeenCalledWith({
      x: 0.25,
      y: 0.5
    });
    expect(clearSelection).not.toHaveBeenCalled();
    expect(clearHighlightedCellIds).not.toHaveBeenCalled();
  });

  it('routes empty canvas clicks to obstacle route planning with world coordinates', () => {
    const clearSelection = vi.fn();
    const clearHighlightedCellIds = vi.fn();
    const cancelPlacementInteraction = vi.fn();
    const onObstacleRouteEmptyCanvasClick = vi.fn();

    const { stageMock } = renderHookHarness({
      interactionScope: 'object',
      clearSelection,
      clearHighlightedCellIds,
      cancelPlacementInteraction,
      isObstacleRouteMode: true,
      onObstacleRouteEmptyCanvasClick
    });

    act(() => {
      stageMock.trigger('click.canvas');
    });

    expect(onObstacleRouteEmptyCanvasClick).toHaveBeenCalledWith({
      x: 0.25,
      y: 0.5
    });
    expect(clearSelection).not.toHaveBeenCalled();
    expect(clearHighlightedCellIds).not.toHaveBeenCalled();
  });

  it('keeps route graph empty clicks isolated from obstacle route behavior', () => {
    const onObstacleRouteEmptyCanvasClick = vi.fn();
    const onRouteGraphEmptyCanvasClick = vi.fn();

    const { stageMock } = renderHookHarness({
      interactionScope: 'object',
      clearSelection: vi.fn(),
      clearHighlightedCellIds: vi.fn(),
      cancelPlacementInteraction: vi.fn(),
      isObstacleRouteMode: true,
      isRouteGraphMode: true,
      onObstacleRouteEmptyCanvasClick,
      onRouteGraphEmptyCanvasClick
    });

    act(() => {
      stageMock.trigger('click.canvas');
    });

    expect(onRouteGraphEmptyCanvasClick).toHaveBeenCalledTimes(1);
    expect(onObstacleRouteEmptyCanvasClick).not.toHaveBeenCalled();
  });

  it('uses transform-aware relative pointer coordinates for route graph empty clicks', () => {
    const clearSelection = vi.fn();
    const clearHighlightedCellIds = vi.fn();
    const cancelPlacementInteraction = vi.fn();
    const onRouteGraphEmptyCanvasClick = vi.fn();
    const stageMock = createStageMock({ x: 240, y: 320 });

    function Harness() {
      const stageRef = useRef<Konva.Stage | null>(stageMock.stage);
      useCanvasStageInteractions({
        cancelPlacementInteraction,
        clearHighlightedCellIds,
        clearSelection,
        createRack: () => undefined,
        createZone: () => undefined,
        createFreeWall: () => false,
        interactionScope: 'object',
        isDrawingWall: false,
        isDrawingZone: false,
        isLayoutMode: false,
        isObstacleRouteMode: false,
        isPlacing: false,
        isRouteGraphMode: true,
        layoutDraft: null,
        setSelectedRackIds: () => undefined,
        stageRef,
        viewport: { width: 1000, height: 800 },
        onRouteGraphEmptyCanvasClick
      });
      return null;
    }

    act(() => {
      TestRenderer.create(createElement(Harness));
    });
    act(() => {
      stageMock.trigger('click.canvas');
    });

    expect(stageMock.stage.getRelativePointerPosition).toHaveBeenCalledTimes(1);
    expect(stageMock.stage.getPointerPosition).not.toHaveBeenCalled();
    expect(onRouteGraphEmptyCanvasClick).toHaveBeenCalledWith({
      x: 6,
      y: 8
    });
  });
});

describe('useCanvasStageInteractions free wall drawing', () => {
  const mouseEvent = {
    evt: {
      button: 0
    }
  } as Konva.KonvaEventObject<MouseEvent>;

  it('uses world-metre distance for free wall drag threshold', () => {
    const createFreeWall = vi.fn(() => true);
    const { stageMock, getInteractions } = renderHookHarness({
      interactionScope: 'idle',
      clearSelection: vi.fn(),
      clearHighlightedCellIds: vi.fn(),
      cancelPlacementInteraction: vi.fn(),
      createFreeWall,
      isDrawingWall: true,
      isLayoutMode: true
    });

    act(() => {
      stageMock.setPointerPosition({ x: 4000, y: 0 });
      getInteractions().onMouseDown(mouseEvent);
      stageMock.setPointerPosition({ x: 4020, y: 0 });
      getInteractions().onMouseMove();
      getInteractions().onMouseUp();
    });

    expect(createFreeWall).not.toHaveBeenCalled();
  });

  it('creates a free wall after a valid world-metre drag', () => {
    const createFreeWall = vi.fn(() => true);
    const { stageMock, getInteractions } = renderHookHarness({
      interactionScope: 'idle',
      clearSelection: vi.fn(),
      clearHighlightedCellIds: vi.fn(),
      cancelPlacementInteraction: vi.fn(),
      createFreeWall,
      isDrawingWall: true,
      isLayoutMode: true
    });

    act(() => {
      stageMock.setPointerPosition({ x: 4000, y: 0 });
      getInteractions().onMouseDown(mouseEvent);
      stageMock.setPointerPosition({ x: 4060, y: 0 });
      getInteractions().onMouseMove();
      getInteractions().onMouseUp();
    });

    expect(createFreeWall).toHaveBeenCalledWith(100, 0, 102, 0);
  });
});
