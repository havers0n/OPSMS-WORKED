import { describe, expect, it, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerBondedCoverageRoutes } from './bonded-coverage-routes.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { BondedCoverageService } from './bonded-coverage-service.js';
import type {
  BondedCoverageRequest,
  BondedCoverageRequestDetail,
  BondedCoverageRequestItem
} from '@wos/domain';

// ── Fake BondedCoverageService (in-memory, for tests only) ───────────────────

function createFakeBondedCoverageService(): BondedCoverageService {
  const requestStore = new Map<string, BondedCoverageRequestDetail>();
  const itemStore = new Map<string, BondedCoverageRequestItem>();

  function makeRequest(
    tenantId: string,
    shiftId: string,
    id: string,
    overrides?: Partial<BondedCoverageRequest>
  ): BondedCoverageRequest {
    return {
      id,
      tenantId,
      shiftId,
      planningDate: '2026-06-23',
      status: 'open',
      title: null,
      notes: null,
      bondedSnapshotId: null,
      warehouseStockSnapshotId: null,
      createdByProfileId: null,
      createdByName: 'Test User',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      closedByProfileId: null,
      closedByName: null,
      closedAt: null,
      cancelledByProfileId: null,
      cancelledByName: null,
      cancelledAt: null,
      ...overrides
    };
  }

  function makeItem(
    requestId: string,
    id: string,
    overrides?: Partial<BondedCoverageRequestItem>
  ): BondedCoverageRequestItem {
    return {
      id,
      requestId,
      sku: '519526',
      description: null,
      category: null,
      requestedQty: 264,
      fulfilledQty: 0,
      demandQtyAtCreate: null,
      warehouseQtyAtCreate: null,
      shortageQtyAtCreate: 264,
      bondedAvailableQtyAtCreate: 2979,
      bondedCoverQtyAtCreate: 264,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides
    };
  }

  return {
    async createRequest(tenantId, shiftId, userId, userName, input) {
      const id = crypto.randomUUID();
      const request = makeRequest(tenantId, shiftId, id, {
        title: input.title ?? null,
        notes: input.notes ?? null,
        createdByName: userName ?? undefined
      });

      const items: BondedCoverageRequestItem[] = [];
      if (input.items) {
        for (const itemInput of input.items) {
          const itemId = crypto.randomUUID();
          const item = makeItem(id, itemId, {
            sku: itemInput.sku,
            requestedQty: itemInput.requestedQty,
            shortageQtyAtCreate: itemInput.shortageQtyAtCreate ?? null,
            bondedAvailableQtyAtCreate: itemInput.bondedAvailableQtyAtCreate ?? null
          });
          items.push(item);
          itemStore.set(`${tenantId}:${itemId}`, item);
        }
      }

      const detail: BondedCoverageRequestDetail = { ...request, items };
      requestStore.set(`${tenantId}:${id}`, detail);
      return detail;
    },

    async listRequests(tenantId, shiftId, status) {
      const results: BondedCoverageRequest[] = [];
      for (const [key, detail] of requestStore) {
        if (!key.startsWith(`${tenantId}:`)) continue;
        if (detail.shiftId !== shiftId) continue;
        if (status && detail.status !== status) continue;
        const { items: _items, ...request } = detail;
        results.push(request);
      }
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return results;
    },

    async getRequest(tenantId, requestId) {
      const detail = requestStore.get(`${tenantId}:${requestId}`);
      return detail ?? null;
    },

    async addItem(tenantId, requestId, input) {
      const request = requestStore.get(`${tenantId}:${requestId}`);
      if (!request) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404, code: 'NOT_FOUND' });
      if (request.status !== 'open') throw Object.assign(new Error('REQUEST_NOT_OPEN'), { statusCode: 409, code: 'REQUEST_NOT_OPEN' });

      const itemId = crypto.randomUUID();
      const item = makeItem(requestId, itemId, {
        sku: input.sku,
        requestedQty: input.requestedQty,
        shortageQtyAtCreate: input.shortageQtyAtCreate ?? null,
        bondedAvailableQtyAtCreate: input.bondedAvailableQtyAtCreate ?? null
      });
      itemStore.set(`${tenantId}:${itemId}`, item);
      request.items.push(item);
      return item;
    },

    async updateItem(tenantId, requestId, itemId, input) {
      const request = requestStore.get(`${tenantId}:${requestId}`);
      if (!request) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404, code: 'NOT_FOUND' });
      if (request.status !== 'open') throw Object.assign(new Error('REQUEST_NOT_OPEN'), { statusCode: 409, code: 'REQUEST_NOT_OPEN' });

      const item = itemStore.get(`${tenantId}:${itemId}`);
      if (!item) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404, code: 'NOT_FOUND' });

      if (input.requestedQty !== undefined) item.requestedQty = input.requestedQty;
      if (input.notes !== undefined) item.notes = input.notes;

      return { ...item };
    },

    async closeRequest(tenantId, requestId, userId, userName, input) {
      const detail = requestStore.get(`${tenantId}:${requestId}`);
      if (!detail) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404, code: 'NOT_FOUND' });
      if (detail.status !== 'open') throw Object.assign(new Error('REQUEST_NOT_OPEN'), { statusCode: 409, code: 'REQUEST_NOT_OPEN' });

      detail.status = 'closed';
      detail.closedByProfileId = userId;
      detail.closedByName = userName;
      detail.closedAt = new Date().toISOString();

      if (input.items) {
        for (const closeItem of input.items) {
          const item = itemStore.get(`${tenantId}:${closeItem.itemId}`);
          if (item) {
            item.fulfilledQty = closeItem.fulfilledQty;
          }
        }
      }

      return { ...detail, items: [...detail.items] };
    },

    async cancelRequest(tenantId, requestId, userId, userName, input) {
      const detail = requestStore.get(`${tenantId}:${requestId}`);
      if (!detail) throw Object.assign(new Error('NOT_FOUND'), { statusCode: 404, code: 'NOT_FOUND' });
      if (detail.status !== 'open') throw Object.assign(new Error('REQUEST_NOT_OPEN'), { statusCode: 409, code: 'REQUEST_NOT_OPEN' });

      detail.status = 'cancelled';
      detail.cancelledByProfileId = userId;
      detail.cancelledByName = userName;
      detail.cancelledAt = new Date().toISOString();

      return { ...detail, items: [...detail.items] };
    }
  };
}

