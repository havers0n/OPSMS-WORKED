import type { Wall } from '@wos/domain';
import type Konva from 'konva';
import { Circle, Group, Layer, Line } from 'react-konva';
import { WORLD_SCALE } from '@/entities/layout-version/lib/canvas-geometry';

type DraftWallLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type WallLayerProps = {
  canSelectWall: boolean;
  draftWallLine?: DraftWallLine | null;
  getRelativePointerPosition: () => { x: number; y: number } | null;
  isLayoutEditable: boolean;
  selectedWallId: string | null;
  setSelectedWallId: (wallId: string) => void;
  updateWallGeometry: (
    wallId: string,
    geometry: Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'>
  ) => void;
  wallLookup: Record<string, Wall>;
  walls: Wall[];
};

type WallEndpointHandle = 'start' | 'end';

const WALL_HANDLE_RADIUS = 6;

// Returns wall endpoint in metres (world space)
function getWallEndpointPosition(wall: Wall, handle: WallEndpointHandle) {
  return handle === 'start'
    ? { x: wall.x1, y: wall.y1 }
    : { x: wall.x2, y: wall.y2 };
}

// nextStart is in metres; returns wall geometry in metres
function moveWallByDelta(
  wall: Wall,
  nextStart: { x: number; y: number }
): Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'> {
  const dx = wall.x2 - wall.x1;
  const dy = wall.y2 - wall.y1;

  return {
    x1: nextStart.x,
    y1: nextStart.y,
    x2: nextStart.x + dx,
    y2: nextStart.y + dy
  };
}

// Returns wall geometry in metres, pointer is canvas pixels
function resizeWallFromEndpoint(
  wall: Wall,
  handle: WallEndpointHandle,
  pointer: { x: number; y: number }
): Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'> {
  // pointer is canvas pixels → metres, snapped to 1 m grid
  const snappedX = Math.round(pointer.x / WORLD_SCALE);
  const snappedY = Math.round(pointer.y / WORLD_SCALE);
  const isHorizontal = wall.y1 === wall.y2;

  if (handle === 'start') {
    return isHorizontal
      ? { x1: snappedX, y1: wall.y1, x2: wall.x2, y2: wall.y2 }
      : { x1: wall.x1, y1: snappedY, x2: wall.x2, y2: wall.y2 };
  }

  return isHorizontal
    ? { x1: wall.x1, y1: wall.y1, x2: snappedX, y2: wall.y2 }
    : { x1: wall.x1, y1: wall.y1, x2: wall.x2, y2: snappedY };
}

