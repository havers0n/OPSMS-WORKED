import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError, z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildCatalogProductItemRef, type PlacementCommandResponse } from '@wos/domain';
import { env } from './env.js';
import { ApiError, mapSupabaseError, sendApiError } from './errors.js';
import {
  addInventoryToContainerBodySchema,
  addInventoryToContainerResponseSchema,
  cellsResponseSchema,
  cellStorageSnapshotResponseSchema,
  cellSlotStorageResponseSchema,
  cellOccupancyResponseSchema,
  floorCellOccupancyRowsResponseSchema,
  containerResponseSchema,
  containerStorageSnapshotResponseSchema,
  containersResponseSchema,
  createContainerResponseSchema,
  containerTypesResponseSchema,
  createContainerBodySchema,
  createFloorBodySchema,
  createLayoutDraftBodySchema,
  moveContainerBodySchema,
  moveContainerResponseSchema,
  placementCommandResponse,
  placementMoveBodySchema,
  placementPlaceBodySchema,
  placementRemoveBodySchema,
  placeContainerBodySchema,
  placeContainerResponseSchema,
  createSiteBodySchema,
  currentWorkspaceResponseSchema,
  floorWorkspaceResponseSchema,
  floorsResponseSchema,
  idResponseSchema,
  inventoryItemsResponseSchema,
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
  mapCellOccupancyRowToDomain,
  mapCellRowToDomain,
  mapCellStorageSnapshotRowToDomain,
  mapContainerRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
  mapContainerTypeRowToDomain,
  mapFloorRowToDomain,
  mapInventoryItemRowToDomain,
  mapLayoutDraftBundleToDomain,
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
  ActivePlacementNotFoundError,
  ContainerAlreadyPlacedError,
  ContainerNotFoundError,
  CrossFloorPlacementMoveNotAllowedError,
  PlacementSourceMismatchError,
  PublishedLayoutNotFoundError,
  TargetCellNotFoundError,
  TargetCellSameAsSourceError
} from './features/placement/errors.js';
import {
  createPlacementCommandService,
  type PlacementCommandService
} from './features/placement/service.js';
import {
  attachProductsToRows,
  productSelectColumns,
  type ProductAwareRow,
  type ProductRow
} from './inventory-product-resolution.js';

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

