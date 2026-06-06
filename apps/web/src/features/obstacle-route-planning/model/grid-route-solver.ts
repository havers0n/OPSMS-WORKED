import {
  DEFAULT_GRID_ROUTE_SOLVER_CONFIG,
  type GridRouteSolverConfig,
  type ResolvedGridRouteSolverConfig,
  type RouteGridCell,
  type RouteObstacle,
  type RoutePoint,
  type RouteSolveDiagnostics,
  type RouteSolveResult
} from './obstacle-types';
import {
  removeDuplicatePoints,
  removeRedundantCollinearPoints,
  simplifyRouteLineOfSight
} from './route-simplification';

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

type Grid = {
  minX: number;
  minY: number;
  cols: number;
  rows: number;
  resolutionM: number;
};

type Cell = {
  x: number;
  y: number;
};

type SolveGridRouteOptions = {
  includeDiagnostics?: boolean;
  boundsOverride?: Bounds;
  occupancyMode?: 'conservative' | 'center';
};

type HeapItem = {
  key: number;
  priority: number;
};

const EPSILON = 1e-9;

export type RouteCellBlockReason =
  | {
      obstacleId: string;
      obstacleType: 'rack';
      rule: 'center_in_inflated_obstacle' | 'cell_area_intersects_inflated_obstacle';
      overlapRect:
        | {
            x: number;
            y: number;
            width: number;
            height: number;
          }
        | null;
    }
  | {
      obstacleId: string;
      obstacleType: 'wall';
      rule: 'center_on_wall';
      overlapRect: null;
    };

export type RouteEndpointCandidateInspection = {
  radius: number;
  cell: RouteGridCell;
  worldCenter: RoutePoint;
  blocked: boolean;
  blockers: RouteCellBlockReason[];
};

export function resolveGridRouteSolverConfig(
  config: GridRouteSolverConfig = {}
): ResolvedGridRouteSolverConfig {
  return {
    ...DEFAULT_GRID_ROUTE_SOLVER_CONFIG,
    ...config
  };
}

function distance(left: RoutePoint, right: RoutePoint) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function totalPathCost(points: RoutePoint[]) {
  return points.reduce(
    (sum, point, index) =>
      index === 0 ? 0 : sum + distance(points[index - 1]!, point),
    0
  );
}

function inflateRack(obstacle: Extract<RouteObstacle, { type: 'rack' }>, clearanceM: number) {
  return {
    x: obstacle.x - clearanceM,
    y: obstacle.y - clearanceM,
    width: obstacle.width + clearanceM * 2,
    height: obstacle.height + clearanceM * 2
  };
}

function isPointInRect(point: RoutePoint, rect: ReturnType<typeof inflateRack>) {
  return (
    point.x >= rect.x - EPSILON &&
    point.x <= rect.x + rect.width + EPSILON &&
    point.y >= rect.y - EPSILON &&
    point.y <= rect.y + rect.height + EPSILON
  );
}

function doRectsIntersect(
  left: ReturnType<typeof inflateRack>,
  right: ReturnType<typeof inflateRack>
) {
  return (
    left.x <= right.x + right.width &&
    left.x + left.width >= right.x &&
    left.y <= right.y + right.height &&
    left.y + left.height >= right.y
  );
}

function orientation(a: RoutePoint, b: RoutePoint, c: RoutePoint) {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

function isPointOnSegment(point: RoutePoint, start: RoutePoint, end: RoutePoint) {
  return (
    orientation(start, point, end) === 0 &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    point.x >= Math.min(start.x, end.x) - EPSILON &&
    point.y <= Math.max(start.y, end.y) + EPSILON &&
    point.y >= Math.min(start.y, end.y) - EPSILON
  );
}

function doSegmentsIntersect(
  aStart: RoutePoint,
  aEnd: RoutePoint,
  bStart: RoutePoint,
  bEnd: RoutePoint
) {
  const o1 = orientation(aStart, aEnd, bStart);
  const o2 = orientation(aStart, aEnd, bEnd);
  const o3 = orientation(bStart, bEnd, aStart);
  const o4 = orientation(bStart, bEnd, aEnd);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && isPointOnSegment(bStart, aStart, aEnd)) return true;
  if (o2 === 0 && isPointOnSegment(bEnd, aStart, aEnd)) return true;
  if (o3 === 0 && isPointOnSegment(aStart, bStart, bEnd)) return true;
  if (o4 === 0 && isPointOnSegment(aEnd, bStart, bEnd)) return true;

  return false;
}

