/**
 * RackBody
 *
 * Renders the visual body of one rack (any LOD).
 *
 * Visual grammar
 * ──────────────
 *  SINGLE rack (kind = 'single')
 *    • One thin rectangle (SINGLE_DEPTH_PX = 22 px high)
 *    • 4–8 px sky-blue stripe across the top  → Face A access aisle side
 *    • Code pill centred vertically
 *
 *  PAIRED rack (kind = 'paired')
 *    • Full-depth rectangle, split by a dashed spine at spineY = height/2
 *    • Sky-blue stripe at top (Face A), violet stripe just below spine (Face B)
 *    • Code pill in the top half; "-B" label in the bottom half
 *    • When faceAWidth ≠ faceBWidth (asymmetric): the shorter face gets a
 *      hatched overlay on the overhanging portion, and a vertical boundary
 *      line marks where that face ends.
 *
 * Colour states: default / hovered / selected  (driven by parent Group)
 */
import { Group, Line, Rect, Text } from 'react-konva';
import type { CanvasRackGeometry } from '../../lib/canvas-geometry';

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  fillDefault:  '#ffffff',
  fillHovered:  '#eff6ff',
  fillSelected: '#dbeafe',

  strokeDefault:  '#cbd5e1',
  strokeHovered:  '#60a5fa',
  strokeSelected: '#2563eb',

  stripeA:  '#0ea5e9',   // sky-500
  stripeB:  '#7c3aed',   // violet-600
  spine:    '#94a3b8',   // slate-400
  pillBg:   'rgba(255,255,255,0.96)',
  codeText: '#0f172a',
  codeBText:'#4c1d95',
  selectionBorder: '#0f6a8e',
  emptyZone: '#f1f5f9',  // slate-100 — "no face here" zone
  boundaryLine: '#94a3b8', // slate-400 — vertical face boundary
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
type Props = {
  geometry: CanvasRackGeometry;
  displayCode: string;
  isSelected: boolean;
  isHovered: boolean;
  /** Canvas LOD: 0 = far (no label), 1 = mid (corner text), 2 = close (corner pill) */
  lod: 0 | 1 | 2;
};

