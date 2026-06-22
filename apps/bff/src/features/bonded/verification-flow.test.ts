import { describe, expect, it, vi, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { parseBondedWorkbook } from './bonded-excel-parser.js';
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
      return parseBondedWorkbook(input);
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

// ── Realistic workbook builder ──────────────────────────────────────────────

const HEADERS = [
  'עמודה7', 'גוש', 'פריט', 'תיאור חדש', 'כמות משוחררת',
  'גורם אירוז', 'כמות קרטונים במשטח', "יח' במשטח",
  'עמודה1', 'עמודה2', 'עמודה3', 'עמודה4', 'עמודה5', 'עמודה6',
  'משיכה7', 'משיכה8', 'משיכה9',
  'סה"כ נמשך', 'יתרה משוחררת', 'הערות', 'נותר בונדד'
];

const SKUS = [
  '100001', '100002', '100003', '100004', '100005',
  '200001', '200002', '200003',
  '300001', '300002', '300003', '300004',
  '400001', '400002', '400003', '400004', '400005', '400006', '400007', '400008'
];

function makeRow(sku: string | null, releasedQty: number, totalPulled: number, balanceOverride?: number): unknown[] {
  const balance = balanceOverride ?? (releasedQty - totalPulled);
  const colMap: Record<string, unknown> = {
    'עמודה7': 'מקור א',
    'גוש': '7488/23',
    'פריט': sku,
    'תיאור חדש': `מוצר ${sku ?? 'חסר'}`,
    'כמות משוחררת': releasedQty,
    'גורם אירוז': 20,
    'כמות קרטונים במשטח': 20,
    "יח' במשטח": 400,
    'עמודה1': 10,
    'עמודה2': 15,
    'עמודה3': 20,
    'עמודה4': 25,
    'עמודה5': 10,
    'עמודה6': null,
    'משיכה7': null,
    'משיכה8': null,
    'משיכה9': null,
    'סה"כ נמשך': totalPulled,
    'יתרה משוחררת': balance,
    'הערות': null,
    'נותר בונדד': null
  };
  return HEADERS.map(h => colMap[h]);
}

function buildWorkbookBuffer(
  rows: unknown[][],
  extraSheetName?: string
): Buffer {
  const wb = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, sheet, 'בונדד!');
  if (extraSheetName) {
    const extraSheet = XLSX.utils.aoa_to_sheet([['dummy']]);
    XLSX.utils.book_append_sheet(wb, extraSheet, extraSheetName);
  }
  const out = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.isBuffer(out) ? out : Buffer.from(out);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function buildTestApp() {
  const mockAuthContext: AuthenticatedRequestContext = {
    accessToken: 'test-token',
    user: { id: 'user-v', email: 'verify@test.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: new Date().toISOString() } as any,
    currentTenant: { tenantId: 'verify-tenant', tenantCode: 'verify', tenantName: 'Verify', role: 'operator' },
    displayName: 'Verifier',
    memberships: [{ tenantId: 'verify-tenant', tenantCode: 'verify', tenantName: 'Verify', role: 'operator' }]
  };

  const app = Fastify({ bodyLimit: 20 * 1024 * 1024 });
  app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

  const getAuthContext = vi.fn().mockResolvedValue(mockAuthContext);
  const bondedService = createFakeBondedService();
  const getBondedService = vi.fn().mockReturnValue(bondedService);
  registerBondedRoutes(app, { getAuthContext, getBondedService });

  return { app };
}

// ── Integration verification ────────────────────────────────────────────────

const TOTAL_ROWS = 468;
const MISSING_SKU_COUNT = 14;
const NEGATIVE_BALANCE_COUNT = 5;
const DUPLICATE_SKU_COUNT = 3; // 3 SKUs appear twice each

describe('PR4C.1 verification — realistic bonded workbook', () => {
  beforeAll(() => {
    vi.setConfig({ testTimeout: 30_000 });
  });
  it('1. parses a 468-row workbook matching expected real-file statistics', () => {
    const rows: unknown[][] = [HEADERS];

    // Normal rows = 468 - 14 missing - 5 negative - 3 duplicates = 446
    let skuIndex = 0;
    for (let i = 0; i < 446; i++) {
      const sku = SKUS[skuIndex % SKUS.length];
      skuIndex++;
      rows.push(makeRow(sku, 100 + (i % 5) * 50, 30 + (i % 3) * 20));
    }

    // 14 missing SKU rows
    for (let i = 0; i < MISSING_SKU_COUNT; i++) {
      rows.push(makeRow(null, 50 + i * 10, 10));
    }

    // 5 negative balance rows (balance < 0)
    for (let i = 0; i < NEGATIVE_BALANCE_COUNT; i++) {
      rows.push(makeRow('NEG-SKU-' + i, 50, 80)); // released=50, totalPulled=80 => balance=-30
    }

    // Add duplicate SKU rows: 3 SKUs appear a second time
    for (let i = 0; i < DUPLICATE_SKU_COUNT; i++) {
      rows.push(makeRow(SKUS[i], 200, 50));
    }

    const buffer = buildWorkbookBuffer(rows);
    const result = parseBondedWorkbook({ fileName: 'pivot-millennium-2026.xlsx', buffer });

    expect(result.sourceSheetName).toBe('בונדד!');
    expect(result.rowCount).toBe(TOTAL_ROWS);
    expect(result.rows).toHaveLength(TOTAL_ROWS);

    // Verify diagnostics
    const { diagnostics } = result;
    expect(diagnostics.populatedRows).toBe(TOTAL_ROWS - MISSING_SKU_COUNT);
    expect(diagnostics.missingSkuRows).toBe(MISSING_SKU_COUNT);
    expect(diagnostics.negativeBalanceRows).toBe(NEGATIVE_BALANCE_COUNT);

    // All negative balance rows have availableQty = 0
    const negativeRows = result.rows.filter(r => r.releasedBalanceQty < 0);
    expect(negativeRows).toHaveLength(NEGATIVE_BALANCE_COUNT);
    for (const row of negativeRows) {
      expect(row.availableQty).toBe(0);
    }

    // Missing SKU rows have sku = null
    const missingSkuRows = result.rows.filter(r => r.sku === null);
    expect(missingSkuRows).toHaveLength(MISSING_SKU_COUNT);

    // Duplicate SKU groups detected
    expect(diagnostics.duplicateSkuGroups).toBeGreaterThanOrEqual(DUPLICATE_SKU_COUNT);
    expect(diagnostics.warnings.some(w => w.includes('multiple bonded candidates'))).toBe(true);
  });

  it('2. detects PIVOT! sheet when present', () => {
    const rows: unknown[][] = [HEADERS, makeRow('100001', 200, 50)];
    const buffer = buildWorkbookBuffer(rows, 'PIVOT!');

    // Lightweight detection
    const quickWb = XLSX.read(buffer, { type: 'buffer', cellFormula: false, cellText: false, raw: true, sheets: [] });
    const pivotFound = quickWb.SheetNames.some(name => name.trim() === 'PIVOT!');
    expect(pivotFound).toBe(true);

    // Parser ignores PIVOT! and works normally
    const result = parseBondedWorkbook({ fileName: 'test.xlsx', buffer });
    expect(result.sourceSheetName).toBe('בונדד!');
    expect(result.rowCount).toBe(1);
  });

  it('3. full flow: upload → preview → publish → list → detail', async () => {
    const { app } = buildTestApp();

    // Build a smaller but realistic workbook for the full flow test
    const rows: unknown[][] = [HEADERS];
    for (let i = 0; i < 20; i++) {
      rows.push(makeRow(SKUS[i % SKUS.length], 100, 30));
    }
    rows.push(makeRow(null, 50, 10)); // 1 missing SKU
    rows.push(makeRow('NEG-1', 30, 60)); // 1 negative balance
    rows.push(makeRow(SKUS[0], 150, 40)); // 1 duplicate SKU

    const buffer = buildWorkbookBuffer(rows);

    // Step A: parse the workbook as the backend upload route would
    const draft = parseBondedWorkbook({ fileName: 'pivot-millennium-2026.xlsx', buffer });
    expect(draft.sourceSheetName).toBe('בונדד!');
    expect(draft.rowCount).toBeGreaterThan(0);

    // Step B: POST /api/bonded/snapshots (simulates frontend publish)
    // Use a planningDate different from today to verify business date independence
    const userPlanningDate = '2026-06-15';
    const publishResponse = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: {
        planningDate: userPlanningDate,
        draft,
        fileName: 'pivot-millennium-2026.xlsx',
        shiftId: null
      },
      headers: { 'content-type': 'application/json' }
    });

    expect(publishResponse.statusCode).toBe(201);
    const published = JSON.parse(publishResponse.body);
    expect(published.id).toBeTruthy();
    expect(published.planningDate).toBe(userPlanningDate);
    expect(published.status).toBe('completed');
    expect(published.rowCount).toBe(draft.rowCount);
    expect(published.importedAt).toBeTruthy();

    // Verify importedAt is a full ISO timestamp with time component
    const importedAt = new Date(published.importedAt);
    expect(importedAt instanceof Date && !isNaN(importedAt.getTime())).toBe(true);
    // importedAt has time component (includes T)
    expect(published.importedAt.includes('T')).toBe(true);
    // planningDate is user-selected, independent of upload timestamp
    expect(published.planningDate).toBe(userPlanningDate);
    // importedAt date is today (upload time), planningDate is user-selected
    const todayStr = new Date().toISOString().slice(0, 10);
    expect(published.importedAt.startsWith(todayStr)).toBe(true);
    expect(published.planningDate).not.toBe(todayStr);
    console.log(`importedAt=${published.importedAt}, planningDate=${published.planningDate} — confirmed: importedAt is upload time, not business date`);

    // Step C: GET /api/bonded/snapshots (verifies snapshot appears in list)
    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/bonded/snapshots'
    });

    expect(listResponse.statusCode).toBe(200);
    const list = JSON.parse(listResponse.body);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(published.id);
    expect(list[0].planningDate).toBe(userPlanningDate);
    expect(list[0].rowCount).toBe(draft.rowCount);
    expect(list[0].status).toBe('completed');

    // Step D: GET /api/bonded/snapshots/:snapshotId (verifies detail)
    const detailResponse = await app.inject({
      method: 'GET',
      url: `/api/bonded/snapshots/${published.id}`
    });

    expect(detailResponse.statusCode).toBe(200);
    const detail = JSON.parse(detailResponse.body);
    expect(detail.id).toBe(published.id);
    expect(detail.planningDate).toBe(userPlanningDate);
    expect(detail.rows).toHaveLength(draft.rowCount);
    expect(detail.sourceSheetName).toBe('בונדד!');

    // Verify negative balance rows have availableQty = 0
    const negRows = detail.rows.filter((r: { releasedBalanceQty: number }) => r.releasedBalanceQty < 0);
    for (const row of negRows) {
      expect(row.availableQty).toBe(0);
    }

    // Verify missing SKU rows have sku = null
    const missingRows = detail.rows.filter((r: { sku: null }) => r.sku === null);
    expect(missingRows.length).toBeGreaterThan(0);
    for (const row of missingRows) {
      expect(row.sku).toBeNull();
    }

    // Verify duplicate SKU rows preserved as separate candidates
    const skuGroups = new Map<string, number>();
    for (const row of detail.rows) {
      if (row.sku) {
        skuGroups.set(row.sku, (skuGroups.get(row.sku) ?? 0) + 1);
      }
    }
    const duplicates = Array.from(skuGroups.entries()).filter(([_, count]) => count > 1);
    expect(duplicates.length).toBeGreaterThan(0);
    console.log(`Duplicate SKU groups: ${duplicates.map(([sku, count]) => `${sku}(${count})`).join(', ')}`);
  });

  it('4. planningDate is user-selected and independent of file data', async () => {
    const { app } = buildTestApp();
    const rows: unknown[][] = [HEADERS, makeRow('100001', 200, 50)];
    const buffer = buildWorkbookBuffer(rows);
    const draft = parseBondedWorkbook({ fileName: 'test.xlsx', buffer });

    // Publish with a specific planningDate
    const userSelectedDate = '2026-07-15';
    const response = await app.inject({
      method: 'POST',
      url: '/api/bonded/snapshots',
      payload: { planningDate: userSelectedDate, draft },
      headers: { 'content-type': 'application/json' }
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.planningDate).toBe(userSelectedDate);

    // importedAt should be NOW, not the planningDate
    const importedAt = new Date(body.importedAt);
    const planningDate = new Date(body.planningDate + 'T00:00:00Z');
    expect(importedAt.getTime()).not.toBe(planningDate.getTime());
    expect(body.planningDate).toBe('2026-07-15');

    // Verify in list
    const listResponse = await app.inject({ method: 'GET', url: '/api/bonded/snapshots' });
    const list = JSON.parse(listResponse.body);
    expect(list[0].planningDate).toBe('2026-07-15');
  });

  it('5. negative balance rows compute availableQty = 0', () => {
    const rows: unknown[][] = [HEADERS];
    // Create a row where releasedQty < totalPulledQty
    rows.push(makeRow('NEG-001', 50, 100)); // balance = -50

    const buffer = buildWorkbookBuffer(rows);
    const result = parseBondedWorkbook({ fileName: 'test.xlsx', buffer });

    expect(result.rows).toHaveLength(1);
    const row = result.rows[0];
    expect(row.releasedBalanceQty).toBe(-50);
    expect(row.availableQty).toBe(0);
    expect(row.diagnostics).toContain('negative_released_balance');
  });

  it('6. missing SKU rows stored with sku = null', () => {
    const rows: unknown[][] = [HEADERS];
    rows.push(makeRow(null, 100, 30));

    const buffer = buildWorkbookBuffer(rows);
    const result = parseBondedWorkbook({ fileName: 'test.xlsx', buffer });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sku).toBeNull();
    expect(result.rows[0].diagnostics).toContain('missing_sku');
    expect(result.diagnostics.missingSkuRows).toBe(1);
  });

  it('7. duplicate SKU rows are preserved as separate bonded candidates', () => {
    const rows: unknown[][] = [HEADERS];
    rows.push(makeRow('DUP-001', 100, 20));
    rows.push(makeRow('DUP-001', 150, 40)); // same SKU, different quantities

    const buffer = buildWorkbookBuffer(rows);
    const result = parseBondedWorkbook({ fileName: 'test.xlsx', buffer });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].sku).toBe('DUP-001');
    expect(result.rows[1].sku).toBe('DUP-001');
    expect(result.diagnostics.duplicateSkuGroups).toBe(1);
    expect(result.diagnostics.warnings.some(w => w.includes('multiple bonded candidates'))).toBe(true);
  });
});
