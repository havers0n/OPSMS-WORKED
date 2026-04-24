import { describe, expect, it } from 'vitest';
import type { Rack } from '@wos/domain';
import {
  CELL_VIEWPORT_OVERSCAN_PX,
  doCanvasRectsIntersect,
  getCanvasViewportRect,
  getZoomToCursorCamera,
  isRackInViewport,
  projectLocalRackRectToCanvasRect,
  RACK_VIEWPORT_OVERSCAN_METERS,
  shouldRenderCanvasCell,
  WORLD_SCALE
} from './canvas-geometry';

const baseRack: Rack = {
  id: 'rack-1',
  displayCode: 'R-01',
  kind: 'single',
  axis: 'NS',
  x: 0,
  y: 0,
  totalLength: 4,
  depth: 1,
  rotationDeg: 0,
  faces: []
};

// 400x300 viewport at zoom=1 maps to 10m x 7.5m world area.
const viewport = { width: 400, height: 300 };
const canvasOffset = { x: 0, y: 0 };
const zoom = 1;

describe('isRackInViewport', () => {
  it('returns true when rack is fully inside viewport', () => {
    const rack = { ...baseRack, x: 2, y: 2 };
    expect(isRackInViewport(rack, viewport, canvasOffset, zoom, 0)).toBe(true);
  });

  it('returns false when rack is fully outside viewport', () => {
    const rack = { ...baseRack, x: 20, y: 2 };
    expect(isRackInViewport(rack, viewport, canvasOffset, zoom, 0)).toBe(false);
  });

  it('returns true when rack partially intersects viewport edge', () => {
    const rack = { ...baseRack, x: 9.5, y: 2, totalLength: 2 };
    expect(isRackInViewport(rack, viewport, canvasOffset, zoom, 0)).toBe(true);
  });

  it('treats boundary-touch as visible', () => {
    const rack = { ...baseRack, x: 10, y: 2, totalLength: 1 };
    expect(isRackInViewport(rack, viewport, canvasOffset, zoom, 0)).toBe(true);
  });

  it('returns true when outside raw viewport but inside overscan-expanded viewport', () => {
    const rack = { ...baseRack, x: 10.5, y: 2, totalLength: 1 };
    expect(isRackInViewport(rack, viewport, canvasOffset, zoom)).toBe(true);
    expect(
      isRackInViewport(
        rack,
        viewport,
        canvasOffset,
        zoom,
        RACK_VIEWPORT_OVERSCAN_METERS
      )
    ).toBe(true);
  });

  it('returns false when rack is far outside even with overscan', () => {
    const rack = {
      ...baseRack,
      x: 13.1,
      y: 2,
      totalLength: 1
    };
    expect(isRackInViewport(rack, viewport, canvasOffset, zoom)).toBe(false);
  });

  it('uses an enclosing world-space AABB for rotated racks', () => {
    const rotatedRack: Rack = {
      ...baseRack,
      x: 0,
      y: 0,
      totalLength: 4,
      depth: 2,
      rotationDeg: 90
    };

    const viewportNearRotatedTail = {
      width: WORLD_SCALE,
      height: WORLD_SCALE
    };
    const offsetNearRotatedTail = {
      x: -2.4 * WORLD_SCALE,
      y: -2.4 * WORLD_SCALE
    };

    expect(
      isRackInViewport(
        rotatedRack,
        viewportNearRotatedTail,
        offsetNearRotatedTail,
        1,
        0
      )
    ).toBe(true);
  });

  it('keeps a clearly in-view rack visible at zoom 1.0, 1.1, and 0.9 (no overscan masking)', () => {
    const rack = { ...baseRack, x: 3, y: 2, totalLength: 4, depth: 1 };
    const cursor = { x: viewport.width / 2, y: viewport.height / 2 };
    const camera100 = { zoom: 1, offsetX: 0, offsetY: 0 };
    const camera110 = getZoomToCursorCamera(camera100, cursor, 1.1);
    const camera090 = getZoomToCursorCamera(camera100, cursor, 0.9);

    expect(
      isRackInViewport(
        rack,
        viewport,
        { x: camera100.offsetX, y: camera100.offsetY },
        camera100.zoom,
        0
      )
    ).toBe(true);
    expect(
      isRackInViewport(
        rack,
        viewport,
        { x: camera110.offsetX, y: camera110.offsetY },
        camera110.zoom,
        0
      )
    ).toBe(true);
    expect(
      isRackInViewport(
        rack,
        viewport,
        { x: camera090.offsetX, y: camera090.offsetY },
        camera090.zoom,
        0
      )
    ).toBe(true);
  });

  it('keeps a clearly in-view rack visible after pan at zoom 1.1 (no overscan masking)', () => {
    const rack = { ...baseRack, x: 2, y: 2, totalLength: 4, depth: 1 };
    const zoomedCamera = { zoom: 1.1, offsetX: 80, offsetY: 60 };
    const pannedCamera = { zoom: 1.1, offsetX: 40, offsetY: 20 };

    expect(
      isRackInViewport(
        rack,
        viewport,
        { x: zoomedCamera.offsetX, y: zoomedCamera.offsetY },
        zoomedCamera.zoom,
        0
      )
    ).toBe(true);
    expect(
      isRackInViewport(
        rack,
        viewport,
        { x: pannedCamera.offsetX, y: pannedCamera.offsetY },
        pannedCamera.zoom,
        0
      )
    ).toBe(true);
  });
});

