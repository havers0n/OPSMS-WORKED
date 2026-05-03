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
  getZoomToCursorCamera,
  getWallCanvasRect,
  LOD_CELL_ENTRY,
  LOD_CELL_THRESHOLD,
  LOD_HYSTERESIS,
  LOD_SECTION_THRESHOLD,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  projectCanvasRectToViewport,
  WORLD_SCALE
} from '@/entities/layout-version/lib/canvas-geometry';

// Rack position in metres. WORLD_SCALE=40 → canvas x=120px, y=80px.
const rack: Rack = {
  id: 'rack-1',
  displayCode: '03',
  kind: 'paired',
  axis: 'NS',
  x: 3,   // 3 m → 120 px
  y: 2,   // 2 m → 80 px
  totalLength: 6,
  depth: 1.4,
  rotationDeg: 90,
  faces: []
};

// Wall endpoints in metres. WORLD_SCALE=40 → same pixel rect as the old pixel fixture.
const wall: Wall = {
  id: 'wall-1',
  code: 'W01',
  name: 'Wall 1',
  wallType: 'generic',
  x1: 2,   // 2 m → 80 px
  y1: 4,   // 4 m → 160 px
  x2: 5,   // 5 m → 200 px
  y2: 4,   // 4 m → 160 px
  blocksRackPlacement: true
};

