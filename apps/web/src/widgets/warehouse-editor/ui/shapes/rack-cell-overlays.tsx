import { Rect } from 'react-konva';
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
  ownsFill,
  ownsStroke
}: {
  geometry: CellRectGeometry;
  visualState: ResolvedCellVisualState;
  fill?: string;
  stroke?: string;
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
      strokeWidth={ownsStroke ? visualState.strokeWidth : 0}
      opacity={visualState.opacity}
    />
  );
}

export function CellBaseVisual({
  geometry,
  visualState,
  isSelected,
  isWorkflowSource,
  isHighlighted
}: CellOverlaySharedProps) {
  const ownsFill =
    !isSelected &&
    !isWorkflowSource &&
    !visualState.flags.isWorkflowTargetLocked &&
    !visualState.flags.hasRuntimeStatus;
  const ownsStroke =
    !isSelected &&
    !isWorkflowSource &&
    !isHighlighted &&
    !visualState.flags.isWorkflowTargetLocked &&
    !visualState.flags.hasRuntimeStatus;

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
  isSelected,
  isWorkflowSource,
  isHighlighted
}: CellOverlaySharedProps) {
  const ownsFill =
    visualState.flags.hasRuntimeStatus &&
    !isSelected &&
    !isWorkflowSource &&
    !visualState.flags.isWorkflowTargetLocked;
  const ownsStroke =
    visualState.flags.hasRuntimeStatus &&
    !isSelected &&
    !isWorkflowSource &&
    !isHighlighted &&
    !visualState.flags.isWorkflowTargetLocked;

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
  const ownsFill = isSelected || isWorkflowSource;
  const ownsStroke = isSelected || isWorkflowSource || isHighlighted;

  return (
    <>
      <LayerRect
        geometry={geometry}
        visualState={visualState}
        fill={visualState.fill}
        stroke={visualState.stroke}
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
