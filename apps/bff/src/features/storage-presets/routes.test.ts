import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { registerStoragePresetsRoutes } from './routes.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  user: '33333333-3333-4333-8333-333333333333',
  product: '99999999-9999-4999-8999-999999999999',
  preset: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  location: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  containerType: '22222222-2222-4222-8222-222222222222',
  level: '44444444-4444-4444-8444-444444444444',
  policy: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  container: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
};

const authContext = {
  accessToken: 'token',
  user: { id: ids.user, email: 'operator@wos.local' },
  displayName: 'Local Operator',
  memberships: [
    { tenantId: ids.tenant, tenantCode: 'default', tenantName: 'Default Tenant', role: 'operator' as const }
  ],
  currentTenant: {
    tenantId: ids.tenant, tenantCode: 'default', tenantName: 'Default Tenant', role: 'operator' as const
  }
} as unknown as AuthenticatedRequestContext;

const presetFixture = {
  id: ids.preset,
  tenantId: ids.tenant,
  productId: ids.product,
  code: 'PAL-8CTN',
  name: 'Pallet / 8 cartons',
  profileType: 'storage' as const,
  scopeType: 'tenant' as const,
  scopeId: ids.tenant,
  validFrom: null,
  validTo: null,
  priority: 0,
  isDefault: false,
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  levels: [
    {
      id: ids.level,
      profileId: ids.preset,
      levelType: 'CTN',
      qtyEach: 16,
      parentLevelType: null,
      qtyPerParent: null,
      containerType: 'pallet',
      tareWeightG: null,
      nominalGrossWeightG: null,
      lengthMm: null,
      widthMm: null,
      heightMm: null,
      casesPerTier: null,
      tiersPerPallet: null,
      maxStackHeight: null,
      maxStackWeight: null,
      legacyProductPackagingLevelId: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ]
};

const containerResultFixture = {
  containerId: ids.container,
  systemCode: 'CNT-000001',
  externalCode: null,
  containerTypeId: ids.containerType,
  packagingProfileId: ids.preset,
  isStandardPack: true as const,
  placedLocationId: null,
  materializationMode: 'shell' as const,
  materializationStatus: 'shell' as const,
  materializationErrorCode: null,
  materializationErrorMessage: null,
  materializedInventoryUnitId: null,
  materializedContainerLineId: null,
  materializedQuantity: null
};

const policyFixture = {
  id: ids.policy,
  tenantId: ids.tenant,
  locationId: ids.location,
  productId: ids.product,
  minQtyEach: null,
  maxQtyEach: null,
  preferredPackagingProfileId: ids.preset,
  status: 'active' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z'
};

const validCreateBody = {
  code: 'PAL-8CTN',
  name: 'Pallet / 8 cartons',
  scopeType: 'tenant',
  scopeId: ids.tenant,
  levels: [{ levelType: 'CTN', qtyEach: 16, containerType: 'pallet' }]
};

const expectedParsedCreateBody = {
  ...validCreateBody,
  isDefault: false,
  status: 'active'
};

const validPatchBody = { name: 'Updated Pallet' };

const validSetPreferredBody = { preferredPackagingProfileId: ids.preset };

const validCreateContainerBody = { locationId: ids.location };

const invalidBody = { code: '', name: '', levels: [] };

function setupErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error: unknown, _request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ code: 'VALIDATION_ERROR', message: error.message });
    }

    if (error instanceof ApiError) {
      return reply.code(error.statusCode).send({ code: error.code, message: error.message });
    }

    return reply.code(500).send({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Unexpected test error'
    });
  });
}

