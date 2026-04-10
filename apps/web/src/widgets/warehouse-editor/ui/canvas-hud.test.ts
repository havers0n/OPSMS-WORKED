import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';
import type { Rack } from '@wos/domain';
import { createLayoutDraftFixture } from '@/widgets/warehouse-editor/model/__fixtures__/layout-draft.fixture';
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
  it('renders the compact geometry-only strip for the selected rack', () => {
    const renderer = renderHud(
      createRack({
        x: 20,
        y: 30,
        totalLength: 5,
        depth: 1.2,
        rotationDeg: 90
      })
    );

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-geometry-affordance-bar' })).toHaveLength(1);
    const text = collectText(renderer.toJSON());

    expect(text).toContain('X');
    expect(text).toContain('20.00');
    expect(text).toContain('Y');
    expect(text).toContain('30.00');
    expect(text).toContain('L');
    expect(text).toContain('5.0');
    expect(text).toContain('D');
    expect(text).toContain('1.2');
    expect(text).toContain('R');
    expect(text).toContain('90°');
    expect(text).not.toContain('Inspect');
    expect(text).not.toContain('Display Code');
  });

  it('updates displayed geometry values when the selected rack geometry changes', () => {
    const renderer = renderHud(
      createRack({
        x: 20,
        y: 30,
        totalLength: 5,
        depth: 1.2,
        rotationDeg: 0
      })
    );

    act(() => {
      renderer.update(
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
          selectedRack: createRack({
            x: 42.25,
            y: 18.5,
            totalLength: 7.5,
            depth: 1.8,
            rotationDeg: 180
          }),
          selectedRackAnchorRect: { x: 260, y: 24, width: 200, height: 48 },
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

    expect(renderer.root.findAllByProps({ 'data-testid': 'rack-geometry-affordance-bar' })).toHaveLength(1);
    const text = collectText(renderer.toJSON());

    expect(text).toContain('42.25');
    expect(text).toContain('18.50');
    expect(text).toContain('7.5');
    expect(text).toContain('1.8');
    expect(text).toContain('180°');
  });
});
