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
};

export function RackBody({ geometry, displayCode, isSelected, isHovered }: Props) {
  const { width, height, faceAWidth, faceBWidth, isPaired, spineY } = geometry;

  const fill   = isSelected ? C.fillSelected   : isHovered ? C.fillHovered   : C.fillDefault;
  const stroke = isSelected ? C.strokeSelected : isHovered ? C.strokeHovered : C.strokeDefault;
  const stripeH = Math.max(4, Math.min(8, height * 0.18));

  // Code pill geometry – sits in the "Face A" half, vertically centred
  const pillW  = Math.min(faceAWidth - 24, 130);
  const pillH  = 20;
  const pillX  = 12;
  const faceAMidY = isPaired ? spineY / 2 : height / 2;
  const pillY  = faceAMidY - pillH / 2;
  const codeFS = 12;

  // Face B label – centred in the bottom half of paired rack (within faceBWidth)
  const faceBMidY = spineY + (height - spineY) / 2;
  const labelBY   = faceBMidY - codeFS / 2;

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

      {/* ── Code pill / label (Face A) ────────────────────────────── */}
      {pillW > 20 ? (
        /* Full pill with background — enough horizontal space */
        <>
          <Rect
            x={pillX} y={pillY} width={pillW} height={pillH}
            cornerRadius={999}
            fill={C.pillBg}
            shadowColor="#0f172a"
            shadowBlur={4}
            shadowOpacity={0.06}
          />
          <Text
            x={pillX + 8}
            y={pillY + (pillH - codeFS) / 2}
            text={`${displayCode}-A`}
            fontSize={codeFS}
            fontStyle="bold"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill={C.codeText}
          />
        </>
      ) : faceAWidth > 14 ? (
        /* Compact label — narrow rack, no room for pill, but text still fits */
        <Text
          x={4}
          y={faceAMidY - 5}
          text={displayCode}
          fontSize={9}
          fontStyle="bold"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill={C.codeText}
          opacity={0.8}
        />
      ) : null}

      {/* ── Face-B label ──────────────────────────────────────────── */}
      {isPaired && (
        <Text
          x={pillX + 8}
          y={labelBY}
          text={`${displayCode}-B`}
          fontSize={codeFS}
          fontStyle="bold"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill={C.codeBText}
          opacity={0.75}
        />
      )}
    </Group>
  );
}
