import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ApiError } from '../../errors.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import { registerLayoutRoutes } from './routes.js';

let mockRepo: ReturnType<typeof createMockRepo>;

function createMockRepo() {
  return {
    listPublishedCells: vi.fn(),
    findActiveDraft: vi.fn(),
    findPublishedLayoutSummary: vi.fn()
  };
}

vi.mock('./repo.js', () => ({
  createLayoutRepo: vi.fn(() => mockRepo)
}));

const ids = {
  tenant: '11111111-1111-4111-8111-111111111111',
  user: '33333333-3333-4333-8333-333333333333',
  floor: '44444444-4444-4444-8444-444444444444',
  layoutVersion: '55555555-5555-4555-8555-555555555555'
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

describe('layout routes', () => {
  beforeEach(() => {
    mockRepo = createMockRepo();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/floors/:floorId/published-cells', () => {
    it('returns published cells when authenticated', async () => {
      const cellFixture = {
        id: 'cell-1',
        cellCode: '03-A.01.01.01',
        layoutVersionId: 'ver-1',
        rackId: 'rack-1',
        rackFaceId: 'face-1',
        rackSectionId: 'section-1',
        rackLevelId: 'level-1',
        slotNo: 1,
        address: {
          raw: '03-A.01.01.01',
          parts: { rackCode: '03', face: 'A' as const, section: 1, level: 1, slot: 1 },
          sortKey: '0003-A-01-01-01'
        },
        x: 10,
        y: 20,
        status: 'active' as const
      };
      mockRepo.listPublishedCells.mockResolvedValue([cellFixture]);

      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/published-cells`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([cellFixture]);
      expect(mockRepo.listPublishedCells).toHaveBeenCalledWith(ids.floor);
      await app.close();
    });

    it('returns empty array when no published cells exist', async () => {
      mockRepo.listPublishedCells.mockResolvedValue([]);

      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/published-cells`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
      await app.close();
    });

    it('returns validation error for invalid floorId', async () => {
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/floors/not-a-uuid/published-cells'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      await app.close();
    });

    it('does not access Supabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/published-cells`
      });

      expect(getUserSupabase).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('GET /api/floors/:floorId/layout-draft', () => {
    it('returns the active draft when authenticated', async () => {
      const draftFixture = {
        layoutVersionId: ids.layoutVersion,
        floorId: ids.floor,
        state: 'draft' as const,
        rackIds: [],
        racks: {},
        zoneIds: [],
        zones: {},
        wallIds: [],
        walls: {}
      };
      mockRepo.findActiveDraft.mockResolvedValue(draftFixture);

      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/layout-draft`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(draftFixture);
      expect(mockRepo.findActiveDraft).toHaveBeenCalledWith(ids.floor);
      await app.close();
    });

    it('returns null when no active draft exists', async () => {
      mockRepo.findActiveDraft.mockResolvedValue(null);

      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/layout-draft`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toBeNull();
      await app.close();
    });

    it('returns validation error for invalid floorId', async () => {
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/floors/not-a-uuid/layout-draft'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      await app.close();
    });

    it('does not access Supabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/layout-draft`
      });

      expect(getUserSupabase).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('GET /api/floors/:floorId/published-layout', () => {
    it('returns the published layout summary when authenticated', async () => {
      const summaryFixture = {
        layoutVersionId: ids.layoutVersion,
        floorId: ids.floor,
        versionNo: 1,
        publishedAt: '2026-01-01T00:00:00.000Z',
        cellCount: 8,
        sampleAddresses: ['03-A.01.01.01']
      };
      mockRepo.findPublishedLayoutSummary.mockResolvedValue(summaryFixture);

      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/published-layout`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(summaryFixture);
      expect(mockRepo.findPublishedLayoutSummary).toHaveBeenCalledWith(ids.floor);
      await app.close();
    });

    it('returns null when no published layout exists', async () => {
      mockRepo.findPublishedLayoutSummary.mockResolvedValue(null);

      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/published-layout`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toBeNull();
      await app.close();
    });

    it('returns validation error for invalid floorId', async () => {
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/floors/not-a-uuid/published-layout'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      await app.close();
    });

    it('does not access Supabase when unauthenticated', async () => {
      const getUserSupabase = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase,
        getLayoutService: vi.fn() as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: `/api/floors/${ids.floor}/published-layout`
      });

      expect(getUserSupabase).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('POST /api/layout-drafts', () => {
    it('creates a draft when authenticated', async () => {
      const createDraft = vi.fn().mockResolvedValue(ids.layoutVersion);
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ createDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/layout-drafts',
        payload: { floorId: ids.floor }
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({ id: ids.layoutVersion });
      expect(createDraft).toHaveBeenCalledWith(ids.floor, ids.user);
      await app.close();
    });

    it('returns validation error for invalid body', async () => {
      const createDraft = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ createDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/layout-drafts',
        payload: { floorId: 'not-a-uuid' }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(createDraft).not.toHaveBeenCalled();
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const createDraft = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ createDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/layout-drafts',
        payload: { floorId: ids.floor }
      });

      expect(createDraft).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('POST /api/layout-drafts/save', () => {
    it('forwards body unchanged when authenticated', async () => {
      const saveResult = {
        layoutVersionId: ids.layoutVersion,
        draftVersion: 3,
        changeClass: 'no_changes' as const
      };
      const saveDraft = vi.fn().mockResolvedValue(saveResult);
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ saveDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const payload = {
        layoutDraft: {
          layoutVersionId: ids.layoutVersion,
          draftVersion: 2,
          racks: [],
          zones: [],
          walls: []
        }
      };
      const response = await app.inject({
        method: 'POST',
        url: '/api/layout-drafts/save',
        payload
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(saveResult);
      expect(saveDraft).toHaveBeenCalledWith(payload.layoutDraft, ids.user);
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const saveDraft = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ saveDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/layout-drafts/save',
        payload: {
          layoutDraft: {
            layoutVersionId: ids.layoutVersion,
            racks: [],
            zones: [],
            walls: []
          }
        }
      });

      expect(saveDraft).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('POST /api/layout-drafts/:layoutVersionId/validate', () => {
    it('forwards layoutVersionId and preserves mapper behavior', async () => {
      const validationResult = {
        isValid: false,
        issues: [{ code: 'LAYOUT_OVERLAP', severity: 'error' as const, message: 'Rack geometry overlaps another rack.', entityId: ids.layoutVersion }]
      };
      const validateVersion = vi.fn().mockResolvedValue(validationResult);
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ validateVersion }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/layout-drafts/${ids.layoutVersion}/validate`
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(validationResult);
      expect(validateVersion).toHaveBeenCalledWith(ids.layoutVersion);
      await app.close();
    });

    it('returns validation error for invalid layoutVersionId', async () => {
      const validateVersion = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ validateVersion }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/layout-drafts/not-a-uuid/validate'
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(validateVersion).not.toHaveBeenCalled();
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const validateVersion = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ validateVersion }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/layout-drafts/${ids.layoutVersion}/validate`
      });

      expect(validateVersion).not.toHaveBeenCalled();
      await app.close();
    });
  });

  describe('POST /api/layout-drafts/:layoutVersionId/publish', () => {
    it('forwards body and layoutVersionId when authenticated', async () => {
      const publishResult = {
        layoutVersionId: ids.layoutVersion,
        publishedAt: '2026-03-21T10:15:00.000Z',
        generatedCells: 8,
        validation: { isValid: true, issues: [] }
      };
      const publishDraft = vi.fn().mockResolvedValue(publishResult);
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ publishDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const payload = { expectedDraftVersion: 5, renameMappings: [] };
      const response = await app.inject({
        method: 'POST',
        url: `/api/layout-drafts/${ids.layoutVersion}/publish`,
        payload
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(publishResult);
      expect(publishDraft).toHaveBeenCalledWith(ids.layoutVersion, 5, ids.user, []);
      await app.close();
    });

    it('returns validation error for invalid layoutVersionId', async () => {
      const publishDraft = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async (_req, _rep) => authContext,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ publishDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: '/api/layout-drafts/not-a-uuid/publish',
        payload: { expectedDraftVersion: 1 }
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(publishDraft).not.toHaveBeenCalled();
      await app.close();
    });

    it('does not call the service when unauthenticated', async () => {
      const publishDraft = vi.fn();
      const app = Fastify({ logger: false });
      registerLayoutRoutes(app, {
        getAuthContext: async () => null,
        getUserSupabase: vi.fn() as never,
        getLayoutService: () => ({ publishDraft }) as never
      });
      setupErrorHandler(app);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/layout-drafts/${ids.layoutVersion}/publish`,
        payload: { expectedDraftVersion: 1 }
      });

      expect(publishDraft).not.toHaveBeenCalled();
      await app.close();
    });
  });
});
