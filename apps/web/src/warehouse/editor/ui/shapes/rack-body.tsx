import { useLayoutEffect, useRef } from 'react';
import { Group, Line, Rect, Text } from 'react-konva';
import type Konva from 'konva';
import type { CanvasRackGeometry } from '@/entities/layout-version/lib/canvas-geometry';
import { recordCanvasComponentRender } from '../canvas-diagnostics';
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
  shellRendering?: 'normal' | 'cached';
  disableShadows?: boolean;
  simpleShell?: boolean;
  disableLabels?: boolean;
  disableBodyStrokes?: boolean;
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
  isActivelyPanning = false,
  shellRendering = 'normal',
  disableShadows = false,
  simpleShell = false,
  disableLabels = false,
  disableBodyStrokes = false
}: Props) {
  const shellRef = useRef<Konva.Group | null>(null);
  const { width, height, faceAWidth, faceBWidth, isPaired, spineY } = geometry;

  recordCanvasComponentRender({
    component: 'RackBody',
    instanceId: displayCode,
    propsKeys: [
      'geometryX',
      'geometryY',
      'geometryWidth',
      'geometryHeight',
      'displayCode',
      'rotationDeg',
      'isSelected',
      'isHovered',
      'isPassive',
      'showRackCode',
      'rackCodeProminence',
      'rackCodePlacement',
      'disableStrokes',
      'isActivelyPanning',
      'shellRendering',
      'disableShadows',
      'simpleShell',
      'disableLabels',
      'disableBodyStrokes'
    ],
    snapshot: {
      geometryX: geometry.x,
      geometryY: geometry.y,
      geometryWidth: geometry.width,
      geometryHeight: geometry.height,
      displayCode,
      rotationDeg,
      isSelected,
      isHovered,
      isPassive,
      showRackCode,
      rackCodeProminence,
      rackCodePlacement,
      disableStrokes,
      isActivelyPanning,
      shellRendering,
      disableShadows,
      simpleShell,
      disableLabels,
      disableBodyStrokes
    }
  });

  const lightweightVisuals = disableStrokes || isActivelyPanning;
  const visualSelected = isActivelyPanning ? false : isSelected;
  const visualHovered = isActivelyPanning ? false : isHovered;
  const fill = visualSelected ? C.fillSelected : visualHovered ? C.fillHovered : C.fillDefault;
  const stroke = visualSelected ? C.strokeSelected : visualHovered ? C.strokeHovered : C.strokeDefault;
  const stripeH = Math.max(4, Math.min(8, height * 0.18));

  const hideBodyStrokes = disableBodyStrokes || lightweightVisuals || simpleShell;
  const hideShadows = disableShadows || lightweightVisuals || simpleShell;
  const hideLabels = disableLabels || simpleShell;
  const hideSelectionDecoration = simpleShell;
  const hideStripesOrOverhangs = simpleShell;
  const hideSpineBoundary = disableBodyStrokes || lightweightVisuals || simpleShell;

  const mainCornerRadius = simpleShell ? 0 : 8;
  const mainShadowBlur = hideShadows ? 0 : visualSelected ? 12 : 6;
  const mainShadowOpacity = hideShadows ? 0 : visualSelected ? 0.12 : 0.07;
  const mainStroke = hideBodyStrokes ? undefined : stroke;
  const mainStrokeEnabled = !hideBodyStrokes;
  const mainStrokeWidth = hideBodyStrokes ? 0 : visualSelected ? 2 : 1.5;

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

  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    if (shellRendering !== 'cached') {
      shell.clearCache();
      return;
    }

    shell.clearCache();
    shell.cache({
      pixelRatio:
        typeof window !== 'undefined' && window.devicePixelRatio > 0
          ? window.devicePixelRatio
          : 1
    });
    shell.getLayer()?.batchDraw();
  }, [
    disableStrokes,
    displayCode,
    faceAWidth,
    faceBWidth,
    fill,
    height,
    isActivelyPanning,
    isHovered,
    isPassive,
    isAsymmetric,
    isPaired,
    isSelected,
    labelBgOpacity,
    labelFontSize,
    labelFontStyle,
    labelHeight,
    labelShadowOpacity,
    labelStrokeOpacity,
    labelTextOpacity,
    labelWidth,
    labelX,
    labelY,
    rackCodePlacement,
    rackCodeProminence,
    rotationDeg,
    showRackCode,
    shellRendering,
    spineY,
    stripeH,
    stroke,
    width,
    disableShadows,
    simpleShell,
    disableLabels,
    disableBodyStrokes,
    hideBodyStrokes,
    hideShadows,
    hideLabels,
    hideSelectionDecoration,
    hideStripesOrOverhangs,
    hideSpineBoundary,
    mainCornerRadius,
    mainShadowBlur,
    mainShadowOpacity,
    mainStroke,
    mainStrokeEnabled,
    mainStrokeWidth
  ]);

  return (
    <Group
      ref={shellRef}
      listening={false}
      opacity={isActivelyPanning ? 1 : isPassive && !isSelected ? 0.5 : 1}
    >
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        cornerRadius={mainCornerRadius}
        fill={fill}
        stroke={mainStroke}
        strokeEnabled={mainStrokeEnabled}
        strokeWidth={mainStrokeWidth}
        shadowColor="#0f172a"
        shadowBlur={mainShadowBlur}
        shadowOpacity={mainShadowOpacity}
        shadowOffsetY={hideShadows ? 0 : 3}
        wosRectRole="rack-body-main"
      />

      {isSelected && !hideSelectionDecoration && (
        <Rect
          x={4}
          y={4}
          width={width - 8}
          height={height - 8}
          cornerRadius={6}
          stroke={C.selectionBorder}
          strokeWidth={hideBodyStrokes ? 0 : 1}
          dash={[8, 5]}
          opacity={lightweightVisuals ? 0 : 0.7}
          visible={!lightweightVisuals}
          wosRectRole="selection-highlight"
        />
      )}

      {!hideStripesOrOverhangs && isAsymmetric && faceAOverhang && (
        <Rect
          x={faceBWidth}
          y={spineY}
          width={faceAWidth - faceBWidth}
          height={height - spineY}
          fill={C.emptyZone}
          opacity={0.7}
          wosRectRole="rack-body-overhang"
        />
      )}
      {!hideStripesOrOverhangs && isAsymmetric && faceBOverhang && (
        <Rect
          x={faceAWidth}
          y={0}
          width={faceBWidth - faceAWidth}
          height={spineY}
          fill={C.emptyZone}
          opacity={0.7}
          wosRectRole="rack-body-overhang"
        />
      )}

      {!hideStripesOrOverhangs && (
        <Rect
          x={0}
          y={0}
          width={faceAWidth}
          height={stripeH}
          cornerRadius={[8, faceAOverhang || !isPaired ? 8 : 0, 0, 0] as unknown as number}
          fill={C.stripeA}
          opacity={visualSelected ? 0.6 : 0.4}
          wosRectRole="rack-body-stripe"
        />
      )}

      {!hideStripesOrOverhangs && isPaired && (
        <Rect
          x={0}
          // Face B band must stay on the outer edge of the paired rack.
          // Using spineY places it on the internal seam (between faces).
          y={Math.max(0, height - stripeH)}
          width={faceBWidth}
          height={stripeH}
          fill={C.stripeB}
          opacity={visualSelected ? 0.5 : 0.28}
          wosRectRole="rack-body-stripe"
        />
      )}

      {isPaired && !hideSpineBoundary && (
        <Line
          points={[8, spineY, width - 8, spineY]}
          stroke={C.spine}
          strokeWidth={1}
          dash={[6, 4]}
          opacity={0.55}
        />
      )}

      {isAsymmetric && !hideSpineBoundary && (
        <Line
          points={[minFaceW, 4, minFaceW, height - 4]}
          stroke={C.boundaryLine}
          strokeWidth={1.5}
          dash={[4, 3]}
          opacity={0.5}
        />
      )}

      {showRackCode && !hideLabels && (
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
            shadowBlur={hideShadows ? 0 : 4}
            shadowOpacity={hideShadows ? 0 : labelShadowOpacity}
            wosRectRole="badge-decoration"
          />
          <Rect
            x={-labelWidth / 2}
            y={-labelHeight / 2}
            width={labelWidth}
            height={labelHeight}
            cornerRadius={999}
            stroke={hideBodyStrokes ? undefined : C.codeText}
            strokeEnabled={!hideBodyStrokes}
            strokeWidth={hideBodyStrokes ? 0 : 0.6}
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