function doesSegmentIntersectRect(
  start: RoutePoint,
  end: RoutePoint,
  rect: ReturnType<typeof inflateRack>
) {
  if (isPointInRect(start, rect) || isPointInRect(end, rect)) return true;

  const topLeft = { x: rect.x, y: rect.y };
  const topRight = { x: rect.x + rect.width, y: rect.y };
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height };
  const bottomLeft = { x: rect.x, y: rect.y + rect.height };

  return (
    doSegmentsIntersect(start, end, topLeft, topRight) ||
    doSegmentsIntersect(start, end, topRight, bottomRight) ||
    doSegmentsIntersect(start, end, bottomRight, bottomLeft) ||
    doSegmentsIntersect(start, end, bottomLeft, topLeft)
  );
}

export function isPointBlocked(
  point: RoutePoint,
  obstacles: RouteObstacle[],
  clearanceM = DEFAULT_GRID_ROUTE_SOLVER_CONFIG.clearanceM
) {
  return obstacles.some((obstacle) => {
    if (obstacle.type === 'rack') {
      return isPointInRect(point, inflateRack(obstacle, clearanceM));
    }

    // MVP wall policy: walls have zero thickness; movement segments may not
    // cross them. Clearance bands for walls require real floor semantics later.
    return isPointOnSegment(
      point,
      { x: obstacle.x1, y: obstacle.y1 },
      { x: obstacle.x2, y: obstacle.y2 }
    );
  });
}

export function isRouteSegmentClear(
  start: RoutePoint,
  end: RoutePoint,
  obstacles: RouteObstacle[],
  clearanceM = DEFAULT_GRID_ROUTE_SOLVER_CONFIG.clearanceM
) {
  return obstacles.every((obstacle) => {
    if (obstacle.type === 'rack') {
      return !doesSegmentIntersectRect(start, end, inflateRack(obstacle, clearanceM));
    }

    return !doSegmentsIntersect(
      start,
      end,
      { x: obstacle.x1, y: obstacle.y1 },
      { x: obstacle.x2, y: obstacle.y2 }
    );
  });
}

function inferBounds(
  start: RoutePoint,
  end: RoutePoint,
  obstacles: RouteObstacle[],
  config: ResolvedGridRouteSolverConfig
): Bounds {
  const xs = [start.x, end.x];
  const ys = [start.y, end.y];

  for (const obstacle of obstacles) {
    if (obstacle.type === 'rack') {
      xs.push(obstacle.x - config.clearanceM, obstacle.x + obstacle.width + config.clearanceM);
      ys.push(obstacle.y - config.clearanceM, obstacle.y + obstacle.height + config.clearanceM);
      continue;
    }

    xs.push(obstacle.x1, obstacle.x2);
    ys.push(obstacle.y1, obstacle.y2);
  }

  return {
    minX: Math.min(...xs) - config.boundsMarginM,
    minY: Math.min(...ys) - config.boundsMarginM,
    maxX: Math.max(...xs) + config.boundsMarginM,
    maxY: Math.max(...ys) + config.boundsMarginM
  };
}

function buildGrid(bounds: Bounds, config: ResolvedGridRouteSolverConfig): Grid {
  const minX = Math.floor(bounds.minX / config.resolutionM) * config.resolutionM;
  const minY = Math.floor(bounds.minY / config.resolutionM) * config.resolutionM;
  const maxX = Math.ceil(bounds.maxX / config.resolutionM) * config.resolutionM;
  const maxY = Math.ceil(bounds.maxY / config.resolutionM) * config.resolutionM;

  return {
    minX,
    minY,
    cols: Math.floor((maxX - minX) / config.resolutionM) + 1,
    rows: Math.floor((maxY - minY) / config.resolutionM) + 1,
    resolutionM: config.resolutionM
  };
}

