import type { FastifyInstance } from 'fastify';
import { type WarehouseLabelsService } from './service.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { ApiError } from '../../errors.js';
import type { RouteDeps } from '../../route-deps.js';
import {
  idResponseSchema,
  rackSlotLocationRefsResponseSchema,
  warehouseLabelPreviewRequestBodySchema,
  warehouseLabelPreviewResponseSchema
} from '../../schemas.js';
import { parseOrThrow } from '../../validation.js';

type WarehouseLabelsRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getWarehouseLabelsService'>;

function requireCurrentTenant(auth: AuthenticatedRequestContext) {
  if (!auth.currentTenant) {
    throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'Warehouse labels are unavailable without an active workspace.');
  }

  return auth.currentTenant;
}

export function registerWarehouseLabelRoutes(app: FastifyInstance, deps: WarehouseLabelsRouteDeps): void {
  app.get('/api/floors/:floorId/rack-slot-location-refs', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    const floorId = parseOrThrow(idResponseSchema, {
      id: (request.params as { floorId: string }).floorId
    }).id;
    const response = await deps.getWarehouseLabelsService(auth).getRackSlotLocationRefs({
      tenantId: tenant.tenantId,
      floorId
    });

    return parseOrThrow(rackSlotLocationRefsResponseSchema, response);
  });

  app.post('/api/warehouse-labels/preview', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    const body = parseOrThrow(warehouseLabelPreviewRequestBodySchema, request.body);
    const response = await deps.getWarehouseLabelsService(auth).previewLabels({
      tenantId: tenant.tenantId,
      request: body
    });

    return parseOrThrow(warehouseLabelPreviewResponseSchema, response);
  });

  app.post('/api/warehouse-labels/pdf', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const tenant = requireCurrentTenant(auth);
    const body = parseOrThrow(warehouseLabelPreviewRequestBodySchema, request.body);
    const safeFloorId = body.floorId.replace(/[^a-zA-Z0-9._-]/g, '-');

    console.log(
      JSON.stringify({
        event: 'warehouse-labels-pdf-request-started',
        tenantId: tenant.tenantId,
        floorId: safeFloorId,
        preset: body.labelPreset,
        layoutMode: body.layout.mode,
        timestamp: new Date().toISOString()
      })
    );

    try {
      const response = await deps.getWarehouseLabelsService(auth).generateLabelsPdf({
        tenantId: tenant.tenantId,
        request: body
      });

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="warehouse-labels-${safeFloorId}.pdf"`)
        .send(Buffer.from(response.bytes));
    } catch (error) {
      const errorCode = error instanceof ApiError ? error.code : 'UNKNOWN';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      console.log(
        JSON.stringify({
          event: 'warehouse-labels-pdf-failed',
          tenantId: tenant.tenantId,
          floorId: safeFloorId,
          errorCode,
          errorMessage,
          timestamp: new Date().toISOString()
        })
      );

      throw error;
    }
  });
}