export function RackBody({ geometry, displayCode, isSelected, isHovered, lod }: Props) {
  const { width, height, faceAWidth, faceBWidth, isPaired, spineY } = geometry;

  const fill   = isSelected ? C.fillSelected   : isHovered ? C.fillHovered   : C.fillDefault;
  const stroke = isSelected ? C.strokeSelected : isHovered ? C.strokeHovered : C.strokeDefault;
  const stripeH = Math.max(4, Math.min(8, height * 0.18));

  // ── Label geometry (bottom-right corner, inside rack body) ──────────────────
  // LOD 1: compact text — 9 px, no background
  // LOD 2: pill — 11 px with semi-transparent background
  const labelPad  = 5;
  const labelFSA  = lod >= 2 ? 11 : 9;
  const labelFSB  = lod >= 2 ? 11 : 9;

  // Face A label: bottom-right of Face A zone
  const labelAText = isPaired ? `${displayCode}-A` : displayCode;
  const faceABottom = isPaired ? spineY : height;
  // pill dimensions (LOD 2 only)
  const pillH  = 18;
  const pillW  = Math.min(faceAWidth - 16, 120);

  // Face B label: bottom-right of Face B zone (paired only)
  const faceBBottom = height;

  // Asymmetric overhang — which face is shorter?
  const minFaceW = Math.min(faceAWidth, faceBWidth);
  const isAsymmetric = isPaired && Math.abs(faceAWidth - faceBWidth) > 2;
  const faceAOverhang = isPaired && faceAWidth > faceBWidth; // Face A extends beyond Face B
  const faceBOverhang = isPaired && faceBWidth > faceAWidth; // Face B extends beyond Face A

  return (
    <Group listening={false}>

      {/* ── Main body ─────────────────────────────────────────────── */}
      <Rect
        x={0} y={0} width={width} height={height}
        cornerRadius={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1.5}
        shadowColor="#0f172a"
        shadowBlur={isSelected ? 12 : 6}
        shadowOpacity={isSelected ? 0.12 : 0.07}
        shadowOffsetY={3}
      />

      {/* ── Selection inner ring ──────────────────────────────────── */}
      {isSelected && (
        <Rect
          x={4} y={4} width={width - 8} height={height - 8}
          cornerRadius={6}
          stroke={C.selectionBorder}
          strokeWidth={1}
          dash={[8, 5]}
          opacity={0.7}
        />
      )}

      {/* ── Empty zone overlay (asymmetric paired rack) ───────────── */}
      {isAsymmetric && faceAOverhang && (
        /* Face A is longer — bottom-right zone (Face B doesn't reach here) */
        <Rect
          x={faceBWidth} y={spineY}
          width={faceAWidth - faceBWidth} height={height - spineY}
          fill={C.emptyZone}
          opacity={0.7}
        />
      )}
      {isAsymmetric && faceBOverhang && (
        /* Face B is longer — top-right zone (Face A doesn't reach here) */
        <Rect
          x={faceAWidth} y={0}
          width={faceBWidth - faceAWidth} height={spineY}
          fill={C.emptyZone}
          opacity={0.7}
        />
      )}

      {/* ── Face-A stripe (top edge, spans faceAWidth) ────────────── */}
      <Rect
        x={0} y={0} width={faceAWidth} height={stripeH}
        cornerRadius={[8, faceAOverhang || !isPaired ? 8 : 0, 0, 0] as unknown as number}
        fill={C.stripeA}
        opacity={isSelected ? 0.6 : 0.4}
      />

      {/* ── Face-B stripe (just below spine, spans faceBWidth) ─────── */}
      {isPaired && (
        <Rect
          x={0} y={spineY} width={faceBWidth} height={stripeH}
          fill={C.stripeB}
          opacity={isSelected ? 0.5 : 0.28}
        />
      )}

      {/* ── Spine divider (full width, horizontal) ────────────────── */}
      {isPaired && (
        <Line
          points={[8, spineY, width - 8, spineY]}
          stroke={C.spine}
          strokeWidth={1}
          dash={[6, 4]}
          opacity={0.55}
        />
      )}

      {/* ── Vertical boundary line where shorter face ends ────────── */}
      {isAsymmetric && (
        <Line
          points={[minFaceW, 4, minFaceW, height - 4]}
          stroke={C.boundaryLine}
          strokeWidth={1.5}
          dash={[4, 3]}
          opacity={0.5}
        />
      )}

      {/* ── Face-A label (bottom-right corner) ───────────────────── */}
      {lod >= 1 && faceAWidth > 14 && (
        lod >= 2 && pillW > 24 ? (
          /* LOD 2: pill with background */
          <>
            <Rect
              x={faceAWidth - pillW - labelPad}
              y={faceABottom - pillH - labelPad}
              width={pillW}
              height={pillH}
              cornerRadius={999}
              fill={C.pillBg}
              shadowColor="#0f172a"
              shadowBlur={4}
              shadowOpacity={0.08}
            />
            <Text
              x={faceAWidth - pillW - labelPad + 7}
              y={faceABottom - pillH - labelPad + (pillH - labelFSA) / 2}
              text={labelAText}
              fontSize={labelFSA}
              fontStyle="bold"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={C.codeText}
            />
          </>
        ) : (
          /* LOD 1: plain text, no background — width needed for align="right" in Konva */
          <Text
            x={labelPad}
            y={faceABottom - labelFSA - labelPad}
            width={faceAWidth - 2 * labelPad}
            text={labelAText}
            fontSize={labelFSA}
            fontStyle="bold"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill={C.codeText}
            opacity={0.55}
            align="right"
          />
        )
      )}

      {/* ── Face-B label (bottom-right corner of B zone) ──────────── */}
      {isPaired && lod >= 1 && faceBWidth > 14 && (
        lod >= 2 && pillW > 24 ? (
          <>
            <Rect
              x={faceBWidth - pillW - labelPad}
              y={faceBBottom - pillH - labelPad}
              width={pillW}
              height={pillH}
              cornerRadius={999}
              fill={C.pillBg}
              shadowColor="#0f172a"
              shadowBlur={4}
              shadowOpacity={0.08}
            />
            <Text
              x={faceBWidth - pillW - labelPad + 7}
              y={faceBBottom - pillH - labelPad + (pillH - labelFSB) / 2}
              text={`${displayCode}-B`}
              fontSize={labelFSB}
              fontStyle="bold"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              fill={C.codeBText}
            />
          </>
        ) : (
          <Text
            x={labelPad}
            y={faceBBottom - labelFSB - labelPad}
            width={faceBWidth - 2 * labelPad}
            text={`${displayCode}-B`}
            fontSize={labelFSB}
            fontStyle="bold"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill={C.codeBText}
            opacity={0.55}
            align="right"
          />
        )
      )}
    </Group>
  );
}
