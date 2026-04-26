/**
 * Draft vocabulary for future picking planning + routing architecture.
 *
 * This module is intentionally additive and type-only:
 * - no runtime behavior
 * - no persistence contract changes
 * - no wiring into current pick execution
 */

export type PickingMethod =
  | 'single_order'
  | 'batch'
  | 'wave_bulk'
  | 'cluster'
  | 'zone'
  | 'pick_and_pack'
  | 'two_step';

export type RoutePriorityMode =
  | 'location_sequence'
  | 'address_sequence'
  | 'distance'
  | 'handling'
  | 'hybrid';

export type WorkSplitPolicy = {
  maxPickLines?: number;
  maxEstimatedPickTimeSec?: number;
  maxWeightKg?: number;
  maxVolumeLiters?: number;
  maxUniqueLocations?: number;
  maxZones?: number;
};

export type PickingStrategy = {
  id: string;
  code: string;
  name: string;
  method: PickingMethod;
  aggregateSameSku: boolean;
  preserveOrderSeparation: boolean;
  requiresCartSlots: boolean;
  requiresPostSort: boolean;
  routePriorityMode: RoutePriorityMode;
  splitPolicy: WorkSplitPolicy;
};

/**
 * Candidate generated before execution-level task materialization.
 * Uses executable storage identity (fromLocationId = locations.id).
 */
export type PickTaskCandidate = {
  id: string;
  skuId: string;
  fromLocationId: string;
  qty: number;
  orderRefs: {
    orderId: string;
    orderLineId: string;
    qty: number;
  }[];
  weightKg?: number;
  volumeLiters?: number;
  handlingClass?:
    | 'normal'
    | 'heavy'
    | 'bulky'
    | 'fragile'
    | 'cold'
    | 'frozen'
    | 'hazmat';
};

/**
 * Planned work unit to be sequenced; not tied to execution persistence yet.
 */
export type WorkPackage = {
  id: string;
  strategyId: string;
  method: PickingMethod;
  tasks: PickTaskCandidate[];
  assignedPickerId?: string;
  assignedZoneId?: string;
  assignedCartId?: string;
  totalWeightKg?: number;
  totalVolumeLiters?: number;
  estimatedDistanceMeters?: number;
  estimatedTimeSec?: number;
  complexityScore?: number;
};

/**
 * Deterministic route output over an already-created WorkPackage.
 */
export type RouteStep = {
  sequence: number;
  taskId: string;
  fromLocationId: string;
  skuId: string;
  qtyToPick: number;
  allocations: {
    orderId: string;
    orderLineId?: string;
    qty: number;
    cartSlotId?: string;
  }[];
  handlingInstruction?: string;
};

export type Cart = {
  id: string;
  code: string;
  maxWeightKg?: number;
  maxVolumeLiters?: number;
  slots: CartSlot[];
};

export type CartSlot = {
  id: string;
  code: string;
  assignedOrderId?: string;
};

/**
 * Read-optimized projection for route/planning services.
 *
 * Important: `id` is the executable storage identity (`locations.id`).
 * `cellId` is optional bridge metadata for geometry/display concerns.
 */
export type StorageLocationProjection = {
  id: string;
  warehouseId: string;
  zoneId?: string;
  pickZoneId?: string;
  taskZoneId?: string;
  allocationZoneId?: string;
  rackId?: string;
  faceId?: string;
  sectionId?: string;
  levelSlotId?: string;
  cellId?: string;
  addressLabel: string;
  pickSequence?: number;
  routeSequence?: number;
  accessAisleId?: string;
  sideOfAisle?: 'left' | 'right';
  positionAlongAisle?: number;
  travelNodeId?: string;
  x?: number;
  y?: number;
};

export type PickAisle = {
  id: string;
  code: string;
  name?: string;
  tenantId: string;
  floorId: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  widthMm?: number;
  routeSequence?: number;
  status?: 'active' | 'inactive';
};

export type FaceAccess = {
  id?: string;
  tenantId?: string;
  rackId: string;
  faceId: string;
  aisleId: string;
  sideOfAisle?: 'left' | 'right';
  positionAlongAisle?: number;
  normalX?: number;
  normalY?: number;
};
