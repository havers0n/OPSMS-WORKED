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
  layoutDraftResponseSchema,
  layoutVersionIdResponseSchema,
  publishResponseSchema,
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
    .order('name', { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as ProductRow[];
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
        query: z.string().trim().optional()
      })
      .parse(request.query);

    const supabase = getUserSupabase(auth);
    const products = await fetchActiveProducts(supabase);
    const normalizedQuery = queryParams.query?.toLocaleLowerCase() ?? '';
    const filteredProducts =
      normalizedQuery.length === 0
        ? products
        : products.filter((product) => {
            const sku = product.sku?.toLocaleLowerCase() ?? '';
            const externalProductId = product.external_product_id.toLocaleLowerCase();
            const name = product.name.toLocaleLowerCase();

            return (
              name.includes(normalizedQuery) ||
              sku.includes(normalizedQuery) ||
              externalProductId.includes(normalizedQuery)
            );
          });

    return parseOrThrow(
      productsResponseSchema,
      filteredProducts.slice(0, 20).map(mapProductRowToDomain)
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
      .select(`
        id,
        tenant_id,
        external_number,
        status,
        priority,
        wave_id,
        created_at,
        released_at,
        closed_at,
        order_lines(qty_required, qty_picked)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const summaries = (data ?? []).map((row) => {
      const lines = (row.order_lines ?? []) as { qty_required: number; qty_picked: number }[];
      return mapOrderSummaryRowToDomain({
        id: row.id,
        tenant_id: row.tenant_id,
        external_number: row.external_number,
        status: row.status,
        priority: row.priority,
        wave_id: row.wave_id,
        created_at: row.created_at,
        released_at: row.released_at,
        closed_at: row.closed_at,
        line_count: lines.length,
        unit_count: lines.reduce((sum, l) => sum + l.qty_required, 0),
        picked_unit_count: lines.reduce((sum, l) => sum + l.qty_picked, 0)
      });
    });

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

    const { data, error } = await supabase
      .from('orders')
      .insert({
        tenant_id: tenantId,
        external_number: body.externalNumber,
        priority: body.priority,
        status: 'draft'
      })
      .select('id,tenant_id,external_number,status,priority,wave_id,created_at,released_at,closed_at')
      .single();

    if (error) {
      throw error;
    }

    return parseOrThrow(orderResponseSchema, mapOrderRowToDomain(data, []));
  });

  app.get('/api/orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const supabase = getUserSupabase(auth);

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,tenant_id,external_number,status,priority,wave_id,created_at,released_at,closed_at')
      .eq('id', orderId)
      .single();

    if (orderError || !orderRow) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
    }

    const { data: lineRows, error: linesError } = await supabase
      .from('order_lines')
      .select('id,order_id,tenant_id,sku,name,qty_required,qty_picked,status')
      .eq('order_id', orderId)
      .order('id', { ascending: true });

    if (linesError) {
      throw linesError;
    }

    const lines = (lineRows ?? []).map(mapOrderLineRowToDomain);
    return parseOrThrow(orderResponseSchema, mapOrderRowToDomain(orderRow, lines));
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

    // Guard: only editable in draft / ready
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

    const { data, error } = await supabase
      .from('order_lines')
      .insert({
        order_id: orderId,
        tenant_id: tenantId,
        sku: body.sku,
        name: body.name,
        qty_required: body.qtyRequired,
        status: 'pending'
      })
      .select('id,order_id,tenant_id,sku,name,qty_required,qty_picked,status')
      .single();

    if (error) {
      throw error;
    }

    void reply.code(201);
    return parseOrThrow(orderResponseSchema.shape.lines.element, mapOrderLineRowToDomain(data));
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

    const tenantId = auth.currentTenant.tenantId;
    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const body = parseOrThrow(transitionOrderStatusBodySchema, request.body);
    const supabase = getUserSupabase(auth);

    const { data: orderRow, error: orderError } = await supabase
      .from('orders')
      .select('id,status')
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

    // Real release flow: generate pick_task + pick_steps
    if (body.status === 'released') {
      const { data: lineRows, error: linesError } = await supabase
        .from('order_lines')
        .select('id,sku,name,qty_required')
        .eq('order_id', orderId);

      if (linesError) throw linesError;

      const lines = lineRows ?? [];
      if (lines.length === 0) {
        throw new ApiError(409, 'ORDER_HAS_NO_LINES', 'Cannot release an order with no lines.');
      }

      // Create pick_task
      const { data: taskRow, error: taskError } = await supabase
        .from('pick_tasks')
        .insert({ tenant_id: tenantId, source_type: 'order', source_id: orderId, status: 'ready' })
        .select('id')
        .single();

      if (taskError || !taskRow) throw taskError ?? new ApiError(500, 'TASK_CREATE_FAILED', 'Failed to create pick task.');

      // Create pick_steps from order_lines
      const steps = lines.map((line, idx) => ({
        task_id: taskRow.id,
        tenant_id: tenantId,
        order_id: orderId,
        order_line_id: line.id,
        sequence_no: idx + 1,
        sku: line.sku,
        item_name: line.name,
        qty_required: line.qty_required,
        status: 'pending'
      }));

      const { error: stepsError } = await supabase.from('pick_steps').insert(steps);
      if (stepsError) throw stepsError;

      // Update order_lines to released
      await supabase.from('order_lines').update({ status: 'released' }).eq('order_id', orderId);
    }

    const patch: Record<string, unknown> = { status: body.status };
    if (body.status === 'released') patch.released_at = new Date().toISOString();
    if (body.status === 'closed' || body.status === 'cancelled') patch.closed_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('orders')
      .update(patch)
      .eq('id', orderId)
      .select('id,tenant_id,external_number,status,priority,wave_id,created_at,released_at,closed_at')
      .single();

    if (error) throw error;

    const { data: updatedLineRows } = await supabase
      .from('order_lines')
      .select('id,order_id,tenant_id,sku,name,qty_required,qty_picked,status')
      .eq('order_id', orderId);

    const lines = (updatedLineRows ?? []).map(mapOrderLineRowToDomain);
    return parseOrThrow(orderResponseSchema, mapOrderRowToDomain(data, lines));
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
