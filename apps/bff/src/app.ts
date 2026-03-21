import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError, z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { ApiError, mapSupabaseError, sendApiError } from './errors.js';
import {
  addInventoryToContainerBodySchema,
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
  pickTasksResponseSchema
} from './schemas.js';
import { getUserClient, requireAuth, type AuthenticatedRequestContext } from './auth.js';
import {
  mapContainerRowToDomain,
  mapLocationOccupancyRowToDomain,
  mapLocationStorageSnapshotRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
  mapContainerTypeRowToDomain,
  mapFloorRowToDomain,
  mapInventoryUnitRowToLegacyInventoryItemDomain,
  mapSiteRowToDomain,
  mapValidationResult
} from './mappers.js';
import { createAnonClient } from './supabase.js';
import {
  mapPlacementError
} from './features/placement/errors.js';
import {
  createPlacementCommandService,
  type PlacementCommandService
} from './features/placement/service.js';
import {
  createOrdersService,
  type OrdersService
} from './features/orders/service.js';
import {
  createWavesService,
  type WavesService
} from './features/waves/service.js';
import { createOrdersRepo } from './features/orders/repo.js';
import { createWavesRepo } from './features/waves/repo.js';
import { createProductsRepo } from './features/products/repo.js';
import { createLayoutRepo } from './features/layout/repo.js';
import {
  createLayoutService,
  type LayoutService
} from './features/layout/service.js';
import { createContainersRepo } from './features/containers/repo.js';
import { createExecutionService } from './features/execution/service.js';
import {
  mapExecutionLocationMoveError,
  mapExecutionTransferError
} from './features/execution/errors.js';
import {
  createInventoryService,
  type InventoryService
} from './features/inventory/service.js';
import { isContainerTypeConstraintError } from './features/containers/errors.js';
import {
  attachProductsToRows,
  type ProductAwareRow,
  type ProductRow
} from './inventory-product-resolution.js';
import { createLocationReadRepo } from './features/location-read/location-read-repo.js';

type UserClientFactory = (context: AuthenticatedRequestContext) => SupabaseClient;
type PlacementServiceFactory = (context: AuthenticatedRequestContext) => PlacementCommandService;
type OrdersServiceFactory = (context: AuthenticatedRequestContext) => OrdersService;
type WavesServiceFactory = (context: AuthenticatedRequestContext) => WavesService;
type InventoryServiceFactory = (context: AuthenticatedRequestContext) => InventoryService;
type LayoutServiceFactory = (context: AuthenticatedRequestContext) => LayoutService;