describe('storage-presets routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/products/:productId/storage-presets', () => {
    it('returns presets when authenticated', async () => {
      const listByProduct = vi.fn().mockResolvedValue([presetFixture]);
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ listByProduct }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${ids.product}/storage-presets`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([presetFixture]);
      expect(listByProduct).toHaveBeenCalledWith(ids.tenant, ids.product);
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const listByProduct = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async () => null,
        getStoragePresetsService: () => ({ listByProduct }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${ids.product}/storage-presets`
      });

      expect(listByProduct).not.toHaveBeenCalled();
      await app.close();
    });

    it('returns validation error for invalid productId', async () => {
      const listByProduct = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ listByProduct }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/products/not-a-uuid/storage-presets'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(listByProduct).not.toHaveBeenCalled();
      await app.close();
    });

    it('returns 403 when currentTenant is missing', async () => {
      const listByProduct = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async () =>
          ({ ...authContext, currentTenant: null }) as unknown as AuthenticatedRequestContext,
        getStoragePresetsService: () => ({ listByProduct }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/products/${ids.product}/storage-presets`
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'WORKSPACE_UNAVAILABLE' });
      expect(listByProduct).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('POST /api/products/:productId/storage-presets', () => {
    it('forwards productId, tenantId and body when authenticated', async () => {
      const create = vi.fn().mockResolvedValue(presetFixture);
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ create }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/products/${ids.product}/storage-presets`,
        payload: validCreateBody
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toEqual(presetFixture);
      expect(create).toHaveBeenCalledWith(ids.tenant, ids.product, expectedParsedCreateBody);
      await app.close();
    });

    it('returns validation error for invalid body', async () => {
      const create = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ create }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/products/${ids.product}/storage-presets`,
        payload: invalidBody
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(create).not.toHaveBeenCalled();
      await app.close();
    });

    it('returns 403 when currentTenant is missing', async () => {
      const create = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async () =>
          ({ ...authContext, currentTenant: null }) as unknown as AuthenticatedRequestContext,
        getStoragePresetsService: () => ({ create }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/products/${ids.product}/storage-presets`,
        payload: validCreateBody
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'WORKSPACE_UNAVAILABLE' });
      expect(create).not.toHaveBeenCalled();
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const create = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async () => null,
        getStoragePresetsService: () => ({ create }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/products/${ids.product}/storage-presets`,
        payload: validCreateBody
      });

      expect(create).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('PATCH /api/products/:productId/storage-presets/:presetId', () => {
    it('forwards productId, presetId and body when authenticated', async () => {
      const patch = vi.fn().mockResolvedValue(presetFixture);
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ patch }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/products/${ids.product}/storage-presets/${ids.preset}`,
        payload: validPatchBody
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(presetFixture);
      expect(patch).toHaveBeenCalledWith(ids.tenant, ids.product, ids.preset, validPatchBody);
      await app.close();
    });

    it('returns validation error for invalid presetId', async () => {
      const patch = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ patch }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/products/${ids.product}/storage-presets/not-a-uuid`,
        payload: validPatchBody
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(patch).not.toHaveBeenCalled();
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const patch = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async () => null,
        getStoragePresetsService: () => ({ patch }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/products/${ids.product}/storage-presets/${ids.preset}`,
        payload: validPatchBody
      });

      expect(patch).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('PUT /api/locations/:locationId/sku-policies/:productId/storage-preset', () => {
    it('forwards locationId, productId and preferredPackagingProfileId when authenticated', async () => {
      const setPreferredPolicy = vi.fn().mockResolvedValue(policyFixture);
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ setPreferredPolicy }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/locations/${ids.location}/sku-policies/${ids.product}/storage-preset`,
        payload: validSetPreferredBody
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(policyFixture);
      expect(setPreferredPolicy).toHaveBeenCalledWith(
        ids.tenant,
        ids.location,
        ids.product,
        ids.preset
      );
      await app.close();
    });

    it('returns validation error for invalid UUID params', async () => {
      const setPreferredPolicy = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ setPreferredPolicy }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/locations/not-a-uuid/sku-policies/${ids.product}/storage-preset`,
        payload: validSetPreferredBody
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(setPreferredPolicy).not.toHaveBeenCalled();
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const setPreferredPolicy = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async () => null,
        getStoragePresetsService: () => ({ setPreferredPolicy }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'PUT',
        url: `/api/locations/${ids.location}/sku-policies/${ids.product}/storage-preset`,
        payload: validSetPreferredBody
      });

      expect(setPreferredPolicy).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('POST /api/storage-presets/:presetId/create-container', () => {
    it('forwards presetId and body when authenticated', async () => {
      const createContainerFromPreset = vi.fn().mockResolvedValue(containerResultFixture);
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ createContainerFromPreset }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/storage-presets/${ids.preset}/create-container`,
        payload: validCreateContainerBody
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(containerResultFixture);
      expect(createContainerFromPreset).toHaveBeenCalledWith({
        presetId: ids.preset,
        locationId: ids.location,
        externalCode: undefined,
        materializeContents: false,
        actorId: ids.user
      });
      await app.close();
    });

    it('returns validation error for invalid body', async () => {
      const createContainerFromPreset = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getStoragePresetsService: () => ({ createContainerFromPreset }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/storage-presets/${ids.preset}/create-container`,
        payload: { locationId: 'not-a-uuid' }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(createContainerFromPreset).not.toHaveBeenCalled();
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const createContainerFromPreset = vi.fn();
      const app = Fastify({ logger: false });
      registerStoragePresetsRoutes(app, {
        getAuthContext: async () => null,
        getStoragePresetsService: () => ({ createContainerFromPreset }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/storage-presets/${ids.preset}/create-container`,
        payload: validCreateContainerBody
      });

      expect(createContainerFromPreset).not.toHaveBeenCalled();
      await app.close();
    });
  });
});
