import { describe, expect, it } from 'vitest';
import { createManualShiftsRepo } from './repo.js';

function createFakeSupabase() {
  const tables: Record<string, Array<Record<string, unknown>>> = {
    demand_import_batches: [],
    raw_demand_rows: [],
    demand_planning_drafts: [],
    demand_planning_buckets: [],
    demand_planning_allocations: []
  };

  function queryRows(table: string, filters: Array<[string, unknown]>, inFilters: Array<[string, unknown[]]> = []) {
    let rows = tables[table] ?? [];
    for (const [col, val] of filters) {
      rows = rows.filter((r) => r[col] === val);
    }
    for (const [col, vals] of inFilters) {
      rows = rows.filter((r) => vals.includes(r[col]));
    }
    return rows;
  }

  const from = (table: string) => {
    const state: {
      table: string;
      filters: Array<[string, unknown]>;
      inFilters: Array<[string, unknown[]]>;
      limitCount: number | undefined;
    } = {
      table,
      filters: [],
      inFilters: [],
      limitCount: undefined
    };

    const builder = {
      insert(payload: Record<string, unknown> | Array<Record<string, unknown>>) {
        const rows = Array.isArray(payload) ? payload : [payload];
        tables[table] ??= [];
        const inserted: Array<Record<string, unknown>> = [];
        for (const row of rows) {
          const defaults: Record<string, unknown> = {
            id: `id-${table}-${tables[table].length + 1}`,
            uploaded_at: '2026-06-24T08:00:00.000Z',
            created_at: '2026-06-24T08:00:00.000Z',
            updated_at: '2026-06-24T08:00:00.000Z',
          };
          // Apply DB-level defaults per table
          if (table === 'demand_planning_drafts' && row.status === undefined) {
            defaults.status = 'draft';
          }
          const stored = { ...defaults, ...row };
          tables[table].push(stored);
          inserted.push(stored);
        }
        return {
          select() {
            return {
              single: async () => ({ data: tables[table][tables[table].length - 1], error: null }),
              then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
                return Promise.resolve({ data: inserted, error: null }).then(resolve);
              }
            };
          },
          then(resolve: (value: { error: null }) => unknown) {
            return Promise.resolve({ error: null }).then(resolve);
          }
        };
      },
      select(_cols?: string) {
        return builder;
      },
      eq(column: string, value: unknown) {
        state.filters.push([column, value]);
        return builder;
      },
      in(column: string, values: unknown[]) {
        state.inFilters.push([column, values]);
        return builder;
      },
      order(_col: string, _opts?: { ascending?: boolean }) {
        return builder;
      },
      limit(count: number) {
        state.limitCount = count;
        return builder;
      },
      delete() {
        const delFilters = [...state.filters];
        const delInFilters = [...state.inFilters];
        return {
          eq(col: string, val: unknown) {
            delFilters.push([col, val]);
            return this;
          },
          in(col: string, vals: unknown[]) {
            delInFilters.push([col, vals]);
            return this;
          },
          then(resolve: (value: { data: unknown; error: null }) => unknown) {
            const toDelete = queryRows(table, delFilters, delInFilters);
            for (const row of toDelete) {
              const idx = tables[table].indexOf(row);
              if (idx !== -1) tables[table].splice(idx, 1);
            }
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
        };
      },
      update(payload: Record<string, unknown>) {
        const rows = queryRows(table, state.filters, state.inFilters);
        for (const row of rows) {
          Object.assign(row, payload);
        }
        return {
          select() {
            return {
              single: async () => ({ data: rows[0] ?? null, error: null })
            };
          },
          then(resolve: (value: { data: unknown; error: null }) => unknown) {
            return Promise.resolve({ data: null, error: null }).then(resolve);
          }
        };
      },
      async single() {
        const rows = queryRows(table, state.filters, state.inFilters);
        const row = rows[0] ?? null;
        return { data: row, error: row ? null : { code: 'PGRST116', message: 'not found', details: '' } };
      },
      then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
        let rows = queryRows(table, state.filters, state.inFilters);
        if (state.limitCount !== undefined) {
          rows = rows.slice(0, state.limitCount);
        }
        return Promise.resolve({ data: rows, error: null }).then(resolve);
      }
    };

    return builder;
  };

  return {
    supabase: {
      from,
      rpc: async () => ({ data: null, error: null })
    },
    tables
  };
}

