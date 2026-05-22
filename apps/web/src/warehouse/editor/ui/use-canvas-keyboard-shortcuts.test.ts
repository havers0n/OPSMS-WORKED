// @vitest-environment jsdom

import { createElement, useRef } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InteractionScope } from '@/warehouse/editor/model/editor-types';
import { useCanvasKeyboardShortcuts } from './use-canvas-keyboard-shortcuts';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

let renderer: TestRenderer.ReactTestRenderer | null = null;
let cancelPickingPlanRouteStartPlacementLastSpy = vi.fn();

function renderKeyboardHarness(params: {
  isRouteGraphMode: boolean;
  isPickingPlanRouteStartPlacementMode?: boolean;
  selectedRouteGraphElement:
    | { type: 'node' | 'edge'; id: string }
    | null;
  clearRouteGraphInteraction?: () => void;
  deleteRouteGraphNode?: (id: string) => void;
  deleteRouteGraphEdge?: (id: string) => void;
}) {
  const clearRouteGraphInteraction =
    params.clearRouteGraphInteraction ?? vi.fn();
  const deleteRouteGraphNode = params.deleteRouteGraphNode ?? vi.fn();
  const deleteRouteGraphEdge = params.deleteRouteGraphEdge ?? vi.fn();
  const cancelPickingPlanRouteStartPlacement = vi.fn();
  cancelPickingPlanRouteStartPlacementLastSpy = cancelPickingPlanRouteStartPlacement;

  function Harness() {
    useCanvasKeyboardShortcuts({
      isLayoutEditable: false,
      isPlacingRef: useRef(false),
      isDrawingZoneRef: useRef(false),
      isDrawingWallRef: useRef(false),
      isRouteGraphModeRef: useRef(params.isRouteGraphMode),
      isPickingPlanRouteStartPlacementModeRef: useRef(
        params.isPickingPlanRouteStartPlacementMode ?? false
      ),
      interactionScopeRef: useRef<InteractionScope>('idle'),
      cancelPickingPlanRouteStartPlacementRef: useRef(
        cancelPickingPlanRouteStartPlacement
      ),
      cancelPlacementInteractionRef: useRef(() => undefined),
      clearSelectionRef: useRef(() => undefined),
      selectedRackIdsRef: useRef([]),
      selectedZoneIdRef: useRef<string | null>(null),
      selectedWallIdRef: useRef<string | null>(null),
      deleteZoneRef: useRef(() => undefined),
      deleteWallRef: useRef(() => undefined),
      selectedRouteGraphElementRef: useRef(params.selectedRouteGraphElement),
      clearRouteGraphInteractionRef: useRef(clearRouteGraphInteraction),
      deleteRouteGraphNodeRef: useRef(deleteRouteGraphNode),
      deleteRouteGraphEdgeRef: useRef(deleteRouteGraphEdge),
      cancelDrawZone: () => undefined,
      cancelDrawWall: () => undefined,
      setEditorMode: () => undefined,
      clearHighlightedCellIds: () => undefined
    });
    return null;
  }

  act(() => {
    renderer = TestRenderer.create(createElement(Harness));
  });
}

afterEach(() => {
  if (!renderer) return;
  act(() => {
    renderer?.unmount();
    renderer = null;
  });
});

describe('useCanvasKeyboardShortcuts route graph scope', () => {
  it('deletes a selected route graph node', () => {
    const deleteRouteGraphNode = vi.fn();
    const clearRouteGraphInteraction = vi.fn();
    renderKeyboardHarness({
      isRouteGraphMode: true,
      selectedRouteGraphElement: { type: 'node', id: 'node-1' },
      deleteRouteGraphNode,
      clearRouteGraphInteraction
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });

    expect(deleteRouteGraphNode).toHaveBeenCalledWith('node-1');
    expect(clearRouteGraphInteraction).toHaveBeenCalledTimes(1);
  });

  it('deletes a selected route graph edge', () => {
    const deleteRouteGraphEdge = vi.fn();
    const clearRouteGraphInteraction = vi.fn();
    renderKeyboardHarness({
      isRouteGraphMode: true,
      selectedRouteGraphElement: { type: 'edge', id: 'edge-1' },
      deleteRouteGraphEdge,
      clearRouteGraphInteraction
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    });

    expect(deleteRouteGraphEdge).toHaveBeenCalledWith('edge-1');
    expect(clearRouteGraphInteraction).toHaveBeenCalledTimes(1);
  });

  it('clears route graph pending state and selection on Escape', () => {
    const clearRouteGraphInteraction = vi.fn();
    renderKeyboardHarness({
      isRouteGraphMode: true,
      selectedRouteGraphElement: { type: 'node', id: 'node-1' },
      clearRouteGraphInteraction
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(clearRouteGraphInteraction).toHaveBeenCalledTimes(1);
  });

  it('does not handle route graph deletion outside the route graph stage', () => {
    const deleteRouteGraphNode = vi.fn();
    renderKeyboardHarness({
      isRouteGraphMode: false,
      selectedRouteGraphElement: { type: 'node', id: 'node-1' },
      deleteRouteGraphNode
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
    });

    expect(deleteRouteGraphNode).not.toHaveBeenCalled();
  });

  it('cancels picking-plan start placement on Escape', () => {
    const clearRouteGraphInteraction = vi.fn();
    renderKeyboardHarness({
      isRouteGraphMode: false,
      isPickingPlanRouteStartPlacementMode: true,
      selectedRouteGraphElement: null,
      clearRouteGraphInteraction
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(clearRouteGraphInteraction).not.toHaveBeenCalled();
    expect(cancelPickingPlanRouteStartPlacementLastSpy).toHaveBeenCalledTimes(1);
  });
});
