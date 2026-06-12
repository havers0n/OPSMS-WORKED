import { afterEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { registerFloorsRoutes } from './routes.js';

vi.mock('../../features/layout/repo.js', () => ({
  createLayoutRepo: vi.fn(() => ({
    findActiveDraft: vi.fn().mockResolvedValue({
      layoutVersionId: 'v1',
      floorId: '44444444-4444-4444-8444-444444444444',
      state: 'draft' as const,
      rackIds: [],
      racks: {},
      zoneIds: [],
      zones: {},
      wallIds: [],
      walls: {}
    }),
    findLatestPublished: vi.fn().mockResolvedValue({
      layoutVersionId: 'v2',
      floorId: '44444444-4444-4444-8444-444444444444',
      state: 'published' as const,
      versionNo: 1,
      rackIds: [],
      racks: {},
      zoneIds: [],
      zones: {},
      wallIds: [],
      walls: {}
    })
  }))
}));

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  otherTenant: '22222222-2222-4222-8222-222222222222',
  user: '33333333-3333-4333-8333-333333333333',
  floor: '44444444-4444-4444-8444-444444444444',
  aisle: '55555555-5555-4555-8555-555555555555',
  face: '66666666-6666-4666-8666-666666666666'
};

const authContext = {
  accessToken: 'token',
  user: {
    id: ids.user,
    email: 'operator@wos.local'
  },
  displayName: 'Local Operator',
  memberships: [
    {
      tenantId: ids.tenant,
      tenantCode: 'default',
      tenantName: 'Default Tenant',
      role: 'operator' as const
    }
  ],
  currentTenant: {
    tenantId: ids.tenant,
    tenantCode: 'default',
    tenantName: 'Default Tenant',
    role: 'operator' as const
  }
} as unknown as AuthenticatedRequestContext;

type QueryCall = {
  op: string;
  args: unknown[];
};

type TableCall = {
  table: string;
  calls: QueryCall[];
};

function makeSupabaseMock(results: Record<string, unknown[] | unknown | null>) {
  const tables: TableCall[] = [];

  return {
    tables,
    supabase: {
      from(table: string) {
        const tableCall: TableCall = { table, calls: [] };
        tables.push(tableCall);
        const builder = {
          select(...args: unknown[]) {
            tableCall.calls.push({ op: 'select', args });
            return builder;
          },
          eq(...args: unknown[]) {
            tableCall.calls.push({ op: 'eq', args });
            return builder;
          },
          in(...args: unknown[]) {
            tableCall.calls.push({ op: 'in', args });
            return builder;
          },
          not(...args: unknown[]) {
            tableCall.calls.push({ op: 'not', args });
            return builder;
          },
          order(...args: unknown[]) {
            tableCall.calls.push({ op: 'order', args });
            return builder;
          },
          maybeSingle() {
            tableCall.calls.push({ op: 'maybeSingle', args: [] });
            const rows = results[table];
            return Promise.resolve({
              data: Array.isArray(rows) ? rows[0] ?? null : rows ?? null,
              error: null
            });
          },
          then(
            resolve: (value: { data: unknown[]; error: null }) => void,
            reject?: (reason: unknown) => void
          ) {
            const rows = results[table];
            return Promise.resolve({
              data: Array.isArray(rows) ? rows : rows ? [rows] : [],
              error: null
            }).then(resolve, reject);
          }
        };

        return builder;
      }
    }
  };
}

function findTable(tables: TableCall[], table: string) {
  const match = tables.find((entry) => entry.table === table);
  expect(match).toBeDefined();
  return match as TableCall;
}

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

async function buildTestApp(results: Record<string, unknown[] | unknown | null>) {
  const { supabase, tables } = makeSupabaseMock(results);
  const app = Fastify({ logger: false });
  registerFloorsRoutes(app, {
    getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
    getUserSupabase: () => supabase as never,
    getFloorsService: () => ({ createFloor: vi.fn() }) as never,
    getSitesService: () => ({ listFloors: vi.fn() }) as never
  });
  setupErrorHandler(app);

  await app.ready();

  return { app, tables };
}

