import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError, z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCatalogProductItemRef } from '@wos/domain';
import { env } from './env.js';
import { ApiError, mapSupabaseError, sendApiError } from './errors.js';
import {
  addInventoryToContainerBodySchema,
  addInventoryToContainerResponseSchema,
  cellsResponseSchema,
  containerCurrentLocationResponseSchema,
  locationReferenceResponseSchema,
  locationOccupancyRowsResponseSchema,
  locationStorageSnapshotRowsResponseSchema,
  containerResponseSchema,
  containerStorageSnapshotResponseSchema,
  containersResponseSchema,
  moveContainerToLocationRequestBodySchema,
  moveContainerToLocationResponseSchema,
  transferInventoryUnitRequestBodySchema,
  transferInventoryUnitResponseSchema,
  pickPartialInventoryUnitRequestBodySchema,
  pickPartialInventoryUnitResponseSchema,
  createContainerResponseSchema,
  containerTypesResponseSchema,
  createContainerBodySchema,
  createFloorBodySchema,
  createLayoutDraftBodySchema,
  placementPlaceAtLocationBodySchema,
  createSiteBodySchema,
  currentWorkspaceResponseSchema,
  floorWorkspaceResponseSchema,
  floorsResponseSchema,
  idResponseSchema,
  inventoryItemResponseSchema,
  layoutDraftResponseSchema,
  layoutVersionIdResponseSchema,
  publishResponseSchema,
  productCatalogResponseSchema,
  productResponseSchema,
  productsResponseSchema,
  publishedLayoutSummaryResponseSchema,
  removeContainerResponseSchema,
  saveLayoutDraftBodySchema,
  sitesResponseSchema,
  validationResponseSchema,
  createOrderBodySchema,
  addOrderLineBodySchema,
  transitionOrderStatusBodySchema,
  ordersResponseSchema,
  orderResponseSchema,
  orderLineResponseSchema,
  createWaveBodySchema,
  transitionWaveStatusBodySchema,
  attachWaveOrderBodySchema,
  wavesResponseSchema,
  waveResponseSchema,
  pickTaskResponseSchema,
  pickTaskSummaryResponseSchema,
  pickTasksResponseSchema
} from './schemas.js';
import { getUserClient, requireAuth, type AuthenticatedRequestContext } from './auth.js';
import {
  mapCellRowToDomain,
  mapContainerRowToDomain,
  mapLocationOccupancyRowToDomain,
  mapLocationStorageSnapshotRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
  mapContainerTypeRowToDomain,
  mapFloorRowToDomain,
  mapInventoryUnitRowToLegacyInventoryItemDomain,
  mapLayoutDraftBundleToDomain,
  mapLayoutBundleJsonToDomain,
  mapProductRowToDomain,
  mapSiteRowToDomain,
  mapValidationResult,
  mapOrderLineRowToDomain,
  mapOrderRowToDomain,
  mapOrderSummaryRowToDomain,
  mapWaveRowToDomain,
  mapWaveSummaryRowToDomain,
  mapPickStepRowToDomain,
  mapPickTaskRowToDomain,
  mapPickTaskSummaryRowToDomain
} from './mappers.js';
import { createAnonClient } from './supabase.js';
import {
  ContainerNotFoundError,
  LocationNotActiveError,
  LocationNotFoundError,
  LocationOccupiedError
} from './features/placement/errors.js';
import {
  createPlacementCommandService,
  type PlacementCommandService
} from './features/placement/service.js';
import { createExecutionService } from './features/execution/service.js';
import {
  ExecutionContainerNotFoundError,
  ExecutionContainerNotPlacedError,
  ExecutionInventoryUnitNotFoundError,
  ExecutionInvalidSplitQuantityError,
  ExecutionSerialSplitNotAllowedError,
  ExecutionTargetContainerNotFoundError,
  ExecutionTargetContainerSameAsSourceError,
  ExecutionTargetContainerTenantMismatchError,
  ExecutionTargetLocationDimensionOverflowError,
  ExecutionTargetLocationDimensionUnknownError,
  ExecutionTargetLocationNotActiveError,
  ExecutionTargetLocationNotFoundError,
  ExecutionTargetLocationOccupiedError,
  ExecutionTargetLocationSameAsSourceError,
  ExecutionTargetLocationTenantMismatchError,
  ExecutionTargetLocationWeightOverflowError,
  ExecutionTargetLocationWeightUnknownError
} from './features/execution/errors.js';
import {
  attachProductsToRows,
  productSelectColumns,
  type ProductAwareRow,
  type ProductRow
} from './inventory-product-resolution.js';
import { createLocationReadRepo } from './features/location-read/location-read-repo.js';

type UserClientFactory = (context: AuthenticatedRequestContext) => SupabaseClient;
type PlacementServiceFactory = (context: AuthenticatedRequestContext) => PlacementCommandService;

type BuildAppOptions = {
  getAuthContext?: typeof requireAuth;
  getUserSupabase?: UserClientFactory;
  getHealthSupabase?: () => SupabaseClient;
  getPlacementService?: PlacementServiceFactory;
};

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

function getAllowedTransitions(currentStatus: string): string[] {
  switch (currentStatus) {
    case 'draft':     return ['ready', 'cancelled'];
    case 'ready':     return ['draft', 'released', 'cancelled'];
    case 'released':  return ['picking', 'cancelled'];
    case 'picking':   return ['picked', 'partial'];
    case 'picked':    return ['closed'];
    case 'partial':   return ['closed'];
    default:          return [];
  }
}

function getAllowedWaveTransitions(currentStatus: string): string[] {
  switch (currentStatus) {
    case 'draft': return ['ready'];
    case 'ready': return ['draft', 'released'];
    case 'released': return ['closed'];
    default: return [];
  }
}

type LayoutVersionRow = {
  id: string;
  floor_id: string;
  version_no: number;
  state: 'draft' | 'published' | 'archived';
  published_at?: string | null;
};

type WaveRelation = { name: string } | Array<{ name: string }> | null | undefined;

type OrderSummaryMetricsRow = {
  id: string;
  tenant_id: string;
  external_number: string;
  status: string;
  priority: number;
  wave_id: string | null;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
  waves?: WaveRelation;
  order_lines?: Array<{ qty_required: number; qty_picked: number }>;
};

type OrderRow = {
  id: string;
  tenant_id: string;
  external_number: string;
  status: string;
  priority: number;
  wave_id: string | null;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
  waves?: WaveRelation;
};

type WaveRow = {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
};

