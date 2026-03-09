import { describe, expect, it } from 'vitest';
import type { Rack } from '@wos/domain';
import { clampCanvasPosition, clampCanvasZoom, getRackGeometry, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, RACK_DEPTH_SCALE, RACK_LENGTH_SCALE } from './canvas-geometry';

const rack: Rack = {
  id: 'rack-1',
  displayCode: '03',
  kind: 'paired',
  axis: 'NS',
  x: 120,
  y: 80,
  totalLength: 6,
  depth: 1.4,
  rotationDeg: 90,
  faces: []
};

describe('canvas geometry helpers', () => {
  it('maps rack dimensions into canvas pixels', () => {
    const geometry = getRackGeometry(rack);

    expect(geometry.width).toBe(6 * RACK_LENGTH_SCALE);
    expect(geometry.height).toBe(1.4 * RACK_DEPTH_SCALE);
    expect(geometry.centerX).toBe(geometry.width / 2);
    expect(geometry.centerY).toBe(geometry.height / 2);
    // faceAWidth and faceBWidth both equal rack.totalLength when no per-face override is set
    expect(geometry.faceAWidth).toBe(6 * RACK_LENGTH_SCALE);
    expect(geometry.faceBWidth).toBe(6 * RACK_LENGTH_SCALE);
  });

  it('clamps drag coordinates to non-negative values', () => {
    expect(clampCanvasPosition(42)).toBe(42);
    expect(clampCanvasPosition(-5)).toBe(0);
  });

  it('clamps zoom into the supported canvas range', () => {
    expect(clampCanvasZoom(1)).toBe(1);
    expect(clampCanvasZoom(0.1)).toBe(MIN_CANVAS_ZOOM);
    expect(clampCanvasZoom(5)).toBe(MAX_CANVAS_ZOOM);
  });
});
