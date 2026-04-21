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
  ownsFill,
  ownsStroke
}: {
  geometry: CellRectGeometry;
  visualState: ResolvedCellVisualState;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
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
  const ownsFill =
    !visualState.flags.isWorkflowTargetLocked && !visualState.flags.hasRuntimeStatus;
  const ownsStroke =
    !visualState.flags.isWorkflowTargetLocked && !visualState.flags.hasRuntimeStatus;

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
  const ownsFill = visualState.flags.hasRuntimeStatus && !visualState.flags.isWorkflowTargetLocked;
  const ownsStroke = visualState.flags.hasRuntimeStatus && !visualState.flags.isWorkflowTargetLocked;

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
  isSelected,
  isWorkflowSource,
  isHighlighted,
  isClickable,
  onCellClick
}: CellInteractionOverlayProps) {
  const ownsFill = false;
  const ownsStroke =
    visualState.interactionStroke !== null && (isSelected || isWorkflowSource || isHighlighted);

  return (
    <>
      <LayerRect
        geometry={geometry}
        visualState={visualState}
        stroke={visualState.interactionStroke ?? undefined}
        strokeWidth={visualState.interactionStrokeWidth}
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
  if (visualState.flags.isWorkflowTargetLocked) return null;

  const markOpacity = isSelected || isWorkflowSource ? 0.92 : 0.86;
  const markColor = visualState.stroke;
  const inset = Math.max(1, Math.min(geometry.width, geometry.height) * 0.14);
  const markerX = geometry.x + inset;
  const markerY = geometry.y + inset;
  const markerW = Math.max(1, geometry.width - inset * 2);
  const markerH = Math.max(1, geometry.height - inset * 2);
  const thin = Math.max(0.85, Math.min(markerW, markerH) * 0.16);

  if (visualState.flags.semanticKind === 'stocked') {
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

  if (visualState.flags.semanticKind === 'reserved') {
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

  if (visualState.flags.semanticKind === 'pick_active') {
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

  if (visualState.flags.semanticKind === 'quarantined') {
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

  if (visualState.flags.semanticKind === 'empty') {
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

  if (visualState.flags.semanticKind === 'occupied_fallback') {
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
  isHighlighted
}: Pick<CellOverlaySharedProps, 'geometry' | 'visualState' | 'isHighlighted'>) {
  const ownsFill = visualState.flags.isWorkflowTargetLocked;
  const ownsStroke = visualState.flags.isWorkflowTargetLocked && !isHighlighted;

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