const orderSummarySelectColumns = `
  id,
  tenant_id,
  external_number,
  status,
  priority,
  wave_id,
  created_at,
  released_at,
  closed_at,
  waves(name),
  order_lines(qty_required, qty_picked)
`;

const orderSelectColumns = `
  id,
  tenant_id,
  external_number,
  status,
  priority,
  wave_id,
  created_at,
  released_at,
  closed_at,
  waves(name)
`;

const orderLineSelectColumns = 'id,order_id,tenant_id,product_id,sku,name,qty_required,qty_picked,status';
const waveSelectColumns = 'id,tenant_id,name,status,created_at,released_at,closed_at';

function getWaveNameFromRelation(relation: WaveRelation): string | null {
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null;
  }

  return relation?.name ?? null;
}

function mapOrderSummaryMetricsRow(row: OrderSummaryMetricsRow) {
  const lines = row.order_lines ?? [];

  return mapOrderSummaryRowToDomain({
    id: row.id,
    tenant_id: row.tenant_id,
    external_number: row.external_number,
    status: row.status,
    priority: row.priority,
    wave_id: row.wave_id,
    wave_name: getWaveNameFromRelation(row.waves),
    created_at: row.created_at,
    released_at: row.released_at,
    closed_at: row.closed_at,
    line_count: lines.length,
    unit_count: lines.reduce((sum, line) => sum + line.qty_required, 0),
    picked_unit_count: lines.reduce((sum, line) => sum + line.qty_picked, 0)
  });
}

function mapOrderRow(row: OrderRow, lines: ReturnType<typeof mapOrderLineRowToDomain>[]) {
  return mapOrderRowToDomain(
    {
      id: row.id,
      tenant_id: row.tenant_id,
      external_number: row.external_number,
      status: row.status,
      priority: row.priority,
      wave_id: row.wave_id,
      wave_name: getWaveNameFromRelation(row.waves),
      created_at: row.created_at,
      released_at: row.released_at,
      closed_at: row.closed_at
    },
    lines
  );
}

function buildWaveCounts(orders: Array<{ status: string }>) {
  const totalOrders = orders.length;
  const readyOrders = orders.filter((order) => order.status === 'ready').length;
  const blockingOrderCount = orders.filter((order) => order.status !== 'ready').length;

  return {
    totalOrders,
    readyOrders,
    blockingOrderCount
  };
}

function mapWaveSummaryWithCounts(row: WaveRow & { orders?: Array<{ status: string }> }) {
  const counts = buildWaveCounts(row.orders ?? []);

  return mapWaveSummaryRowToDomain({
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    released_at: row.released_at,
    closed_at: row.closed_at,
    total_orders: counts.totalOrders,
    ready_orders: counts.readyOrders,
    blocking_order_count: counts.blockingOrderCount
  });
}

function mapWaveWithOrders(row: WaveRow, orders: ReturnType<typeof mapOrderSummaryMetricsRow>[]) {
  const counts = buildWaveCounts(orders);

  return mapWaveRowToDomain(
    {
      id: row.id,
      tenant_id: row.tenant_id,
      name: row.name,
      status: row.status,
      created_at: row.created_at,
      released_at: row.released_at,
      closed_at: row.closed_at,
      total_orders: counts.totalOrders,
      ready_orders: counts.readyOrders,
      blocking_order_count: counts.blockingOrderCount
    },
    orders
  );
}

function mapReleaseOrderRpcError(error: { message?: string } | null) {
  const message = error?.message ?? 'ORDER_RELEASE_FAILED';

  switch (message) {
    case 'ORDER_NOT_FOUND':
      return new ApiError(404, 'ORDER_NOT_FOUND', 'Order was not found.');
    case 'ORDER_NOT_READY':
      return new ApiError(409, 'INVALID_TRANSITION', 'Only ready orders can be released.');
    case 'ORDER_HAS_NO_LINES':
      return new ApiError(409, 'ORDER_HAS_NO_LINES', 'Cannot release an order with no lines.');
    case 'ORDER_ALREADY_RELEASED':
      return new ApiError(409, 'ORDER_ALREADY_RELEASED', 'Order has already been released.');
    default:
      return error;
  }
}

function mapReleaseWaveRpcError(error: { message?: string } | null) {
  const message = error?.message ?? 'WAVE_RELEASE_FAILED';

  switch (message) {
    case 'WAVE_NOT_FOUND':
      return new ApiError(404, 'WAVE_NOT_FOUND', 'Wave was not found.');
    case 'WAVE_NOT_READY':
      return new ApiError(409, 'INVALID_WAVE_TRANSITION', 'Only ready waves can be released.');
    case 'WAVE_HAS_NO_ORDERS':
      return new ApiError(409, 'WAVE_HAS_NO_ORDERS', 'Cannot release an empty wave.');
    case 'WAVE_HAS_BLOCKING_ORDERS':
      return new ApiError(409, 'WAVE_HAS_BLOCKING_ORDERS', 'All attached orders must be ready before wave release.');
    default:
      return error;
  }
}

async function fetchProductById(supabase: SupabaseClient, productId: string) {
  const { data, error } = await supabase
    .from('products')
    .select(productSelectColumns)
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ProductRow | null) ?? null;
}

async function fetchActiveProducts(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('products')
    .select(productSelectColumns)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductRow[];
}

async function searchActiveProducts(supabase: SupabaseClient, query: string) {
  const normalizedQuery = query.trim();

  let request = supabase
    .from('products')
    .select(productSelectColumns)
    .eq('is_active', true);

  if (normalizedQuery.length > 0) {
    request = request.or(
      `name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%,external_product_id.ilike.%${normalizedQuery}%`
    );
  }

  const { data, error } = await request
    .order('name', { ascending: true })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductRow[];
}

async function fetchProductCatalog(
  supabase: SupabaseClient,
  args: { query: string; limit: number; offset: number; activeOnly: boolean }
) {
  const normalizedQuery = args.query.trim();

  let itemsRequest = supabase
    .from('products')
    .select(productSelectColumns);

  let totalRequest = supabase
    .from('products')
    .select('id', { count: 'exact', head: true });

  let activeTotalRequest = supabase
    .from('products')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);

  if (args.activeOnly) {
    itemsRequest = itemsRequest.eq('is_active', true);
    totalRequest = totalRequest.eq('is_active', true);
  }

  if (normalizedQuery.length > 0) {
    const expression = `name.ilike.%${normalizedQuery}%,sku.ilike.%${normalizedQuery}%,external_product_id.ilike.%${normalizedQuery}%`;
    itemsRequest = itemsRequest.or(expression);
    totalRequest = totalRequest.or(expression);
    activeTotalRequest = activeTotalRequest.or(expression);
  }

  const [
    { data: itemRows, error: itemsError },
    { count: total, error: totalError },
    { count: activeTotal, error: activeTotalError }
  ] = await Promise.all([
    itemsRequest
        .order('name', { ascending: true })
        .range(args.offset, args.offset + args.limit - 1),
    totalRequest.limit(1),
    activeTotalRequest.limit(1)
  ]);

  if (itemsError) throw itemsError;
  if (totalError) throw totalError;
  if (activeTotalError) throw activeTotalError;

  return {
    items: (itemRows ?? []) as ProductRow[],
    total: total ?? 0,
    activeTotal: activeTotal ?? 0,
    limit: args.limit,
    offset: args.offset
  };
}

