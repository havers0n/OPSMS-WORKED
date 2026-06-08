import type { FastifyInstance } from 'fastify';
import {
  diagnosticsHeartbeatRequestBodySchema,
  diagnosticsHeartbeatResponseSchema
} from '../schemas.js';
import { parseOrThrow } from '../validation.js';

export function registerDiagnosticsRoutes(app: FastifyInstance): void {
  app.post('/api/diagnostics/heartbeat', async (request, reply) => {
    const body = parseOrThrow(diagnosticsHeartbeatRequestBodySchema, request.body);

    request.log.info(
      {
        sessionId: body.sessionId,
        sequence: body.sequence,
        route: body.route,
        activeWarehouseMode: body.activeWarehouseMode,
        floorId: body.floorId,
        viewport: `${body.viewportWidth}x${body.viewportHeight}`,
        devicePixelRatio: body.devicePixelRatio,
        publishedCellCount: body.publishedCellCount,
        occupancyRowCount: body.occupancyRowCount,
        navigatorItemCount: body.navigatorItemCount,
        breadcrumbCount: body.recentBreadcrumbs.length,
        debugFlags: body.activeDebugFlags,
        userAgent: body.userAgent
      },
      'storage diagnostics heartbeat'
    );

    return reply.code(202).send(
      parseOrThrow(diagnosticsHeartbeatResponseSchema, {
        accepted: true,
        requestId: request.id
      })
    );
  });
}
