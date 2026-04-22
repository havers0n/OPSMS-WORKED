import { Line, Rect } from 'react-konva';
import type { ResolvedCellVisualState } from './rack-cells-visual-state';

type CellRectGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type CellOverlaySharedProps = {
  geometry: CellRectGeometry;
  visualState: ResolvedCellVisualState;
  isSelected: boolean;
  isWorkflowSource: boolean;
  isHighlighted: boolean;
};

function LayerRect({
  geometry,
  visualState,
  fill,
  stroke,
  strokeWidth,
  dash,
  ownsFill,
  ownsStroke
}: {
  geometry: CellRectGeometry;
  visualState: ResolvedCellVisualState;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
  ownsFill: boolean;
  ownsStroke: boolean;
}) {
  if (!ownsFill && !ownsStroke) return null;
  return (
    <Rect
      x={geometry.x}
      y={geometry.y}
      width={geometry.width}
      height={geometry.height}
      cornerRadius={1}
      listening={false}
      fill={fill}
      fillEnabled={ownsFill}
      stroke={stroke}
      strokeEnabled={ownsStroke}
      strokeWidth={ownsStroke ? (strokeWidth ?? visualState.strokeWidth) : 0}
      dash={ownsStroke ? dash : undefined}
      opacity={visualState.opacity}
    />
  );
}

export function CellBaseVisual({
  geometry,
  visualState,
  isSelected: _isSelected,
  isWorkflowSource: _isWorkflowSource,
  isHighlighted: _isHighlighted
}: CellOverlaySharedProps) {
  const ownsFill = !visualState.compat.isWorkflowTargetLocked && visualState.semantics.fill === null;
  const ownsStroke = !visualState.compat.isWorkflowTargetLocked && visualState.semantics.fill === null;

  return (
    <LayerRect
      geometry={geometry}
      visualState={visualState}
      fill={visualState.fill}
      stroke={visualState.stroke}
      ownsFill={ownsFill}
      ownsStroke={ownsStroke}
    />
  );
}

export function CellRuntimeOverlay({
  geometry,
  visualState,
  isSelected: _isSelected,
  isWorkflowSource: _isWorkflowSource,
  isHighlighted: _isHighlighted
}: CellOverlaySharedProps) {
  const ownsFill = visualState.semantics.fill !== null && !visualState.compat.isWorkflowTargetLocked;
  const ownsStroke = visualState.semantics.fill !== null && !visualState.compat.isWorkflowTargetLocked;

  return (
    <LayerRect
      geometry={geometry}
      visualState={visualState}
      fill={visualState.fill}
      stroke={visualState.stroke}
      ownsFill={ownsFill}
      ownsStroke={ownsStroke}
    />
  );
}

type CellInteractionOverlayProps = CellOverlaySharedProps & {
  isClickable: boolean;
  onCellClick?: (anchor: { x: number; y: number }) => void;
};

export function CellInteractionOverlay({
  geometry,
  visualState,
  isSelected: _isSelected,
  isWorkflowSource: _isWorkflowSource,
  isHighlighted: _isHighlighted,
  isClickable,
  onCellClick
}: CellInteractionOverlayProps) {
  const ownsFill = visualState.navigationFill !== null;
  const ownsStroke = visualState.navigationStroke !== null;

  return (
    <>
      <LayerRect
        geometry={geometry}
        visualState={visualState}
        fill={visualState.navigationFill ?? undefined}
        stroke={visualState.navigationStroke ?? undefined}
        strokeWidth={visualState.navigationStrokeWidth}
        dash={visualState.navigationDash}
        ownsFill={ownsFill}
        ownsStroke={ownsStroke}
      />
      <Rect
        x={geometry.x}
        y={geometry.y}
        width={geometry.width}
        height={geometry.height}
        cornerRadius={1}
        fillEnabled={false}
        strokeEnabled={false}
        opacity={0}
        onClick={isClickable && onCellClick ? (event) => {
          event.cancelBubble = true;
          onCellClick({ x: event.evt.clientX, y: event.evt.clientY });
        } : undefined}
      />
    </>
  );
}