async function fetchOrderResponse(supabase: SupabaseClient, orderId: string) {
  const { data: orderRow, error: orderError } = await supabase
    .from('orders')
    .select(orderSelectColumns)
    .eq('id', orderId)
    .single();

  if (orderError || !orderRow) {
    throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
  }

  const { data: lineRows, error: linesError } = await supabase
    .from('order_lines')
    .select(orderLineSelectColumns)
    .eq('order_id', orderId)
    .order('id', { ascending: true });

  if (linesError) {
    throw linesError;
  }

  const lines = (lineRows ?? []).map(mapOrderLineRowToDomain);
  return mapOrderRow(orderRow as OrderRow, lines);
}

async function fetchWaveRowById(supabase: SupabaseClient, waveId: string) {
  const { data, error } = await supabase
    .from('waves')
    .select(waveSelectColumns)
    .eq('id', waveId)
    .single();

  if (error || !data) {
    throw new ApiError(404, 'WAVE_NOT_FOUND', `Wave ${waveId} not found.`);
  }

  return data as WaveRow;
}

async function fetchWaveResponse(supabase: SupabaseClient, waveId: string) {
  const waveRow = await fetchWaveRowById(supabase, waveId);
  const { data: orderRows, error: ordersError } = await supabase
    .from('orders')
    .select(orderSummarySelectColumns)
    .eq('wave_id', waveId)
    .order('created_at', { ascending: true });

  if (ordersError) {
    throw ordersError;
  }

  const orders = ((orderRows ?? []) as OrderSummaryMetricsRow[]).map(mapOrderSummaryMetricsRow);
  return mapWaveWithOrders(waveRow, orders);
}

async function fetchLatestLayoutVersionByState(
  supabase: SupabaseClient,
  floorId: string,
  state: LayoutVersionRow['state']
) {
  const { data: layoutVersions, error: layoutVersionsError } = await supabase
    .from('layout_versions')
    .select('id,floor_id,version_no,state,published_at')
    .eq('floor_id', floorId);

  if (layoutVersionsError) {
    throw layoutVersionsError;
  }

  return ((layoutVersions ?? []) as LayoutVersionRow[])
    .filter((row) => row.state === state)
    .sort((a, b) => b.version_no - a.version_no)[0];
}

async function fetchLayoutVersionBundle(
  supabase: SupabaseClient,
  layoutVersion: LayoutVersionRow | null
) {
  if (!layoutVersion) {
    return null;
  }

  // Single SECURITY DEFINER RPC call replaces 4 sequential queries that each
  // triggered per-row RLS checks (can_access_rack → can_manage_layout_version
  // → can_manage_floor) causing statement timeouts on large layouts.
  const { data, error } = await supabase.rpc('get_layout_bundle', {
    layout_version_uuid: layoutVersion.id
  });

  if (error) throw error;

  return mapLayoutBundleJsonToDomain(data);
}

async function fetchActiveLayoutDraft(supabase: SupabaseClient, floorId: string) {
  const activeDraft = await fetchLatestLayoutVersionByState(supabase, floorId, 'draft');
  return fetchLayoutVersionBundle(supabase, activeDraft);
}

async function fetchLatestPublishedLayout(supabase: SupabaseClient, floorId: string) {
  const latestPublished = await fetchLatestLayoutVersionByState(supabase, floorId, 'published');
  return fetchLayoutVersionBundle(supabase, latestPublished);
}

async function fetchPublishedLayoutSummary(supabase: SupabaseClient, floorId: string) {
  const publishedVersion = await fetchLatestLayoutVersionByState(supabase, floorId, 'published');
  if (!publishedVersion) {
    return null;
  }

  const { data: sampleCells, count, error: sampleCellsError } = await supabase
    .from('cells')
    .select('address,address_sort_key', { count: 'exact' })
    .eq('layout_version_id', publishedVersion.id)
    .order('address_sort_key', { ascending: true })
    .limit(4);

  if (sampleCellsError) {
    throw sampleCellsError;
  }

  return {
    layoutVersionId: publishedVersion.id,
    floorId: publishedVersion.floor_id,
    versionNo: publishedVersion.version_no,
    publishedAt: publishedVersion.published_at ?? new Date(0).toISOString(),
    cellCount: count ?? sampleCells?.length ?? 0,
    sampleAddresses: (sampleCells ?? []).map((cell) => cell.address)
  };
}

function mapPlacementError(error: unknown): ApiError | null {
  if (error instanceof ContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', error.message);
  }

  if (error instanceof LocationNotFoundError) {
    return new ApiError(404, 'LOCATION_NOT_FOUND', error.message);
  }

  if (error instanceof LocationOccupiedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', error.message);
  }

  if (error instanceof LocationNotActiveError) {
    return new ApiError(409, 'LOCATION_NOT_WRITABLE', error.message);
  }

  return null;
}

function mapExecutionMoveError(error: unknown): ApiError | null {
  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Container is not currently placed.');
  }

  if (error instanceof ExecutionTargetLocationNotFoundError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell was not found.');
  }

  if (error instanceof ExecutionTargetLocationTenantMismatchError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell belongs to a different tenant.');
  }

  if (error instanceof ExecutionTargetLocationNotActiveError) {
    return new ApiError(409, 'INVALID_TARGET_CELL', 'Target cell is not currently writable.');
  }

  if (error instanceof ExecutionTargetLocationSameAsSourceError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Container is already in the target cell.');
  }

  if (error instanceof ExecutionTargetLocationOccupiedError) {
    return new ApiError(409, 'PLACEMENT_CONFLICT', 'Target cell is already occupied.');
  }

  if (error instanceof ExecutionTargetLocationDimensionUnknownError) {
    return new ApiError(409, 'PLACEMENT_CONSTRAINT', 'Target cell enforces dimensions that are missing on this container type.');
  }

  if (error instanceof ExecutionTargetLocationDimensionOverflowError) {
    return new ApiError(409, 'PLACEMENT_CONSTRAINT', 'Container dimensions exceed the target cell limits.');
  }

  if (error instanceof ExecutionTargetLocationWeightUnknownError) {
    return new ApiError(409, 'PLACEMENT_CONSTRAINT', 'Target cell enforces weight, but the container gross weight cannot be computed.');
  }

  if (error instanceof ExecutionTargetLocationWeightOverflowError) {
    return new ApiError(409, 'PLACEMENT_CONSTRAINT', 'Container gross weight exceeds the target cell limit.');
  }

  return null;
}

