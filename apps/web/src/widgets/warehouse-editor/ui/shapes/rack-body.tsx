import { Group, Line, Rect, Text } from 'react-konva';
import type { CanvasRackGeometry } from '../../lib/canvas-geometry';

const C = {
  fillDefault: '#ffffff',
  fillHovered: '#eff6ff',
  fillSelected: '#dbeafe',
  strokeDefault: '#cbd5e1',
  strokeHovered: '#60a5fa',
  strokeSelected: '#2563eb',
  stripeA: '#0ea5e9',
  stripeB: '#7c3aed',
  spine: '#94a3b8',
  pillBg: 'rgba(255,255,255,0.96)',
  codeText: '#0f172a',
  selectionBorder: '#0f6a8e',
  emptyZone: '#f1f5f9',
  boundaryLine: '#94a3b8'
} as const;

type Props = {
  geometry: CanvasRackGeometry;
  displayCode: string;
  rotationDeg: 0 | 90 | 180 | 270;
  isSelected: boolean;
  isHovered: boolean;
  isPassive?: boolean;
  lod: 0 | 1 | 2;
};

export function RackBody({
  geometry,
  displayCode,
  rotationDeg,
  isSelected,
  isHovered,
  isPassive = false,
  lod
}: Props) {
  const { width, height, faceAWidth, faceBWidth, isPaired, spineY } = geometry;

  const fill = isSelected ? C.fillSelected : isHovered ? C.fillHovered : C.fillDefault;
  const stroke = isSelected ? C.strokeSelected : isHovered ? C.strokeHovered : C.strokeDefault;
  const stripeH = Math.max(4, Math.min(8, height * 0.18));

  const minFaceW = Math.min(faceAWidth, faceBWidth);
  const isAsymmetric = isPaired && Math.abs(faceAWidth - faceBWidth) > 2;
  const faceAOverhang = isPaired && faceAWidth > faceBWidth;
  const faceBOverhang = isPaired && faceBWidth > faceAWidth;

  const labelFontSize = lod === 0 ? 12 : 11;
  const labelPadX = lod === 0 ? 10 : 8;
  const labelPadY = 4;
  const labelWidth = Math.min(
    Math.max(width - 12, 30),
    Math.max(38, displayCode.length * (labelFontSize * 0.62) + labelPadX * 2)
  );
  const labelHeight = labelFontSize + labelPadY * 2;
  const labelY = lod === 0
    ? height / 2
    : isPaired
      ? Math.min(spineY - 10, stripeH + labelHeight / 2 + 4)
      : height / 2;

  return (
    <Group listening={false} opacity={isPassive && !isSelected ? 0.5 : 1}>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        cornerRadius={8}
        fill={fill}
        stroke={stroke}
        strokeWidth={isSelected ? 2 : 1.5}
        shadowColor="#0f172a"
        shadowBlur={isSelected ? 12 : 6}
        shadowOpacity={isSelected ? 0.12 : 0.07}
        shadowOffsetY={3}
      />

      {isSelected && (
        <Rect
          x={4}
          y={4}
          width={width - 8}
          height={height - 8}
          cornerRadius={6}
          stroke={C.selectionBorder}
          strokeWidth={1}
          dash={[8, 5]}
          opacity={0.7}
        />
      )}

      {isAsymmetric && faceAOverhang && (
        <Rect
          x={faceBWidth}
          y={spineY}
          width={faceAWidth - faceBWidth}
          height={height - spineY}
          fill={C.emptyZone}
          opacity={0.7}
        />
      )}
      {isAsymmetric && faceBOverhang && (
        <Rect
          x={faceAWidth}
          y={0}
          width={faceBWidth - faceAWidth}
          height={spineY}
          fill={C.emptyZone}
          opacity={0.7}
        />
      )}

      <Rect
        x={0}
        y={0}
        width={faceAWidth}
        height={stripeH}
        cornerRadius={[8, faceAOverhang || !isPaired ? 8 : 0, 0, 0] as unknown as number}
        fill={C.stripeA}
        opacity={isSelected ? 0.6 : 0.4}
      />

      {isPaired && (
        <Rect
          x={0}
          y={spineY}
          width={faceBWidth}
          height={stripeH}
          fill={C.stripeB}
          opacity={isSelected ? 0.5 : 0.28}
        />
      )}

      {isPaired && (
        <Line
          points={[8, spineY, width - 8, spineY]}
          stroke={C.spine}
          strokeWidth={1}
          dash={[6, 4]}
          opacity={0.55}
        />
      )}

      {isAsymmetric && (
        <Line
          points={[minFaceW, 4, minFaceW, height - 4]}
          stroke={C.boundaryLine}
          strokeWidth={1.5}
          dash={[4, 3]}
          opacity={0.5}
        />
      )}

      <Group x={width / 2} y={labelY} rotation={-rotationDeg}>
        <Rect
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          cornerRadius={999}
          fill={C.pillBg}
          shadowColor="#0f172a"
          shadowBlur={4}
          shadowOpacity={0.08}
        />
        <Text
          x={-labelWidth / 2}
          y={-labelHeight / 2 + labelPadY}
          width={labelWidth}
          text={displayCode}
          fontSize={labelFontSize}
          fontStyle="bold"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill={C.codeText}
          align="center"
        />
      </Group>
    </Group>
  );
}
