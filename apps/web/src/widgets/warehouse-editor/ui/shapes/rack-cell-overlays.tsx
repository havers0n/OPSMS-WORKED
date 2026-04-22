import { Circle, Group, Rect } from 'react-konva';
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

export function CellSurfaceVisual({ geometry, visualState }: CellOverlaySharedProps) {
  const pattern = visualState.surface.pattern;
  const dotsVisible =
    pattern?.kind === 'dots' &&
    Math.min(geometry.width, geometry.height) >= pattern.minCellSize &&
    geometry.width > pattern.inset * 2 &&
    geometry.height > pattern.inset * 2;

  const dotNodes =
    dotsVisible && pattern
      ? Array.from(
          { length: Math.floor((geometry.height - pattern.inset * 2) / pattern.pitch) + 1 },
          (_, rowIndex) => rowIndex
        ).flatMap((rowIndex) => {
          const centerY = geometry.y + pattern.inset + rowIndex * pattern.pitch;
          if (centerY > geometry.y + geometry.height - pattern.inset) return [];

          return Array.from(
            { length: Math.floor((geometry.width - pattern.inset * 2) / pattern.pitch) + 1 },
            (_, columnIndex) => columnIndex
          ).flatMap((columnIndex) => {
            const centerX = geometry.x + pattern.inset + columnIndex * pattern.pitch;
            if (centerX > geometry.x + geometry.width - pattern.inset) return [];

            return (
              <Circle
                key={`reserved-dot-${rowIndex}-${columnIndex}`}
                x={centerX}
                y={centerY}
                radius={pattern.radius}
                listening={false}
                fill={pattern.color}
                opacity={pattern.opacity}
              />
            );
          });
        })
      : [];

  return (
    <Group listening={false}>
      <LayerRect
        geometry={geometry}
        visualState={visualState}
        fill={visualState.surface.fill ?? undefined}
        stroke={visualState.surface.stroke ?? undefined}
        strokeWidth={visualState.surface.strokeWidth}
        ownsFill={visualState.surface.fill !== null}
        ownsStroke={visualState.surface.stroke !== null}
      />
      {dotNodes}
    </Group>
  );
}

export function CellTruthMarkerOverlay({ geometry, visualState }: CellOverlaySharedProps) {
  const marker = visualState.truthMarker;
  if (marker === null) return null;

  const inset = Math.max(1, Math.min(geometry.width, geometry.height) * 0.18);
  const markerW = Math.max(1, geometry.width - inset * 2);
  const markerH = Math.max(1, geometry.height - inset * 2);
  const centerX = geometry.x + geometry.width / 2;
  const centerY = geometry.y + geometry.height / 2;

  if (marker.kind === 'degraded') {
    const dot = Math.max(1, Math.min(markerW, markerH) * 0.34);
    return (
      <Rect
        x={centerX - dot / 2}
        y={centerY - dot / 2}
        width={dot}
        height={dot}
        cornerRadius={0.6}
        listening={false}
        fill={marker.color}
        opacity={0.86}
      />
    );
  }

  return (
    <Rect
      x={geometry.x + inset}
      y={geometry.y + inset}
      width={markerW}
      height={markerH}
      listening={false}
      fillEnabled={false}
      stroke={marker.color}
      strokeWidth={Math.max(0.85, Math.min(markerW, markerH) * 0.16)}
      opacity={0.7}
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
  isClickable,
  onCellClick
}: CellInteractionOverlayProps) {
  return (
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
  );
}

export function CellOutlineOverlay({ geometry, visualState }: CellOverlaySharedProps) {
  const outline = visualState.outline;
  if (outline === null) return null;

  return (
    <LayerRect
      geometry={geometry}
      visualState={visualState}
      stroke={outline.stroke ?? undefined}
      strokeWidth={outline.strokeWidth}
      dash={outline.dash}
      ownsFill={false}
      ownsStroke={outline.stroke !== null}
    />
  );
}

export function CellHaloOverlay({ geometry, visualState }: CellOverlaySharedProps) {
  const halo = visualState.halo;
  if (halo === null) return null;

  return (
    <Rect
      x={geometry.x - 1}
      y={geometry.y - 1}
      width={geometry.width + 2}
      height={geometry.height + 2}
      cornerRadius={2}
      listening={false}
      fill={halo.fill ?? undefined}
      fillEnabled={halo.fill !== null}
      stroke={halo.stroke ?? undefined}
      strokeEnabled={halo.stroke !== null}
      strokeWidth={halo.strokeWidth}
      dash={halo.dash}
      opacity={1}
    />
  );
}

export function CellBadgeOverlay({ geometry, visualState }: CellOverlaySharedProps) {
  const badge = visualState.badge;
  if (badge === null) return null;

  const badgeSize = Math.max(4, Math.min(geometry.width, geometry.height) * 0.34);

  return (
    <Rect
      x={geometry.x + geometry.width - badgeSize}
      y={geometry.y}
      width={badgeSize}
      height={badgeSize}
      cornerRadius={1}
      listening={false}
      fill={badge.fill ?? undefined}
      fillEnabled={badge.fill !== null}
      stroke={badge.stroke ?? undefined}
      strokeEnabled={badge.stroke !== null}
      strokeWidth={badge.strokeWidth}
      dash={badge.dash}
      opacity={1}
    />
  );
}
