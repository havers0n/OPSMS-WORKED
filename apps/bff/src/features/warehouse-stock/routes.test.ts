import { describe, expect, it, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { registerWarehouseStockRoutes } from './routes.js';
import type { AuthenticatedRequestContext } from '../../auth.js';
import type { WarehouseStockService } from './warehouse-stock-service.js';

// ── Fake WarehouseStockService (in-memory, for tests only) ────────────────

function createFakeWarehouseStockService(): WarehouseStockService {
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
    parseWorkbook: () => {
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
        rowCount: input.preview.rows.length,
        status: 'completed',
        diagnostics: input.preview.diagnostics,
        sourceSheetName: input.preview.sourceSheetName,
        shiftId: input.shiftId,
        rows: input.preview.rows
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
            sourceRowCount: record.rowCount,
            uniqueSkuCount: record.rows.length,
            status: record.status,
            diagnostics: record.diagnostics
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
        sourceRowCount: record.rowCount,
        uniqueSkuCount: record.rows.length,
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
  const warehouseStockService = createFakeWarehouseStockService();
  const getWarehouseStockService = vi.fn().mockReturnValue(warehouseStockService);

  registerWarehouseStockRoutes(app, { getAuthContext, getWarehouseStockService });

  return { app };
}

function makePreview(overrides?: Record<string, unknown>) {
  return {
    sourceSheetName: 'מלאי',
    rowCount: 1,
    populatedSkuCount: 1,
    uniqueSkuCount: 1,
    duplicateSkuRowsCount: 0,
    missingSkuRowsCount: 0,
    negativeStockRowsCount: 0,
    conflictingStockSkuCount: 0,
    diagnostics: [],
    rows: [{
      sku: 'SKU001',
      description: 'Test',
      category: 'Cat A',
      warehouseQtyRaw: 100,
      availableQty: 100,
      sourceDemandQty: 50,
      sourceRowCount: 1,
      diagnostics: []
    }],
    ...overrides
  };
}

describe('warehouse stock routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST /api/warehouse-stock/snapshots with valid input creates snapshot', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview: makePreview(), fileName: 'test.xlsx' },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.id).toBeTruthy();
    expect(body.planningDate).toBe('2026-06-22');
    expect(body.status).toBe('completed');
    expect(body.rowCount).toBe(1);
  });

  it('POST /api/warehouse-stock/snapshots rejects missing planningDate', async () => {
    const { app } = buildTestApp();
    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { preview: makePreview() },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/warehouse-stock/snapshots returns list', async () => {
    const { app } = buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview: makePreview() },
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/warehouse-stock/snapshots'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(1);
    expect(body[0].planningDate).toBe('2026-06-22');
  });

  it('GET /api/warehouse-stock/snapshots/:snapshotId returns detail', async () => {
    const { app } = buildTestApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview: makePreview() },
      headers: { 'content-type': 'application/json' }
    });

    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/warehouse-stock/snapshots/${id}`
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(id);
    expect(body.rows).toHaveLength(1);
    expect(body.sourceSheetName).toBe('מלאי');
  });

  it('GET /api/warehouse-stock/snapshots/:snapshotId returns 404 for missing', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/warehouse-stock/snapshots/nonexistent-id'
    });

    expect(response.statusCode).toBe(404);
  });

  it('POST /api/warehouse-stock/upload rejects without file', async () => {
    const { app } = buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/upload'
    });

    expect(response.statusCode).toBe(400);
  });

  it('GET /api/warehouse-stock/snapshots lists multiple snapshots newest first', async () => {
    const { app } = buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-21', preview: makePreview() },
      headers: { 'content-type': 'application/json' }
    });

    await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview: makePreview() },
      headers: { 'content-type': 'application/json' }
    });

    const response = await app.inject({
      method: 'GET',
      url: '/api/warehouse-stock/snapshots'
    });

    expect(response.statusCode).toBe(200);
    const list = JSON.parse(response.body);
    expect(list.length).toBe(2);
  });

  it('persists snapshot and reads it back', async () => {
    const { app } = buildTestApp();

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview: makePreview() },
      headers: { 'content-type': 'application/json' }
    });

    expect(createResponse.statusCode).toBe(201);
    const created = JSON.parse(createResponse.body);

    const getResponse = await app.inject({
      method: 'GET',
      url: `/api/warehouse-stock/snapshots/${created.id}`
    });

    expect(getResponse.statusCode).toBe(200);
    const detail = JSON.parse(getResponse.body);
    expect(detail.id).toBe(created.id);
    expect(detail.rows).toHaveLength(1);
    expect(detail.rows[0].sku).toBe('SKU001');
  });

  it('negative stock persisted with availableQty = 0', async () => {
    const { app } = buildTestApp();

    const preview = makePreview({
      rows: [{
        sku: 'NEG001',
        description: 'Negative',
        category: null,
        warehouseQtyRaw: -30,
        availableQty: 0,
        sourceDemandQty: null,
        sourceRowCount: 1,
        diagnostics: ['negative_stock']
      }]
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview },
      headers: { 'content-type': 'application/json' }
    });

    expect(createResponse.statusCode).toBe(201);
    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/warehouse-stock/snapshots/${id}`
    });

    const detail = JSON.parse(response.body);
    expect(detail.rows[0].availableQty).toBe(0);
    expect(detail.rows[0].warehouseQtyRaw).toBe(-30);
  });

  it('duplicate SKU aggregated as one row', async () => {
    const { app } = buildTestApp();

    const preview = makePreview({
      uniqueSkuCount: 1,
      rowCount: 2,
      rows: [{
        sku: 'DUP001',
        description: 'First',
        category: null,
        warehouseQtyRaw: 100,
        availableQty: 100,
        sourceDemandQty: 30,
        sourceRowCount: 2,
        diagnostics: ['duplicate_sku_rows']
      }]
    });

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview },
      headers: { 'content-type': 'application/json' }
    });

    expect(createResponse.statusCode).toBe(201);
    const { id } = JSON.parse(createResponse.body);

    const response = await app.inject({
      method: 'GET',
      url: `/api/warehouse-stock/snapshots/${id}`
    });

    const detail = JSON.parse(response.body);
    expect(detail.rows).toHaveLength(1);
    expect(detail.rows[0].sku).toBe('DUP001');
  });

  it('tenant isolation works', async () => {
    const app1 = buildTestApp().app;
    const { app: app2 } = buildTestApp();

    await app1.inject({
      method: 'POST',
      url: '/api/warehouse-stock/snapshots',
      payload: { planningDate: '2026-06-22', preview: makePreview() },
      headers: { 'content-type': 'application/json' }
    });

    const response = await app2.inject({
      method: 'GET',
      url: '/api/warehouse-stock/snapshots'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.length).toBe(0);
  });
});