describe('demand import repo methods', () => {
  it('creates batches and raw rows without touching manual_shift tables', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const batch = await repo.createDemandImportBatch({
      tenantId: '11111111-1111-4111-8111-111111111111',
      sourceFile: 'datasheet.xlsx',
      sourceSheet: 'DataSheet',
      uploadedBy: '22222222-2222-4222-8222-222222222222',
      status: 'ready',
      rowsCount: 1,
      rawRowsCount: 1,
      warningRowsCount: 0,
      errorRowsCount: 0,
      specialFlowRowsCount: 0,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 1
    });

    await repo.insertRawDemandRows({
      tenantId: batch.tenantId,
      batchId: batch.id,
      sourceSheet: 'DataSheet',
      rows: [
        {
          sourceSheet: 'DataSheet',
          sourceRowNumber: 2,
          agent: 'agent',
          orderDate: '2026-06-24',
          customerName: 'לקוח א',
          orderNumber: 'SO-1',
          sku: 'SKU-1',
          description: 'מוצר',
          category: 'cat',
          quantity: 3,
          cost: 10,
          notes: null,
          distributionArea: 'דרום',
          rawRouteLine: null,
          plannedDeliveryDate: '2026-06-25',
          plannedRouteLine: null,
          plannedWorkBucket: null,
          planningStatus: 'unplanned',
          routeFlow: 'unassigned',
          productHandlingFlow: 'regular',
          noteDateHints: [],
          issues: []
        }
      ]
    });

    expect(Object.keys(tables).filter((k) => tables[k].length > 0).sort()).toEqual(['demand_import_batches', 'raw_demand_rows']);
    expect(tables.raw_demand_rows).toHaveLength(1);
    expect(tables.raw_demand_rows[0]).toMatchObject({
      batch_id: batch.id,
      planned_delivery_date: '2026-06-25',
      planned_route_line: null,
      planned_work_bucket: null
    });
  });
});

