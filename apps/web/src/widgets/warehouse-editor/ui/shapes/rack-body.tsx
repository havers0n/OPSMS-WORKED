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
} as const;

// ─── Component ────────────────────────────────────────────────────────────────
type Props = {
  geometry: CanvasRackGeometry;
  displayCode: string;
  isSelected: boolean;
  isHovered: boolean;
};

export function RackBody({ geometry, displayCode, isSelected, isHovered }: Props) {
  const { width, height, isPaired, spineY } = geometry;

  const fill   = isSelected ? C.fillSelected   : isHovered ? C.fillHovered   : C.fillDefault;
  const stroke = isSelected ? C.strokeSelected : isHovered ? C.strokeHovered : C.strokeDefault;
  const stripeH = Math.max(4, Math.min(8, height * 0.18));

  // Code pill geometry – sits in the "Face A" half, vertically centred
  const pillW  = Math.min(width - 24, 130);
  const pillH  = 20;
  const pillX  = 12;
  const faceAMidY = isPaired ? spineY / 2 : height / 2;
  const pillY  = faceAMidY - pillH / 2;
  const codeFS = 12;

  // Face B label – centred in the bottom half of paired rack
  const faceBMidY = spineY + (height - spineY) / 2;
  const labelBY   = faceBMidY - codeFS / 2;

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

      {/* ── Face-A stripe (top edge) ──────────────────────────────── */}
      <Rect
        x={0} y={0} width={width} height={stripeH}
        cornerRadius={[8, 8, 0, 0] as unknown as number}
        fill={C.stripeA}
        opacity={isSelected ? 0.6 : 0.4}
      />

      {/* ── Face-B stripe (just below spine) ─────────────────────── */}
      {isPaired && (
        <Rect
          x={0} y={spineY} width={width} height={stripeH}
          fill={C.stripeB}
          opacity={isSelected ? 0.5 : 0.28}
        />
      )}

      {/* ── Spine divider for paired ──────────────────────────────── */}
      {isPaired && (
        <Line
          points={[8, spineY, width - 8, spineY]}
          stroke={C.spine}
          strokeWidth={1}
          dash={[6, 4]}
          opacity={0.55}
        />
      )}

      {/* ── Code pill (Face A) ────────────────────────────────────── */}
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