const rackGeometry = {
  x: 0,
  y: 0,
  width: 400,
  height: 40,
  faceAWidth: 400,
  faceBWidth: 400,
  centerX: 200,
  centerY: 20,
  isPaired: false,
  spineY: 0
};

describe('cell viewport culling helpers', () => {
  it('derives a canvas viewport rect with fixed pixel overscan', () => {
    expect(getCanvasViewportRect(viewport, canvasOffset, 1, 20)).toEqual({
      x: -20,
      y: -20,
      width: 440,
      height: 340
    });
  });

  it('returns null viewport bounds for invalid camera state', () => {
    expect(getCanvasViewportRect(viewport, canvasOffset, 0)).toBeNull();
    expect(
      getCanvasViewportRect({ width: 0, height: 100 }, canvasOffset, 1)
    ).toBeNull();
  });

  it('treats boundary-touching canvas rects as intersecting', () => {
    expect(
      doCanvasRectsIntersect(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10, y: 4, width: 10, height: 10 }
      )
    ).toBe(true);
  });

  it('projects local cell geometry through rack rotation into canvas space', () => {
    const rect = projectLocalRackRectToCanvasRect(
      { x: 0, y: 0, width: 40, height: 10 },
      rackGeometry,
      90
    );

    expect(rect.x).toBeCloseTo(210);
    expect(rect.y).toBeCloseTo(-180);
    expect(rect.width).toBeCloseTo(10);
    expect(rect.height).toBeCloseTo(40);
  });

  it('renders cells inside, outside, and inside overscan correctly', () => {
    expect(
      shouldRenderCanvasCell({
        cellGeometry: { x: 20, y: 20, width: 20, height: 20 },
        canvasOffset,
        rackGeometry,
        rackRotationDeg: 0,
        viewport,
        zoom
      })
    ).toBe(true);

    expect(
      shouldRenderCanvasCell({
        cellGeometry: { x: 620, y: 20, width: 20, height: 20 },
        canvasOffset,
        overscanPx: 0,
        rackGeometry,
        rackRotationDeg: 0,
        viewport,
        zoom
      })
    ).toBe(false);

    expect(
      shouldRenderCanvasCell({
        cellGeometry: {
          x: viewport.width + CELL_VIEWPORT_OVERSCAN_PX - 8,
          y: 20,
          width: 20,
          height: 20
        },
        canvasOffset,
        rackGeometry,
        rackRotationDeg: 0,
        viewport,
        zoom
      })
    ).toBe(true);
  });

  it('force-renders focused cells outside the viewport', () => {
    expect(
      shouldRenderCanvasCell({
        cellGeometry: { x: 2000, y: 20, width: 20, height: 20 },
        canvasOffset,
        forceVisible: true,
        overscanPx: 0,
        rackGeometry,
        rackRotationDeg: 0,
        viewport,
        zoom
      })
    ).toBe(true);
  });

  it('keeps fixed pixel overscan behavior stable across zoom levels', () => {
    const justInsideOverscanAtNormalZoom = {
      x: 545,
      y: 20,
      width: 10,
      height: 10
    };
    const outsideOverscanWhenZoomedIn = {
      x: 545,
      y: 20,
      width: 10,
      height: 10
    };

    expect(
      shouldRenderCanvasCell({
        cellGeometry: justInsideOverscanAtNormalZoom,
        canvasOffset,
        rackGeometry,
        rackRotationDeg: 0,
        viewport,
        zoom: 1
      })
    ).toBe(true);

    expect(
      shouldRenderCanvasCell({
        cellGeometry: outsideOverscanWhenZoomedIn,
        canvasOffset,
        rackGeometry,
        rackRotationDeg: 0,
        viewport,
        zoom: 2
      })
    ).toBe(false);

    expect(
      shouldRenderCanvasCell({
        cellGeometry: { x: 820, y: 20, width: 10, height: 10 },
        canvasOffset,
        rackGeometry,
        rackRotationDeg: 0,
        viewport,
        zoom: 0.5
      })
    ).toBe(true);
  });

  it('renders all cells when viewport state is invalid', () => {
    expect(
      shouldRenderCanvasCell({
        cellGeometry: { x: 2000, y: 20, width: 20, height: 20 },
        canvasOffset,
        rackGeometry,
        rackRotationDeg: 0,
        viewport: { width: 0, height: 0 },
        zoom
      })
    ).toBe(true);
  });
});