describe('canvas geometry helpers', () => {
  it('maps rack dimensions into canvas pixels', () => {
    const geometry = getRackGeometry(rack);

    expect(geometry.width).toBe(6 * WORLD_SCALE);          // 240 px
    expect(geometry.height).toBe(1.4 * WORLD_SCALE);       // 56 px
    expect(geometry.centerX).toBe(geometry.width / 2);
    expect(geometry.centerY).toBe(geometry.height / 2);
    // faceAWidth and faceBWidth both equal rack.totalLength when no per-face override is set
    expect(geometry.faceAWidth).toBe(6 * WORLD_SCALE);
    expect(geometry.faceBWidth).toBe(6 * WORLD_SCALE);
    // position: metres × WORLD_SCALE → pixels
    expect(geometry.x).toBe(3 * WORLD_SCALE);              // 120 px
    expect(geometry.y).toBe(2 * WORLD_SCALE);              // 80 px
  });

  it('keeps the non-negative floor helper behavior for placement-only callers', () => {
    expect(clampCanvasPosition(42)).toBe(42);
    expect(clampCanvasPosition(-5)).toBe(0);
  });

  it('clamps zoom into the supported canvas range', () => {
    expect(clampCanvasZoom(1)).toBe(1);
    expect(clampCanvasZoom(0.1)).toBe(MIN_CANVAS_ZOOM);
    expect(clampCanvasZoom(5)).toBe(MAX_CANVAS_ZOOM);
  });

  it('clamps zoom into caller-provided canvas bounds', () => {
    expect(clampCanvasZoom(0.4, { minZoom: 0.2, maxZoom: 2 })).toBe(0.4);
    expect(clampCanvasZoom(0.1, { minZoom: 0.2, maxZoom: 2 })).toBe(0.2);
    expect(clampCanvasZoom(3, { minZoom: 0.2, maxZoom: 2 })).toBe(2);
  });

  it('keeps the canvas point under the cursor stable after zoom', () => {
    const camera = { zoom: 1, offsetX: 120, offsetY: -80 };
    const cursor = { x: 350, y: 240 };
    const nextCamera = getZoomToCursorCamera(camera, cursor, 1.4);

    const worldBefore = {
      x: (cursor.x - camera.offsetX) / camera.zoom,
      y: (cursor.y - camera.offsetY) / camera.zoom
    };
    const worldAfter = {
      x: (cursor.x - nextCamera.offsetX) / nextCamera.zoom,
      y: (cursor.y - nextCamera.offsetY) / nextCamera.zoom
    };

    expect(nextCamera.zoom).toBe(1.4);
    expect(worldAfter.x).toBeCloseTo(worldBefore.x);
    expect(worldAfter.y).toBeCloseTo(worldBefore.y);
  });

  it('maps rendering LOD to semantic interaction levels', () => {
    expect(getCanvasInteractionLevel(getCanvasLOD(0.8))).toBe('L1');  // LOD 0
    expect(getCanvasInteractionLevel(getCanvasLOD(1.1))).toBe('L1');  // LOD 1
    // At exactly the old threshold (1.3) without prevLod, LOD stays at 1 —
    // hysteresis requires 1.325 to upgrade from prevLod=0.
    expect(getCanvasInteractionLevel(getCanvasLOD(1.3))).toBe('L1');
    expect(getCanvasInteractionLevel(getCanvasLOD(1.4))).toBe('L3');  // LOD 2
  });

  describe('getCanvasLOD — hysteresis', () => {
    const half = LOD_HYSTERESIS / 2;

    it('requires zoom ≥ threshold + half-band to upgrade LOD 0 → 1', () => {
      // Exactly at the old hard threshold: stays LOD 0 when coming from below.
      expect(getCanvasLOD(LOD_SECTION_THRESHOLD, 0)).toBe(0);
      // One epsilon above the up-crossing point: upgrades.
      expect(getCanvasLOD(LOD_SECTION_THRESHOLD + half, 0)).toBe(1);
    });

    it('stays LOD 1 down to threshold − half-band when downgrading', () => {
      // Just above the down-crossing point: remains LOD 1.
      expect(getCanvasLOD(LOD_SECTION_THRESHOLD - half + 0.001, 1)).toBe(1);
      // Just below the down-crossing point: drops to LOD 0.
      expect(getCanvasLOD(LOD_SECTION_THRESHOLD - half - 0.001, 1)).toBe(0);
    });

    it('requires zoom ≥ threshold + half-band to upgrade LOD 1 → 2', () => {
      // Exactly at the old hard threshold: stays LOD 1 when coming from below.
      expect(getCanvasLOD(LOD_CELL_THRESHOLD, 1)).toBe(1);
      // At the up-crossing point: upgrades.
      expect(getCanvasLOD(LOD_CELL_THRESHOLD + half, 1)).toBe(2);
    });

    it('stays LOD 2 down to threshold − half-band when downgrading', () => {
      // Just above the down-crossing point: remains LOD 2.
      expect(getCanvasLOD(LOD_CELL_THRESHOLD - half + 0.001, 2)).toBe(2);
      // Just below the down-crossing point: drops to LOD 1.
      expect(getCanvasLOD(LOD_CELL_THRESHOLD - half - 0.001, 2)).toBe(1);
    });

    it('LOD_CELL_ENTRY guarantees LOD 2 entry from any previous LOD', () => {
      // Auto-fit uses LOD_CELL_ENTRY as minimum zoom to ensure cells are visible.
      // Must hold for prevLod 0 (skips LOD 1 entirely), 1 (normal up-crossing), and 2 (already there).
      expect(getCanvasLOD(LOD_CELL_ENTRY, 0)).toBe(2);
      expect(getCanvasLOD(LOD_CELL_ENTRY, 1)).toBe(2);
      expect(getCanvasLOD(LOD_CELL_ENTRY, 2)).toBe(2);
    });
  });

  it('derives a selected cell rect from rack/face/section/level structure', () => {
    // Rack at origin (0 m, 0 m), kind=paired, totalLength=6 m, depth=1.4 m
    // WORLD_SCALE=40: geometry.x=0, y=0, width=240 px, height=56 px
    // Face A: bandY=0, bandHeight=spineY=28, cellHeight=28-8=20
    // 1 section of 6 m → full width 240 px; 1 level; 3 slots
    // slotNo=2 (ltr) → slotIndex=1; slotWidth=80 px
    // cellRect.x = 0 + 0 + 1*80 + 0.5 = 80.5; cellRect.y = 0 + 0 + 4 + 0 + 0.5 = 4.5
    const cellRack: Rack = {
      ...rack,
      x: 0,
      y: 0,
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
    expect(cellRect?.x).toBeCloseTo(80.5);
    expect(cellRect?.y).toBeCloseTo(4.5);
    expect(cellRect?.width).toBeCloseTo(79);
    expect(cellRect?.height).toBeCloseTo(19);
  });

  it('projects rotated rack bounds into viewport coordinates', () => {
    // rack at (3 m, 2 m) = (120 px, 80 px), 6 m × 1.4 m = 240 × 56 px, rotated 90°
    // After rotation around centre (240, 108): canvas rect ≈ {x:212, y:-12, w:56, h:240}
    // After projectCanvasRectToViewport(zoom=2, offset={x:12,y:20}):
    //   x = 212*2+12 = 436, y = -12*2+20 = -4, w = 56*2 = 112, h = 240*2 = 480
    const rect = projectCanvasRectToViewport(
      getRackCanvasRect(rack),
      2,
      { x: 12, y: 20 }
    );

    expect(rect.x).toBeCloseTo(436);
    expect(rect.y).toBeCloseTo(-4);
    expect(rect.width).toBeCloseTo(112);
    expect(rect.height).toBeCloseTo(480);
  });

  it('derives a wall bounds rect from segment endpoints', () => {
    // wall: x1=2m→80px, y1=4m→160px, x2=5m→200px, y2=4m→160px
    // getWallCanvasRect multiplies by WORLD_SCALE
    expect(getWallCanvasRect(wall)).toEqual({
      x: 80,
      y: 160,
      width: 120,
      height: 0
    });
  });
});
