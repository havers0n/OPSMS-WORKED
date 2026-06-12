import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { buildApp } from '../../app.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { SitesService } from './service.js';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  site: '22222222-2222-4222-8222-222222222222'
};

const authContext = {
  accessToken: 'token',
  user: {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'operator@wos.local'
  },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId: ids.tenant,
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'tenant_admin' as const
    }
  ],
  currentTenant: {
    tenantId: ids.tenant,
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'tenant_admin' as const
  }
} as unknown as AuthenticatedRequestContext;

const site = {
  id: ids.site,
  code: 'WH-01',
  name: 'Warehouse One',
  timezone: 'Europe/London'
};

function createService() {
  return {
    listSites: vi.fn(async () => [site]),
    createSite: vi.fn(async () => ids.site),
    listFloors: vi.fn(async () => [])
  } satisfies SitesService;
}

describe('sites routes', () => {
  const service = createService();
  const app = buildApp({
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
    getSitesService: () => service
  });

  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/sites', () => {
    it('returns sites when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sites'
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([site]);
      expect(service.listSites).toHaveBeenCalledOnce();
    });

    it('does not call the service when unauthenticated', async () => {
      const unauthService = createService();
      const unauthApp = buildApp({
        getAuthContext: async () => null as unknown as AuthenticatedRequestContext,
        getSitesService: () => unauthService
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'GET',
        url: '/api/sites'
      });

      expect(unauthService.listSites).not.toHaveBeenCalled();
      await unauthApp.close();
    });
  });

  describe('POST /api/sites', () => {
    it('creates a site when authenticated with current tenant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sites',
        payload: {
          code: 'WH-02',
          name: 'Warehouse Two',
          timezone: 'Europe/Paris'
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: ids.site });
      expect(service.createSite).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        code: 'WH-02',
        name: 'Warehouse Two',
        timezone: 'Europe/Paris'
      });
    });

    it('returns workspace unavailable when no current tenant exists', async () => {
      const tenantlessService = createService();
      const tenantlessApp = buildApp({
        getAuthContext: async () =>
          ({ ...authContext, currentTenant: null }) as AuthenticatedRequestContext,
        getSitesService: () => tenantlessService
      });
      await tenantlessApp.ready();

      const response = await tenantlessApp.inject({
        method: 'POST',
        url: '/api/sites',
        payload: {
          code: 'WH-03',
          name: 'Warehouse Three',
          timezone: 'Europe/Berlin'
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'WORKSPACE_UNAVAILABLE' });
      expect(tenantlessService.createSite).not.toHaveBeenCalled();
      await tenantlessApp.close();
    });

    it('returns validation error for invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sites',
        payload: {
          code: '',
          name: 'Test',
          timezone: 'UTC'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(service.createSite).not.toHaveBeenCalled();
    });

    it('does not call the service when unauthenticated', async () => {
      const unauthService = createService();
      const unauthApp = buildApp({
        getAuthContext: async () => null as unknown as AuthenticatedRequestContext,
        getSitesService: () => unauthService
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'POST',
        url: '/api/sites',
        payload: {
          code: 'WH-04',
          name: 'Warehouse Four',
          timezone: 'Europe/Madrid'
        }
      });

      expect(unauthService.createSite).not.toHaveBeenCalled();
      await unauthApp.close();
    });
  });
});