type FloorCellOccupancyRow = {
  cellId: string;
  containerCount: number;
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

  const { data: racks, error: racksError } = await supabase
    .from('racks')
    .select('id,layout_version_id,display_code,kind,axis,x,y,total_length,depth,rotation_deg')
    .eq('layout_version_id', layoutVersion.id);

  if (racksError) {
    throw racksError;
  }

  if (!racks || racks.length === 0) {
    return {
      layoutVersionId: layoutVersion.id,
      floorId: layoutVersion.floor_id,
      state: layoutVersion.state,
      rackIds: [],
      racks: {}
    };
  }

  const rackIds = racks.map((rack) => rack.id);
  const { data: rackFaces, error: rackFacesError } = await supabase
    .from('rack_faces')
    .select('id,rack_id,side,enabled,slot_numbering_direction,is_mirrored,mirror_source_face_id,face_length')
    .in('rack_id', rackIds);

  if (rackFacesError) {
    throw rackFacesError;
  }

  const faceIds = (rackFaces ?? []).map((face) => face.id);
  const { data: rackSections, error: rackSectionsError } =
    faceIds.length > 0
      ? await supabase.from('rack_sections').select('id,rack_face_id,ordinal,length').in('rack_face_id', faceIds)
      : { data: [], error: null };

  if (rackSectionsError) {
    throw rackSectionsError;
  }

  const sectionIds = (rackSections ?? []).map((section) => section.id);
  const { data: rackLevels, error: rackLevelsError } =
    sectionIds.length > 0
      ? await supabase.from('rack_levels').select('id,rack_section_id,ordinal,slot_count').in('rack_section_id', sectionIds)
      : { data: [], error: null };

  if (rackLevelsError) {
    throw rackLevelsError;
  }

  return mapLayoutDraftBundleToDomain({
    layoutVersion,
    racks,
    rackFaces: rackFaces ?? [],
    rackSections: rackSections ?? [],
    rackLevels: rackLevels ?? []
  });
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

  if (error instanceof TargetCellNotFoundError) {
    return new ApiError(404, 'TARGET_CELL_NOT_FOUND', error.message);
  }

  if (error instanceof ContainerAlreadyPlacedError) {
    return new ApiError(409, 'CONTAINER_ALREADY_PLACED', error.message);
  }

  if (error instanceof PublishedLayoutNotFoundError) {
    return new ApiError(409, 'PUBLISHED_LAYOUT_NOT_FOUND', error.message);
  }

  if (error instanceof ActivePlacementNotFoundError) {
    return new ApiError(409, 'ACTIVE_PLACEMENT_NOT_FOUND', error.message);
  }

  if (error instanceof PlacementSourceMismatchError) {
    return new ApiError(409, 'PLACEMENT_SOURCE_MISMATCH', error.message);
  }

  if (error instanceof TargetCellSameAsSourceError) {
    return new ApiError(409, 'TARGET_CELL_SAME_AS_SOURCE', error.message);
  }

  if (error instanceof CrossFloorPlacementMoveNotAllowedError) {
    return new ApiError(409, 'CROSS_FLOOR_MOVE_NOT_ALLOWED', error.message);
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

  app.get('/api/cells/:cellId/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const cellId = parseOrThrow(idResponseSchema, { id: (request.params as { cellId: string }).cellId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('cell_occupancy_v')
      .select('tenant_id,cell_id,container_id,external_code,container_type,container_status,placed_at')
      .eq('cell_id', cellId)
      .order('placed_at', { ascending: true });

    if (error) {
      throw error;
    }

    return parseOrThrow(cellOccupancyResponseSchema, (data ?? []).map(mapCellOccupancyRowToDomain));
  });

  app.get('/api/cells/:cellId/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const cellId = parseOrThrow(idResponseSchema, { id: (request.params as { cellId: string }).cellId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('cell_storage_snapshot_v')
      .select('tenant_id,cell_id,container_id,external_code,container_type,container_status,placed_at,item_ref,product_id,quantity,uom')
      .eq('cell_id', cellId)
      .order('placed_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      tenant_id: string;
      cell_id: string;
      container_id: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      placed_at: string;
      product_id?: string | null;
      quantity: number | null;
      uom: string | null;
    }>);

    return parseOrThrow(cellStorageSnapshotResponseSchema, rows.map(mapCellStorageSnapshotRowToDomain));
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

  app.get('/api/floors/:floorId/cell-occupancy', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = getUserSupabase(auth);
    const publishedVersion = await fetchLatestLayoutVersionByState(supabase, floorId, 'published');

    if (!publishedVersion) {
      return parseOrThrow(floorCellOccupancyRowsResponseSchema, []);
    }

    const { data: cells, error: cellsError } = await supabase
      .from('cells')
      .select('id')
      .eq('layout_version_id', publishedVersion.id);

    if (cellsError) {
      throw cellsError;
    }

    const cellIds = (cells ?? []).map((cell) => cell.id);
    if (cellIds.length === 0) {
      return parseOrThrow(floorCellOccupancyRowsResponseSchema, []);
    }

    const { data: occupancyRows, error: occupancyError } = await supabase
      .from('cell_occupancy_v')
      .select('cell_id')
      .in('cell_id', cellIds);

    if (occupancyError) {
      throw occupancyError;
    }

    const countsByCellId = new Map<string, number>();
    for (const row of occupancyRows ?? []) {
      const nextCount = (countsByCellId.get(row.cell_id) ?? 0) + 1;
      countsByCellId.set(row.cell_id, nextCount);
    }

    const response: FloorCellOccupancyRow[] = cellIds.flatMap((cellId) => {
      const containerCount = countsByCellId.get(cellId);
      return containerCount ? [{ cellId, containerCount }] : [];
    });

    return parseOrThrow(floorCellOccupancyRowsResponseSchema, response);
  });

  /**
   * GET /api/rack-sections/:sectionId/slots/:slotNo/storage
   *
   * Returns cell storage snapshot rows for all cells in a given rack section slot.
   * This endpoint exists because the web has no direct DB access — it needs a
   * structural lookup path (sectionId + slotNo) rather than a persisted cell UUID.
   *
   * Cells only exist for published layout versions. If the layout has not been
   * published, the cells table will be empty for the section and an empty array
   * is returned (not an error — the inspector UI handles this state).
   */
  app.get('/api/rack-sections/:sectionId/slots/:slotNo/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { sectionId: string; slotNo: string };
    const rawSectionId = params.sectionId.trim();
    const slotNo = z.coerce.number().int().min(1).parse(params.slotNo);

    // Non-UUID section IDs come from in-memory sections that have never been
    // published. No persisted cells can exist for them — return the
    // "unpublished" response immediately without touching the DB.
    const sectionIdParsed = z.string().uuid().safeParse(rawSectionId);
    if (!sectionIdParsed.success) {
      return parseOrThrow(cellSlotStorageResponseSchema, { published: false, rows: [] });
    }
    const sectionId = sectionIdParsed.data;

    const supabase = getUserSupabase(auth);

    // Step 1: resolve persisted cell UUIDs for this section + slot.
    // A slot position spans one cell per level (e.g., 3 levels → 3 cells).
    const { data: cells, error: cellsError } = await supabase
      .from('cells')
      .select('id')
      .eq('rack_section_id', sectionId)
      .eq('slot_no', slotNo);

    if (cellsError) {
      throw cellsError;
    }

    const cellIds = (cells ?? []).map((c) => c.id);

    // Layout not yet published — no persisted cell UUIDs exist for this slot.
    if (cellIds.length === 0) {
      return parseOrThrow(cellSlotStorageResponseSchema, { published: false, rows: [] });
    }

    // Step 2: fetch storage snapshot for all cells in this slot.
    const { data, error } = await supabase
      .from('cell_storage_snapshot_v')
      .select('tenant_id,cell_id,container_id,external_code,container_type,container_status,placed_at,item_ref,product_id,quantity,uom')
      .in('cell_id', cellIds)
      .order('placed_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      tenant_id: string;
      cell_id: string;
      container_id: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      placed_at: string;
      product_id?: string | null;
      quantity: number | null;
      uom: string | null;
    }>);

    return parseOrThrow(cellSlotStorageResponseSchema, {
      published: true,
      rows: rows.map(mapCellStorageSnapshotRowToDomain)
    });
  });

  app.get('/api/containers/:containerId/inventory', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('inventory_items')
      .select('id,tenant_id,container_id,item_ref,product_id,quantity,uom,created_at,created_by')
      .eq('container_id', containerId)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      id: string;
      tenant_id: string;
      container_id: string;
      item_ref: string;
      product_id?: string | null;
      quantity: number;
      uom: string;
      created_at: string;
      created_by: string | null;
    }>);

    return parseOrThrow(inventoryItemsResponseSchema, rows.map(mapInventoryItemRowToDomain));
  });

  app.get('/api/containers/:containerId/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('container_storage_snapshot_v')
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

  app.post('/api/containers/:containerId/place', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(placeContainerBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('place_container', {
      container_uuid: containerId,
      cell_uuid: body.cellId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(placeContainerResponseSchema, data);
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

  app.post('/api/placement/place', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementPlaceBodySchema, request.body);
    const service = getPlacementService(auth);

    try {
      const result: PlacementCommandResponse = await service.placeContainer({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        targetCellId: body.targetCellId,
        actorId: auth.user.id
      });

      return parseOrThrow(placementCommandResponse, result);
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });

  app.post('/api/placement/remove', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementRemoveBodySchema, request.body);
    const service = getPlacementService(auth);

    try {
      const result: PlacementCommandResponse = await service.removeContainer({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        fromCellId: body.fromCellId,
        actorId: auth.user.id
      });

      return parseOrThrow(placementCommandResponse, result);
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });

  app.post('/api/placement/move', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for placement writes.');
    }

    const body = parseOrThrow(placementMoveBodySchema, request.body);
    const service = getPlacementService(auth);

    try {
      const result: PlacementCommandResponse = await service.moveContainer({
        tenantId: auth.currentTenant.tenantId,
        containerId: body.containerId,
        fromCellId: body.fromCellId,
        toCellId: body.toCellId,
        actorId: auth.user.id
      });

      return parseOrThrow(placementCommandResponse, result);
    } catch (error) {
      const apiError = mapPlacementError(error);
      if (apiError) {
        throw apiError;
      }

      throw error;
    }
  });

  app.post('/api/containers/:containerId/move', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(moveContainerBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase.rpc('move_container', {
      container_uuid: containerId,
      target_cell_uuid: body.targetCellId,
      actor_uuid: auth.user.id
    });

    if (error) {
      throw error;
    }

    return parseOrThrow(moveContainerResponseSchema, data);
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
      .from('inventory_items')
      .insert({
        tenant_id: auth.currentTenant.tenantId,
        container_id: containerId,
        product_id: product.id,
        item_ref: buildCatalogProductItemRef(product.id),
        quantity: body.quantity,
        uom: body.uom,
        created_by: auth.user.id
      })
      .select('id,tenant_id,container_id,item_ref,product_id,quantity,uom,created_at,created_by')
      .single();

    if (error) {
      if ('code' in error && error.code === '23505') {
        throw new ApiError(
          409,
          'INVENTORY_ROW_ALREADY_EXISTS',
          'An inventory row for this SKU and UOM already exists in the container.'
        );
      }

      throw error;
    }

    return parseOrThrow(
      inventoryItemResponseSchema,
      mapInventoryItemRowToDomain({
        ...data,
        product
      })
    );
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
