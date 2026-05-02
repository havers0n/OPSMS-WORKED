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

function createStageMock() {
  const handlers = new Map<string, ClickHandler>();
  const stage = {
    getRelativePointerPosition: vi.fn(() => ({ x: 10, y: 20 })),
    on: vi.fn((eventName: string, handler: ClickHandler) => {
      handlers.set(eventName, handler);
    }),
    off: vi.fn((eventName: string) => {
      handlers.delete(eventName);
    })
  };

  return {
    stage: stage as unknown as Konva.Stage,
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
}) {
  const stageMock = createStageMock();

  function Harness() {
    const stageRef = useRef<Konva.Stage | null>(stageMock.stage);
    useCanvasStageInteractions({
      cancelPlacementInteraction: params.cancelPlacementInteraction,
      clearHighlightedCellIds: params.clearHighlightedCellIds,
      clearSelection: params.clearSelection,
      createRack: () => undefined,
      createZone: () => undefined,
      createFreeWall: () => undefined,
      interactionScope: params.interactionScope,
      isDrawingWall: false,
      isDrawingZone: false,
      isLayoutMode: false,
      isPlacing: false,
      layoutDraft: null,
      setSelectedRackIds: () => undefined,
      stageRef,
      viewport: { width: 1000, height: 800 }
    });
    return null;
  }

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });

  return { renderer, stageMock };
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
});