// ── Test helpers ─────────────────────────────────────────────────────────────

let tenantCounter = 0;

function buildTestApp() {
  tenantCounter += 1;
  const tenantId = `test-tenant-${tenantCounter}`;

  const mockAuthContext: AuthenticatedRequestContext = {
    accessToken: 'test-token',
    user: { id: 'user-1', email: 'test@test.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() } as any,
    currentTenant: { tenantId, tenantCode: 'test-tenant', tenantName: 'Test', role: 'operator' },
    displayName: 'Test User',
    memberships: [{ tenantId, tenantCode: 'test-tenant', tenantName: 'Test', role: 'operator' }]
  };

  const app = Fastify();
  const getAuthContext = vi.fn().mockResolvedValue(mockAuthContext);
  const bondedCoverageService = createFakeBondedCoverageService();
  const getBondedCoverageService = vi.fn().mockReturnValue(bondedCoverageService);

  registerBondedCoverageRoutes(app, { getAuthContext, getBondedCoverageService });

  return { app, tenantId, bondedCoverageService };
}

function makeCreatePayload(overrides?: Record<string, unknown>) {
  return {
    planningDate: '2026-06-23',
    title: 'Test Request',
    ...overrides
  };
}

function makeItemPayload(overrides?: Record<string, unknown>) {
  return {
    sku: '519526',
    requestedQty: 264,
    shortageQtyAtCreate: 264,
    bondedAvailableQtyAtCreate: 2979,
    ...overrides
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('bonded coverage routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/manual-shifts/:shiftId/bonded-requests creates request', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({ title: 'Test Request' }),
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeTruthy();
    expect(body.status).toBe('open');
    expect(body.shiftId).toBe('shift-1');
    expect(body.items).toEqual([]);
  });

  it('POST creates request with initial items', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({
        title: 'With Items',
        items: [makeItemPayload()]
      }),
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].sku).toBe('519526');
    expect(body.items[0].requestedQty).toBe(264);
  });

  it('POST rejects missing planningDate', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: {},
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST rejects invalid payload', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: { planningDate: '2026-06-23', items: [{ sku: '', requestedQty: 0 }] },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/manual-shifts/:shiftId/bonded-requests lists requests', async () => {
    const { app } = buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({ title: 'Req 1' }),
      headers: { 'content-type': 'application/json' }
    });

    await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({ title: 'Req 2' }),
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/manual-shifts/shift-1/bonded-requests'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(2);
  });

  it('GET lists requests filtered by status', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({ title: 'Open Req' }),
      headers: { 'content-type': 'application/json' }
    });
    const { id } = JSON.parse(createResp.body);

    await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/close`,
      payload: { notes: 'closed' },
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/manual-shifts/shift-1/bonded-requests?status=closed'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.length).toBe(1);
    expect(body[0].status).toBe('closed');
  });

  it('GET /api/bonded-requests/:requestId returns detail', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({
        items: [makeItemPayload()]
      }),
      headers: { 'content-type': 'application/json' }
    });

    const { id } = JSON.parse(createResp.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/bonded-requests/${id}`
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(id);
    expect(body.items).toHaveLength(1);
  });

  it('GET /api/bonded-requests/:requestId returns 404 for missing', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'GET',
      url: '/api/bonded-requests/nonexistent-id'
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /api/bonded-requests/:requestId/items adds item to open request', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload(),
      headers: { 'content-type': 'application/json' }
    });

    const { id } = JSON.parse(createResp.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/items`,
      payload: makeItemPayload(),
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.sku).toBe('519526');
    expect(body.requestedQty).toBe(264);
  });

  it('PATCH /api/bonded-requests/:requestId/items/:itemId updates item', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({ items: [makeItemPayload()] }),
      headers: { 'content-type': 'application/json' }
    });

    const { id, items } = JSON.parse(createResp.body);
    const itemId = items[0].id;

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/bonded-requests/${id}/items/${itemId}`,
      payload: { requestedQty: 150 },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.requestedQty).toBe(150);
  });

  it('POST /api/bonded-requests/:requestId/close closes request', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload({ items: [makeItemPayload()] }),
      headers: { 'content-type': 'application/json' }
    });

    const { id, items } = JSON.parse(createResp.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/close`,
      payload: {
        notes: 'Closed from workflow',
        items: [{ itemId: items[0].id, fulfilledQty: 200 }]
      },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('closed');
    expect(body.closedByName).toBe('Test User');
    expect(body.items[0].fulfilledQty).toBe(200);
  });

  it('POST /api/bonded-requests/:requestId/cancel cancels request', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload(),
      headers: { 'content-type': 'application/json' }
    });

    const { id } = JSON.parse(createResp.body);

    const response = await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/cancel`,
      payload: { notes: 'No longer needed' },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('cancelled');
    expect(body.cancelledByName).toBe('Test User');
  });

  it('cannot add item to closed request', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload(),
      headers: { 'content-type': 'application/json' }
    });
    const { id } = JSON.parse(createResp.body);

    await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/close`,
      payload: {},
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/items`,
      payload: makeItemPayload(),
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(409);
  });

  it('cannot close already closed request', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload(),
      headers: { 'content-type': 'application/json' }
    });
    const { id } = JSON.parse(createResp.body);

    await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/close`,
      payload: {},
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/close`,
      payload: {},
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(409);
  });

  it('cannot cancel already cancelled request', async () => {
    const { app } = buildTestApp();

    const createResp = await app.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload(),
      headers: { 'content-type': 'application/json' }
    });
    const { id } = JSON.parse(createResp.body);

    await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/cancel`,
      payload: {},
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/bonded-requests/${id}/cancel`,
      payload: {},
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(409);
  });

  it('tenant isolation works', async () => {
    const { app: app1 } = buildTestApp();
    const { app: app2 } = buildTestApp();

    await app1.inject({
      method: 'POST',
      url: '/api/manual-shifts/shift-1/bonded-requests',
      payload: makeCreatePayload(),
      headers: { 'content-type': 'application/json' }
    });

    const response = await app2.inject({
      method: 'GET',
      url: '/api/manual-shifts/shift-1/bonded-requests'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.length).toBe(0);
  });
});
