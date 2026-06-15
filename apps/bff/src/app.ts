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
import { registerHealthRoutes } from './infra/health.routes.js';
import { registerClientErrorsRoutes } from './infra/client-errors.routes.js';
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
import { registerWarehouseLabelRoutes } from './features/warehouse-labels/routes.js';

const MANUAL_SHIFT_IMPORT_FILE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024;
const MANUAL_SHIFT_IMPORT_BODY_LIMIT_BYTES = 10 * 1024 * 1024;

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    bodyLimit: MANUAL_SHIFT_IMPORT_BODY_LIMIT_BYTES,
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
    getWarehouseLabelsService,
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
      fields: 3,
      parts: 4,
      fileSize: MANUAL_SHIFT_IMPORT_FILE_SIZE_LIMIT_BYTES
    }
  });

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api/manual-shifts/import/')) {
      return;
    }

    request.log.info(
      {
        route: request.url,
        method: request.method,
        requestId: request.id,
        contentType: request.headers['content-type'] ?? null,
        contentLength: request.headers['content-length'] ?? null
      },
      'manual shift import request entered'
    );

    request.raw.on('aborted', () => {
      request.log.error(
        {
          route: request.url,
          method: request.method,
          requestId: request.id
        },
        'manual shift import request aborted'
      );
    });

    request.raw.on('close', () => {
      request.log.info(
        {
          route: request.url,
          method: request.method,
          requestId: request.id,
          aborted: request.raw.aborted
        },
        'manual shift import request raw closed'
      );
    });

    reply.raw.on('close', () => {
      request.log.info(
        {
          route: request.url,
          method: request.method,
          requestId: request.id,
          writableEnded: reply.raw.writableEnded,
          destroyed: reply.raw.destroyed
        },
        'manual shift import reply raw closed'
      );
    });
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
  registerWarehouseLabelRoutes(app, { getAuthContext, getWarehouseLabelsService });

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
    const errorCode = typeof error === 'object' && error !== null && 'code' in error ? (error as { code?: string }).code : undefined;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack ?? null : null;
    const errorLog = {
      err: error,
      errorCode,
      errorMessage,
      errorStack,
      requestId: request.id,
      method: request.method,
      url: request.url
    };

    console.error('[bff] request error', errorLog);

    if (typeof error === 'object' && error !== null && 'code' in error) {
      const multipartCode = (error as { code?: string }).code;
      if (multipartCode === 'FST_REQ_FILE_TOO_LARGE') {
        request.log.warn(
          {
            err: error,
            requestId: request.id,
            route: request.routeOptions.url,
            statusCode: 413,
            errorCode: 'FILE_TOO_LARGE'
          },
          'multipart upload rejected'
        );
        void sendApiError(reply, new ApiError(413, 'FILE_TOO_LARGE', 'Uploaded file exceeds the 5MB limit.'), request.id);
        return;
      }
      if (
        multipartCode === 'FST_FILES_LIMIT' ||
        multipartCode === 'FST_FIELDS_LIMIT' ||
        multipartCode === 'FST_PARTS_LIMIT' ||
        multipartCode === 'FST_INVALID_MULTIPART_CONTENT_TYPE'
      ) {
        request.log.warn(
          {
            err: error,
            requestId: request.id,
            route: request.routeOptions.url,
            statusCode: 400,
            errorCode: 'INVALID_MULTIPART_REQUEST'
          },
          'multipart upload rejected'
        );
        void sendApiError(
          reply,
          new ApiError(400, 'INVALID_MULTIPART_REQUEST', 'Multipart upload could not be processed.'),
          request.id
        );
        return;
      }
    }

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