function pointToCell(point: RoutePoint, grid: Grid): Cell {
  return {
    x: Math.round((point.x - grid.minX) / grid.resolutionM),
    y: Math.round((point.y - grid.minY) / grid.resolutionM)
  };
}

function toRouteGridCell(cell: Cell): RouteGridCell {
  return { x: cell.x, y: cell.y };
}

function cellToPoint(cell: Cell, grid: Grid): RoutePoint {
  return {
    x: grid.minX + cell.x * grid.resolutionM,
    y: grid.minY + cell.y * grid.resolutionM
  };
}

function cellKey(cell: Cell, grid: Grid) {
  return cell.y * grid.cols + cell.x;
}

function keyToCell(key: number, grid: Grid): Cell {
  return {
    x: key % grid.cols,
    y: Math.floor(key / grid.cols)
  };
}

function isCellWithinGrid(cell: Cell, grid: Grid) {
  return cell.x >= 0 && cell.y >= 0 && cell.x < grid.cols && cell.y < grid.rows;
}

function getCellRect(cell: Cell, grid: Grid) {
  const center = cellToPoint(cell, grid);
  const half = grid.resolutionM / 2;

  return {
    x: center.x - half,
    y: center.y - half,
    width: grid.resolutionM,
    height: grid.resolutionM
  };
}

function getCellBlockReasons(
  cell: Cell,
  grid: Grid,
  obstacles: RouteObstacle[],
  clearanceM: number,
  occupancyMode: 'conservative' | 'center'
): RouteCellBlockReason[] {
  if (!isCellWithinGrid(cell, grid)) return [];

  const center = cellToPoint(cell, grid);
  const cellRect = getCellRect(cell, grid);
  const reasons: RouteCellBlockReason[] = [];

  for (const obstacle of obstacles) {
    if (obstacle.type === 'rack') {
      const inflated = inflateRack(obstacle, clearanceM);
      if (isPointInRect(center, inflated)) {
        reasons.push({
          obstacleId: obstacle.id,
          obstacleType: 'rack',
          rule: 'center_in_inflated_obstacle',
          overlapRect: getRectIntersection(cellRect, inflated)
        });
        continue;
      }

      if (occupancyMode === 'conservative' && doRectsIntersect(cellRect, inflated)) {
        reasons.push({
          obstacleId: obstacle.id,
          obstacleType: 'rack',
          rule: 'cell_area_intersects_inflated_obstacle',
          overlapRect: getRectIntersection(cellRect, inflated)
        });
      }
      continue;
    }

    if (
      isPointOnSegment(
        center,
        { x: obstacle.x1, y: obstacle.y1 },
        { x: obstacle.x2, y: obstacle.y2 }
      )
    ) {
      reasons.push({
        obstacleId: obstacle.id,
        obstacleType: 'wall',
        rule: 'center_on_wall',
        overlapRect: null
      });
    }
  }

  return reasons;
}

class MinHeap {
  private readonly items: HeapItem[] = [];

  get size() {
    return this.items.length;
  }

  push(item: HeapItem) {
    this.items.push(item);
    this.bubbleUp(this.items.length - 1);
  }

  pop(): HeapItem | null {
    if (this.items.length === 0) return null;
    const first = this.items[0]!;
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return first;
  }

  private bubbleUp(index: number) {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.items[parent]!.priority <= this.items[current]!.priority) break;
      [this.items[parent], this.items[current]] = [
        this.items[current]!,
        this.items[parent]!
      ];
      current = parent;
    }
  }

  private bubbleDown(index: number) {
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;

      if (
        left < this.items.length &&
        this.items[left]!.priority < this.items[smallest]!.priority
      ) {
        smallest = left;
      }
      if (
        right < this.items.length &&
        this.items[right]!.priority < this.items[smallest]!.priority
      ) {
        smallest = right;
      }
      if (smallest === current) break;
      [this.items[current], this.items[smallest]] = [
        this.items[smallest]!,
        this.items[current]!
      ];
      current = smallest;
    }
  }
}

