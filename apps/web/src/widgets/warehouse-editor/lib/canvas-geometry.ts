import type { CellStructureIdentity, Rack, Zone } from '@wos/domain';

// ─── Scale constants ────────────────────────────────────────────────────────
export const RACK_LENGTH_SCALE = 28;   // px per metre (along the long axis)
export const RACK_DEPTH_SCALE  = 44;   // px per metre for a PAIRED rack (two faces back-to-back)
export const SINGLE_DEPTH_PX   = 22;   // fixed visual depth for a SINGLE-face rack
export const GRID_SIZE         = 40;
export const ROTATE_HANDLE_SIZE = 28;
export const MIN_CANVAS_ZOOM = 0.5;
export const MAX_CANVAS_ZOOM = 3.0;

// ─── Level-of-Detail thresholds ─────────────────────────────────────────────
// LOD 0  zoom < 0.9  → plain block + code label only
// LOD 1  zoom 0.9–1.3 → block + section dividers + face label
// LOD 2  zoom ≥ 1.3  → full cell grid (section × level slots)
export const LOD_SECTION_THRESHOLD = 0.9;
export const LOD_CELL_THRESHOLD    = 1.3;
const CELL_RECT_INSET = 4;

export type CanvasLOD = 0 | 1 | 2;
export type CanvasInteractionLevel = 'L1' | 'L3';

export function getCanvasLOD(zoom: number): CanvasLOD {
  if (zoom >= LOD_CELL_THRESHOLD)    return 2;
  if (zoom >= LOD_SECTION_THRESHOLD) return 1;
  return 0;
}

export function getCanvasInteractionLevel(lod: CanvasLOD): CanvasInteractionLevel {
  return lod >= 2 ? 'L3' : 'L1';
}

// ─── Geometry types ──────────────────────────────────────────────────────────
export type CanvasRackGeometry = {
  x: number;
  y: number;
  /** Total bounding box width = max(faceAWidth, faceBWidth) */
  width: number;
  height: number;
  /** Pixel width of Face A zone (may differ from faceBWidth on paired racks) */
  faceAWidth: number;
  /** Pixel width of Face B zone (= faceAWidth for single racks) */
  faceBWidth: number;
  centerX: number;
  centerY: number;
  /** True when this rack has two active faces rendered back-to-back */
  isPaired: boolean;
  /** Y coordinate of the spine divider line (only meaningful when isPaired=true) */
  spineY: number;
};

export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function clampCanvasPosition(value: number) {
  return Math.max(0, value);
}

export function clampCanvasZoom(value: number) {
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, value));
}

/**
 * getRackGeometry
 *
 * Visual depth rules:
 *  - kind = 'single'  → SINGLE_DEPTH_PX (one face, thin bar)
 *  - kind = 'paired'  → rack.depth * RACK_DEPTH_SCALE (two faces, full block)
 *
 * Width rules:
 *  - Single rack: faceAWidth = rack.totalLength * scale
 *  - Paired rack: each face can have an independent faceLength override.
 *    The bounding box spans max(faceAWidth, faceBWidth).
 *
 * The spine divider for paired racks sits at height / 2.
 */
export function getRackGeometry(rack: Rack): CanvasRackGeometry {
  const isPaired = rack.kind === 'paired';

  const faceA = rack.faces.find((f) => f.side === 'A');
  const faceB = rack.faces.find((f) => f.side === 'B');

  const faceALength = faceA?.faceLength ?? rack.totalLength;
  const faceBLength = isPaired ? (faceB?.faceLength ?? rack.totalLength) : faceALength;

  const faceAWidth = faceALength * RACK_LENGTH_SCALE;
  const faceBWidth = faceBLength * RACK_LENGTH_SCALE;
  const width      = Math.max(faceAWidth, faceBWidth);

  const height = isPaired ? rack.depth * RACK_DEPTH_SCALE : SINGLE_DEPTH_PX;

  return {
    x: rack.x,
    y: rack.y,
    width,
    height,
    faceAWidth,
    faceBWidth,
    centerX: width  / 2,
    centerY: height / 2,
    isPaired,
    spineY: height / 2,
  };
}

