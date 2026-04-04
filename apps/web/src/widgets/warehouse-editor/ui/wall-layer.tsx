import type { Wall } from '@wos/domain';
import type Konva from 'konva';
import { Circle, Group, Layer, Line } from 'react-konva';
import { GRID_SIZE } from '../lib/canvas-geometry';

type WallLayerProps = {
  canSelectWall: boolean;
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

function getWallEndpointPosition(wall: Wall, handle: WallEndpointHandle) {
  return handle === 'start'
    ? { x: wall.x1, y: wall.y1 }
    : { x: wall.x2, y: wall.y2 };
}

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

function resizeWallFromEndpoint(
  wall: Wall,
  handle: WallEndpointHandle,
  pointer: { x: number; y: number }
): Pick<Wall, 'x1' | 'y1' | 'x2' | 'y2'> {
  const snappedX = Math.round(pointer.x / GRID_SIZE) * GRID_SIZE;
  const snappedY = Math.round(pointer.y / GRID_SIZE) * GRID_SIZE;
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
    const x = Math.round(node.x() / GRID_SIZE) * GRID_SIZE;
    const y = Math.round(node.y() / GRID_SIZE) * GRID_SIZE;

    updateWallGeometry(wall.id, moveWallByDelta(wall, { x, y }));
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
      {walls.map((wall) => {
        const isSelectedWall = selectedWallId === wall.id;
        const lineDx = wall.x2 - wall.x1;
        const lineDy = wall.y2 - wall.y1;

        return (
          <Group
            key={wall.id}
            x={wall.x1}
            y={wall.y1}
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
                x: currentWall.x1,
                y: currentWall.y1
              });
            }}
          >
            <Line
              points={[0, 0, lineDx, lineDy]}
              stroke="transparent"
              strokeWidth={18}
              strokeScaleEnabled={false}
              lineCap="round"
            />
            <Line
              points={[0, 0, lineDx, lineDy]}
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
                const localX = point.x - wall.x1;
                const localY = point.y - wall.y1;

                return (
                  <Circle
                    key={`${wall.id}-${handle}`}
                    x={localX}
                    y={localY}
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
                      const point = getWallEndpointPosition(currentWall, handle);
                      event.target.position({
                        x: point.x - currentWall.x1,
                        y: point.y - currentWall.y1
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
