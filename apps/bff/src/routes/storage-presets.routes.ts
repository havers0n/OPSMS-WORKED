import type { FastifyInstance } from 'fastify';
import { ApiError, mapSupabaseError } from '../errors.js';
import type { RouteDeps } from '../route-deps.js';
import {
  idResponseSchema,
  storagePresetsResponseSchema,
  storagePresetResponseSchema,
  createStoragePresetRequestBodySchema,
  patchStoragePresetRequestBodySchema,
  createContainerFromStoragePresetRequestBodySchema,
  createContainerFromStoragePresetResponseSchema,
  setPreferredStoragePresetRequestBodySchema
} from '../schemas.js';
import { parseOrThrow } from '../validation.js';

type StoragePresetsRouteDeps = Pick<RouteDeps, 'getAuthContext' | 'getStoragePresetsService'>;

export function registerStoragePresetsRoutes(app: FastifyInstance, deps: StoragePresetsRouteDeps): void {
  app.get('/api/products/:productId/storage-presets', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;
    const presets = await deps.getStoragePresetsService(auth).listByProduct(auth.currentTenant.tenantId, productId);
    return parseOrThrow(storagePresetsResponseSchema, presets);
  });

  app.post('/api/products/:productId/storage-presets', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;
    if (!auth.currentTenant) {
      throw new ApiError(403, 'WORKSPACE_UNAVAILABLE', 'No active tenant workspace.');
    }

    const productId = parseOrThrow(idResponseSchema, {
      id: (request.params as { productId: string }).productId
    }).id;
    const body = parseOrThrow(createStoragePresetRequestBodySchema, request.body);
    const preset = await deps.getStoragePresetsService(auth).create(auth.currentTenant.tenantId, productId, body);
    return reply.code(201).send(parseOrThrow(storagePresetResponseSchema, preset));
  });

  app.patch('/api/products/:productId/storage-presets/:presetId', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
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
    const preset = await deps.getStoragePresetsService(auth).patch(auth.currentTenant.tenantId, productId, presetId, body);
    return parseOrThrow(storagePresetResponseSchema, preset);
  });

  app.put('/api/locations/:locationId/sku-policies/:productId/storage-preset', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
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
    const policy = await deps.getStoragePresetsService(auth).setPreferredPolicy(
      auth.currentTenant.tenantId,
      locationId,
      productId,
      body.preferredPackagingProfileId
    );
    return policy;
  });

  app.post('/api/storage-presets/:presetId/create-container', async (request, reply) => {
    const auth = await deps.getAuthContext(request, reply);
    if (!auth) return;

    const presetId = parseOrThrow(idResponseSchema, {
      id: (request.params as { presetId: string }).presetId
    }).id;
    const body = parseOrThrow(createContainerFromStoragePresetRequestBodySchema, request.body);

    try {
      const result = await deps.getStoragePresetsService(auth).createContainerFromPreset({
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
}
