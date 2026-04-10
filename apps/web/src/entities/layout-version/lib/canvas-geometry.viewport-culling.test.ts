import { describe, expect, it } from 'vitest';
import type { Rack } from '@wos/domain';
import {
  getZoomToCursorCamera,
  isRackInViewport,
  RACK_VIEWPORT_OVERSCAN_METERS,
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
    expect(isRackInViewport(rack, viewport, canvasOffset, zoom, RACK_VIEWPORT_OVERSCAN_METERS)).toBe(true);
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

    expect(isRackInViewport(rotatedRack, viewportNearRotatedTail, offsetNearRotatedTail, 1, 0)).toBe(true);
  });

  it('keeps a clearly in-view rack visible at zoom 1.0, 1.1, and 0.9 (no overscan masking)', () => {
    const rack = { ...baseRack, x: 3, y: 2, totalLength: 4, depth: 1 };
    const cursor = { x: viewport.width / 2, y: viewport.height / 2 };
    const camera100 = { zoom: 1, offsetX: 0, offsetY: 0 };
    const camera110 = getZoomToCursorCamera(camera100, cursor, 1.1);
    const camera090 = getZoomToCursorCamera(camera100, cursor, 0.9);

    expect(isRackInViewport(rack, viewport, { x: camera100.offsetX, y: camera100.offsetY }, camera100.zoom, 0)).toBe(true);
    expect(isRackInViewport(rack, viewport, { x: camera110.offsetX, y: camera110.offsetY }, camera110.zoom, 0)).toBe(true);
    expect(isRackInViewport(rack, viewport, { x: camera090.offsetX, y: camera090.offsetY }, camera090.zoom, 0)).toBe(true);
  });

  it('keeps a clearly in-view rack visible after pan at zoom 1.1 (no overscan masking)', () => {
    const rack = { ...baseRack, x: 2, y: 2, totalLength: 4, depth: 1 };
    const zoomedCamera = { zoom: 1.1, offsetX: 80, offsetY: 60 };
    const pannedCamera = { zoom: 1.1, offsetX: 40, offsetY: 20 };

    expect(isRackInViewport(rack, viewport, { x: zoomedCamera.offsetX, y: zoomedCamera.offsetY }, zoomedCamera.zoom, 0)).toBe(true);
    expect(isRackInViewport(rack, viewport, { x: pannedCamera.offsetX, y: pannedCamera.offsetY }, pannedCamera.zoom, 0)).toBe(true);
  });
});
