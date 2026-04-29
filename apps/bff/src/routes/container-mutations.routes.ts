import type { FastifyInstance } from 'fastify';
import { ApiError } from '../errors.js';
import {
  mapInventoryUnitRowToLegacyInventoryItemDomain,
} from '../mappers.js';
import type { RouteDeps } from '../route-deps.js';
import {
  addInventoryToContainerBodySchema,
  createContainerBodySchema,
  createContainerResponseSchema,
  idResponseSchema,
  inventoryItemResponseSchema,
  removeContainerResponseSchema,
} from '../schemas.js';
import { type ProductRow } from '../inventory-product-resolution.js';

type ContainerMutationsRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getContainersService' | 'getInventoryService'>;

function parseOrThrow<T>(schema: { parse: (input: unknown) => T }, payload: unknown): T {
  return schema.parse(payload);
}

export function registerContainerMutationsRoutes(app: FastifyInstance, deps: ContainerMutationsRouteDeps): void {
  app.post('/api/containers', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const body = parseOrThrow(createContainerBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for container creation.');
    }

    const container = await deps.getContainersService(auth).createContainer({
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

  app.post('/api/containers/:containerId/remove', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const data = await deps.getContainersService(auth).removeContainer(containerId, auth.user.id);
    return parseOrThrow(removeContainerResponseSchema, data);
  });

  app.post('/api/containers/:containerId/inventory', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const containerId = parseOrThrow(idResponseSchema, { id: (request.params as { containerId: string }).containerId }).id;
    const body = parseOrThrow(addInventoryToContainerBodySchema, request.body);
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace is available for inventory writes.');
    }

    const inventoryService = deps.getInventoryService(auth);
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
}
