import { describe, expect, it } from 'vitest';
import type { Rack, Wall } from '@wos/domain';
import {
  clampCanvasPosition,
  clampCanvasZoom,
  getCellCanvasRect,
  getCanvasInteractionLevel,
  getCanvasLOD,
  getRackCanvasRect,
  getRackGeometry,
  getWallCanvasRect,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  projectCanvasRectToViewport,
  RACK_DEPTH_SCALE,
  RACK_LENGTH_SCALE
} from './canvas-geometry';

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

const wall: Wall = {
  id: 'wall-1',
  code: 'W01',
  name: 'Wall 1',
  wallType: 'generic',
  x1: 80,
  y1: 160,
  x2: 200,
  y2: 160,
  blocksRackPlacement: true
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

  it('maps rendering LOD to semantic interaction levels', () => {
    expect(getCanvasInteractionLevel(getCanvasLOD(0.8))).toBe('L1');
    expect(getCanvasInteractionLevel(getCanvasLOD(1.1))).toBe('L1');
    expect(getCanvasInteractionLevel(getCanvasLOD(1.3))).toBe('L3');
  });

  it('derives a selected cell rect from rack/face/section/level structure', () => {
    const cellRack: Rack = {
      ...rack,
      x: 100,
      y: 60,
      rotationDeg: 0,
      faces: [
        {
          id: 'face-a',
          side: 'A',
          enabled: true,
          slotNumberingDirection: 'ltr',
          isMirrored: false,
          mirrorSourceFaceId: null,
          sections: [
            {
              id: 'section-a1',
              ordinal: 1,
              length: 6,
              levels: [{ id: 'level-a1', ordinal: 1, slotCount: 3 }]
            }
          ]
        },
        {
          id: 'face-b',
          side: 'B',
          enabled: true,
          slotNumberingDirection: 'ltr',
          isMirrored: false,
          mirrorSourceFaceId: null,
          sections: []
        }
      ]
    };

    const cellRect = getCellCanvasRect(cellRack, {
        rackId: 'rack-1',
        rackFaceId: 'face-a',
        rackSectionId: 'section-a1',
        rackLevelId: 'level-a1',
        slotNo: 2
      });

    expect(cellRect).not.toBeNull();
    expect(cellRect?.x).toBeCloseTo(156.5);
    expect(cellRect?.y).toBeCloseTo(64.5);
    expect(cellRect?.width).toBeCloseTo(55);
    expect(cellRect?.height).toBeCloseTo(21.8);
  });

  it('projects rotated rack bounds into viewport coordinates', () => {
    const rect = projectCanvasRectToViewport(
      getRackCanvasRect(rack),
      2,
      { x: 12, y: 20 }
    );

    expect(rect.x).toBeCloseTo(358.4);
    expect(rect.y).toBeCloseTo(73.6);
    expect(rect.width).toBeCloseTo(123.2);
    expect(rect.height).toBeCloseTo(336);
  });

  it('derives a wall bounds rect from segment endpoints', () => {
    expect(getWallCanvasRect(wall)).toEqual({
      x: 80,
      y: 160,
      width: 120,
      height: 0
    });
  });
});
