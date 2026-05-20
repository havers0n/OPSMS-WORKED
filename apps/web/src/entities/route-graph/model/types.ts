export type RouteGraphNodeKind =
  | 'walkway'
  | 'junction'
  | 'pick_point'
  | 'packing_station';

export type RouteGraphPoint = {
  x: number;
  y: number;
};

export type RouteGraphNode = {
  id: string;
  floorId: string;
  x: number;
  y: number;
  kind: RouteGraphNodeKind;
  label: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RouteGraphEdge = {
  id: string;
  floorId: string;
  sourceNodeId: string;
  targetNodeId: string;
  cost: number;
  reverseCost: number;
  points: RouteGraphPoint[];
  createdAt: string;
  updatedAt: string;
};

export type RouteGraph = {
  nodes: RouteGraphNode[];
  edges: RouteGraphEdge[];
};