function reconstructPath(cameFrom: Map<number, number>, endKey: number, grid: Grid) {
  const keys = [endKey];
  let current = endKey;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    keys.push(current);
  }

  return keys.reverse().map((key) => cellToPoint(keyToCell(key, grid), grid));
}

function reconstructPathCells(cameFrom: Map<number, number>, endKey: number, grid: Grid) {
  const keys = [endKey];
  let current = endKey;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    keys.push(current);
  }

  return keys.reverse().map((key) => keyToCell(key, grid));
}

function buildCellWalkability(
  grid: Grid,
  obstacles: RouteObstacle[],
  clearanceM: number,
  occupancyMode: 'conservative' | 'center'
) {
  const cache = new Map<number, boolean>();

  return (cell: Cell) => {
    if (!isCellWithinGrid(cell, grid)) return false;
    const key = cellKey(cell, grid);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const walkable =
      getCellBlockReasons(cell, grid, obstacles, clearanceM, occupancyMode).length === 0;
    cache.set(key, walkable);
    return walkable;
  };
}

function appendIfDistinct(points: RoutePoint[], point: RoutePoint) {
  const last = points[points.length - 1];
  if (!last || distance(last, point) > EPSILON) {
    points.push(point);
  }
}

function prependIfDistinct(points: RoutePoint[], point: RoutePoint) {
  const first = points[0];
  if (!first || distance(first, point) > EPSILON) {
    points.unshift(point);
  }
}

type EndpointOverride = {
  cells: Cell[];
};

const ALL_DIRECTIONS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: -1 },
  { dx: 1, dy: -1 },
  { dx: -1, dy: 1 },
  { dx: 1, dy: 1 }
];

function getEndpointOverride(
  worldPoint: RoutePoint,
  cell: Cell,
  grid: Grid,
  obstacles: RouteObstacle[],
  clearanceM: number,
  occupancyMode: 'conservative' | 'center'
): EndpointOverride | null {
  const blockers = getCellBlockReasons(cell, grid, obstacles, clearanceM, occupancyMode);
  const isOnlyAreaIntersects =
    blockers.length > 0 &&
    blockers.every((b) => b.rule === 'cell_area_intersects_inflated_obstacle');
  if (!isOnlyAreaIntersects) return null;

  const visited = new Map<number, Cell | null>();
  const queue: Cell[] = [cell];
  const cellKeyValue = cellKey(cell, grid);
  visited.set(cellKeyValue, null);

  let searchedCells = 0;
  const MAX_SEARCH = 1000;

  while (queue.length > 0 && searchedCells < MAX_SEARCH) {
    const current = queue.shift()!;
    searchedCells += 1;

    for (const dir of ALL_DIRECTIONS) {
      const next = { x: current.x + dir.dx, y: current.y + dir.dy };
      if (!isCellWithinGrid(next, grid)) continue;

      const nextKey = cellKey(next, grid);
      if (visited.has(nextKey)) continue;

      const nextBlockers = getCellBlockReasons(
        next,
        grid,
        obstacles,
        clearanceM,
        occupancyMode
      );

      if (nextBlockers.length === 0) {
        const nextCenter = cellToPoint(next, grid);
        if (!isRouteSegmentClear(nextCenter, worldPoint, obstacles, clearanceM)) {
          visited.set(nextKey, current);
          continue;
        }

        const pathCells: Cell[] = [next];
        let cur: Cell | null = current;
        while (cur !== null) {
          pathCells.push(cur);
          if (cur.x === cell.x && cur.y === cell.y) break;
          cur = visited.get(cellKey(cur, grid)) ?? null;
        }

        return { cells: pathCells };
      }

      if (
        nextBlockers.every(
          (b) => b.rule === 'cell_area_intersects_inflated_obstacle'
        )
      ) {
        visited.set(nextKey, current);
        queue.push(next);
      }
    }
  }

  return null;
}

