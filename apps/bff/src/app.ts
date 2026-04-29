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
  operationsCellsRuntimeResponseSchema,
  nonRackLocationsResponseSchema,
  patchLocationGeometryBodySchema,
} from './schemas.js';
import {
  mapLocationOccupancyRowToDomain,
  mapLocationStorageSnapshotRowToDomain,
  mapContainerStorageSnapshotRowToDomain,
} from './mappers.js';
import { type PlacementCommandService } from './features/placement/service.js';
import { type OrdersService } from './features/orders/service.js';
import { type WavesService } from './features/waves/service.js';
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
import { registerPickingPlanningPreviewRoutes } from './features/picking-planning/routes.js';
import { type ProductLocationRolesService } from './features/product-location-roles/service.js';
import { registerProductLocationRolesRoutes } from './features/product-location-roles/routes.js';
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
import { registerStoragePresetsRoutes } from './routes/storage-presets.routes.js';
import { registerPickingExecutionRoutes } from './routes/picking-execution.routes.js';
import { registerRackInspectorRoutes } from './routes/rack-inspector.routes.js';

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
  registerStoragePresetsRoutes(app, { getAuthContext, getStoragePresetsService: deps.getStoragePresetsService });

  registerProductsRoutes(app, { getAuthContext, getProductsService });
  registerProductLocationRolesRoutes(app, { getAuthContext, getProductLocationRolesService });


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

  registerPickingExecutionRoutes(app, { getAuthContext, getUserSupabase, getPickingService });
  registerRackInspectorRoutes(app, { getAuthContext, getUserSupabase });
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