describe('demand planning draft repo methods', () => {
  const tenantA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const batchId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('createDemandPlanningDraft inserts draft with tenantId/batchId/status', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createDemandPlanningDraft({
      tenantId: tenantA,
      batchId,
      createdBy: null
    });

    expect(draft.tenantId).toBe(tenantA);
    expect(draft.batchId).toBe(batchId);
    expect(draft.status).toBe('draft');
    expect(draft.id).toBeTruthy();
    expect(tables.demand_planning_drafts).toHaveLength(1);
    expect(tables.demand_planning_drafts[0].tenant_id).toBe(tenantA);
    expect(tables.demand_planning_drafts[0].batch_id).toBe(batchId);
  });

  it('getDemandPlanningDraft returns null for non-existent draft', async () => {
    const { supabase } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const result = await repo.getDemandPlanningDraft({
      tenantId: tenantA,
      draftId: '00000000-0000-0000-0000-000000000000'
    });

    expect(result).toBeNull();
  });

  it('getDemandPlanningDraft returns draft for matching tenant', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const created = await repo.createDemandPlanningDraft({ tenantId: tenantA, batchId, createdBy: null });
    const retrieved = await repo.getDemandPlanningDraft({ tenantId: tenantA, draftId: created.id });

    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(created.id);
    expect(retrieved!.tenantId).toBe(tenantA);
  });

  it('getDemandPlanningDraft enforces tenant isolation', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const created = await repo.createDemandPlanningDraft({ tenantId: tenantA, batchId, createdBy: null });
    const result = await repo.getDemandPlanningDraft({ tenantId: tenantB, draftId: created.id });

    expect(result).toBeNull();
    // Ensure the draft was actually created under tenantA
    const ownResult = await repo.getDemandPlanningDraft({ tenantId: tenantA, draftId: created.id });
    expect(ownResult).not.toBeNull();
  });

  it('insert/list demandPlanningBuckets', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createDemandPlanningDraft({ tenantId: tenantA, batchId, createdBy: null });

    const buckets = await repo.insertDemandPlanningBuckets({
      tenantId: tenantA,
      draftId: draft.id,
      batchId,
      buckets: [
        { distributionArea: 'דרום', planningLineName: 'default', bucketName: 'unassigned', bucketKind: 'technical_unassigned', sortOrder: 0 },
        { distributionArea: 'צפון', planningLineName: 'default', bucketName: 'unassigned', bucketKind: 'technical_unassigned', sortOrder: 1 }
      ]
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0].distributionArea).toBe('דרום');
    expect(buckets[0].planningLineName).toBe('default');
    expect(buckets[1].distributionArea).toBe('צפון');

    const listed = await repo.listDemandPlanningBuckets({ tenantId: tenantA, draftId: draft.id });
    expect(listed).toHaveLength(2);
  });

  it('insert/list demandPlanningAllocations', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createDemandPlanningDraft({ tenantId: tenantA, batchId, createdBy: null });

    const buckets = await repo.insertDemandPlanningBuckets({
      tenantId: tenantA,
      draftId: draft.id,
      batchId,
      buckets: [{ distributionArea: 'דרום', planningLineName: 'default', bucketName: 'כללי', bucketKind: 'work_group', sortOrder: 0 }]
    });

    const allocations = await repo.insertDemandPlanningAllocations({
      tenantId: tenantA,
      draftId: draft.id,
      batchId,
      allocations: [
        { rawDemandRowId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', bucketId: buckets[0].id, allocatedQuantity: 5 },
        { rawDemandRowId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', bucketId: buckets[0].id, allocatedQuantity: 10 }
      ]
    });

    expect(allocations).toHaveLength(2);
    expect(allocations[0].rawDemandRowId).toBe('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    expect(allocations[0].allocatedQuantity).toBe(5);

    const listed = await repo.listDemandPlanningAllocations({ tenantId: tenantA, draftId: draft.id });
    expect(listed).toHaveLength(2);
  });

  it('deleteDemandPlanningBucketsByDraft clears buckets', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createDemandPlanningDraft({ tenantId: tenantA, batchId, createdBy: null });
    await repo.insertDemandPlanningBuckets({
      tenantId: tenantA,
      draftId: draft.id,
      batchId,
      buckets: [{ distributionArea: 'דרום', planningLineName: 'default', bucketName: 'unassigned', bucketKind: 'technical_unassigned', sortOrder: 0 }]
    });

    await repo.deleteDemandPlanningBucketsByDraft({ tenantId: tenantA, draftId: draft.id });

    const listed = await repo.listDemandPlanningBuckets({ tenantId: tenantA, draftId: draft.id });
    expect(listed).toHaveLength(0);
  });

  it('deleteDemandPlanningAllocationsByDraft clears allocations', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createDemandPlanningDraft({ tenantId: tenantA, batchId, createdBy: null });
    const buckets = await repo.insertDemandPlanningBuckets({
      tenantId: tenantA,
      draftId: draft.id,
      batchId,
      buckets: [{ distributionArea: 'דרום', planningLineName: 'default', bucketName: 'כללי', bucketKind: 'work_group', sortOrder: 0 }]
    });

    await repo.insertDemandPlanningAllocations({
      tenantId: tenantA,
      draftId: draft.id,
      batchId,
      allocations: [{ rawDemandRowId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', bucketId: buckets[0].id, allocatedQuantity: 5 }]
    });

    await repo.deleteDemandPlanningAllocationsByDraft({ tenantId: tenantA, draftId: draft.id });

    const listed = await repo.listDemandPlanningAllocations({ tenantId: tenantA, draftId: draft.id });
    expect(listed).toHaveLength(0);
  });

  it('listRawDemandRowsByIds returns only tenant-scoped rows', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    // Insert raw rows for tenantA
    const batchA = await repo.createDemandImportBatch({
      tenantId: tenantA,
      sourceFile: 'a.xlsx',
      sourceSheet: 'DataSheet',
      uploadedBy: null,
      status: 'ready',
      rowsCount: 2,
      rawRowsCount: 2,
      warningRowsCount: 0,
      errorRowsCount: 0,
      specialFlowRowsCount: 0,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 2
    });

    // Insert raw rows for tenantB
    const batchB = await repo.createDemandImportBatch({
      tenantId: tenantB,
      sourceFile: 'b.xlsx',
      sourceSheet: 'DataSheet',
      uploadedBy: null,
      status: 'ready',
      rowsCount: 1,
      rawRowsCount: 1,
      warningRowsCount: 0,
      errorRowsCount: 0,
      specialFlowRowsCount: 0,
      distributionAreasCount: 1,
      distinctOrdersCount: 1,
      distinctSkuCount: 1
    });

    await repo.insertRawDemandRows({
      tenantId: tenantA,
      batchId: batchA.id,
      sourceSheet: 'DataSheet',
      rows: [
        { sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C1', orderNumber: 'O1', sku: 'SKU-A', description: null, category: null, quantity: 1, cost: null, notes: null, distributionArea: 'דרום', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [] }
      ]
    });

    await repo.insertRawDemandRows({
      tenantId: tenantB,
      batchId: batchB.id,
      sourceSheet: 'DataSheet',
      rows: [
        { sourceSheet: 'DataSheet', sourceRowNumber: 2, agent: null, orderDate: null, customerName: 'C2', orderNumber: 'O2', sku: 'SKU-B', description: null, category: null, quantity: 2, cost: null, notes: null, distributionArea: 'צפון', rawRouteLine: null, plannedDeliveryDate: null, plannedRouteLine: null, plannedWorkBucket: null, planningStatus: 'unplanned', routeFlow: 'unassigned', productHandlingFlow: 'regular', noteDateHints: [], issues: [] }
      ]
    });

    // Get rows by IDs from tenantA should only return tenantA rows
    const rowA = tables.raw_demand_rows.find((r) => r.tenant_id === tenantA)!;
    const rowB = tables.raw_demand_rows.find((r) => r.tenant_id === tenantB)!;

    const result = await repo.listRawDemandRowsByIds({
      tenantId: tenantA,
      rowIds: [rowA.id as string, rowB.id as string]
    });

    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('SKU-A');
  });

  const rollingDraftTargetShiftId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const rollingDraftTargetDate = '2026-07-01';

  it('createRollingDemandPlanningDraft inserts with source_kind rolling, null batch_id, target_date and target_shift_id', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createRollingDemandPlanningDraft({
      tenantId: tenantA,
      createdBy: null,
      targetDate: rollingDraftTargetDate,
      targetShiftId: rollingDraftTargetShiftId
    });

    expect(draft.tenantId).toBe(tenantA);
    expect(draft.batchId).toBeNull();
    expect(draft.sourceKind).toBe('rolling');
    expect(draft.status).toBe('draft');
    expect(draft.id).toBeTruthy();
    expect(draft.targetDate).toBe(rollingDraftTargetDate);
    expect(draft.targetShiftId).toBe(rollingDraftTargetShiftId);
    expect(tables.demand_planning_drafts).toHaveLength(1);
    expect(tables.demand_planning_drafts[0].source_kind).toBe('rolling');
    expect(tables.demand_planning_drafts[0].batch_id).toBeNull();
    expect(tables.demand_planning_drafts[0].target_date).toBe(rollingDraftTargetDate);
    expect(tables.demand_planning_drafts[0].target_shift_id).toBe(rollingDraftTargetShiftId);
  });

  it('insertDemandPlanningBuckets accepts null batchId for rolling drafts', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createRollingDemandPlanningDraft({
      tenantId: tenantA,
      createdBy: null,
      targetDate: rollingDraftTargetDate,
      targetShiftId: rollingDraftTargetShiftId
    });

    const buckets = await repo.insertDemandPlanningBuckets({
      tenantId: tenantA,
      draftId: draft.id,
      batchId: null,
      buckets: [
        { distributionArea: 'דרום', planningLineName: 'default', bucketName: 'unassigned', bucketKind: 'technical_unassigned', sortOrder: 0 },
        { distributionArea: 'צפון', planningLineName: 'default', bucketName: 'unassigned', bucketKind: 'technical_unassigned', sortOrder: 1 }
      ]
    });

    expect(buckets).toHaveLength(2);
    expect(buckets[0].batchId).toBeNull();
    expect(buckets[1].batchId).toBeNull();
    expect(buckets[0].distributionArea).toBe('דרום');
    expect(buckets[1].distributionArea).toBe('צפון');

    const listed = await repo.listDemandPlanningBuckets({ tenantId: tenantA, draftId: draft.id });
    expect(listed).toHaveLength(2);
  });

  it('round-trip rolling draft with null-batch buckets and per-row-batch allocations', async () => {
    const { supabase, tables } = createFakeSupabase();
    const repo = createManualShiftsRepo(supabase as never);

    const draft = await repo.createRollingDemandPlanningDraft({
      tenantId: tenantA,
      createdBy: null,
      targetDate: rollingDraftTargetDate,
      targetShiftId: rollingDraftTargetShiftId
    });

    const buckets = await repo.insertDemandPlanningBuckets({
      tenantId: tenantA,
      draftId: draft.id,
      batchId: null,
      buckets: [
        { distributionArea: 'דרום', planningLineName: 'default', bucketName: 'unassigned', bucketKind: 'technical_unassigned', sortOrder: 0 },
        { distributionArea: 'צפון', planningLineName: 'default', bucketName: 'unassigned', bucketKind: 'technical_unassigned', sortOrder: 1 }
      ]
    });

    const batchId1 = '11111111-1111-4111-8111-111111111111';
    const batchId2 = '22222222-2222-4222-8222-222222222222';

    const allocations = await repo.insertDemandPlanningAllocations({
      tenantId: tenantA,
      draftId: draft.id,
      batchId: batchId1,
      allocations: [
        { rawDemandRowId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', bucketId: buckets[0].id, allocatedQuantity: 10, batchId: batchId1 },
        { rawDemandRowId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', bucketId: buckets[1].id, allocatedQuantity: 20, batchId: batchId2 }
      ]
    });

    expect(allocations).toHaveLength(2);
    expect(allocations[0].batchId).toBe(batchId1);
    expect(allocations[0].allocatedQuantity).toBe(10);
    expect(allocations[1].batchId).toBe(batchId2);
    expect(allocations[1].allocatedQuantity).toBe(20);

    const listed = await repo.listDemandPlanningAllocations({ tenantId: tenantA, draftId: draft.id });
    expect(listed).toHaveLength(2);
  });
});