function getRotatedBounds(rect: CanvasRect, rotationDeg: number, pivot: { x: number; y: number }): CanvasRect {
  const normalizedDeg = ((rotationDeg % 360) + 360) % 360;

  if (normalizedDeg === 0) {
    return rect;
  }

  const radians = (normalizedDeg * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ].map((point) => {
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;

    return {
      x: pivot.x + dx * cos - dy * sin,
      y: pivot.y + dx * sin + dy * cos
    };
  });

  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function projectCanvasRectToViewport(
  rect: CanvasRect,
  zoom: number,
  canvasOffset: { x: number; y: number }
): CanvasRect {
  return {
    x: rect.x * zoom + canvasOffset.x,
    y: rect.y * zoom + canvasOffset.y,
    width: rect.width * zoom,
    height: rect.height * zoom
  };
}

export function getRackCanvasRect(rack: Rack): CanvasRect {
  const geometry = getRackGeometry(rack);
  return getRotatedBounds(
    {
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height
    },
    rack.rotationDeg,
    {
      x: geometry.x + geometry.centerX,
      y: geometry.y + geometry.centerY
    }
  );
}

export function getZoneCanvasRect(zone: Zone): CanvasRect {
  return {
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height
  };
}

export function getCellCanvasRect(rack: Rack, cell: CellStructureIdentity): CanvasRect | null {
  const geometry = getRackGeometry(rack);
  const face = rack.faces.find((candidate) => candidate.id === cell.rackFaceId) ?? null;

  if (!face || !face.enabled || face.sections.length === 0) {
    return null;
  }

  const orderedSections =
    face.slotNumberingDirection === 'rtl' ? [...face.sections].reverse() : face.sections;
  const sectionIndex = orderedSections.findIndex(
    (section) => section.id === cell.rackSectionId
  );
  const section = sectionIndex >= 0 ? orderedSections[sectionIndex] : null;

  if (!section) {
    return null;
  }

  const orderedLevels = [...section.levels].sort((left, right) => right.ordinal - left.ordinal);
  const levelIndex = orderedLevels.findIndex((level) => level.id === cell.rackLevelId);
  const slotCount = orderedLevels[0]?.slotCount ?? 0;
  const slotIndex =
    face.slotNumberingDirection === 'rtl'
      ? slotCount - cell.slotNo
      : cell.slotNo - 1;

  if (levelIndex < 0 || slotCount <= 0 || slotIndex < 0 || slotIndex >= slotCount) {
    return null;
  }

  const sectionOffsets = getSectionWidths(
    face.side === 'B' ? geometry.faceBWidth : geometry.faceAWidth,
    orderedSections
  );
  const sectionX = sectionOffsets[sectionIndex];
  const sectionWidth = sectionOffsets[sectionIndex + 1] - sectionX;
  const bandY = geometry.isPaired && face.side === 'B' ? geometry.spineY : 0;
  const bandHeight = geometry.isPaired ? geometry.spineY : geometry.height;
  const cellHeight = bandHeight - CELL_RECT_INSET * 2;

  if (sectionWidth <= 0 || cellHeight <= 0 || orderedLevels.length === 0) {
    return null;
  }

  const slotWidth = sectionWidth / slotCount;
  const levelHeight = cellHeight / orderedLevels.length;

  if (slotWidth <= 0 || levelHeight <= 0) {
    return null;
  }

  return getRotatedBounds(
    {
      x: geometry.x + sectionX + slotIndex * slotWidth + 0.5,
      y: geometry.y + bandY + CELL_RECT_INSET + levelIndex * levelHeight + 0.5,
      width: Math.max(1, slotWidth - 1),
      height: Math.max(1, levelHeight - 1)
    },
    rack.rotationDeg,
    {
      x: geometry.x + geometry.centerX,
      y: geometry.y + geometry.centerY
    }
  );
}

/**
 * getSectionWidths
 *
 * Returns the pixel x-offsets of each section boundary (left edge) plus
 * the right edge so callers can draw dividers and compute cell widths.
 * Sections within a face are proportional to their .length field.
 */
export function getSectionWidths(
  totalWidth: number,
  sections: ReadonlyArray<{ length: number }>
): number[] {
  if (!sections.length) return [0, totalWidth];
  const totalLen = sections.reduce((s, sec) => s + sec.length, 0);
  const offsets = [0];
  let acc = 0;
  for (const sec of sections) {
    acc += (sec.length / totalLen) * totalWidth;
    offsets.push(acc);
  }
  return offsets;
}
