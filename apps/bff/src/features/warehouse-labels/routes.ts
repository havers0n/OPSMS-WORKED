import type { FastifyInstance } from 'fastify';
import { type WarehouseLabelsService } from './service.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { ApiError } from '../../errors.js';
import type { RouteDeps } from '../../route-deps.js';
import {
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
    const response = await deps.getWarehouseLabelsService(auth).generateLabelsPdf({
      tenantId: tenant.tenantId,
      request: body
    });
    const safeFloorId = body.floorId.replace(/[^a-zA-Z0-9._-]/g, '-');

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="warehouse-labels-${safeFloorId}.pdf"`)
      .send(Buffer.from(response.bytes));
  });
}