function buildIsWalkableWithOverride(
  base: (cell: Cell) => boolean,
  overrideCells: Cell[],
  grid: Grid
): (cell: Cell) => boolean {
  const overrideKeys = new Set<number>();
  for (const c of overrideCells) {
    overrideKeys.add(cellKey(c, grid));
  }

  return (cell: Cell) => {
    if (overrideKeys.has(cellKey(cell, grid))) return true;
    return base(cell);
  };
}

function snapEndpointsToOriginal(
  points: RoutePoint[],
  start: RoutePoint,
  end: RoutePoint
) {
  const next = [...points];
  prependIfDistinct(next, start);
  appendIfDistinct(next, end);
  return next;
}

function enumerateCandidateCells(blockedCell: Cell, maxRadiusCells: number) {
  const seen = new Set<string>();
  const candidates: Array<{ cell: Cell; radius: number }> = [];
  const pushCandidate = (cell: Cell, radius: number) => {
    const key = `${cell.x},${cell.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ cell, radius });
  };

  pushCandidate(blockedCell, 0);

  for (let radius = 1; radius <= maxRadiusCells; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      pushCandidate({ x: blockedCell.x + dx, y: blockedCell.y - radius }, radius);
      pushCandidate({ x: blockedCell.x + dx, y: blockedCell.y + radius }, radius);
    }
    for (let dy = -radius + 1; dy <= radius - 1; dy += 1) {
      pushCandidate({ x: blockedCell.x - radius, y: blockedCell.y + dy }, radius);
      pushCandidate({ x: blockedCell.x + radius, y: blockedCell.y + dy }, radius);
    }
  }

  return candidates;
}

function findNearestWalkableCell(
  blockedCell: Cell,
  grid: Grid,
  isWalkable: (cell: Cell) => boolean,
  maxRadiusCells: number
): { cell: Cell; radius: number } | null {
  for (let radius = 1; radius <= maxRadiusCells; radius += 1) {
    const candidates: Cell[] = [];

    for (let dx = -radius; dx <= radius; dx += 1) {
      candidates.push({ x: blockedCell.x + dx, y: blockedCell.y - radius });
      candidates.push({ x: blockedCell.x + dx, y: blockedCell.y + radius });
    }
    for (let dy = -radius + 1; dy <= radius - 1; dy += 1) {
      candidates.push({ x: blockedCell.x - radius, y: blockedCell.y + dy });
      candidates.push({ x: blockedCell.x + radius, y: blockedCell.y + dy });
    }

    const walkableCandidates = candidates
      .filter((candidate) => isCellWithinGrid(candidate, grid) && isWalkable(candidate))
      .sort((left, right) => {
        const leftDx = left.x - blockedCell.x;
        const leftDy = left.y - blockedCell.y;
        const rightDx = right.x - blockedCell.x;
        const rightDy = right.y - blockedCell.y;
        const leftDist = leftDx * leftDx + leftDy * leftDy;
        const rightDist = rightDx * rightDx + rightDy * rightDy;
        if (leftDist !== rightDist) return leftDist - rightDist;
        if (left.y !== right.y) return left.y - right.y;
        return left.x - right.x;
      });

    if (walkableCandidates.length > 0) {
      return { cell: walkableCandidates[0]!, radius };
    }
  }

  return null;
}

function smoothFoundPath(
  start: RoutePoint,
  end: RoutePoint,
  gridPath: RoutePoint[],
  obstacles: RouteObstacle[],
  config: ResolvedGridRouteSolverConfig
) {
  const raw = removeDuplicatePoints([start, ...gridPath, end]);
  const collinear = removeRedundantCollinearPoints(raw);
  return simplifyRouteLineOfSight(
    collinear,
    obstacles,
    config.clearanceM,
    isRouteSegmentClear
  );
}

function getRectIntersection(
  left: ReturnType<typeof inflateRack>,
  right: ReturnType<typeof inflateRack>
) {
  const x = Math.max(left.x, right.x);
  const y = Math.max(left.y, right.y);
  const maxX = Math.min(left.x + left.width, right.x + right.width);
  const maxY = Math.min(left.y + left.height, right.y + right.height);

  if (maxX < x || maxY < y) return null;

  return {
    x,
    y,
    width: maxX - x,
    height: maxY - y
  };
}

function countBlockedGridCells(grid: Grid, isWalkable: (cell: Cell) => boolean) {
  const blockedCells: Cell[] = [];

  for (let y = 0; y < grid.rows; y += 1) {
    for (let x = 0; x < grid.cols; x += 1) {
      if (!isWalkable({ x, y })) blockedCells.push({ x, y });
    }
  }

  return blockedCells;
}

function buildRouteSolveDiagnostics({
  bounds,
  grid,
  obstacles,
  startCell,
  endCell,
  startSnap,
  endSnap,
  blockedGridCells,
  pathCells,
  pathWorldPoints,
  blockedGridCellCount
}: {
  bounds: Bounds;
  grid: Grid;
  obstacles: RouteObstacle[];
  startCell: Cell;
  endCell: Cell;
  startSnap: { cell: Cell; radius: number } | null;
  endSnap: { cell: Cell; radius: number } | null;
  blockedGridCells: Cell[];
  pathCells?: Cell[];
  pathWorldPoints?: RoutePoint[];
  blockedGridCellCount: number;
}): RouteSolveDiagnostics {
  return {
    grid: {
      minX: grid.minX,
      minY: grid.minY,
      resolutionM: grid.resolutionM
    },
    originalStartCell: toRouteGridCell(startCell),
    originalEndCell: toRouteGridCell(endCell),
    ...(startSnap ? { snappedStartCell: toRouteGridCell(startSnap.cell) } : {}),
    ...(endSnap ? { snappedEndCell: toRouteGridCell(endSnap.cell) } : {}),
    solverBounds: {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY
    },
    obstacleCount: obstacles.length,
    blockedGridCellCount,
    blockedGridCells: blockedGridCells.map(toRouteGridCell),
    pathGridCells: pathCells?.map(toRouteGridCell) ?? [],
    pathWorldPoints: pathWorldPoints ? [...pathWorldPoints] : []
  };
}

export function solveGridRoute(
  start: RoutePoint,
  end: RoutePoint,
  obstacles: RouteObstacle[],
  configInput: GridRouteSolverConfig = {},
  options: SolveGridRouteOptions = {}
): RouteSolveResult {
  const config = resolveGridRouteSolverConfig(configInput);
  const occupancyMode = options.occupancyMode ?? 'conservative';

  if (isPointBlocked(start, obstacles, config.clearanceM)) {
    return { status: 'start_blocked', points: [], cost: 0 };
  }
  if (isPointBlocked(end, obstacles, config.clearanceM)) {
    return { status: 'end_blocked', points: [], cost: 0 };
  }

  // MVP/debug behavior: until floor boundaries are modeled, the solver creates
  // finite bounds from the requested endpoints and visible obstacles.
  const bounds = options.boundsOverride ?? inferBounds(start, end, obstacles, config);
  const grid = buildGrid(bounds, config);
  const gridCells = grid.cols * grid.rows;

  if (gridCells > config.maxGridCells) {
    return {
      status: 'no_path',
      points: [],
      cost: 0,
      debugReason: `grid_guard:${gridCells}`
    };
  }

  const startCell = pointToCell(start, grid);
  const endCell = pointToCell(end, grid);
  const isWalkable = buildCellWalkability(
    grid,
    obstacles,
    config.clearanceM,
    occupancyMode
  );
  const blockedGridCells = options.includeDiagnostics
    ? countBlockedGridCells(grid, isWalkable)
    : [];
  const blockedGridCellCount = blockedGridCells.length;
  const startSnap =
    isWalkable(startCell)
      ? null
      : findNearestWalkableCell(
          startCell,
          grid,
          isWalkable,
          config.maxEndpointSnapCells
        );
  const endSnap =
    isWalkable(endCell)
      ? null
      : findNearestWalkableCell(
          endCell,
          grid,
          isWalkable,
          config.maxEndpointSnapCells
        );

  const startOverride = !isWalkable(startCell) && !startSnap
    ? getEndpointOverride(start, startCell, grid, obstacles, config.clearanceM, occupancyMode)
    : null;
  const endOverride = !isWalkable(endCell) && !endSnap
    ? getEndpointOverride(end, endCell, grid, obstacles, config.clearanceM, occupancyMode)
    : null;

  if (!isWalkable(startCell) && !startSnap && !startOverride) {
    return {
      status: 'start_blocked',
      points: [],
      cost: 0,
      ...(options.includeDiagnostics
        ? {
            diagnostics: buildRouteSolveDiagnostics({
              bounds,
              grid,
              obstacles,
              startCell,
              endCell,
              startSnap,
              endSnap,
              blockedGridCells,
              blockedGridCellCount
            })
          }
        : {})
    };
  }
  if (!isWalkable(endCell) && !endSnap && !endOverride) {
    return {
      status: 'end_blocked',
      points: [],
      cost: 0,
      ...(options.includeDiagnostics
        ? {
            diagnostics: buildRouteSolveDiagnostics({
              bounds,
              grid,
              obstacles,
              startCell,
              endCell,
              startSnap,
              endSnap,
              blockedGridCells,
              blockedGridCellCount
            })
          }
        : {})
    };
  }

  const routedStartCell = startSnap?.cell ?? startCell;
  const routedEndCell = endSnap?.cell ?? endCell;

  let isWalkableForAStar = isWalkable;
  if (startOverride) {
    isWalkableForAStar = buildIsWalkableWithOverride(isWalkableForAStar, startOverride.cells, grid);
  }
  if (endOverride) {
    isWalkableForAStar = buildIsWalkableWithOverride(isWalkableForAStar, endOverride.cells, grid);
  }
  const routedStartPoint = cellToPoint(routedStartCell, grid);
  const routedEndPoint = cellToPoint(routedEndCell, grid);
  const startKey = cellKey(routedStartCell, grid);
  const endKey = cellKey(routedEndCell, grid);

  const frontier = new MinHeap();
  const cameFrom = new Map<number, number>();
  const costSoFar = new Map<number, number>([[startKey, 0]]);
  const visited = new Set<number>();
  frontier.push({
    key: startKey,
    priority: distance(routedStartPoint, routedEndPoint)
  });

  const directions = [
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: 1, dy: 1 }
  ];
  let expandedCells = 0;

  while (frontier.size > 0) {
    const currentItem = frontier.pop();
    if (!currentItem) break;
    if (visited.has(currentItem.key)) continue;
    visited.add(currentItem.key);
    expandedCells += 1;

    if (expandedCells > config.maxExpandedCells) {
      return {
        status: 'no_path',
        points: [],
        cost: 0,
        debugReason: `expanded_guard:${expandedCells}`
      };
    }

    if (currentItem.key === endKey) {
      const gridPathCells = reconstructPathCells(cameFrom, endKey, grid);
      const gridPath = reconstructPath(cameFrom, endKey, grid);
      const snappedPath = smoothFoundPath(
        routedStartPoint,
        routedEndPoint,
        gridPath,
        obstacles,
        config
      );
      const points = snapEndpointsToOriginal(snappedPath, start, end);
      const snapTags = [
        startSnap ? `start_snap:r${startSnap.radius}` : null,
        endSnap ? `end_snap:r${endSnap.radius}` : null
      ].filter(Boolean);
      const overrideTags = [
        startOverride ? 'start_override' : null,
        endOverride ? 'end_override' : null
      ].filter(Boolean);
      return {
        status: 'ok',
        points,
        cost: totalPathCost(points),
        ...(options.includeDiagnostics
          ? {
              diagnostics: buildRouteSolveDiagnostics({
                bounds,
                grid,
                obstacles,
                startCell,
                endCell,
                startSnap,
                endSnap,
                blockedGridCells,
                pathCells: gridPathCells,
                pathWorldPoints: points,
                blockedGridCellCount
              })
            }
          : {}),
        ...(snapTags.length > 0 || overrideTags.length > 0
          ? {
              debugReason: [...snapTags, ...overrideTags].join(',')
            }
          : {})
      };
    }

    const currentCell = keyToCell(currentItem.key, grid);
    const currentPoint = cellToPoint(currentCell, grid);

    for (const direction of directions) {
      const nextCell = {
        x: currentCell.x + direction.dx,
        y: currentCell.y + direction.dy
      };

      if (!isWalkableForAStar(nextCell)) continue;

      const isDiagonal = direction.dx !== 0 && direction.dy !== 0;
      if (isDiagonal) {
        const horizontal = { x: currentCell.x + direction.dx, y: currentCell.y };
        const vertical = { x: currentCell.x, y: currentCell.y + direction.dy };
        if (!isWalkableForAStar(horizontal) || !isWalkableForAStar(vertical)) continue;
      }

      const nextPoint = cellToPoint(nextCell, grid);
      if (!isRouteSegmentClear(currentPoint, nextPoint, obstacles, config.clearanceM)) {
        continue;
      }

      const nextKey = cellKey(nextCell, grid);
      const movementCost = isDiagonal
        ? config.resolutionM * Math.SQRT2
        : config.resolutionM;
      const nextCost = costSoFar.get(currentItem.key)! + movementCost;

      if (!costSoFar.has(nextKey) || nextCost < costSoFar.get(nextKey)!) {
        costSoFar.set(nextKey, nextCost);
        cameFrom.set(nextKey, currentItem.key);
        frontier.push({
          key: nextKey,
          priority: nextCost + distance(nextPoint, routedEndPoint)
        });
      }
    }
  }

  return {
    status: 'no_path',
    points: [],
    cost: 0,
    ...(options.includeDiagnostics
      ? {
          diagnostics: buildRouteSolveDiagnostics({
            bounds,
            grid,
            obstacles,
            startCell,
            endCell,
            startSnap,
            endSnap,
            blockedGridCells,
            blockedGridCellCount
          })
        }
      : {})
  };
}

export function inspectGridRouteEndpointCandidates(
  start: RoutePoint,
  end: RoutePoint,
  obstacles: RouteObstacle[],
  configInput: GridRouteSolverConfig = {},
  options: Omit<SolveGridRouteOptions, 'includeDiagnostics'> & {
    endpoint: 'start' | 'end';
    maxRadiusCells: number;
  }
) {
  const config = resolveGridRouteSolverConfig(configInput);
  const occupancyMode = options.occupancyMode ?? 'conservative';
  const bounds = options.boundsOverride ?? inferBounds(start, end, obstacles, config);
  const grid = buildGrid(bounds, config);
  const originCell = pointToCell(options.endpoint === 'start' ? start : end, grid);
  const candidates = enumerateCandidateCells(originCell, options.maxRadiusCells)
    .filter(({ cell }) => isCellWithinGrid(cell, grid))
    .map<RouteEndpointCandidateInspection>(({ cell, radius }) => {
      const blockers = getCellBlockReasons(
        cell,
        grid,
        obstacles,
        config.clearanceM,
        occupancyMode
      );

      return {
        radius,
        cell: toRouteGridCell(cell),
        worldCenter: cellToPoint(cell, grid),
        blocked: blockers.length > 0,
        blockers
      };
    });
  const isWalkable = buildCellWalkability(
    grid,
    obstacles,
    config.clearanceM,
    occupancyMode
  );

  return {
    bounds,
    grid: {
      minX: grid.minX,
      minY: grid.minY,
      cols: grid.cols,
      rows: grid.rows,
      resolutionM: grid.resolutionM
    },
    originalCell: toRouteGridCell(originCell),
    blockedGridCellCount: countBlockedGridCells(grid, isWalkable).length,
    candidates
  };
}