type BuildAppOptions = {
  getAuthContext?: typeof requireAuth;
  getUserSupabase?: UserClientFactory;
  getHealthSupabase?: () => SupabaseClient;
  getPlacementService?: PlacementServiceFactory;
  getOrdersService?: OrdersServiceFactory;
  getWavesService?: WavesServiceFactory;
  getInventoryService?: InventoryServiceFactory;
  getLayoutService?: LayoutServiceFactory;
};

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
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
  const getOrdersService =
    options.getOrdersService ??
    ((context: AuthenticatedRequestContext) => createOrdersService(getUserSupabase(context)));
  const getWavesService =
    options.getWavesService ??
    ((context: AuthenticatedRequestContext) => createWavesService(getUserSupabase(context)));
  const getInventoryService =
    options.getInventoryService ??
    ((context: AuthenticatedRequestContext) => createInventoryService(getUserSupabase(context)));
  const getLayoutService =
    options.getLayoutService ??
    ((context: AuthenticatedRequestContext) => createLayoutService(getUserSupabase(context)));

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
    const productsRepo = createProductsRepo(supabase);
    const catalog = await productsRepo.findCatalog({
      query: queryParams.query ?? '',
      limit: queryParams.limit ?? 50,
      offset: queryParams.offset ?? 0,
      activeOnly: queryParams.activeOnly === 'true'
    });

    return parseOrThrow(productCatalogResponseSchema, catalog);
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
    const productsRepo = createProductsRepo(supabase);
    const products =
      queryParams.query && queryParams.query.trim().length > 0
        ? await productsRepo.searchActive(queryParams.query)
        : await productsRepo.listActive();

    return parseOrThrow(productsResponseSchema, products);
  });

  app.get('/api/products/:productId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;

    const supabase = getUserSupabase(auth);
    const productsRepo = createProductsRepo(supabase);
    const product = await productsRepo.findById(productId);

    if (!product) {
      throw new ApiError(404, 'NOT_FOUND', 'Product was not found.');
    }

    return parseOrThrow(productResponseSchema, product);
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
    const layoutRepo = createLayoutRepo(supabase);
    const cells = await layoutRepo.listPublishedCells(floorId);

    return parseOrThrow(cellsResponseSchema, cells);
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
    const containersRepo = createContainersRepo(supabase);
    const typeExists = await containersRepo.containerTypeExists(body.containerTypeId);
    if (!typeExists) {
      throw new ApiError(400, 'INVALID_CONTAINER_TYPE', 'Container type was not found.');
    }

    const externalCodeExists = await containersRepo.containerCodeExists(
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

    const inventoryService = getInventoryService(auth);
    const rpcResult = await inventoryService.receiveInventoryUnit({
      tenantId: auth.currentTenant.tenantId,
      containerId,
      productId: body.productId,
      quantity: body.quantity,
      uom: body.uom,
      actorId: auth.user.id
    });

    return parseOrThrow(
      inventoryItemResponseSchema,
      mapInventoryUnitRowToLegacyInventoryItemDomain({
        ...rpcResult.inventoryUnit,
        product: rpcResult.product as ProductRow
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
    const layoutRepo = createLayoutRepo(supabase);
    const draft = await layoutRepo.findActiveDraft(floorId);
    return parseOrThrow(layoutDraftResponseSchema, draft);
  });

  app.get('/api/floors/:floorId/workspace', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, { id: (request.params as { floorId: string }).floorId }).id;
    const supabase = getUserSupabase(auth);
    const layoutRepo = createLayoutRepo(supabase);
    const [activeDraft, latestPublished] = await Promise.all([
      layoutRepo.findActiveDraft(floorId),
      layoutRepo.findLatestPublished(floorId)
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
    const layoutRepo = createLayoutRepo(supabase);
    const summary = await layoutRepo.findPublishedLayoutSummary(floorId);
    return parseOrThrow(publishedLayoutSummaryResponseSchema, summary);
  });

  app.post('/api/layout-drafts', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createLayoutDraftBodySchema, request.body);
    const layoutService = getLayoutService(auth);
    const id = await layoutService.createDraft(body.floorId, auth.user.id);

    return parseOrThrow(idResponseSchema, { id });
  });

  app.post('/api/layout-drafts/save', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(saveLayoutDraftBodySchema, request.body);
    const layoutService = getLayoutService(auth);
    const layoutVersionId = await layoutService.saveDraft(body.layoutDraft, auth.user.id);

    return parseOrThrow(layoutVersionIdResponseSchema, { layoutVersionId });
  });

  app.post('/api/layout-drafts/:layoutVersionId/validate', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const layoutService = getLayoutService(auth);
    const result = await layoutService.validateVersion(layoutVersionId);

    return parseOrThrow(validationResponseSchema, mapValidationResult(result));
  });

  app.post('/api/layout-drafts/:layoutVersionId/publish', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const layoutService = getLayoutService(auth);
    const result = await layoutService.publishVersion(layoutVersionId, auth.user.id);

    return parseOrThrow(publishResponseSchema, result);
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
    const ordersRepo = createOrdersRepo(supabase);
    const summaries = await ordersRepo.listOrderSummaries(tenantId, statusFilter);

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
    const service = getOrdersService(auth);
    const order = await service.createOrder({
      tenantId,
      externalNumber: body.externalNumber,
      priority: body.priority,
      waveId: body.waveId
    });

    return parseOrThrow(orderResponseSchema, order);
  });

  app.get('/api/orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const supabase = getUserSupabase(auth);
    const ordersRepo = createOrdersRepo(supabase);
    const order = await ordersRepo.findOrderResponse(orderId);

    if (!order) {
      throw new ApiError(404, 'ORDER_NOT_FOUND', `Order ${orderId} not found.`);
    }

    return parseOrThrow(orderResponseSchema, order);
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
    const service = getOrdersService(auth);
    const line = await service.addOrderLine({
      tenantId,
      orderId,
      productId: body.productId,
      qtyRequired: body.qtyRequired
    });

    void reply.code(201);
    return parseOrThrow(orderLineResponseSchema, line);
  });

  app.delete('/api/orders/:orderId/lines/:lineId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { orderId: string; lineId: string };
    const orderId = parseOrThrow(idResponseSchema, { id: params.orderId }).id;
    const lineId = parseOrThrow(idResponseSchema, { id: params.lineId }).id;
    const service = getOrdersService(auth);
    await service.removeOrderLine({ orderId, lineId });

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
    const service = getOrdersService(auth);
    const order = await service.transitionOrderStatus({
      orderId,
      status: body.status
    });

    return parseOrThrow(orderResponseSchema, order);
  });

  app.get('/api/orders/:orderId/execution', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const supabase = getUserSupabase(auth);
    const ordersRepo = createOrdersRepo(supabase);
    const execution = await ordersRepo.listOrderExecutionPickTasks(orderId);

    return parseOrThrow(pickTasksResponseSchema, execution);
  });

  app.get('/api/waves', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const supabase = getUserSupabase(auth);
    const wavesRepo = createWavesRepo(supabase);
    const waves = await wavesRepo.listWaveSummaries(tenantId);

    return parseOrThrow(wavesResponseSchema, waves);
  });

  app.post('/api/waves', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    if (!auth.currentTenant) {
      throw new ApiError(403, 'NO_TENANT', 'No tenant context.');
    }

    const tenantId = auth.currentTenant.tenantId;
    const body = parseOrThrow(createWaveBodySchema, request.body);
    const service = getWavesService(auth);
    const wave = await service.createWave({
      tenantId,
      name: body.name
    });

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.get('/api/waves/:waveId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const supabase = getUserSupabase(auth);
    const wavesRepo = createWavesRepo(supabase);
    const wave = await wavesRepo.findWaveResponse(waveId);

    if (!wave) {
      throw new ApiError(404, 'WAVE_NOT_FOUND', `Wave ${waveId} not found.`);
    }

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.patch('/api/waves/:waveId/status', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const body = parseOrThrow(transitionWaveStatusBodySchema, request.body);
    const service = getWavesService(auth);
    const wave = await service.transitionWaveStatus({
      waveId,
      status: body.status
    });

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.post('/api/waves/:waveId/orders', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const waveId = parseOrThrow(idResponseSchema, { id: (request.params as { waveId: string }).waveId }).id;
    const body = parseOrThrow(attachWaveOrderBodySchema, request.body);
    const service = getWavesService(auth);
    const wave = await service.attachOrderToWave({
      waveId,
      orderId: body.orderId
    });

    return parseOrThrow(waveResponseSchema, wave);
  });

  app.delete('/api/waves/:waveId/orders/:orderId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const params = request.params as { waveId: string; orderId: string };
    const waveId = parseOrThrow(idResponseSchema, { id: params.waveId }).id;
    const orderId = parseOrThrow(idResponseSchema, { id: params.orderId }).id;
    const service = getWavesService(auth);
    const wave = await service.detachOrderFromWave({
      waveId,
      orderId
    });

    return parseOrThrow(waveResponseSchema, wave);
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
