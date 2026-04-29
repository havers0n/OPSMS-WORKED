import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { ZodError, z } from 'zod';
import { env } from './env.js';
import { ApiError, mapSupabaseError, sendApiError } from './errors.js';
import type { BuildAppOptions } from './app-options.js';
import { createRouteDeps } from './route-deps.js';
import {
  containerCurrentLocationResponseSchema,
  locationReferenceResponseSchema,
  locationOccupancyRowsResponseSchema,
  locationStorageSnapshotRowsResponseSchema,
  containerResponseSchema,
  containerStorageSnapshotResponseSchema,
  containersResponseSchema,
  containerTypesResponseSchema,
  listContainersQuerySchema,
  currentWorkspaceResponseSchema,
  idResponseSchema,
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
import {
  mapLocationOccupancyRowToDomain,
  mapLocationStorageSnapshotRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
} from './mappers.js';
import { type PlacementCommandService } from './features/placement/service.js';
import { type OrdersService } from './features/orders/service.js';
import { type WavesService } from './features/waves/service.js';
import { createOrdersRepo } from './features/orders/repo.js';
import { registerOrdersRoutes } from './features/orders/routes.js';
import { registerWavesRoutes } from './features/waves/routes.js';
import { type ProductsService } from './features/products/service.js';
import { registerProductsRoutes } from './features/products/routes.js';
import { createLayoutRepo } from './features/layout/repo.js';
import { type LayoutService } from './features/layout/service.js';
import { type ContainersService } from './features/containers/service.js';
import {
  attachProductsToRows,
  type ProductAwareRow,
} from './inventory-product-resolution.js';
import { createLocationReadRepo } from './features/location-read/location-read-repo.js';
import { createRackInspectorRepo } from './features/rack-inspector/rack-inspector-repo.js';
import { registerPickingPlanningPreviewRoutes } from './features/picking-planning/routes.js';
import { mapPickingError } from './features/picking/errors.js';
import { createPickReadRepo } from './features/picking/pick-read-repo.js';
import { type ProductLocationRolesService } from './features/product-location-roles/service.js';
import { registerProductLocationRolesRoutes } from './features/product-location-roles/routes.js';
import { type StoragePresetsService } from './features/storage-presets/service.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerMeRoutes } from './routes/me.routes.js';
import { registerSitesRoutes } from './routes/sites.routes.js';
import { registerFloorsRoutes } from './routes/floors.routes.js';
import { registerLayoutReadRoutes } from './routes/layout-read.routes.js';
import { registerLayoutMutationsRoutes } from './routes/layout-mutations.routes.js';
import { registerContainerReadRoutes } from './routes/container-read.routes.js';
import { registerContainerMutationsRoutes } from './routes/container-mutations.routes.js';
import { registerLocationReadRoutes } from './routes/location-read.routes.js';
import { registerContainerMovementRoutes } from './routes/container-movement.routes.js';
import { registerInventoryMovementRoutes } from './routes/inventory-movement.routes.js';

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

  const deps = createRouteDeps(options);
  const {
    getAuthContext,
    getUserSupabase,
    getHealthSupabase,
    getPlacementService,
    getPickingService,
    getOrdersService,
    getWavesService,
    getInventoryService,
    getLayoutService,
    getSitesService,
    getContainersService,
    getFloorsService,
    getProductsService,
    getProductLocationRolesService,
    getStoragePresetsService,
    getPickingPlanningPreviewService
  } = deps;

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

  registerHealthRoutes(app, { getHealthSupabase });

  registerSitesRoutes(app, { getAuthContext, getSitesService });
  registerFloorsRoutes(app, { getAuthContext, getSitesService, getFloorsService, getUserSupabase });
  registerLayoutReadRoutes(app, { getAuthContext, getUserSupabase });
  registerLayoutMutationsRoutes(app, { getAuthContext, getLayoutService });
  registerContainerReadRoutes(app, { getAuthContext, getContainersService, getUserSupabase });
  registerContainerMutationsRoutes(app, { getAuthContext, getContainersService, getInventoryService });
  registerLocationReadRoutes(app, { getAuthContext, getUserSupabase });
  registerContainerMovementRoutes(app, { getAuthContext, getPlacementService, getUserSupabase });

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


  registerMeRoutes(app, { getAuthContext });
  registerInventoryMovementRoutes(app, { getAuthContext, getUserSupabase });


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
