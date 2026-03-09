import type { Rack } from '@wos/domain';

// ─── Scale constants ────────────────────────────────────────────────────────
export const RACK_LENGTH_SCALE = 28;   // px per metre (along the long axis)
export const RACK_DEPTH_SCALE  = 44;   // px per metre for a PAIRED rack (two faces back-to-back)
export const SINGLE_DEPTH_PX   = 22;   // fixed visual depth for a SINGLE-face rack
export const GRID_SIZE         = 40;
export const ROTATE_HANDLE_SIZE = 28;
export const MIN_CANVAS_ZOOM = 0.75;
export const MAX_CANVAS_ZOOM = 1.75;

// ─── Level-of-Detail thresholds ─────────────────────────────────────────────
// LOD 0  zoom < 0.9  → plain block + code label only
// LOD 1  zoom 0.9–1.3 → block + section dividers + face label
// LOD 2  zoom ≥ 1.3  → full cell grid (section × level slots)
export const LOD_SECTION_THRESHOLD = 0.9;
export const LOD_CELL_THRESHOLD    = 1.3;

export type CanvasLOD = 0 | 1 | 2;

export function getCanvasLOD(zoom: number): CanvasLOD {
  if (zoom >= LOD_CELL_THRESHOLD)    return 2;
  if (zoom >= LOD_SECTION_THRESHOLD) return 1;
  return 0;
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
