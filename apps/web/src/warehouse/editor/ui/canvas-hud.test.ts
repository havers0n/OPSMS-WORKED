import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { Rack } from '@wos/domain';
import { createLayoutDraftFixture } from '@/warehouse/editor/model/__fixtures__/layout-draft.fixture';
import { CanvasHud } from './canvas-hud';

(
  globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  }
).IS_REACT_ACT_ENVIRONMENT = true;

function createRack(overrides: Partial<Rack> = {}): Rack {
  return {
    ...createLayoutDraftFixture().racks['rack-1'],
    ...overrides
  };
}

function renderHud(rack: Rack) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      createElement(CanvasHud, {
        viewport: { width: 640, height: 480 },
        zoom: 1,
        hintText: 'Layout HUD',
        isLayoutDrawToolActive: false,
        isPlacing: false,
        isDrawingZone: false,
        isPlacementMoveMode: false,
        shouldShowLayoutRackGeometryBar: true,
        shouldShowLayoutRackSideHandles: false,
        shouldShowLayoutZoneBar: false,
        shouldShowLayoutWallBar: false,
        shouldShowStorageCellBar: false,
        selectedRack: rack,
        selectedRackAnchorRect: { x: 120, y: 120, width: 200, height: 48 },
        selectedRackSideFocus: null,
        selectedZone: null,
        selectedZoneAnchorRect: null,
        selectedWall: null,
        selectedWallAnchorRect: null,
        selectedStorageCell: null,
        selectedStorageCellAnchorRect: null,
        onOpenInspector: () => undefined,
        onSelectRackSide: () => undefined,
        onZoomOut: () => undefined,
        onZoomReset: () => undefined,
        onZoomIn: () => undefined
      })
    );
  });

  return renderer;
}

function collectText(node: TestRenderer.ReactTestRendererJSON | TestRenderer.ReactTestRendererJSON[] | null): string {
  if (node === null) return '';
  if (Array.isArray(node)) {
    return node.map((child) => collectText(child)).join(' ');
  }

  return (node.children ?? [])
    .map((child) => (typeof child === 'string' ? child : collectText(child)))
    .join(' ');
}

describe('CanvasHud rack geometry affordance', () => {
  it('does not render rack geometry strip even when rack geometry flag is enabled', () => {
    const renderer = renderHud(
      createRack({
        x: 20,
        y: 30,
        totalLength: 5,
        depth: 1.2,
        rotationDeg: 90
      })
    );

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-geometry-affordance-bar' })).toHaveLength(0);
    const text = collectText(renderer.toJSON());
    expect(text).not.toContain('90°');
  });
});
