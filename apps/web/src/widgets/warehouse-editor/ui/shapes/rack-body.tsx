import { Group, Line, Rect, Text } from 'react-konva';
import type { CanvasRackGeometry } from '@/entities/layout-version/lib/canvas-geometry';
import type { LabelProminence, RackCodePlacement } from './rack-label-reveal-policy';

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
  showRackCode: boolean;
  rackCodeProminence: LabelProminence;
  rackCodePlacement: RackCodePlacement;
  disableStrokes?: boolean;
  isActivelyPanning?: boolean;
};

export function RackBody({
  geometry,
  displayCode,
  rotationDeg,
  isSelected,
  isHovered,
  isPassive = false,
  showRackCode,
  rackCodeProminence,
  rackCodePlacement,
  disableStrokes = false,
  isActivelyPanning = false
}: Props) {
  const { width, height, faceAWidth, faceBWidth, isPaired, spineY } = geometry;

  const lightweightVisuals = disableStrokes || isActivelyPanning;
  const visualSelected = isActivelyPanning ? false : isSelected;
  const visualHovered = isActivelyPanning ? false : isHovered;
  const fill = visualSelected ? C.fillSelected : visualHovered ? C.fillHovered : C.fillDefault;
  const stroke = visualSelected ? C.strokeSelected : visualHovered ? C.strokeHovered : C.strokeDefault;
  const stripeH = Math.max(4, Math.min(8, height * 0.18));

  const minFaceW = Math.min(faceAWidth, faceBWidth);
  const isAsymmetric = isPaired && Math.abs(faceAWidth - faceBWidth) > 2;
  const faceAOverhang = isPaired && faceAWidth > faceBWidth;
  const faceBOverhang = isPaired && faceBWidth > faceAWidth;

  const labelFontSize =
    rackCodeProminence === 'dominant' ? 11 : rackCodeProminence === 'secondary' ? 10 : 9;
  const labelFontStyle = rackCodeProminence === 'background' ? 'normal' : 'bold';
  const labelTextOpacity =
    rackCodeProminence === 'dominant' ? 0.95 : rackCodeProminence === 'secondary' ? 0.82 : 0.64;
  const labelBgOpacity =
    rackCodeProminence === 'dominant' ? 0.96 : rackCodeProminence === 'secondary' ? 0.8 : 0.5;
  const labelStrokeOpacity =
    rackCodeProminence === 'dominant' ? 0.18 : rackCodeProminence === 'secondary' ? 0.12 : 0.08;
  const labelShadowOpacity =
    rackCodeProminence === 'dominant' ? 0.08 : rackCodeProminence === 'secondary' ? 0.04 : 0;
  const labelPadX = 8;
  const labelPadY = 4;
  const isVertical = rotationDeg === 90 || rotationDeg === 270;
  const isLowerLeftMidPlacement = rackCodePlacement === 'lower-left-mid';
  const labelStartInsetX = isLowerLeftMidPlacement ? 1 : 10;
  const labelLayoutFontSize = 11;
  const labelLayoutHeight = labelLayoutFontSize + labelPadY * 2;
  const labelWidth = Math.min(
    Math.max(width - 12, 30),
    Math.max(38, displayCode.length * (labelLayoutFontSize * 0.62) + labelPadX * 2)
  );
  const labelHeight = labelLayoutHeight;
  const quietPlacementInset = 1;
  const horizontalInset = isLowerLeftMidPlacement ? quietPlacementInset : 6;
  let labelX = Math.max(
    labelWidth / 2 + horizontalInset,
    Math.min(width - labelWidth / 2 - horizontalInset, labelStartInsetX + labelWidth / 2)
  );
  // Shell-owned identity zone:
  // - header-left for stage0/1/2
  // - quieter lower-left-mid variant for stage3 to avoid top-lane competition with cell labels.
  // For vertical racks, keep this lane near top to avoid floating in-between.
  const headerLabelY = 14;
  const lowerMidLabelY = isVertical
    ? labelHeight / 2 + quietPlacementInset
    : isPaired
      ? Math.max(labelHeight / 2 + 6, spineY - labelHeight / 2 - 2)
      : Math.max(labelHeight / 2 + 6, height * 0.45);
  const verticalInset = isLowerLeftMidPlacement ? quietPlacementInset : 6;
  let labelY = Math.max(
    labelHeight / 2 + verticalInset,
    Math.min(height - labelHeight / 2 - 6, rackCodePlacement === 'lower-left-mid' ? lowerMidLabelY : headerLabelY)
  );

  if (isLowerLeftMidPlacement && isVertical) {
    const cx = width / 2;
    const cy = height / 2;
    // Rotated rack bbox for 90/270: width=height(local), height=width(local).
    const screenTargetX = cx - height / 2 + quietPlacementInset + labelWidth / 2;
    const screenTargetY = cy - width / 2 + quietPlacementInset + labelHeight / 2;
    const theta = (rotationDeg * Math.PI) / 180;
    const cosInv = Math.cos(-theta);
    const sinInv = Math.sin(-theta);
    const dx = screenTargetX - cx;
    const dy = screenTargetY - cy;
    // Inverse-rotate desired screen top-left anchor back into local rack coordinates.
    labelX = cx + dx * cosInv - dy * sinInv;
    labelY = cy + dx * sinInv + dy * cosInv;
  }

  return (
    <Group listening={false} opacity={isActivelyPanning ? 1 : isPassive && !isSelected ? 0.5 : 1}>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        cornerRadius={8}
        fill={fill}
        stroke={lightweightVisuals ? undefined : stroke}
        strokeEnabled={!lightweightVisuals}
        strokeWidth={lightweightVisuals ? 0 : isSelected ? 2 : 1.5}
        shadowColor="#0f172a"
        shadowBlur={lightweightVisuals ? 0 : isSelected ? 12 : 6}
        shadowOpacity={lightweightVisuals ? 0 : isSelected ? 0.12 : 0.07}
        shadowOffsetY={3}
        wosRectRole="rack-body"
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
          opacity={lightweightVisuals ? 0 : 0.7}
          visible={!lightweightVisuals}
          wosRectRole="selection-highlight"
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
          wosRectRole="rack-body"
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
          wosRectRole="rack-body"
        />
      )}

      <Rect
        x={0}
        y={0}
        width={faceAWidth}
        height={stripeH}
        cornerRadius={[8, faceAOverhang || !isPaired ? 8 : 0, 0, 0] as unknown as number}
        fill={C.stripeA}
        opacity={visualSelected ? 0.6 : 0.4}
        wosRectRole="rack-body"
      />

      {isPaired && (
        <Rect
          x={0}
          // Face B band must stay on the outer edge of the paired rack.
          // Using spineY places it on the internal seam (between faces).
          y={Math.max(0, height - stripeH)}
          width={faceBWidth}
          height={stripeH}
          fill={C.stripeB}
          opacity={visualSelected ? 0.5 : 0.28}
          wosRectRole="rack-body"
        />
      )}

      {isPaired && !lightweightVisuals && (
        <Line
          points={[8, spineY, width - 8, spineY]}
          stroke={C.spine}
          strokeWidth={1}
          dash={[6, 4]}
          opacity={0.55}
        />
      )}

      {isAsymmetric && !lightweightVisuals && (
        <Line
          points={[minFaceW, 4, minFaceW, height - 4]}
          stroke={C.boundaryLine}
          strokeWidth={1.5}
          dash={[4, 3]}
          opacity={0.5}
        />
      )}

      {showRackCode && (
        <Group x={labelX} y={labelY} rotation={-rotationDeg}>
          <Rect
            x={-labelWidth / 2}
            y={-labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            cornerRadius={999}
            fill={C.pillBg}
            opacity={labelBgOpacity}
            shadowColor="#0f172a"
            shadowBlur={lightweightVisuals ? 0 : 4}
            shadowOpacity={lightweightVisuals ? 0 : labelShadowOpacity}
            wosRectRole="badge-decoration"
          />
          <Rect
            x={-labelWidth / 2}
            y={-labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            cornerRadius={999}
            stroke={lightweightVisuals ? undefined : C.codeText}
            strokeEnabled={!lightweightVisuals}
            strokeWidth={lightweightVisuals ? 0 : 0.6}
            opacity={lightweightVisuals ? 0 : labelStrokeOpacity}
            listening={false}
            wosRectRole="badge-decoration"
          />
          <Text
            x={-labelWidth / 2}
            y={-labelHeight / 2 + labelPadY}
            width={labelWidth}
            text={displayCode}
            fontSize={labelFontSize}
            fontStyle={labelFontStyle}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fill={C.codeText}
            opacity={labelTextOpacity}
            align="center"
          />
        </Group>
      )}
    </Group>
  );
}
