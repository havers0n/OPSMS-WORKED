import { describe, expect, it, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { registerBondedRoutes } from './routes.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { BondedService } from './bonded-service.js';

// ── Fake BondedService (in-memory, for tests only) ──────────────────────────

function createFakeBondedService(): BondedService {
  type Record = {
    id: string;
    planningDate: string;
    fileName: string | null;
    importedAt: string;
    rowCount: number;
    status: string;
    diagnostics: any;
    sourceSheetName: string;
    shiftId: string | null;
    rows: any[];
  };

  const store = new Map<string, Record>();

  return {
    parseWorkbook: (input) => {
      throw new Error('not used in route tests');
    },
    async createSnapshot(tenantId, _userId, input) {
      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      const record: Record = {
        id,
        planningDate: input.planningDate,
        fileName: input.fileName,
        importedAt: now,
        rowCount: input.draft.rowCount ?? input.draft.rows.length,
        status: 'completed',
        diagnostics: input.draft.diagnostics,
        sourceSheetName: input.draft.sourceSheetName,
        shiftId: input.shiftId,
        rows: input.draft.rows
      };
      store.set(`${tenantId}:${id}`, record);
      return {
        id,
        planningDate: input.planningDate,
        status: 'completed',
        rowCount: record.rowCount,
        importedAt: now
      };
    },
    async listSnapshots(tenantId) {
      const results: any[] = [];
      for (const [key, record] of store) {
        if (key.startsWith(`${tenantId}:`)) {
          results.push({
            id: record.id,
            planningDate: record.planningDate,
            fileName: record.fileName,
            importedAt: record.importedAt,
            rowCount: record.rowCount,
            status: record.status,
            diagnostics: {
              totalRows: record.diagnostics.totalRows,
              missingSkuRows: record.diagnostics.missingSkuRows,
              negativeBalanceRows: record.diagnostics.negativeBalanceRows,
              duplicateSkuGroups: record.diagnostics.duplicateSkuGroups,
              warnings: record.diagnostics.warnings
            }
          });
        }
      }
      results.sort((a, b) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime());
      return results;
    },
    async getSnapshot(tenantId, snapshotId) {
      const record = store.get(`${tenantId}:${snapshotId}`);
      if (!record) return null;
      return {
        id: record.id,
        planningDate: record.planningDate,
        fileName: record.fileName,
        importedAt: record.importedAt,
        rowCount: record.rowCount,
        status: record.status,
        diagnostics: record.diagnostics,
        sourceSheetName: record.sourceSheetName,
        rows: record.rows
      };
    },
    async getLatestCompletedSnapshot(tenantId, planningDate) {
      void planningDate;
      const list = await this.listSnapshots(tenantId);
      if (list.length === 0) return null;
      const latest = list[0];
      return this.getSnapshot(tenantId, latest.id);
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

  const app = Fastify({ bodyLimit: 20 * 1024 * 1024 });
  app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

  const getAuthContext = vi.fn().mockResolvedValue(mockAuthContext);
  const bondedService = createFakeBondedService();
  const getBondedService = vi.fn().mockReturnValue(bondedService);

  registerBondedRoutes(app, { getAuthContext, getBondedService });

  return { app };
}

function makeDraft(overrides?: Record<string, unknown>) {
  return {
    sourceSheetName: 'בונדד!',
    rowCount: 1,
    rows: [{
      rowNumber: 1,
      sourceLabel: null,
      block: 'A1',
      sku: 'SKU001',
      description: 'Test',
      releasedQty: 100,
      packFactor: null,
      cartonsPerPallet: null,
      unitsPerPallet: null,
      pullColumns: [],
      totalPulledQty: 20,
      releasedBalanceQty: 80,
      availableQty: 80,
      notes: null,
      remainingBondedRaw: null,
      diagnostics: []
    }],
    diagnostics: { totalRows: 1, populatedRows: 1, missingSkuRows: 0, negativeBalanceRows: 0, duplicateSkuGroups: 0, formulaDiscrepancyRows: 0, warnings: [] },
    ...overrides
  };
}

describe('bonded routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/bonded/snapshots with valid input creates snapshot', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft: makeDraft(), fileName: 'test.xlsx' },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeTruthy();
    expect(body.planningDate).toBe('2026-06-21');
    expect(body.status).toBe('completed');
    expect(body.rowCount).toBe(1);
  });

  it('POST /api/bonded/snapshots rejects missing planningDate', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { draft: makeDraft() },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/bonded/snapshots returns list', async () => {
    const { app } = buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft: makeDraft() },
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bonded/snapshots'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].planningDate).toBe('2026-06-21');
  });

  it('GET /api/bonded/snapshots/:snapshotId returns detail', async () => {
    const { app } = buildTestApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft: makeDraft() },
      headers: { 'content-type': 'application/json' }
    });

    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/bonded/snapshots/${id}`
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(id);
    expect(body.rows).toHaveLength(1);
    expect(body.sourceSheetName).toBe('בונדד!');
  });

  it('GET /api/bonded/snapshots/:snapshotId returns 404 for missing', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/bonded/snapshots/nonexistent-id'
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /api/bonded/upload rejects without file', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/bonded/upload'
    });

    expect(response.statusCode).toBe(400);
  });

  it('POST /api/bonded/snapshots persists snapshot to service/repo', async () => {
    const { app } = buildTestApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft: makeDraft() },
      headers: { 'content-type': 'application/json' }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/bonded/snapshots/${created.id}`
    });

    expect(getResponse.statusCode).toBe(200);
    const detail = JSON.parse(getResponse.body);
    expect(detail.id).toBe(created.id);
    expect(detail.rows).toHaveLength(1);
  });

  it('GET /api/bonded/snapshots reads persisted snapshots', async () => {
    const { app } = buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft: makeDraft() },
      headers: { 'content-type': 'application/json' }
    });

    await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-22', draft: makeDraft() },
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/bonded/snapshots'
    });

    expect(response.statusCode).toBe(200);
    const list = JSON.parse(response.body);
    expect(list.length).toBe(2);
  });

  it('GET /api/bonded/snapshots/:id reads persisted rows', async () => {
    const { app } = buildTestApp();

    const draft = makeDraft();
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft },
      headers: { 'content-type': 'application/json' }
    });

    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/bonded/snapshots/${id}`
    });

    expect(response.statusCode).toBe(200);
    const detail = JSON.parse(response.body);
    expect(detail.rows).toHaveLength(1);
    expect(detail.rows[0].sku).toBe('SKU001');
  });

  it('missing SKU rows are persisted', async () => {
    const { app } = buildTestApp();

    const draft = makeDraft({
      rows: [{
        rowNumber: 1,
        sourceLabel: null,
        block: 'A1',
        sku: null,
        description: 'Missing SKU',
        releasedQty: 100,
        packFactor: null,
        cartonsPerPallet: null,
        unitsPerPallet: null,
        pullColumns: [],
        totalPulledQty: 20,
        releasedBalanceQty: 80,
        availableQty: 80,
        notes: null,
        remainingBondedRaw: null,
        diagnostics: ['missing_sku']
      }]
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft },
      headers: { 'content-type': 'application/json' }
    });

    expect(createResponse.statusCode).toBe(201);
    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/bonded/snapshots/${id}`
    });

    const detail = JSON.parse(response.body);
    expect(detail.rows[0].sku).toBeNull();
  });

  it('negative balance rows are persisted with availableQty = 0', async () => {
    const { app } = buildTestApp();

    const draft = makeDraft({
      rows: [{
        rowNumber: 1,
        sourceLabel: null,
        block: 'A1',
        sku: 'NEG001',
        description: 'Negative',
        releasedQty: 50,
        packFactor: null,
        cartonsPerPallet: null,
        unitsPerPallet: null,
        pullColumns: [],
        totalPulledQty: 80,
        releasedBalanceQty: -30,
        availableQty: 0,
        notes: null,
        remainingBondedRaw: null,
        diagnostics: ['negative_released_balance']
      }]
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft },
      headers: { 'content-type': 'application/json' }
    });

    expect(createResponse.statusCode).toBe(201);
    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/bonded/snapshots/${id}`
    });

    const detail = JSON.parse(response.body);
    expect(detail.rows[0].availableQty).toBe(0);
    expect(detail.rows[0].releasedBalanceQty).toBe(-30);
  });

  it('duplicate SKU rows are preserved', async () => {
    const { app } = buildTestApp();

    const draft = makeDraft({
      rowCount: 2,
      rows: [
        {
          rowNumber: 1,
          sourceLabel: null,
          block: 'A1',
          sku: 'DUP001',
          description: 'First',
          releasedQty: 100,
          packFactor: null,
          cartonsPerPallet: null,
          unitsPerPallet: null,
          pullColumns: [],
          totalPulledQty: 20,
          releasedBalanceQty: 80,
          availableQty: 80,
          notes: null,
          remainingBondedRaw: null,
          diagnostics: []
        },
        {
          rowNumber: 2,
          sourceLabel: null,
          block: 'A1',
          sku: 'DUP001',
          description: 'Second',
          releasedQty: 150,
          packFactor: null,
          cartonsPerPallet: null,
          unitsPerPallet: null,
          pullColumns: [],
          totalPulledQty: 40,
          releasedBalanceQty: 110,
          availableQty: 110,
          notes: null,
          remainingBondedRaw: null,
          diagnostics: []
        }
      ]
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft },
      headers: { 'content-type': 'application/json' }
    });

    expect(createResponse.statusCode).toBe(201);
    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/bonded/snapshots/${id}`
    });

    const detail = JSON.parse(response.body);
    expect(detail.rows).toHaveLength(2);
    expect(detail.rows[0].sku).toBe('DUP001');
    expect(detail.rows[1].sku).toBe('DUP001');
  });

  it('tenant isolation works', async () => {
    const app1 = buildTestApp().app;
    const { app: app2 } = buildTestApp();

    // Create snapshot in tenant 1
    await app1.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: '2026-06-21', draft: makeDraft() },
      headers: { 'content-type': 'application/json' }
    });

    // Tenant 2 should see 0 snapshots
    const response = await app2.inject({
      method: 'GET',
      url: '/api/bonded/snapshots'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.length).toBe(0);
  });
});
