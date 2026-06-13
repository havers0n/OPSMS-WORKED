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
    throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for warehouse label preview.');
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
}
