import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildApp } from '../../app.js';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { ContainersService } from './service.js';
import type { InventoryService } from '../inventory/service.js';
import type { Container, ContainerType } from '@wos/domain';
import type { RemoveContainerResult } from '@wos/domain';

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  user: '22222222-2222-4222-8222-222222222222',
  container: '33333333-3333-4333-8333-333333333333',
  containerType: '44444444-4444-4444-8444-444444444444',
  product: '77777777-7777-4777-8777-777777777777',
  inventoryUnit: '88888888-8888-4888-8888-888888888888',
  cell: '99999999-9999-4999-8999-999999999999',
};

const authContext = {
  accessToken: 'token',
  user: { id: ids.user, email: 'operator@wos.local' },
  displayName: 'Operator',
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

const containerTypeMock: ContainerType = {
  id: ids.containerType,
  code: 'bin',
  description: 'Bin',
  supportsStorage: true,
  supportsPicking: true
};

const containerMock: Container = {
  id: ids.container,
  tenantId: ids.tenant,
  systemCode: 'SYS-001',
  externalCode: null,
  containerTypeId: ids.containerType,
  status: 'active',
  operationalRole: 'storage',
  createdAt: '2025-01-01T00:00:00.000Z',
  createdBy: ids.user
};

const productMock = {
  id: ids.product,
  source: 'internal',
  external_product_id: 'PROD-001',
  sku: 'SKU-001',
  name: 'Test Product',
  permalink: null,
  image_urls: null,
  image_files: null,
  is_active: true,
  category: 'test',
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z'
};

const storageRowMock = {
  tenant_id: ids.tenant,
  container_id: ids.container,
  system_code: 'SYS-001',
  external_code: null,
  container_type: 'bin',
  container_status: 'active' as const,
  inventory_unit_id: ids.inventoryUnit,
  item_ref: null,
  product_id: ids.product,
  quantity: 10,
  uom: 'units',
  packaging_state: 'loose' as const,
  product_packaging_level_id: null,
  pack_count: null,
  container_packaging_profile_id: null,
  container_is_standard_pack: null,
  preferred_packaging_profile_id: null,
  preset_usage_status: 'unknown' as const,
  preset_materialization_status: 'unknown' as const
};

function createSupabaseMock(dataByTable: Record<string, unknown>) {
  const from = (table: string) => {
    const tableData = dataByTable[table];
    const listResult = { data: Array.isArray(tableData) ? tableData : [], error: null };
    const singleResult = {
      data: Array.isArray(tableData) ? (tableData[0] ?? null) : (tableData ?? null),
      error: null
    };

    const chain = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve(singleResult),
      then: (resolve: (value: typeof listResult) => void) => Promise.resolve(listResult).then(resolve)
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

function createContainersService() {
  return {
    listAllTypes: vi.fn<ContainersService['listAllTypes']>(async () => [containerTypeMock]),
    listAll: vi.fn<ContainersService['listAll']>(async () => [containerMock]),
    findById: vi.fn<ContainersService['findById']>(async () => containerMock),
    createContainer: vi.fn<ContainersService['createContainer']>(async (input) => ({
      ...containerMock,
      operationalRole: input.operationalRole ?? 'storage'
    })),
    removeContainer: vi.fn<ContainersService['removeContainer']>(async () => ({
      action: 'removed' as const,
      containerId: ids.container,
      cellId: null,
      placementId: null,
      occurredAt: '2025-01-01T00:00:00.000Z'
    } satisfies RemoveContainerResult))
  } satisfies ContainersService;
}

function createInventoryService() {
  return {
    receiveInventoryUnit: vi.fn<InventoryService['receiveInventoryUnit']>(async () => ({
      inventoryUnit: {
        id: ids.inventoryUnit,
        tenant_id: ids.tenant,
        container_id: ids.container,
        product_id: ids.product,
        quantity: 10,
        uom: 'units',
        packaging_state: 'loose' as const,
        product_packaging_level_id: null,
        pack_count: null,
        created_at: '2025-01-01T00:00:00.000Z',
        created_by: ids.user,
        updated_at: '2025-01-01T00:00:00.000Z'
      },
      product: productMock
    }))
  } satisfies InventoryService;
}

describe('containers routes', () => {
  let service: ReturnType<typeof createContainersService>;
  let inventoryService: ReturnType<typeof createInventoryService>;
  let app: ReturnType<typeof buildApp>;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeAll(async () => {
    service = createContainersService();
    inventoryService = createInventoryService();
    supabaseMock = createSupabaseMock({});
    app = buildApp({
      getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
      getContainersService: () => service,
      getInventoryService: () => inventoryService,
      getUserSupabase: () => supabaseMock
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /api/container-types ──────────────────────────────────────────────

  describe('GET /api/container-types', () => {
    it('returns container types when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/container-types'
      });

      expect(response.statusCode).toBe(200);
      const json = response.json() as ContainerType[];
      expect(json).toHaveLength(1);
      expect(json[0].code).toBe('bin');
      expect(service.listAllTypes).toHaveBeenCalledOnce();
    });

    it('does not call the service when unauthenticated', async () => {
      const unauthService = createContainersService();
      const unauthApp = buildApp({
        getAuthContext: async () => null as unknown as AuthenticatedRequestContext,
        getContainersService: () => unauthService
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'GET',
        url: '/api/container-types'
      });

      expect(unauthService.listAllTypes).not.toHaveBeenCalled();
      await unauthApp.close();
    });
  });

  // ── GET /api/containers ───────────────────────────────────────────────────

  describe('GET /api/containers', () => {
    it('returns containers when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/containers'
      });

      expect(response.statusCode).toBe(200);
      const json = response.json() as Container[];
      expect(json).toHaveLength(1);
      expect(json[0].id).toBe(ids.container);
      expect(service.listAll).toHaveBeenCalledOnce();
      expect(service.listAll).toHaveBeenCalledWith(undefined);
    });

    it('does not call the service when unauthenticated', async () => {
      const unauthService = createContainersService();
      const unauthApp = buildApp({
        getAuthContext: async () => null as unknown as AuthenticatedRequestContext,
        getContainersService: () => unauthService
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'GET',
        url: '/api/containers'
      });

      expect(unauthService.listAll).not.toHaveBeenCalled();
      await unauthApp.close();
    });
  });

  // ── GET /api/containers/:containerId/storage ───────────────────────────────

  describe('GET /api/containers/:containerId/storage', () => {
    it('returns storage snapshot with product enrichment when authenticated', async () => {
      const storageSupabase = createSupabaseMock({
        'container_storage_canonical_v': [storageRowMock],
        'products': [productMock]
      });
      const storageApp = buildApp({
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getContainersService: () => service,
        getUserSupabase: () => storageSupabase
      });
      await storageApp.ready();

      const response = await storageApp.inject({
        method: 'GET',
        url: `/api/containers/${ids.container}/storage`
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(Array.isArray(json)).toBe(true);
      expect(json).toHaveLength(1);
      expect(json[0].product).toBeDefined();
      expect(json[0].product.id).toBe(ids.product);
      expect(json[0].product.name).toBe('Test Product');
      await storageApp.close();
    });

    it('does not call getUserSupabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const unauthApp = buildApp({
        getAuthContext: async () => null as unknown as AuthenticatedRequestContext,
        getUserSupabase
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'GET',
        url: `/api/containers/${ids.container}/storage`
      });

      expect(getUserSupabase).not.toHaveBeenCalled();
      await unauthApp.close();
    });
  });

  // ── GET /api/containers/:containerId ─────────────────────────────────────

  describe('GET /api/containers/:containerId', () => {
    it('returns a container by id when authenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/containers/${ids.container}`
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.id).toBe(ids.container);
      expect(service.findById).toHaveBeenCalledWith(ids.container);
    });

    it('returns 404 when container not found', async () => {
      const notFoundService = createContainersService();
      notFoundService.findById.mockResolvedValue(null);
      const notFoundApp = buildApp({
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getContainersService: () => notFoundService
      });
      await notFoundApp.ready();

      const response = await notFoundApp.inject({
        method: 'GET',
        url: `/api/containers/${ids.container}`
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'NOT_FOUND' });
      await notFoundApp.close();
    });
  });

  // ── GET /api/containers/:containerId/location ──────────────────────────────

  describe('GET /api/containers/:containerId/location', () => {
    it('returns current location when authenticated', async () => {
      const locSupabase = createSupabaseMock({
        'active_container_locations_v': [{
          container_id: ids.container,
          location_id: ids.tenant,
          location_code: 'LOC-001',
          location_type: 'floor',
          cell_id: null
        }]
      });
      const locApp = buildApp({
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getContainersService: () => service,
        getUserSupabase: () => locSupabase
      });
      await locApp.ready();

      const response = await locApp.inject({
        method: 'GET',
        url: `/api/containers/${ids.container}/location`
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.containerId).toBe(ids.container);
      expect(json.currentLocationId).toBe(ids.tenant);
      expect(json.locationCode).toBe('LOC-001');
      await locApp.close();
    });

    it('returns null location fields when container has no active location', async () => {
      const nullLocSupabase = createSupabaseMock({
        'active_container_locations_v': [],
        'containers': [{ id: ids.container }]
      });
      const nullLocApp = buildApp({
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getContainersService: () => service,
        getUserSupabase: () => nullLocSupabase
      });
      await nullLocApp.ready();

      const response = await nullLocApp.inject({
        method: 'GET',
        url: `/api/containers/${ids.container}/location`
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.containerId).toBe(ids.container);
      expect(json.currentLocationId).toBeNull();
      expect(json.locationCode).toBeNull();
      await nullLocApp.close();
    });
  });

  // ── POST /api/containers ──────────────────────────────────────────────────

  describe('POST /api/containers', () => {
    it('creates a container when authenticated with current tenant', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/containers',
        payload: {
          containerTypeId: ids.containerType,
          externalCode: 'EXT-001',
          operationalRole: 'storage'
        }
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.containerId).toBe(ids.container);
      expect(json.operationalRole).toBe('storage');
      expect(service.createContainer).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        containerTypeId: ids.containerType,
        externalCode: 'EXT-001',
        operationalRole: 'storage',
        createdBy: ids.user
      });
    });

    it('returns 403 when no current tenant exists', async () => {
      const tenantlessService = createContainersService();
      const tenantlessApp = buildApp({
        getAuthContext: async () =>
          ({ ...authContext, currentTenant: null }) as unknown as AuthenticatedRequestContext,
        getContainersService: () => tenantlessService
      });
      await tenantlessApp.ready();

      const response = await tenantlessApp.inject({
        method: 'POST',
        url: '/api/containers',
        payload: {
          containerTypeId: ids.containerType,
          operationalRole: 'storage'
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'WORKSPACE_UNAVAILABLE' });
      expect(tenantlessService.createContainer).not.toHaveBeenCalled();
      await tenantlessApp.close();
    });

    it('returns 400 for invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/containers',
        payload: {
          containerTypeId: 'not-a-uuid'
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(service.createContainer).not.toHaveBeenCalled();
    });

    it('returns 409 when container code already exists', async () => {
      const conflictService = createContainersService();
      conflictService.createContainer.mockRejectedValue(
        new ApiError(409, 'CONTAINER_CODE_ALREADY_EXISTS', 'Container code already exists in this workspace.')
      );
      const conflictApp = buildApp({
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getContainersService: () => conflictService
      });
      await conflictApp.ready();

      const response = await conflictApp.inject({
        method: 'POST',
        url: '/api/containers',
        payload: {
          containerTypeId: ids.containerType,
          externalCode: 'DUP-001',
          operationalRole: 'storage'
        }
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ code: 'CONTAINER_CODE_ALREADY_EXISTS' });
      await conflictApp.close();
    });
  });

  // ── POST /api/containers/:containerId/remove ───────────────────────────────

  describe('POST /api/containers/:containerId/remove', () => {
    it('removes a container when authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/containers/${ids.container}/remove`
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.action).toBe('removed');
      expect(json.containerId).toBe(ids.container);
      expect(service.removeContainer).toHaveBeenCalledWith(ids.container, ids.user);
    });

    it('does not call the service when unauthenticated', async () => {
      const unauthService = createContainersService();
      const unauthApp = buildApp({
        getAuthContext: async () => null as unknown as AuthenticatedRequestContext,
        getContainersService: () => unauthService
      });
      await unauthApp.ready();

      const response = await unauthApp.inject({
        method: 'POST',
        url: `/api/containers/${ids.container}/remove`
      });

      expect(unauthService.removeContainer).not.toHaveBeenCalled();
      await unauthApp.close();
    });
  });

  // ── POST /api/containers/:containerId/inventory ────────────────────────────

  describe('POST /api/containers/:containerId/inventory', () => {
    it('adds inventory to a container when authenticated', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/containers/${ids.container}/inventory`,
        payload: {
          productId: ids.product,
          quantity: 10,
          uom: 'units',
          receiptCorrelationKey: ids.cell
        }
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.id).toBe(ids.inventoryUnit);
      expect(json.containerId).toBe(ids.container);
      expect(json.product).toBeDefined();
      expect(json.product.id).toBe(ids.product);
      expect(inventoryService.receiveInventoryUnit).toHaveBeenCalledWith({
        tenantId: ids.tenant,
        containerId: ids.container,
        productId: ids.product,
        quantity: 10,
        uom: 'units',
        actorId: ids.user,
        packagingState: undefined,
        productPackagingLevelId: null,
        packCount: null,
        receiptCorrelationKey: ids.cell
      });
    });

    it('returns 403 when no current tenant exists', async () => {
      const tenantlessInventoryService = createInventoryService();
      const tenantlessApp = buildApp({
        getAuthContext: async () =>
          ({ ...authContext, currentTenant: null }) as unknown as AuthenticatedRequestContext,
        getInventoryService: () => tenantlessInventoryService
      });
      await tenantlessApp.ready();

      const response = await tenantlessApp.inject({
        method: 'POST',
        url: `/api/containers/${ids.container}/inventory`,
        payload: {
          productId: ids.product,
          quantity: 10,
          uom: 'units',
          receiptCorrelationKey: ids.cell
        }
      });

      expect(response.statusCode).toBe(403);
      expect(response.json()).toMatchObject({ code: 'WORKSPACE_UNAVAILABLE' });
      expect(tenantlessInventoryService.receiveInventoryUnit).not.toHaveBeenCalled();
      await tenantlessApp.close();
    });

    it('returns 400 for invalid body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/containers/${ids.container}/inventory`,
        payload: {
          productId: 'not-a-uuid',
          quantity: -1,
          uom: ''
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(inventoryService.receiveInventoryUnit).not.toHaveBeenCalled();
    });
  });
});