describe('floors routes', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/floors/:floorId/aisle-topology', () => {
    it('returns floor aisle topology with required face access normals', async () => {
      const { app, tables } = await buildTestApp({
        floors: { id: ids.floor, sites: { tenant_id: ids.tenant } },
        pick_aisles: [
          {
            id: ids.aisle,
            tenant_id: ids.tenant,
            floor_id: ids.floor,
            code: 'A-01',
            name: 'Aisle 01',
            status: 'active'
          }
        ],
        face_access: [
          {
            face_id: ids.face,
            aisle_id: ids.aisle,
            normal_x: 0,
            normal_y: -1
          },
          {
            face_id: '77777777-7777-4777-8777-777777777777',
            aisle_id: ids.aisle,
            normal_x: null,
            normal_y: 1
          }
        ]
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/aisle-topology`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        floorId: ids.floor,
        aisles: [
          {
            id: ids.aisle,
            floorId: ids.floor,
            code: 'A-01',
            name: 'Aisle 01'
          }
        ],
        faceAccess: [
          {
            faceId: ids.face,
            aisleId: ids.aisle,
            normalX: 0,
            normalY: -1
          }
        ]
      });

      expect(findTable(tables, 'floors').calls).toContainEqual({ op: 'eq', args: ['sites.tenant_id', ids.tenant] });
      expect(findTable(tables, 'pick_aisles').calls).toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });
      expect(findTable(tables, 'pick_aisles').calls).toContainEqual({ op: 'eq', args: ['floor_id', ids.floor] });
      expect(findTable(tables, 'face_access').calls).toContainEqual({ op: 'in', args: ['aisle_id', [ids.aisle]] });
      expect(findTable(tables, 'face_access').calls).not.toContainEqual({ op: 'eq', args: ['tenant_id', ids.tenant] });

      await app.close();
    }, 15000);

    it('returns empty arrays for an existing floor without topology', async () => {
      const { app } = await buildTestApp({
        floors: { id: ids.floor, sites: { tenant_id: ids.tenant } },
        pick_aisles: []
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/aisle-topology`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        floorId: ids.floor,
        aisles: [],
        faceAccess: []
      });

      await app.close();
    });

    it('returns tenant-safe not found for floors outside the current tenant', async () => {
      const { app, tables } = await buildTestApp({
        floors: null,
        pick_aisles: [
          {
            id: ids.aisle,
            tenant_id: ids.otherTenant,
            floor_id: ids.floor,
            code: 'OTHER',
            name: null,
            status: 'active'
          }
        ]
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/aisle-topology`
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ code: 'FLOOR_NOT_FOUND' });
      expect(tables.map((entry) => entry.table)).toEqual(['floors']);

      await app.close();
    });

    it('returns validation error for invalid floorId', async () => {
      const { app, tables } = await buildTestApp({});

      const response = await app.inject({
        method: 'GET',
        url: '/api/floors/not-a-uuid/aisle-topology'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(tables).toEqual([]);

      await app.close();
    });

    it('does not access Supabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase,
        getFloorsService: vi.fn() as never,
        getSitesService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/aisle-topology`
      });

      expect(getUserSupabase).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('GET /api/sites/:siteId/floors', () => {
    it('returns floors when authenticated', async () => {
      const listFloors = vi.fn().mockResolvedValue([{ id: ids.floor, siteId: ids.floor, code: 'F01', name: 'Floor 1', sortOrder: 0 }]);
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getUserSupabase: vi.fn() as never,
        getFloorsService: vi.fn() as never,
        getSitesService: () => ({ listFloors, listSites: vi.fn(), createSite: vi.fn() })
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/sites/${ids.floor}/floors`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([{ id: ids.floor, siteId: ids.floor, code: 'F01', name: 'Floor 1', sortOrder: 0 }]);
      expect(listFloors).toHaveBeenCalledWith(ids.floor);
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const listFloors = vi.fn();
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase: vi.fn() as never,
        getFloorsService: vi.fn() as never,
        getSitesService: () => ({ listFloors, listSites: vi.fn(), createSite: vi.fn() })
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/sites/${ids.floor}/floors`
      });

      expect(listFloors).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('POST /api/floors', () => {
    it('creates a floor when authenticated with current tenant', async () => {
      const createFloor = vi.fn().mockResolvedValue(ids.floor);
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getUserSupabase: vi.fn() as never,
        getFloorsService: () => ({ createFloor }),
        getSitesService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/floors',
        payload: {
          siteId: ids.floor,
          code: 'F01',
          name: 'Floor 1',
          sortOrder: 0
        }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: ids.floor });
      expect(createFloor).toHaveBeenCalledWith({
        siteId: ids.floor,
        code: 'F01',
        name: 'Floor 1',
        sortOrder: 0
      });
      await app.close();
    });

    it('returns validation error for invalid body', async () => {
      const createFloor = vi.fn();
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getUserSupabase: vi.fn() as never,
        getFloorsService: () => ({ createFloor }),
        getSitesService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/floors',
        payload: {
          siteId: 'not-a-uuid',
          code: '',
          name: '',
          sortOrder: -1
        }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(createFloor).not.toHaveBeenCalled();
      await app.close();
    });

    it('calls the service when no current tenant exists', async () => {
      const createFloor = vi.fn().mockResolvedValue(ids.floor);
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async () =>
          ({ ...authContext, currentTenant: null }) as unknown as AuthenticatedRequestContext,
        getUserSupabase: vi.fn() as never,
        getFloorsService: () => ({ createFloor }),
        getSitesService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/floors',
        payload: {
          siteId: ids.floor,
          code: 'F02',
          name: 'Floor 2',
          sortOrder: 1
        }
      });

      expect(createFloor).toHaveBeenCalled();
      expect(response.statusCode).toBe(200);
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const createFloor = vi.fn();
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase: vi.fn() as never,
        getFloorsService: () => ({ createFloor }),
        getSitesService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/floors',
        payload: {
          siteId: ids.floor,
          code: 'F03',
          name: 'Floor 3',
          sortOrder: 2
        }
      });

      expect(createFloor).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('GET /api/floors/:floorId/workspace', () => {
    it('returns workspace when authenticated', async () => {
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async (_request: FastifyRequest, _reply: FastifyReply) => authContext,
        getUserSupabase: vi.fn() as never,
        getFloorsService: vi.fn() as never,
        getSitesService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/workspace`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        floorId: ids.floor,
        activeDraft: expect.objectContaining({
          layoutVersionId: 'v1',
          floorId: ids.floor,
          state: 'draft'
        }),
        latestPublished: expect.objectContaining({
          layoutVersionId: 'v2',
          floorId: ids.floor,
          state: 'published'
        })
      });
      await app.close();
    });

    it('does not access Supabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const app = Fastify({ logger: false });
      registerFloorsRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase,
        getFloorsService: vi.fn() as never,
        getSitesService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/workspace`
      });

      expect(getUserSupabase).not.toHaveBeenCalled();
      await app.close();
    });
  });
});