function mapExecutionLocationMoveError(error: unknown): ApiError | null {
  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'CONTAINER_LOCATION_UNSET', 'Container does not have a current execution location.');
  }

  if (error instanceof ExecutionTargetLocationNotFoundError) {
    return new ApiError(404, 'LOCATION_NOT_FOUND', 'Target location was not found.');
  }

  if (error instanceof ExecutionTargetLocationTenantMismatchError) {
    return new ApiError(409, 'LOCATION_TENANT_MISMATCH', 'Target location belongs to a different tenant.');
  }

  if (error instanceof ExecutionTargetLocationNotActiveError) {
    return new ApiError(409, 'LOCATION_NOT_WRITABLE', 'Target location is not active.');
  }

  if (error instanceof ExecutionTargetLocationSameAsSourceError) {
    return new ApiError(409, 'SAME_LOCATION', 'Container is already at the target location.');
  }

  if (error instanceof ExecutionTargetLocationOccupiedError) {
    return new ApiError(409, 'LOCATION_OCCUPIED', 'Target location already has an active container.');
  }

  if (error instanceof ExecutionTargetLocationDimensionUnknownError) {
    return new ApiError(409, 'LOCATION_DIMENSION_UNKNOWN', 'Target location enforces dimensions that are missing on this container type.');
  }

  if (error instanceof ExecutionTargetLocationDimensionOverflowError) {
    return new ApiError(409, 'LOCATION_DIMENSION_OVERFLOW', 'Container dimensions exceed the target location limits.');
  }

  if (error instanceof ExecutionTargetLocationWeightUnknownError) {
    return new ApiError(409, 'LOCATION_WEIGHT_UNKNOWN', 'Target location enforces weight, but the container gross weight cannot be computed.');
  }

  if (error instanceof ExecutionTargetLocationWeightOverflowError) {
    return new ApiError(409, 'LOCATION_WEIGHT_OVERFLOW', 'Container gross weight exceeds the target location weight limit.');
  }

  return null;
}

function mapExecutionTransferError(error: unknown): ApiError | null {
  if (error instanceof ExecutionInventoryUnitNotFoundError) {
    return new ApiError(404, 'INVENTORY_UNIT_NOT_FOUND', 'Inventory unit was not found.');
  }

  if (error instanceof ExecutionInvalidSplitQuantityError) {
    return new ApiError(409, 'INVALID_SPLIT_QUANTITY', 'Split quantity must be greater than zero and less than the source quantity.');
  }

  if (error instanceof ExecutionSerialSplitNotAllowedError) {
    return new ApiError(409, 'SERIAL_SPLIT_NOT_ALLOWED', 'Serial-tracked inventory units cannot be split.');
  }

  if (error instanceof ExecutionTargetContainerNotFoundError) {
    return new ApiError(404, 'TARGET_CONTAINER_NOT_FOUND', 'Target container was not found.');
  }

  if (error instanceof ExecutionTargetContainerTenantMismatchError) {
    return new ApiError(409, 'TARGET_CONTAINER_TENANT_MISMATCH', 'Target container belongs to a different tenant.');
  }

  if (error instanceof ExecutionTargetContainerSameAsSourceError) {
    return new ApiError(409, 'TARGET_CONTAINER_CONFLICT', 'Target container cannot be the same as the source container.');
  }

  if (error instanceof ExecutionContainerNotPlacedError) {
    return new ApiError(409, 'CONTAINER_LOCATION_UNSET', 'Source container does not have a current execution location.');
  }

  if (error instanceof ExecutionContainerNotFoundError) {
    return new ApiError(404, 'CONTAINER_NOT_FOUND', 'Source container was not found.');
  }

  return null;
}

function isContainerTypeConstraintError(error: unknown) {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const message = 'message' in error && typeof error.message === 'string' ? error.message : '';
  const details = 'details' in error && typeof error.details === 'string' ? error.details : '';
  const constraint = 'constraint' in error && typeof error.constraint === 'string' ? error.constraint : '';

  return [message, details, constraint].some((value) =>
    value.includes('container_type') || value.includes('containers_container_type_id_fkey')
  );
}