export function WallLayer({
  canSelectWall,
  draftWallLine,
  getRelativePointerPosition,
  isLayoutEditable,
  selectedWallId,
  setSelectedWallId,
  updateWallGeometry,
  wallLookup,
  walls
}: WallLayerProps) {
  const handleWallDragMove = (wall: Wall, event: Konva.KonvaEventObject<DragEvent>) => {
    if (!isLayoutEditable) return;

    const node = event.target;
    // node.x()/y() are canvas pixels; convert to metres, snap to 1 m grid
    const xM = Math.round(node.x() / WORLD_SCALE);
    const yM = Math.round(node.y() / WORLD_SCALE);

    updateWallGeometry(wall.id, moveWallByDelta(wall, { x: xM, y: yM }));
  };

  const handleWallEndpointDragMove = (
    wall: Wall,
    handle: WallEndpointHandle,
    event: Konva.KonvaEventObject<DragEvent>
  ) => {
    if (!isLayoutEditable) return;

    const pointer = getRelativePointerPosition();
    if (!pointer) return;

    event.cancelBubble = true;
    updateWallGeometry(wall.id, resizeWallFromEndpoint(wall, handle, pointer));
  };

  return (
    <Layer>
      {draftWallLine && (
        <Line
          points={[
            draftWallLine.x1 * WORLD_SCALE,
            draftWallLine.y1 * WORLD_SCALE,
            draftWallLine.x2 * WORLD_SCALE,
            draftWallLine.y2 * WORLD_SCALE
          ]}
          stroke="#64748b"
          strokeWidth={4}
          strokeScaleEnabled={false}
          lineCap="round"
          opacity={0.45}
          dash={[6, 5]}
          listening={false}
        />
      )}
      {walls.map((wall) => {
        const isSelectedWall = selectedWallId === wall.id;
        // Wall extent in pixels (local to Group)
        const lineDxPx = (wall.x2 - wall.x1) * WORLD_SCALE;
        const lineDyPx = (wall.y2 - wall.y1) * WORLD_SCALE;

        return (
          <Group
            key={wall.id}
            x={wall.x1 * WORLD_SCALE}
            y={wall.y1 * WORLD_SCALE}
            draggable={isLayoutEditable && canSelectWall}
            onMouseDown={(event) => {
              event.cancelBubble = true;
            }}
            onClick={(event) => {
              event.cancelBubble = true;
              if (!canSelectWall) return;
              setSelectedWallId(wall.id);
            }}
            onTap={(event) => {
              event.cancelBubble = true;
              if (!canSelectWall) return;
              setSelectedWallId(wall.id);
            }}
            onDragStart={() => {
              if (canSelectWall) {
                setSelectedWallId(wall.id);
              }
            }}
            onDragMove={(event) => handleWallDragMove(wall, event)}
            onDragEnd={(event) => {
              const currentWall = wallLookup[wall.id] ?? wall;
              event.target.position({
                x: currentWall.x1 * WORLD_SCALE,
                y: currentWall.y1 * WORLD_SCALE
              });
            }}
          >
            <Line
              points={[0, 0, lineDxPx, lineDyPx]}
              stroke="transparent"
              strokeWidth={18}
              strokeScaleEnabled={false}
              lineCap="round"
            />
            <Line
              points={[0, 0, lineDxPx, lineDyPx]}
              stroke={isSelectedWall ? '#0f172a' : '#64748b'}
              strokeWidth={isSelectedWall ? 5 : 4}
              strokeScaleEnabled={false}
              lineCap="round"
              dash={wall.blocksRackPlacement ? undefined : [8, 6]}
              shadowColor={isSelectedWall ? 'rgba(15,23,42,0.18)' : 'transparent'}
              shadowBlur={isSelectedWall ? 8 : 0}
            />

            {isSelectedWall &&
              isLayoutEditable &&
              canSelectWall &&
              (['start', 'end'] as WallEndpointHandle[]).map((handle) => {
                const point = getWallEndpointPosition(wall, handle);
                // Local pixel offset from the Group origin (wall.x1, wall.y1)
                const localXPx = (point.x - wall.x1) * WORLD_SCALE;
                const localYPx = (point.y - wall.y1) * WORLD_SCALE;

                return (
                  <Circle
                    key={`${wall.id}-${handle}`}
                    x={localXPx}
                    y={localYPx}
                    radius={WALL_HANDLE_RADIUS}
                    fill="#ffffff"
                    stroke="#0f172a"
                    strokeWidth={1.5}
                    strokeScaleEnabled={false}
                    draggable
                    onMouseDown={(event) => {
                      event.cancelBubble = true;
                    }}
                    onClick={(event) => {
                      event.cancelBubble = true;
                      if (!canSelectWall) return;
                      setSelectedWallId(wall.id);
                    }}
                    onDragMove={(event) =>
                      handleWallEndpointDragMove(wall, handle, event)
                    }
                    onDragEnd={(event) => {
                      const currentWall = wallLookup[wall.id] ?? wall;
                      const pt = getWallEndpointPosition(currentWall, handle);
                      event.target.position({
                        x: (pt.x - currentWall.x1) * WORLD_SCALE,
                        y: (pt.y - currentWall.y1) * WORLD_SCALE
                      });
                    }}
                  />
                );
              })}
          </Group>
        );
      })}
    </Layer>
  );
}
