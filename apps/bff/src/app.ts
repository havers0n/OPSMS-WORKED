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
  swapContainersRequestBodySchema,
  swapContainersResponseSchema,
  transferInventoryUnitRequestBodySchema,
  transferInventoryUnitResponseSchema,
  pickPartialInventoryUnitRequestBodySchema,
  pickPartialInventoryUnitResponseSchema,
  createContainerResponseSchema,
  containerTypesResponseSchema,
  createContainerBodySchema,
  listContainersQuerySchema,
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
  publishResponseSchema,
  publishLayoutDraftBodySchema,
  publishedLayoutSummaryResponseSchema,
  removeContainerResponseSchema,
  saveLayoutDraftBodySchema,
  saveLayoutDraftResponseSchema,
  sitesResponseSchema,
  persistedDraftValidationResponseSchema,
  pickTasksResponseSchema,
  pickTaskDetailResponseSchema,
  operationsCellsRuntimeResponseSchema,
  allocatePickStepsResponseSchema,
  executePickStepBodySchema,
  executePickStepResponseSchema,
  nonRackLocationsResponseSchema,
  patchLocationGeometryBodySchema,
  rackInspectorPayloadSchema,
  storagePresetsResponseSchema,
  storagePresetResponseSchema,
  createStoragePresetRequestBodySchema,
  patchStoragePresetRequestBodySchema,
  createContainerFromStoragePresetRequestBodySchema,
  createContainerFromStoragePresetResponseSchema,
  setPreferredStoragePresetRequestBodySchema
} from './schemas.js';
import { getUserClient, requireAuth, type AuthenticatedRequestContext } from './auth.js';
import {
  mapLocationOccupancyRowToDomain,
  mapLocationStorageSnapshotRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
  mapInventoryUnitRowToLegacyInventoryItemDomain,
  mapPersistedDraftValidationResult
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
import { registerOrdersRoutes } from './features/orders/routes.js';
import { registerWavesRoutes } from './features/waves/routes.js';
import {
  createProductsService,
  type ProductsService
} from './features/products/service.js';
import { registerProductsRoutes } from './features/products/routes.js';
import { createLayoutRepo } from './features/layout/repo.js';
import {
  createLayoutService,
  type LayoutService
} from './features/layout/service.js';
import {
  createContainersService,
  type ContainersService
} from './features/containers/service.js';
import { createExecutionService } from './features/execution/service.js';
import {
  mapExecutionLocationMoveError,
  mapExecutionSwapError,
  mapExecutionTransferError
} from './features/execution/errors.js';
import {
  createInventoryService,
  type InventoryService
} from './features/inventory/service.js';
import {
  createSitesService,
  type SitesService
} from './features/sites/service.js';
import {
  createFloorsService,
  type FloorsService
} from './features/floors/service.js';
import {
  attachProductsToRows,
  type ProductAwareRow,
  type ProductRow
} from './inventory-product-resolution.js';
import { createLocationReadRepo } from './features/location-read/location-read-repo.js';
import { createRackInspectorRepo } from './features/rack-inspector/rack-inspector-repo.js';
import {
  createPickingService,
  type PickingService
} from './features/picking/service.js';
import {
  createPickingPlanningPreviewService,
  type PickingPlanningPreviewService
} from './features/picking-planning/service.js';
import { createPickingPlanningOrderInputReadRepo } from './features/picking-planning/repo.js';
import { registerPickingPlanningPreviewRoutes } from './features/picking-planning/routes.js';
import { mapPickingError } from './features/picking/errors.js';
import { createPickReadRepo } from './features/picking/pick-read-repo.js';
import {
  createProductLocationRolesService,
  type ProductLocationRolesService
} from './features/product-location-roles/service.js';
import { registerProductLocationRolesRoutes } from './features/product-location-roles/routes.js';
import {
  createStoragePresetsService,
  type StoragePresetsService
} from './features/storage-presets/service.js';

type UserClientFactory = (context: AuthenticatedRequestContext) => SupabaseClient;
type PlacementServiceFactory = (context: AuthenticatedRequestContext) => PlacementCommandService;
type OrdersServiceFactory = (context: AuthenticatedRequestContext) => OrdersService;
type WavesServiceFactory = (context: AuthenticatedRequestContext) => WavesService;
type InventoryServiceFactory = (context: AuthenticatedRequestContext) => InventoryService;
type LayoutServiceFactory = (context: AuthenticatedRequestContext) => LayoutService;
type SitesServiceFactory = (context: AuthenticatedRequestContext) => SitesService;
type ContainersServiceFactory = (context: AuthenticatedRequestContext) => ContainersService;
type FloorsServiceFactory = (context: AuthenticatedRequestContext) => FloorsService;
type ProductsServiceFactory = (context: AuthenticatedRequestContext) => ProductsService;
type PickingServiceFactory = (context: AuthenticatedRequestContext) => PickingService;
type PickingPlanningPreviewServiceFactory = (
  context: AuthenticatedRequestContext
) => PickingPlanningPreviewService;
type ProductLocationRolesServiceFactory = (context: AuthenticatedRequestContext) => ProductLocationRolesService;
type StoragePresetsServiceFactory = (context: AuthenticatedRequestContext) => StoragePresetsService;

type BuildAppOptions = {
  getAuthContext?: typeof requireAuth;
  getUserSupabase?: UserClientFactory;
  getHealthSupabase?: () => SupabaseClient;
  getPlacementService?: PlacementServiceFactory;
  getPickingService?: PickingServiceFactory;
  getOrdersService?: OrdersServiceFactory;
  getWavesService?: WavesServiceFactory;
  getInventoryService?: InventoryServiceFactory;
  getLayoutService?: LayoutServiceFactory;
  getSitesService?: SitesServiceFactory;
  getContainersService?: ContainersServiceFactory;
  getFloorsService?: FloorsServiceFactory;
  getProductsService?: ProductsServiceFactory;
  getProductLocationRolesService?: ProductLocationRolesServiceFactory;
  getStoragePresetsService?: StoragePresetsServiceFactory;
  getPickingPlanningPreviewService?: PickingPlanningPreviewServiceFactory;
};

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

type OperationsInventoryStatus = 'available' | 'reserved' | 'damaged' | 'hold' | null;
type OperationsCellStatus = 'empty' | 'stocked' | 'pick_active' | 'reserved' | 'quarantined';

const activePickStepStatuses = ['pending', 'partial'] as const;

function resolveOperationsCellStatus(args: {
  quarantined: boolean;
  pickActive: boolean;
  reserved: boolean;
  stocked: boolean;
}): OperationsCellStatus {
  if (args.quarantined) return 'quarantined';
  if (args.pickActive) return 'pick_active';
  if (args.reserved) return 'reserved';
  if (args.stocked) return 'stocked';
  return 'empty';
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
  const getSitesService =
    options.getSitesService ??
    ((context: AuthenticatedRequestContext) => createSitesService(getUserSupabase(context)));
  const getContainersService =
    options.getContainersService ??
    ((context: AuthenticatedRequestContext) => createContainersService(getUserSupabase(context)));
  const getFloorsService =
    options.getFloorsService ??
    ((context: AuthenticatedRequestContext) => createFloorsService(getUserSupabase(context)));
  const getProductsService =
    options.getProductsService ??
    ((context: AuthenticatedRequestContext) => createProductsService(getUserSupabase(context)));
  const getPickingService =
    options.getPickingService ??
    ((context: AuthenticatedRequestContext) => createPickingService(getUserSupabase(context)));
  const getPickingPlanningPreviewService =
    options.getPickingPlanningPreviewService ??
    ((context: AuthenticatedRequestContext) =>
      createPickingPlanningPreviewService(
        undefined,
        createPickingPlanningOrderInputReadRepo(getUserSupabase(context))
      ));
  const getProductLocationRolesService =
    options.getProductLocationRolesService ??
    ((context: AuthenticatedRequestContext) =>
      createProductLocationRolesService(getUserSupabase(context)));
  const getStoragePresetsService =
    options.getStoragePresetsService ??
    ((context: AuthenticatedRequestContext) => createStoragePresetsService(getUserSupabase(context)));

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

    const sites = await getSitesService(auth).listSites();
    return parseOrThrow(sitesResponseSchema, sites);
  });

  app.get('/api/container-types', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const types = await getContainersService(auth).listAllTypes();
    return parseOrThrow(containerTypesResponseSchema, types);
  });

  registerProductsRoutes(app, { getAuthContext, getProductsService });
  registerProductLocationRolesRoutes(app, { getAuthContext, getProductLocationRolesService });

  app.get('/api/products/:productId/storage-presets', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;
    const presets = await getStoragePresetsService(auth).listByProduct(auth.currentTenant.tenantId, productId);
    return parseOrThrow(storagePresetsResponseSchema, presets);
  });

  app.post('/api/products/:productId/storage-presets', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;
    const body = parseOrThrow(createStoragePresetRequestBodySchema, request.body);
    const preset = await getStoragePresetsService(auth).create(auth.currentTenant.tenantId, productId, body);
    return reply.code(201).send(parseOrThrow(storagePresetResponseSchema, preset));
  });

  app.patch('/api/products/:productId/storage-presets/:presetId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;
    const presetId = parseOrThrow(idResponseSchema, {
      id: (request.params as { presetId: string }).presetId
    }).id;
    const body = parseOrThrow(patchStoragePresetRequestBodySchema, request.body);
    const preset = await getStoragePresetsService(auth).patch(auth.currentTenant.tenantId, productId, presetId, body);
    return parseOrThrow(storagePresetResponseSchema, preset);
  });

  app.put('/api/locations/:locationId/sku-policies/:productId/storage-preset', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;
    const body = parseOrThrow(setPreferredStoragePresetRequestBodySchema, request.body);
    const policy = await getStoragePresetsService(auth).setPreferredPolicy(
      auth.currentTenant.tenantId,
      locationId,
      productId,
      body.preferredPackagingProfileId
    );
    return policy;
  });

  app.post('/api/storage-presets/:presetId/create-container', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const presetId = parseOrThrow(idResponseSchema, {
      id: (request.params as { presetId: string }).presetId
    }).id;
    const body = parseOrThrow(createContainerFromStoragePresetRequestBodySchema, request.body);

    try {
      const result = await getStoragePresetsService(auth).createContainerFromPreset({
        presetId,
        locationId: body.locationId,
        externalCode: body.externalCode,
        materializeContents: body.materializeContents,
        actorId: auth.user.id
      });
      return parseOrThrow(createContainerFromStoragePresetResponseSchema, result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('STORAGE_PRESET_NOT_FOUND')) {
          throw new ApiError(404, 'STORAGE_PRESET_NOT_FOUND', 'Storage preset was not found.');
        }
        if (error.message.includes('STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED')) {
          throw new ApiError(422, 'STORAGE_PRESET_CONTAINER_TYPE_UNRESOLVED', 'Storage preset must resolve exactly one container type.');
        }
        if (error.message.includes('STORAGE_PRESET_CONTAINER_TYPE_INVALID')) {
          throw new ApiError(422, 'STORAGE_PRESET_CONTAINER_TYPE_INVALID', 'Storage preset does not resolve a valid storage container type.');
        }
        if (error.message.includes('STORAGE_PRESET_MATERIALIZATION_FAILED')) {
          throw new ApiError(
            422,
            'STORAGE_PRESET_MATERIALIZATION_FAILED',
            'Container was created/placed, but preset contents materialization failed.'
          );
        }
        if (error.message.includes('STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED')) {
          throw new ApiError(
            422,
            'STORAGE_PRESET_MATERIALIZATION_LEVEL_UNRESOLVED',
            'Storage preset must have exactly one materializable level for this phase.'
          );
        }
      }
      const mapped = mapSupabaseError(error);
      if (mapped) throw mapped;
      throw error;
    }
  });

  app.get('/api/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const query = parseOrThrow(listContainersQuerySchema, request.query);
    const containers = await getContainersService(auth).listAll(
      query.operationalRole !== undefined ? { operationalRole: query.operationalRole } : undefined
    );
    return parseOrThrow(containersResponseSchema, containers);
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
      system_code: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      placed_at: string;
      inventory_unit_id?: string | null;
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

  app.get('/api/floors/:floorId/non-rack-locations', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const rows = await locationReadRepo.listFloorNonRackLocations(floorId);

    return parseOrThrow(
      nonRackLocationsResponseSchema,
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        locationType: row.location_type,
        floorX: row.floor_x,
        floorY: row.floor_y,
        status: row.status
      }))
    );
  });

  app.patch('/api/locations/:locationId/geometry', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const locationId = parseOrThrow(idResponseSchema, {
      id: (request.params as { locationId: string }).locationId
    }).id;
    const body = parseOrThrow(patchLocationGeometryBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const row = await locationReadRepo.updateLocationGeometry(locationId, body.floorX, body.floorY);

    if (!row) {
      return reply.status(404).send({ code: 'NOT_FOUND', message: 'Location not found or is a rack slot' });
    }

    return {
      id: row.id,
      code: row.code,
      locationType: row.location_type,
      floorX: row.floor_x,
      floorY: row.floor_y,
      status: row.status
    };
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

  app.get('/api/floors/:floorId/operations-cells', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const supabase = getUserSupabase(auth);
    const locationReadRepo = createLocationReadRepo(supabase);
    const layoutRepo = createLayoutRepo(supabase);

    const cells = await layoutRepo.listPublishedCells(floorId);
    if (cells.length === 0) {
      return parseOrThrow(operationsCellsRuntimeResponseSchema, []);
    }

    const cellIds = cells.map((cell) => cell.id);
    const [occupancyRows, storageRowsRaw, pickStepsResult] = await Promise.all([
      locationReadRepo.listFloorLocationOccupancy(floorId),
      locationReadRepo.listCellStorageByIds(cellIds),
      supabase
        .from('pick_steps')
        .select('source_cell_id,status')
        .in('source_cell_id', cellIds)
        .in('status', [...activePickStepStatuses])
    ]);

    if (pickStepsResult.error) {
      throw pickStepsResult.error;
    }

    const storageRows = await attachProductsToRows(supabase, (storageRowsRaw ?? []) as Array<ProductAwareRow & {
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
      inventory_status?: OperationsInventoryStatus;
    }>);

    const pickActiveByCellId = new Set<string>();
    for (const row of pickStepsResult.data ?? []) {
      if (typeof row.source_cell_id === 'string') {
        pickActiveByCellId.add(row.source_cell_id);
      }
    }

    type RuntimeItem = {
      itemRef: string | null;
      productId: string | null;
      sku: string | null;
      name: string | null;
      quantity: number;
      uom: string;
      inventoryStatus: OperationsInventoryStatus;
    };

    type RuntimeContainer = {
      containerId: string;
      externalCode: string | null;
      containerType: string;
      containerStatus: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      totalQuantity: number;
      itemCount: number;
      items: RuntimeItem[];
    };

    type RuntimeCell = {
      cellId: string;
      cellAddress: string;
      pickActive: boolean;
      reserved: boolean;
      quarantined: boolean;
      stocked: boolean;
      containers: Map<string, RuntimeContainer>;
    };

    const runtimeByCellId = new Map<string, RuntimeCell>();

    for (const cell of cells) {
      runtimeByCellId.set(cell.id, {
        cellId: cell.id,
        cellAddress: cell.address.raw,
        pickActive: pickActiveByCellId.has(cell.id),
        reserved: false,
        quarantined: false,
        stocked: false,
        containers: new Map()
      });
    }

    for (const row of occupancyRows) {
      if (!row.cell_id) continue;

      const runtime = runtimeByCellId.get(row.cell_id);
      if (!runtime) continue;

      runtime.quarantined = runtime.quarantined || row.container_status === 'quarantined';
      if (!runtime.containers.has(row.container_id)) {
        runtime.containers.set(row.container_id, {
          containerId: row.container_id,
          externalCode: row.external_code,
          containerType: row.container_type,
          containerStatus: row.container_status,
          totalQuantity: 0,
          itemCount: 0,
          items: []
        });
      }
    }

    for (const row of storageRows) {
      if (!row.cell_id) continue;

      const runtime = runtimeByCellId.get(row.cell_id);
      if (!runtime) continue;

      const containerId = row.container_id;
      let container = runtime.containers.get(containerId);
      if (!container) {
        container = {
          containerId,
          externalCode: row.external_code,
          containerType: row.container_type,
          containerStatus: row.container_status,
          totalQuantity: 0,
          itemCount: 0,
          items: []
        };
        runtime.containers.set(containerId, container);
      }

      const quantity = row.quantity ?? 0;
      const hasStock = quantity > 0;
      const inventoryStatus = row.inventory_status ?? null;

      if (hasStock) {
        runtime.stocked = true;
        container.totalQuantity += quantity;
      }

      if (hasStock && (inventoryStatus === 'reserved' || inventoryStatus === 'hold')) {
        runtime.reserved = true;
      }

      runtime.quarantined = runtime.quarantined || row.container_status === 'quarantined';

      if (row.item_ref && row.uom) {
        container.itemCount += 1;
        container.items.push({
          itemRef: row.item_ref,
          productId: row.product?.id ?? null,
          sku: row.product?.sku ?? null,
          name: row.product?.name ?? null,
          quantity: row.quantity ?? 0,
          uom: row.uom,
          inventoryStatus
        });
      }
    }

    const response = cells.map((cell) => {
      const runtime = runtimeByCellId.get(cell.id)!;
      const containers = [...runtime.containers.values()];
      const totalQuantity = containers.reduce((sum, container) => sum + container.totalQuantity, 0);
      const status = resolveOperationsCellStatus({
        quarantined: runtime.quarantined,
        pickActive: runtime.pickActive,
        reserved: runtime.reserved,
        stocked: runtime.stocked
      });

      return {
        cellId: runtime.cellId,
        cellAddress: runtime.cellAddress,
        status,
        pickActive: runtime.pickActive,
        reserved: runtime.reserved,
        quarantined: runtime.quarantined,
        stocked: runtime.stocked,
        containerCount: containers.length,
        totalQuantity,
        containers
      };
    });

    return parseOrThrow(operationsCellsRuntimeResponseSchema, response);
  });

  app.get('/api/containers/:containerId/storage', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const supabase = getUserSupabase(auth);
    const { data, error } = await supabase
      .from('container_storage_canonical_v')
      .select('tenant_id,container_id,system_code,external_code,container_type,container_status,inventory_unit_id,item_ref,product_id,quantity,uom,packaging_state,product_packaging_level_id,pack_count,container_packaging_profile_id,container_is_standard_pack,preferred_packaging_profile_id,preset_usage_status,preset_materialization_status')
      .eq('container_id', containerId);

    if (error) {
      throw error;
    }

    const rows = await attachProductsToRows(supabase, (data ?? []) as Array<ProductAwareRow & {
      tenant_id: string;
      container_id: string;
      system_code: string;
      external_code: string | null;
      container_type: string;
      container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
      inventory_unit_id?: string | null;
      product_id?: string | null;
      quantity: number | null;
      uom: string | null;
      packaging_state?: 'sealed' | 'opened' | 'loose' | null;
      product_packaging_level_id?: string | null;
      pack_count?: number | null;
      container_packaging_profile_id?: string | null;
      container_is_standard_pack?: boolean | null;
      preferred_packaging_profile_id?: string | null;
      preset_usage_status?: 'preferred_match' | 'standard_non_preferred' | 'manual' | 'unknown' | null;
      preset_materialization_status?: 'shell' | 'materialized' | 'manual' | 'unknown' | null;
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

    const id = await getSitesService(auth).createSite({
      tenantId: auth.currentTenant.tenantId,
      code: body.code,
      name: body.name,
      timezone: body.timezone
    });
    return parseOrThrow(idResponseSchema, { id });
  });

  app.post('/api/containers', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createContainerBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for container creation.');
    }

    const container = await getContainersService(auth).createContainer({
      tenantId: auth.currentTenant.tenantId,
      containerTypeId: body.containerTypeId,
      externalCode: body.externalCode,
      operationalRole: body.operationalRole,
      createdBy: auth.user.id
    });

    return parseOrThrow(createContainerResponseSchema, {
      containerId: container.id,
      systemCode: container.systemCode,
      externalCode: container.externalCode,
      containerTypeId: container.containerTypeId,
      status: container.status,
      operationalRole: container.operationalRole
    });
  });

  app.get('/api/sites/:siteId/floors', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const siteId = parseOrThrow(idResponseSchema, { id: (request.params as { siteId: string }).siteId }).id;
    const floors = await getSitesService(auth).listFloors(siteId);
    return parseOrThrow(floorsResponseSchema, floors);
  });

  app.get('/api/containers/:containerId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const container = await getContainersService(auth).findById(containerId);

    if (!container) {
      throw new ApiError(404, 'NOT_FOUND', 'Container was not found.');
    }

    return parseOrThrow(containerResponseSchema, container);
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
    const data = await getContainersService(auth).removeContainer(containerId, auth.user.id);
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

  app.post('/api/containers/:containerId/swap', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(swapContainersRequestBodySchema, request.body);
    const supabase = getUserSupabase(auth);
    const executionService = createExecutionService(supabase);

    try {
      const result = await executionService.swapContainersCanonical({
        sourceContainerId: containerId,
        targetContainerId: body.targetContainerId,
        actorId: auth.user.id
      });

      return parseOrThrow(swapContainersResponseSchema, result);
    } catch (error) {
      throw mapExecutionSwapError(error) ?? error;
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
      actorId: auth.user.id,
      packagingState: body.packagingState,
      productPackagingLevelId: body.productPackagingLevelId ?? null,
      packCount: body.packCount ?? null
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
    const id = await getFloorsService(auth).createFloor(body);
    return parseOrThrow(idResponseSchema, { id });
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
    const result = await layoutService.saveDraft(body.layoutDraft, auth.user.id);

    return parseOrThrow(saveLayoutDraftResponseSchema, result);
  });

  app.post('/api/layout-drafts/:layoutVersionId/validate', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const layoutService = getLayoutService(auth);
    const result = await layoutService.validateVersion(layoutVersionId);

    return parseOrThrow(
      persistedDraftValidationResponseSchema,
      mapPersistedDraftValidationResult(result)
    );
  });

  app.post('/api/layout-drafts/:layoutVersionId/publish', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const layoutVersionId = parseOrThrow(idResponseSchema, { id: (request.params as { layoutVersionId: string }).layoutVersionId }).id;
    const body = parseOrThrow(publishLayoutDraftBodySchema, request.body);
    const layoutService = getLayoutService(auth);
    const result = await layoutService.publishDraft(layoutVersionId, body.expectedDraftVersion, auth.user.id);

    return parseOrThrow(publishResponseSchema, result);
  });

  // ── Orders ───────────────────────────────────────────────────────────────────

  registerOrdersRoutes(app, { getAuthContext, getUserSupabase, getOrdersService });
  registerPickingPlanningPreviewRoutes(app, { getAuthContext, getPickingPlanningPreviewService });

  app.get('/api/orders/:orderId/execution', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const orderId = parseOrThrow(idResponseSchema, { id: (request.params as { orderId: string }).orderId }).id;
    const supabase = getUserSupabase(auth);
    const ordersRepo = createOrdersRepo(supabase);
    const execution = await ordersRepo.listOrderExecutionPickTasks(orderId);

    return parseOrThrow(pickTasksResponseSchema, execution);
  });

  app.get('/api/pick-tasks/:taskId', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const taskId = parseOrThrow(
      idResponseSchema,
      { id: (request.params as { taskId: string }).taskId }
    ).id;
    const supabase = getUserSupabase(auth);
    const pickReadRepo = createPickReadRepo(supabase);
    const detail = await pickReadRepo.findPickTaskDetail(taskId);

    if (!detail) {
      throw new ApiError(404, 'PICK_TASK_NOT_FOUND', `Pick task ${taskId} not found.`);
    }

    return parseOrThrow(pickTaskDetailResponseSchema, detail);
  });

  app.post('/api/pick-tasks/:taskId/allocate', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const taskId = parseOrThrow(
      idResponseSchema,
      { id: (request.params as { taskId: string }).taskId }
    ).id;
    const pickingService = getPickingService(auth);

    try {
      const result = await pickingService.allocatePickSteps({ taskId });
      return parseOrThrow(allocatePickStepsResponseSchema, result);
    } catch (error) {
      throw mapPickingError(error) ?? error;
    }
  });

  app.post('/api/pick-steps/:stepId/execute', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const stepId = parseOrThrow(
      idResponseSchema,
      { id: (request.params as { stepId: string }).stepId }
    ).id;
    const body = parseOrThrow(executePickStepBodySchema, request.body);
    const pickingService = getPickingService(auth);

    try {
      const result = await pickingService.executePickStep({
        stepId,
        qtyActual: body.qtyActual,
        pickContainerId: body.pickContainerId,
        actorId: auth.user.id
      });
      return parseOrThrow(executePickStepResponseSchema, result);
    } catch (error) {
      throw mapPickingError(error) ?? error;
    }
  });

  // ── Rack Inspector ──────────────────────────────────────────────────────────

  app.get('/api/racks/:rackId/inspector', async (request, reply) => {
    const auth = await getAuthContext(request, reply);
    if (!auth) return;

    const rackId = parseOrThrow(idResponseSchema, { id: (request.params as { rackId: string }).rackId }).id;
    const supabase = getUserSupabase(auth);
    const rackInspectorRepo = createRackInspectorRepo(supabase);
    const payload = await rackInspectorRepo.getRackInspector(rackId);

    if (!payload) {
      throw new ApiError(404, 'RACK_NOT_FOUND', `Rack ${rackId} not found.`);
    }

    return parseOrThrow(rackInspectorPayloadSchema, payload);
  });

  registerWavesRoutes(app, { getAuthContext, getUserSupabase, getWavesService });

  app.setErrorHandler((error, request, reply) => {
    const mappedSupabaseError = mapSupabaseError(error);

    const apiError =
      error instanceof ZodError
        ? new ApiError(400, 'VALIDATION_ERROR', error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '))
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
