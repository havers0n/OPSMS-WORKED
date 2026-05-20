import type { LayoutDraft, Rack, Wall } from '@wos/domain';
import type { RouteObstacle } from './obstacle-types';

type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function getRackBodySize(rack: Rack) {
  const isPaired = rack.kind === 'paired';
  const faceA = rack.faces.find((face) => face.side === 'A');
  const faceB = rack.faces.find((face) => face.side === 'B');
  const faceALength = faceA?.faceLength ?? rack.totalLength;
  const faceBLength = isPaired
    ? (faceB?.faceLength ?? rack.totalLength)
    : faceALength;

  return {
    width: Math.max(faceALength, faceBLength),
    height: rack.depth
  };
}

function getRotatedAabb(rect: Rect, rotationDeg: 0 | 90 | 180 | 270): Rect {
  if (rotationDeg === 0) return rect;

  const center = {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2
  };
  const radians = (rotationDeg * Math.PI) / 180;
  const sin = Math.sin(radians);
  const cos = Math.cos(radians);
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ].map((point) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;

    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    };
  });

  const minX = Math.min(...corners.map((point) => point.x));
  const maxX = Math.max(...corners.map((point) => point.x));
  const minY = Math.min(...corners.map((point) => point.y));
  const maxY = Math.max(...corners.map((point) => point.y));

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function buildRackRouteObstacle(rack: Rack): RouteObstacle {
  const size = getRackBodySize(rack);
  const rect = getRotatedAabb(
    {
      x: rack.x,
      y: rack.y,
      width: size.width,
      height: size.height
    },
    rack.rotationDeg
  );

  return {
    type: 'rack',
    id: rack.id,
    ...rect
  };
}

export function buildWallRouteObstacle(wall: Wall): RouteObstacle | null {
  if (!wall.blocksRackPlacement) return null;

  return {
    type: 'wall',
    id: wall.id,
    x1: wall.x1,
    y1: wall.y1,
    x2: wall.x2,
    y2: wall.y2
  };
}

export function buildRouteObstaclesFromLayout(
  layout: Pick<LayoutDraft, 'rackIds' | 'racks' | 'wallIds' | 'walls'> | null
): RouteObstacle[] {
  if (!layout) return [];

  const rackObstacles = layout.rackIds
    .map((rackId) => layout.racks[rackId])
    .filter((rack): rack is Rack => Boolean(rack))
    .map(buildRackRouteObstacle);
  const wallObstacles = layout.wallIds
    .map((wallId) => layout.walls[wallId])
    .filter((wall): wall is Wall => Boolean(wall))
    .map(buildWallRouteObstacle)
    .filter((obstacle): obstacle is RouteObstacle => obstacle !== null);

  return [...rackObstacles, ...wallObstacles];
}
