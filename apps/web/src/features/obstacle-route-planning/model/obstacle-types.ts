export type RoutePoint = {
  x: number;
  y: number;
};

export type RouteGridCell = {
  x: number;
  y: number;
};

export type RouteSolverBounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type RouteSolveDiagnostics = {
  grid: {
    minX: number;
    minY: number;
    resolutionM: number;
  };
  originalStartCell: RouteGridCell;
  originalEndCell: RouteGridCell;
  snappedStartCell?: RouteGridCell;
  snappedEndCell?: RouteGridCell;
  solverBounds: RouteSolverBounds;
  obstacleCount: number;
  blockedGridCellCount: number;
  blockedGridCells: RouteGridCell[];
  pathGridCells: RouteGridCell[];
  pathWorldPoints: RoutePoint[];
};

export type RouteObstacle =
  | {
      type: 'rack';
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      type: 'wall';
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    };

export type RouteSolveStatus =
  | 'ok'
  | 'no_path'
  | 'start_blocked'
  | 'end_blocked';

export type RouteSolveResult =
  | {
      status: 'ok';
      points: RoutePoint[];
      cost: number;
      debugReason?: string;
      diagnostics?: RouteSolveDiagnostics;
    }
  | {
      status: 'no_path';
      points: [];
      cost: 0;
      debugReason?: string;
      diagnostics?: RouteSolveDiagnostics;
    }
  | {
      status: 'start_blocked';
      points: [];
      cost: 0;
      debugReason?: string;
      diagnostics?: RouteSolveDiagnostics;
    }
  | {
      status: 'end_blocked';
      points: [];
      cost: 0;
      debugReason?: string;
      diagnostics?: RouteSolveDiagnostics;
    };

export type GridRouteSolverConfig = {
  resolutionM?: number;
  clearanceM?: number;
  boundsMarginM?: number;
  maxExpandedCells?: number;
  maxGridCells?: number;
  maxEndpointSnapCells?: number;
};

export type ResolvedGridRouteSolverConfig = Required<GridRouteSolverConfig>;

export const DEFAULT_GRID_ROUTE_SOLVER_CONFIG: ResolvedGridRouteSolverConfig = {
  resolutionM: 0.5,
  clearanceM: 0.4,
  boundsMarginM: 5,
  maxExpandedCells: 200_000,
  maxGridCells: 250_000,
  maxEndpointSnapCells: 2
};