export function CellStatusSemanticOverlay({
  geometry,
  visualState,
  isSelected,
  isWorkflowSource
}: Pick<CellOverlaySharedProps, 'geometry' | 'visualState' | 'isSelected' | 'isWorkflowSource'>) {
  if (visualState.compat.isWorkflowTargetLocked) return null;

  const markOpacity = isSelected || isWorkflowSource ? 0.92 : 0.86;
  const markColor = visualState.stroke;
  const inset = Math.max(1, Math.min(geometry.width, geometry.height) * 0.14);
  const markerX = geometry.x + inset;
  const markerY = geometry.y + inset;
  const markerW = Math.max(1, geometry.width - inset * 2);
  const markerH = Math.max(1, geometry.height - inset * 2);
  const thin = Math.max(0.85, Math.min(markerW, markerH) * 0.16);

  if (visualState.compat.semanticKind === 'stocked') {
    return (
      <Rect
        x={markerX}
        y={markerY + markerH - thin}
        width={markerW}
        height={thin}
        listening={false}
        fill={markColor}
        opacity={markOpacity}
      />
    );
  }

  if (visualState.compat.semanticKind === 'reserved') {
    return (
      <Rect
        x={markerX}
        y={markerY}
        width={markerW}
        height={thin}
        listening={false}
        fill={markColor}
        opacity={markOpacity}
      />
    );
  }

  if (visualState.compat.semanticKind === 'pick_active') {
    const barW = Math.max(1, markerW * 0.24);
    return (
      <Rect
        x={markerX + (markerW - barW) / 2}
        y={markerY}
        width={barW}
        height={markerH}
        listening={false}
        fill={markColor}
        opacity={markOpacity}
      />
    );
  }

  if (visualState.compat.semanticKind === 'quarantined') {
    return (
      <>
        <Line
          points={[markerX, markerY, markerX + markerW, markerY + markerH]}
          listening={false}
          stroke={markColor}
          strokeWidth={thin}
          lineCap="round"
          opacity={markOpacity}
        />
        <Line
          points={[markerX + markerW, markerY, markerX, markerY + markerH]}
          listening={false}
          stroke={markColor}
          strokeWidth={thin}
          lineCap="round"
          opacity={markOpacity}
        />
      </>
    );
  }

  if (visualState.compat.semanticKind === 'empty') {
    return (
      <Rect
        x={markerX}
        y={markerY}
        width={markerW}
        height={markerH}
        listening={false}
        fillEnabled={false}
        stroke={markColor}
        strokeWidth={thin}
        opacity={Math.max(0.64, markOpacity - 0.16)}
      />
    );
  }

  if (visualState.compat.semanticKind === 'occupied_fallback') {
    const dot = Math.max(1, Math.min(markerW, markerH) * 0.34);
    return (
      <Rect
        x={geometry.x + (geometry.width - dot) / 2}
        y={geometry.y + (geometry.height - dot) / 2}
        width={dot}
        height={dot}
        cornerRadius={0.6}
        listening={false}
        fill={markColor}
        opacity={markOpacity}
      />
    );
  }

  return null;
}

export function CellExceptionOverlay({
  geometry,
  visualState,
  isHighlighted: _isHighlighted
}: Pick<CellOverlaySharedProps, 'geometry' | 'visualState' | 'isHighlighted'>) {
  const ownsFill = visualState.compat.isWorkflowTargetLocked;
  const ownsStroke = visualState.compat.isWorkflowTargetLocked;

  return (
    <LayerRect
      geometry={geometry}
      visualState={visualState}
      fill={visualState.fill}
      stroke={visualState.stroke}
      ownsFill={ownsFill}
      ownsStroke={ownsStroke}
    />
  );
}
