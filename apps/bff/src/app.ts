import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { ZodError } from 'zod';
import { env } from './env.js';
import { ApiError, mapSupabaseError, sendApiError } from './errors.js';
import type { BuildAppOptions } from './app-options.js';
import { createRouteDeps } from './route-deps.js';
import { registerOrdersRoutes } from './features/orders/routes.js';
import { registerWavesRoutes } from './features/waves/routes.js';
import { registerProductsRoutes } from './features/products/routes.js';
import { registerPickingPlanningPreviewRoutes } from './features/picking-planning/routes.js';
import { registerProductLocationRolesRoutes } from './features/product-location-roles/routes.js';
import { registerHealthRoutes } from './routes/health.routes.js';
import { registerClientErrorsRoutes } from './routes/client-errors.routes.js';
import { registerMeRoutes } from './features/me/routes.js';
import { registerSitesRoutes } from './features/sites/routes.js';
import { registerFloorsRoutes } from './features/floors/routes.js';
import { registerLayoutRoutes } from './features/layout/routes.js';
import { registerContainersRoutes } from './features/containers/routes.js';
import { registerLocationReadRoutes } from './features/location-read/routes.js';
import { registerPlacementRoutes } from './features/placement/routes.js';
import { registerExecutionRoutes } from './features/execution/routes.js';
import { registerStoragePresetsRoutes } from './features/storage-presets/routes.js';
import { registerPickingRoutes } from './features/picking/routes.js';
import { registerRackInspectorRoutes } from './features/rack-inspector/routes.js';
import { registerOperationsCellsRoutes } from './features/operations-cells/routes.js';
import { registerFloorRoutingRoutes } from './features/floor-routing/routes.js';
import { registerManualShiftsRoutes } from './features/manual-shifts/routes.js';
import { registerPickerRoutes } from './features/picker/routes.js';

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
    getManualShiftsService,
    getPickingPlanningPreviewService,
    getFloorRoutingService
  } = deps;

  void app.register(cors, {
    origin: env.corsOrigin,
    credentials: true
  });
  void app.register(multipart, {
    limits: {
      files: 1,
      fileSize: 5 * 1024 * 1024
    }
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
  registerClientErrorsRoutes(app);

  registerSitesRoutes(app, { getAuthContext, getSitesService });
  registerFloorsRoutes(app, { getAuthContext, getSitesService, getFloorsService, getUserSupabase });
  registerLayoutRoutes(app, { getAuthContext, getUserSupabase, getLayoutService });
  registerContainersRoutes(app, { getAuthContext, getContainersService, getInventoryService, getUserSupabase });
  registerLocationReadRoutes(app, { getAuthContext, getUserSupabase });
  registerPlacementRoutes(app, { getAuthContext, getPlacementService });
  registerExecutionRoutes(app, { getAuthContext, getUserSupabase });
  registerStoragePresetsRoutes(app, { getAuthContext, getStoragePresetsService: deps.getStoragePresetsService });

  registerProductsRoutes(app, { getAuthContext, getProductsService });
  registerProductLocationRolesRoutes(app, { getAuthContext, getProductLocationRolesService });

  registerMeRoutes(app, { getAuthContext });

  // ── Orders ───────────────────────────────────────────────────────────────────

  registerOrdersRoutes(app, { getAuthContext, getUserSupabase, getOrdersService });
  registerPickingPlanningPreviewRoutes(app, { getAuthContext, getPickingPlanningPreviewService });

  registerPickingRoutes(app, { getAuthContext, getUserSupabase, getPickingService });
  registerRackInspectorRoutes(app, { getAuthContext, getUserSupabase });
  registerOperationsCellsRoutes(app, { getAuthContext, getUserSupabase });
  registerFloorRoutingRoutes(app, { getAuthContext, getFloorRoutingService });
  registerWavesRoutes(app, { getAuthContext, getUserSupabase, getWavesService });
  registerManualShiftsRoutes(app, { getAuthContext, getManualShiftsService, getUserSupabase });
  registerPickerRoutes(app, { getAuthContext, getUserSupabase });

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