async function containerTypeExists(supabase: SupabaseClient, containerTypeId: string) {
  const { data, error } = await supabase
    .from('container_types')
    .select('id')
    .eq('id', containerTypeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function containerCodeExists(supabase: SupabaseClient, tenantId: string, externalCode: string) {
  const { data, error } = await supabase
    .from('containers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('external_code', externalCode)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

type InventoryWriteContainerRow = {
  id: string;
  tenant_id: string;
  status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
};

async function fetchInventoryWriteContainer(
  supabase: SupabaseClient,
  tenantId: string,
  containerId: string
) {
  const { data, error } = await supabase
    .from('containers')
    .select('id,tenant_id,status')
    .eq('tenant_id', tenantId)
    .eq('id', containerId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as InventoryWriteContainerRow | null;
}

function canContainerReceiveInventory(status: InventoryWriteContainerRow['status']) {
  return status === 'active';
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: {
      level: env.logLevel,
      base: {
        service: env.serviceName
      },
      redact: {
        paths: ['req.headers.authorization'],
        censor: '[REDACTED]'
      }
    }
  });

  const getAuthContext = options.getAuthContext ?? requireAuth;
  const getUserSupabase = options.getUserSupabase ?? getUserClient;
  const getHealthSupabase = options.getHealthSupabase ?? createAnonClient;
  const getPlacementService =
    options.getPlacementService ??
    ((context: AuthenticatedRequestContext) => createPlacementCommandService(getUserSupabase(context)));

  void app.register(cors, {
    origin: env.corsOrigin,
    credentials: true
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        route: request.routeOptions.url,
        method: request.method,
        statusCode: reply.statusCode,
        responseTimeMs: reply.elapsedTime
      },
      'request completed'
    );
  });

  app.get('/health', async () =>
    parseOrThrow(
      z.object({
        status: z.literal('ok'),
        service: z.string(),
        time: z.string()
      }),
      {
        status: 'ok',
        service: env.serviceName,
        time: new Date().toISOString()
      }
    )
  );

  app.get('/ready', async (_request, reply) => {
    const supabase = getHealthSupabase();
    const { error } = await supabase.from('sites').select('id').limit(1);

    if (error) {
      throw new ApiError(503, 'BFF_NOT_READY', 'Supabase connectivity check failed.');
    }

    return parseOrThrow(
      z.object({
        status: z.literal('ready'),
        service: z.string(),
        checks: z.object({
          supabase: z.literal('ok')
        })
      }),
      {
        status: 'ready',
        service: env.serviceName,
        checks: {
          supabase: 'ok'
        }
      }
    );
  });

  app.get('/api/sites', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.from('sites').select('id,code,name,timezone').order('name', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(sitesResponseSchema, (data ?? []).map(mapSiteRowToDomain));
  });

  app.get('/api/container-types', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('container_types')
      .select('id,code,description')
      .order('code', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(containerTypesResponseSchema, (data ?? []).map(mapContainerTypeRowToDomain));
  });

  app.get('/api/products', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const queryParams = z
      .object({
        query: z.string().trim().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
        offset: z.coerce.number().int().min(0).optional(),
        activeOnly: z
          .union([z.literal('true'), z.literal('false')])
          .optional()
      })
      .parse(request.query);

    const supabase = getUserSupabase(auth);
    const catalog = await fetchProductCatalog(supabase, {
      query: queryParams.query ?? '',
      limit: queryParams.limit ?? 50,
      offset: queryParams.offset ?? 0,
      activeOnly: queryParams.activeOnly === 'true'
    });

    return parseOrThrow(
      productCatalogResponseSchema,
      {
        items: catalog.items.map(mapProductRowToDomain),
        total: catalog.total,
        activeTotal: catalog.activeTotal,
        limit: catalog.limit,
        offset: catalog.offset
      }
    );
  });

  app.get('/api/products/search', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const queryParams = z
      .object({
        query: z.string().trim().optional()
      })
      .parse(request.query);

    const supabase = getUserSupabase(auth);
    const products =
      queryParams.query && queryParams.query.trim().length > 0
        ? await searchActiveProducts(supabase, queryParams.query)
        : await fetchActiveProducts(supabase);

    return parseOrThrow(
      productsResponseSchema,
      products.map(mapProductRowToDomain)
    );
  });

  app.get('/api/products/:productId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;

    const supabase = getUserSupabase(auth);
    const product = await fetchProductById(supabase, productId);

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Product was not found.');
    }

    return parseOrThrow(productResponseSchema, mapProductRowToDomain(product));
  });

  app.get('/api/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('containers')
      .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return parseOrThrow(containersResponseSchema, (data ?? []).map(mapContainerRowToDomain));
  });

  app.get('/api/locations/:locationId/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);

    if (!(await locationReadRepo.locationExists(locationId))) {
      throw new ApiError(404, 'LOCATION_NOT_FOUND', 'Location was not found.');
    }

    const rows = await locationReadRepo.listLocationContainers(locationId);
    return parseOrThrow(locationOccupancyRowsResponseSchema, rows.map(mapLocationOccupancyRowToDomain));
  });

  app.get('/api/locations/:locationId/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);

    if (!(await locationReadRepo.locationExists(locationId))) {
      throw new ApiError(404, 'LOCATION_NOT_FOUND', 'Location was not found.');
    }

    const data = await locationReadRepo.listLocationStorage(locationId);
    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      tenant_id: string;
      floor_id: string;
      location_id: string;
      location_code: string;
      location_type: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
      cell_id: string | null;
      container_id: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      placed_at: string;
      product_id?: string | null;
      quantity: number | null;
      uom: string | null;
    }>);

    return parseOrThrow(locationStorageSnapshotRowsResponseSchema, rows.map(mapLocationStorageSnapshotRowToDomain));
  });

  app.get('/api/locations/by-cell/:cellId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const cellId = parseOrThrow(idResponseSchema, { id: (request.params as { cellId: string }).cellId }).id;
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const ref = await locationReadRepo.getLocationByCell(cellId);

    if (!ref) {
      throw new ApiError(404, 'LOCATION_NOT_FOUND', 'No active location found for this cell.');
    }

    return parseOrThrow(locationReferenceResponseSchema, ref);
  });

  app.get('/api/floors/:floorId/location-occupancy', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const rows = await locationReadRepo.listFloorLocationOccupancy(floorId);

    return parseOrThrow(locationOccupancyRowsResponseSchema, rows.map(mapLocationOccupancyRowToDomain));
  });

  app.get('/api/floors/:floorId/published-cells', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = getUserSupabase(auth);
    const publishedVersion = await fetchLatestLayoutVersionByState(supabase, floorId, 'published');

    if (!publishedVersion) {
      return parseOrThrow(cellsResponseSchema, []);
    }

    const { data, error } = await supabase
      .from('cells')
      .select('id,layout_version_id,rack_id,rack_face_id,rack_section_id,rack_level_id,slot_no,address,address_sort_key,cell_code,x,y,status')
      .eq('layout_version_id', publishedVersion.id)
      .order('address_sort_key', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(cellsResponseSchema, (data ?? []).map(mapCellRowToDomain));
  });

  app.get('/api/containers/:containerId/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('container_storage_canonical_v')
      .select('tenant_id,container_id,external_code,container_type,container_status,item_ref,product_id,quantity,uom')
      .eq('container_id', containerId);

    if (error) {
      throw error;
    }

    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      tenant_id: string;
      container_id: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      product_id?: string | null;
      quantity: number | null;
      uom: string | null;
    }>);

    return parseOrThrow(containerStorageSnapshotResponseSchema, rows.map(mapContainerStorageSnapshotRowToDomain));
  });

  app.get('/api/me', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    return parseOrThrow(currentWorkspaceResponseSchema, {
      user: {
        id: auth.user.id,
        email: auth.user.email ?? 'unknown@local.invalid',
        displayName: auth.displayName
      },
      currentTenantId: auth.currentTenant?.tenantId ?? null,
      memberships: auth.memberships
    });
  });

  app.post('/api/sites', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createSiteBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for site creation.');
    }

    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('sites')
      .insert({ tenant_id: auth.currentTenant.tenantId, code: body.code, name: body.name, timezone: body.timezone })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(idResponseSchema, { id: data.id });
  });

  app.post('/api/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createContainerBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for container creation.');
    }

    const supabase = getUserSupabase(auth);
    const typeExists = await containerTypeExists(supabase, body.containerTypeId);
    if (!typeExists) {
      throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
    }

    const externalCodeExists = await containerCodeExists(
      supabase,
      auth.currentTenant.tenantId,
      body.externalCode
    );
    if (externalCodeExists) {
      throw new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.');
    }

    const { data, error } = await supabase
      .from('containers')
      .insert({
        tenant_id: auth.currentTenant.tenantId,
        container_type_id: body.containerTypeId,
        external_code: body.externalCode,
        created_by: auth.user.id
      })
      .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
      .single();

    if (error) {
      if ('code' in error && error.code === '23505') {
        throw new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.');
      }

      if ('code' in error && error.code === '23503' && isContainerTypeConstraintError(error)) {
        throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
      }

      throw error;
    }

    return parseOrThrow(createContainerResponseSchema, {
      containerId: data.id,
      externalCode: data.external_code ?? '',
      containerTypeId: data.container_type_id,
      status: data.status
    });
  });

  app.get('/api/sites/:siteId/floors', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const siteId = parseOrThrow(idResponseSchema, { id: (request.params as { siteId: string }).siteId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('floors')
      .select('id,site_id,code,name,sort_order')
      .eq('site_id', siteId)
      .order('sort_order', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(floorsResponseSchema, (data ?? []).map(mapFloorRowToDomain));
  });

  app.get('/api/containers/:containerId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('containers')
      .select('id,tenant_id,external_code,container_type_id,status,created_at,created_by')
      .eq('id', containerId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new ApiError(404, 'NOT_FOUND', 'Container was not found.');
    }

    return parseOrThrow(containerResponseSchema, mapContainerRowToDomain(data));
  });

  app.get('/api/containers/:containerId/location', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const currentLocation = await locationReadRepo.getContainerCurrentLocation(containerId);

    if (!currentLocation) {
      if (!(await locationReadRepo.containerExists(containerId))) {
        throw new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
      }

      return parseOrThrow(containerCurrentLocationResponseSchema, {
        containerId,
        currentLocationId: null,
        locationCode: null,
        locationType: null,
        cellId: null
      });
    }

    return parseOrThrow(containerCurrentLocationResponseSchema, currentLocation);
  });

  app.post('/api/containers/:containerId/remove', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('remove_container', {
      container_uuid: containerId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(removeContainerResponseSchema, data);
  });

  app.post('/api/placement/place-at-location', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementPlaceAtLocationBodySchema, request.body);
    const service = getPlacementService(auth);

    try {
      const result = await service.placeContainerAtLocation({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        locationId: body.locationId,
        actorId: auth.user.id
      });

      return result;
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });

  app.post('/api/containers/:containerId/move-to-location', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(moveContainerToLocationRequestBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.moveContainerCanonical({
        containerId,
        targetLocationId: body.targetLocationId,
        actorId: auth.user.id
      });

      return parseOrThrow(moveContainerToLocationResponseSchema, result);
    } catch (error) {
      throw mapExecutionLocationMoveError(error) ?? error;
    }
  });

  app.post('/api/containers/:containerId/inventory', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(addInventoryToContainerBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for inventory writes.');
    }
    const supabase = getUserSupabase(auth);
    const { data: container, error: containerError } = await supabase
      .from('containers')
      .select('id,status')
      .eq('tenant_id', auth.currentTenant.tenantId)
      .eq('id', containerId)
      .maybeSingle();

    if (containerError) {
      throw containerError;
    }

    if (!container) {
      throw new ApiError(404, 'CONTAINER_NOT_FOUND', 'Container was not found.');
    }

    if (container.status !== 'active') {
      throw new ApiError(409, 'CONTAINER_NOT_RECEIVABLE', 'Only active containers can receive inventory.');
    }

    const product = await fetchProductById(supabase, body.productId);

    if (!product || !product.is_active) {
      throw new ApiError(404, 'NOT_FOUND', 'Product was not found.');
    }

    const { data, error } = await supabase
      .from('inventory_unit')
      .insert({
        tenant_id: auth.currentTenant.tenantId,
        container_id: containerId,
        product_id: product.id,
        quantity: body.quantity,
        uom: body.uom,
        created_by: auth.user.id
      })
      .select('id,tenant_id,container_id,product_id,quantity,uom,lot_code,serial_no,expiry_date,status,created_at,updated_at,created_by')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(
      inventoryItemResponseSchema,
      mapInventoryUnitRowToLegacyInventoryItemDomain({
        ...data,
        product
      })
    );
  });

  app.post('/api/inventory/:inventoryUnitId/transfer', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const inventoryUnitId = parseOrThrow(idResponseSchema, { id: (request.params as { inventoryUnitId: string }).inventoryUnitId }).id;
    const body = parseOrThrow(transferInventoryUnitRequestBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.transferStock({
        inventoryUnitId,
        quantity: body.quantity,
        targetContainerId: body.targetContainerId,
        actorId: auth.user.id
      });

      return parseOrThrow(transferInventoryUnitResponseSchema, result);
    } catch (error) {
      throw mapExecutionTransferError(error) ?? error;
    }
  });

  app.post('/api/inventory/:inventoryUnitId/pick-partial', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const inventoryUnitId = parseOrThrow(idResponseSchema, { id: (request.params as { inventoryUnitId: string }).inventoryUnitId }).id;
    const body = parseOrThrow(pickPartialInventoryUnitRequestBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.pickPartial({
        inventoryUnitId,
        quantity: body.quantity,
        pickContainerId: body.pickContainerId,
        actorId: auth.user.id
      });

      return parseOrThrow(pickPartialInventoryUnitResponseSchema, result);
    } catch (error) {
      throw mapExecutionTransferError(error) ?? error;
    }
  });

  app.post('/api/floors', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createFloorBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('floors')
      .insert({
        site_id: body.siteId,
        code: body.code,
        name: body.name,
        sort_order: body.sortOrder
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(idResponseSchema, { id: data.id });
  });

  app.get('/api/floors/:floorId/layout-draft', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = getUserSupabase(auth);
    const draft = await fetchActiveLayoutDraft(supabase, floorId);
    return parseOrThrow(layoutDraftResponseSchema, draft);
  });

  app.get('/api/floors/:floorId/workspace', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = getUserSupabase(auth);
    const [activeDraft, latestPublished] = await Promise.all([
      fetchActiveLayoutDraft(supabase, floorId),
      fetchLatestPublishedLayout(supabase, floorId)
    ]);

    return parseOrThrow(floorWorkspaceResponseSchema, {
      floorId,
      activeDraft,
      latestPublished
    });
  });

  app.get('/api/floors/:floorId/published-layout', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = getUserSupabase(auth);
    const summary = await fetchPublishedLayoutSummary(supabase, floorId);
    return parseOrThrow(publishedLayoutSummaryResponseSchema, summary);
  });

  app.post('/api/layout-drafts', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createLayoutDraftBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('create_layout_draft', {
      floor_uuid: body.floorId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(idResponseSchema, { id: data });
  });

  app.post('/api/layout-drafts/save', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(saveLayoutDraftBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('save_layout_draft', {
      layout_payload: body.layoutDraft,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(layoutVersionIdResponseSchema, { layoutVersionId: data });
  });

  app.post('/api/layout-drafts/:layoutVersionId/validate', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('validate_layout_version', {
      layout_version_uuid: layoutVersionId
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(validationResponseSchema, mapValidationResult(data ?? { isValid: false, issues: [] }));
  });

  app.post('/api/layout-drafts/:layoutVersionId/publish', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('publish_layout_version', {
      layout_version_uuid: layoutVersionId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(publishResponseSchema, data);
  });

  // ── Orders ───────────────────────────────────────────────────────────────────

  app.get('/api/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const statusFilter = (request.query as { status?: string }).status ?? null;
    const supabase = getUserSupabase(auth);

    let query = supabase
      .from('orders')
      .select(orderSummarySelectColumns)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const summaries = ((data ?? []) as OrderSummaryMetricsRow[]).map(mapOrderSummaryMetricsRow);

    return parseOrThrow(ordersResponseSchema, summaries);
  });

  app.post('/api/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const body = parseOrThrow(createOrderBodySchema, request.body);
    const supabase = getUserSupabase(auth);

    if (body.waveId) {
      const wave = await fetchWaveRowById(supabase, body.waveId);

      if (wave.tenant_id !== tenantId) {
        throw new ApiError(404, 'WAVE_NOT_FOUND', `Wave ${body.waveId} not found.`);
      }

      if (wave.status !== 'draft' && wave.status !== 'ready') {
        throw new ApiError(409, 'WAVE_NOT_EDITABLE', 'Orders can only be created inside draft or ready waves.');
      }
    }

    const { data, error } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        external_number: body.externalNumber,
        priority: body.priority,
        wave_id: body.waveId ?? null,
        status: 'draft'
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(orderResponseSchema, await fetchOrderResponse(supabase, data.id));
  });

  app.get('/api/orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const supabase = getUserSupabase(auth);
    return parseOrThrow(orderResponseSchema, await fetchOrderResponse(supabase, orderId));
  });

  app.post('/api/orders/:orderId/lines', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const body = parseOrThrow(addOrderLineBodySchema, request.body);
    const supabase = getUserSupabase(auth);

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,status')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
    }

    if (orderRow.status !== 'draft' && orderRow.status !== 'ready') {
      throw new ApiError(409, 'ORDER_NOT_EDITABLE', `Cannot add lines to an order in status '${orderRow.status}'.`);
    }

    const product = await fetchProductById(supabase, body.productId);
    if (!product) {
      throw new ApiError(404, 'PRODUCT_NOT_FOUND', 'Product was not found.');
    }

    if (!product.is_active) {
      throw new ApiError(409, 'PRODUCT_INACTIVE', 'Inactive products cannot be added to orders.');
    }

    const { data, error } = await supabase
      .from('order_lines')
      .insert({
        order_id: orderId,
        tenant_id: tenantId,
        product_id: product.id,
        sku: product.sku ?? product.external_product_id,
        name: product.name,
        qty_required: body.qtyRequired,
        status: 'pending'
      })
      .select(orderLineSelectColumns)
      .single();

    if (error) {
      throw error;
    }

    void reply.code(201);
    return parseOrThrow(orderLineResponseSchema, mapOrderLineRowToDomain(data));
  });

  app.delete('/api/orders/:orderId/lines/:lineId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { orderId: string; lineId: string };
    const orderId = parseOrThrow(idResponseSchema, { id: params.orderId }).id;
    const lineId = parseOrThrow(idResponseSchema, { id: params.lineId }).id;
    const supabase = getUserSupabase(auth);

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,status')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
    }

    if (orderRow.status !== 'draft' && orderRow.status !== 'ready') {
      throw new ApiError(409, 'ORDER_NOT_EDITABLE', `Cannot remove lines from an order in status '${orderRow.status}'.`);
    }

    const { error } = await supabase
      .from('order_lines')
      .delete()
      .eq('id', lineId)
      .eq('order_id', orderId);

    if (error) {
      throw error;
    }

    void reply.code(204);
  });

  app.patch('/api/orders/:orderId/status', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const body = parseOrThrow(transitionOrderStatusBodySchema, request.body);
    const supabase = getUserSupabase(auth);

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,status,wave_id')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
    }

    // Validate transition
    const allowed = getAllowedTransitions(orderRow.status);
    if (!allowed.includes(body.status)) {
      throw new ApiError(409, 'INVALID_TRANSITION', `Cannot transition order from '${orderRow.status}' to '${body.status}'.`);
    }

    if (body.status === 'ready') {
      const { count, error: linesError } = await supabase
        .from('order_lines')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId);

      if (linesError) {
        throw linesError;
      }

      if (!count) {
        throw new ApiError(409, 'ORDER_HAS_NO_LINES', 'Cannot mark an order as ready until it has at least one line.');
      }
    }

    if (body.status === 'released') {
      if (orderRow.wave_id) {
        throw new ApiError(
          409,
          'ORDER_RELEASE_CONTROLLED_BY_WAVE',
          'This order belongs to a wave. Release is controlled by the wave.'
        );
      }

      const { error } = await supabase.rpc('release_order', { order_uuid: orderId });
      if (error) {
        throw mapReleaseOrderRpcError(error as { message?: string });
      }

      return parseOrThrow(orderResponseSchema, await fetchOrderResponse(supabase, orderId));
    }

    const patch: Record<string, unknown> = { status: body.status };
    if (body.status === 'closed' || body.status === 'cancelled') patch.closed_at = new Date().toISOString();

    const { error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', orderId)
      .select('id')
      .single();

    if (error) throw error;
    return parseOrThrow(orderResponseSchema, await fetchOrderResponse(supabase, orderId));
  });

  app.get('/api/orders/:orderId/execution', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const supabase = getUserSupabase(auth);

    // Find pick task for this order
    const { data: taskRows, error: taskError } = await supabase
      .from('pick_tasks')
      .select('id,tenant_id,source_type,source_id,status,assigned_to,started_at,completed_at,created_at')
      .eq('source_type', 'order')
      .eq('source_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (taskError) throw taskError;

    if (!taskRows || taskRows.length === 0) {
      return parseOrThrow(pickTasksResponseSchema, []);
    }

    const taskRow = taskRows[0];

    // Aggregate step counts
    const { data: stepRows, error: stepsError } = await supabase
      .from('pick_steps')
      .select('id,status')
      .eq('task_id', taskRow.id);

    if (stepsError) throw stepsError;

    const steps = stepRows ?? [];
    const totalSteps = steps.length;
    const completedSteps = steps.filter((s) => s.status === 'picked').length;
    const exceptionSteps = steps.filter((s) => s.status === 'skipped' || s.status === 'exception' || s.status === 'partial').length;

    return parseOrThrow(pickTasksResponseSchema, [
      mapPickTaskSummaryRowToDomain({
        ...taskRow,
        total_steps: totalSteps,
        completed_steps: completedSteps,
        exception_steps: exceptionSteps
      })
    ]);
  });

  app.get('/api/waves', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('waves')
      .select(`${waveSelectColumns},orders(status)`)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return parseOrThrow(
      wavesResponseSchema,
      ((data ?? []) as Array<WaveRow & { orders?: Array<{ status: string }> }>).map(mapWaveSummaryWithCounts)
    );
  });

  app.post('/api/waves', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const body = parseOrThrow(createWaveBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('waves')
      .insert({
        tenant_id: tenantId,
        name: body.name,
        status: 'draft'
      })
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(waveResponseSchema, await fetchWaveResponse(supabase, data.id));
  });

  app.get('/api/waves/:waveId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const supabase = getUserSupabase(auth);
    return parseOrThrow(waveResponseSchema, await fetchWaveResponse(supabase, waveId));
  });

  app.patch('/api/waves/:waveId/status', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const body = parseOrThrow(transitionWaveStatusBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const wave = await fetchWaveResponse(supabase, waveId);
    const allowed = getAllowedWaveTransitions(wave.status);

    if (!allowed.includes(body.status)) {
      throw new ApiError(409, 'INVALID_WAVE_TRANSITION', `Cannot transition wave from '${wave.status}' to '${body.status}'.`);
    }

    if (body.status === 'ready' && wave.totalOrders === 0) {
      throw new ApiError(409, 'WAVE_HAS_NO_ORDERS', 'Cannot mark an empty wave as ready.');
    }

    if (body.status === 'released') {
      if (wave.totalOrders === 0) {
        throw new ApiError(409, 'WAVE_HAS_NO_ORDERS', 'Cannot release an empty wave.');
      }

      if (wave.blockingOrderCount > 0) {
        throw new ApiError(409, 'WAVE_HAS_BLOCKING_ORDERS', 'All attached orders must be ready before wave release.');
      }

      const { error } = await supabase.rpc('release_wave', { wave_uuid: waveId });
      if (error) {
        throw mapReleaseWaveRpcError(error as { message?: string });
      }

      return parseOrThrow(waveResponseSchema, await fetchWaveResponse(supabase, waveId));
    }

    const patch: Record<string, unknown> = { status: body.status };
    if (body.status === 'closed') {
      patch.closed_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('waves')
      .update(patch)
      .eq('id', waveId)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(waveResponseSchema, await fetchWaveResponse(supabase, waveId));
  });

  app.post('/api/waves/:waveId/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const body = parseOrThrow(attachWaveOrderBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const wave = await fetchWaveRowById(supabase, waveId);

    if (wave.status !== 'draft' && wave.status !== 'ready') {
      throw new ApiError(409, 'WAVE_MEMBERSHIP_LOCKED', 'Released waves have immutable membership.');
    }

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,status,wave_id')
      .eq('id', body.orderId)
      .single();

    if (orderError || !orderRow) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${body.orderId} not found.`);
    }

    if (orderRow.wave_id === waveId) {
      throw new ApiError(409, 'ORDER_ALREADY_IN_WAVE', 'Order is already attached to this wave.');
    }

    if (orderRow.wave_id) {
      throw new ApiError(409, 'ORDER_ALREADY_IN_WAVE', 'Order already belongs to another wave.');
    }

    if (orderRow.status !== 'draft' && orderRow.status !== 'ready') {
      throw new ApiError(409, 'ORDER_NOT_ATTACHABLE', 'Only draft or ready orders can be attached to a wave.');
    }

    const { error } = await supabase
      .from('orders')
      .update({ wave_id: waveId })
      .eq('id', body.orderId)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(waveResponseSchema, await fetchWaveResponse(supabase, waveId));
  });

  app.delete('/api/waves/:waveId/orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { waveId: string; orderId: string };
    const waveId = parseOrThrow(idResponseSchema, { id: params.waveId }).id;
    const orderId = parseOrThrow(idResponseSchema, { id: params.orderId }).id;
    const supabase = getUserSupabase(auth);
    const wave = await fetchWaveRowById(supabase, waveId);

    if (wave.status !== 'draft' && wave.status !== 'ready') {
      throw new ApiError(409, 'WAVE_MEMBERSHIP_LOCKED', 'Released waves have immutable membership.');
    }

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,status,wave_id')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
    }

    if (orderRow.wave_id !== waveId) {
      throw new ApiError(409, 'ORDER_NOT_IN_WAVE', 'Order is not attached to this wave.');
    }

    if (orderRow.status !== 'draft' && orderRow.status !== 'ready') {
      throw new ApiError(409, 'ORDER_NOT_DETACHABLE', 'Only draft or ready orders can be detached from a wave.');
    }

    const { error } = await supabase
      .from('orders')
      .update({ wave_id: null })
      .eq('id', orderId)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(waveResponseSchema, await fetchWaveResponse(supabase, waveId));
  });

  app.setErrorHandler((error, request, reply) => {
    const mappedSupabaseError = mapSupabaseError(error);

    const apiError =
      error instanceof ZodError
        ? new ApiError(400, 'VALIDATION_ERROR', error.issues.map((issue) => issue.message).join('; '))
        : error instanceof ApiError
        ? error
        : mappedSupabaseError
        ? mappedSupabaseError
        : new ApiError(500, 'INTERNAL_ERROR', error instanceof Error ? error.message : 'Unexpected BFF error');

    request.log.error(
      {
        err: error,
        requestId: request.id,
        route: request.routeOptions.url,
        statusCode: apiError.statusCode,
        errorCode: apiError.code
      },
      'request failed'
    );

    void sendApiError(reply, apiError, request.id);
  });

  return app;
}
