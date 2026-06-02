import { describe, expect, it } from 'vitest';
import type { Cell, Rack } from '@wos/domain';
import {
  getCellCanvasRect,
  getRackCanvasRect,
  LOD_CELL_ENTRY,
} from '@/entities/layout-version/lib/canvas-geometry';
import { resolveStorageCameraTarget } from './storage-camera-focus';
import type { StorageCameraFocusRequest } from './storage-focus-store';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const rack: Rack = {
  id: 'rack-1',
  displayCode: '01',
  kind: 'paired',
  axis: 'NS',
  x: 10,
  y: 10,
  totalLength: 6,
  depth: 1.4,
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
          levels: [{ id: 'level-a1', ordinal: 1, slotCount: 3 }],
        },
      ],
    },
    {
      id: 'face-b',
      side: 'B',
      enabled: true,
      slotNumberingDirection: 'ltr',
      isMirrored: false,
      mirrorSourceFaceId: null,
      sections: [],
    },
  ],
};

const rotatedRack: Rack = {
  ...rack,
  id: 'rack-rotated',
  rotationDeg: 90,
};

const cell: Cell = {
  id: 'cell-1',
  layoutVersionId: 'layout-1',
  rackId: 'rack-1',
  rackFaceId: 'face-a',
  rackSectionId: 'section-a1',
  rackLevelId: 'level-a1',
  slotNo: 2,
  address: {
    raw: '01-A.01.01.02',
    parts: { rackCode: '01', face: 'A', section: 1, level: 1, slot: 2 },
    sortKey: '0001-A-01-01-02',
  },
  status: 'active',
  cellCode: '01-A.01.01.02',
};

const request: StorageCameraFocusRequest = {
  requestId: 1,
  source: 'storage-global-search',
  rackId: 'rack-1',
  cellId: 'cell-1',
};

const viewport = { width: 800, height: 600 };

type CameraTarget = { zoom: number; offsetX: number; offsetY: number };

function assertCameraTarget(
  target: CameraTarget | null,
): asserts target is CameraTarget {
  expect(target).not.toBeNull();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveStorageCameraTarget', () => {
  it('1: cell geometry resolved — centers cell center in viewport', () => {
    const cellRect = getCellCanvasRect(rack, {
      rackId: cell.rackId,
      rackFaceId: cell.rackFaceId,
      rackSectionId: cell.rackSectionId,
      rackLevelId: cell.rackLevelId,
      slotNo: cell.slotNo,
    });
    expect(cellRect).not.toBeNull();

    const centerX = cellRect!.x + cellRect!.width / 2;
    const centerY = cellRect!.y + cellRect!.height / 2;

    const target = resolveStorageCameraTarget(
      request,
      [rack],
      new Map([['cell-1', cell]]),
      viewport,
      1,
    );
    assertCameraTarget(target);

    // Viewport center should align with cell world center * zoom
    expect(target.offsetX).toBeCloseTo(viewport.width / 2 - centerX * target.zoom);
    expect(target.offsetY).toBeCloseTo(viewport.height / 2 - centerY * target.zoom);
  });

  it('2: current zoom below LOD_CELL_ENTRY — cell focus forces LOD_CELL_ENTRY', () => {
    const target = resolveStorageCameraTarget(
      request,
      [rack],
      new Map([['cell-1', cell]]),
      viewport,
      0.5,
    );
    assertCameraTarget(target);
    expect(target.zoom).toBeGreaterThanOrEqual(LOD_CELL_ENTRY);
  });

  it('3: current zoom above LOD_CELL_ENTRY — preserves zoom', () => {
    const target = resolveStorageCameraTarget(
      request,
      [rack],
      new Map([['cell-1', cell]]),
      viewport,
      2.0,
    );
    assertCameraTarget(target);
    expect(target.zoom).toBe(2.0);
  });

  it('4: cell geometry unresolved — falls back to rack center', () => {
    // rack has inactive face with no sections — cell will not resolve
    const rackNoCell: Rack = {
      ...rack,
      faces: [
        {
          id: 'face-a',
          side: 'A',
          enabled: false,
          slotNumberingDirection: 'ltr',
          isMirrored: false,
          mirrorSourceFaceId: null,
          sections: [],
        },
      ],
    };

    const rackRect = getRackCanvasRect(rackNoCell);
    const centerX = rackRect.x + rackRect.width / 2;
    const centerY = rackRect.y + rackRect.height / 2;

    const target = resolveStorageCameraTarget(
      { ...request, requestId: 2, rackId: 'rack-1' },
      [rackNoCell],
      new Map([['cell-1', cell]]),
      viewport,
      1,
    );
    assertCameraTarget(target);

    expect(target.offsetX).toBeCloseTo(viewport.width / 2 - centerX * target.zoom);
    expect(target.offsetY).toBeCloseTo(viewport.height / 2 - centerY * target.zoom);
  });

  it('5: rack fallback does not force LOD_CELL_ENTRY', () => {
    const rackNoCell: Rack = {
      ...rack,
      faces: [
        {
          id: 'face-a',
          side: 'A',
          enabled: false,
          slotNumberingDirection: 'ltr',
          isMirrored: false,
          mirrorSourceFaceId: null,
          sections: [],
        },
      ],
    };

    const target = resolveStorageCameraTarget(
      { ...request, requestId: 3, rackId: 'rack-1' },
      [rackNoCell],
      new Map([['cell-1', cell]]),
      viewport,
      0.5,
    );
    assertCameraTarget(target);
    // Should keep current zoom (0.5), not force LOD_CELL_ENTRY
    expect(target.zoom).toBe(0.5);
  });

  it('6: rack absent — returns null', () => {
    const target = resolveStorageCameraTarget(
      { ...request, requestId: 4, rackId: 'nonexistent-rack' },
      [rack],
      new Map([['cell-1', cell]]),
      viewport,
      1,
    );
    expect(target).toBeNull();
  });

  it('7: rotated rack — calculation remains correct via rect helper', () => {
    const rotatedCell: Cell = {
      ...cell,
      id: 'cell-rotated',
      rackId: 'rack-rotated',
    };

    const cellRect = getCellCanvasRect(rotatedRack, {
      rackId: rotatedCell.rackId,
      rackFaceId: rotatedCell.rackFaceId,
      rackSectionId: rotatedCell.rackSectionId,
      rackLevelId: rotatedCell.rackLevelId,
      slotNo: rotatedCell.slotNo,
    });
    expect(cellRect).not.toBeNull();

    const centerX = cellRect!.x + cellRect!.width / 2;
    const centerY = cellRect!.y + cellRect!.height / 2;

    const target = resolveStorageCameraTarget(
      { requestId: 5, source: 'storage-global-search', rackId: 'rack-rotated', cellId: 'cell-rotated' },
      [rotatedRack],
      new Map([['cell-rotated', rotatedCell]]),
      viewport,
      1,
    );
    assertCameraTarget(target);

    expect(target.offsetX).toBeCloseTo(viewport.width / 2 - centerX * target.zoom);
    expect(target.offsetY).toBeCloseTo(viewport.height / 2 - centerY * target.zoom);
  });

  it('returns null for zero-size viewport', () => {
    const target = resolveStorageCameraTarget(
      request,
      [rack],
      new Map([['cell-1', cell]]),
      { width: 0, height: 0 },
      1,
    );
    expect(target).toBeNull();
  });
});
