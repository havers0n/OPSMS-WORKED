import { describe, expect, it, vi } from 'vitest';
import { createPickReadRepo } from './pick-read-repo.js';

const ids = {
  task:      '11111111-1111-4111-8111-111111111111',
  tenant:    '00000000-0000-4000-8000-000000000000',
  step:      '22222222-2222-4222-8222-222222222222',
  container: '33333333-3333-4333-8333-333333333333',
  cell:      '44444444-4444-4444-8444-444444444444',
  orderLine: '55555555-5555-4555-8555-555555555555',
  product:   '66666666-6666-4666-8666-666666666666',
  order:     '77777777-7777-4777-8777-777777777777'
};

const taskRow = {
  id: ids.task,
  task_number: 'TSK-000321',
  tenant_id: ids.tenant,
  source_type: 'order' as const,
  source_id: ids.order,
  status: 'in_progress',
  assigned_to: null,
  started_at: '2026-03-01T10:00:00.000Z',
  completed_at: null,
  created_at: '2026-03-01T09:00:00.000Z'
};

const stepRow = {
  id: ids.step,
  task_id: ids.task,
  tenant_id: ids.tenant,
  order_id: ids.order,
  order_line_id: ids.orderLine,
  sequence_no: 1,
  sku: 'SKU-001',
  item_name: 'Widget A',
  qty_required: 5,
  qty_picked: 0,
  status: 'pending',
  source_cell_id: ids.cell,
  source_container_id: ids.container,
  inventory_unit_id: null,
  pick_container_id: null,
  executed_at: null,
  executed_by: null
};

// ── Supabase stub factory ─────────────────────────────────────────────────────

function makeSupabaseStub(overrides: {
  taskData?: unknown;
  taskError?: unknown;
  stepData?: unknown[];
  stepError?: unknown;
  containerData?: unknown[];
  cellData?: unknown[];
  orderLineData?: unknown[];
  productData?: unknown[];
} = {}) {
  const {
    taskData = taskRow,
    taskError = null,
    stepData = [stepRow],
    stepError = null,
    containerData = [{ id: ids.container, system_code: 'CNT-000111', external_code: 'CTN-001' }],
    cellData = [{ id: ids.cell, address: '03-A.01.01.01', layout_version_id: '88888888-8888-4888-8888-888888888888' }],
    orderLineData = [{ id: ids.orderLine, product_id: ids.product }],
    productData = [{ id: ids.product, image_urls: ['https://cdn.example.com/widget-a.jpg'] }]
  } = overrides;

  return {
    from: vi.fn((table: string) => {
      if (table === 'pick_tasks') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: taskData, error: taskError }))
            }))
          }))
        };
      }

      if (table === 'pick_steps') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(async () => ({ data: stepData, error: stepError }))
            }))
          }))
        };
      }

      if (table === 'containers') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: containerData, error: null }))
          }))
        };
      }

      if (table === 'cells') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: cellData, error: null }))
          }))
        };
      }

      if (table === 'layout_versions') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ id: '88888888-8888-4888-8888-888888888888', floor_id: '99999999-9999-4999-8999-999999999999' }],
              error: null
            }))
          }))
        };
      }

      if (table === 'order_lines') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: orderLineData, error: null }))
          }))
        };
      }

      if (table === 'products') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({ data: productData, error: null }))
          }))
        };
      }

      return { select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) })) };
    })
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('pick-read-repo — findPickTaskDetail', () => {
  it('returns null when task is not found', async () => {
    const supabase = makeSupabaseStub({ taskData: null, taskError: { code: 'PGRST116', message: 'Not Found' } });
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);

    expect(result).toBeNull();
  });

  it('returns full task detail with enriched steps', async () => {
    const supabase = makeSupabaseStub();
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(ids.task);
    expect(result!.taskNumber).toBe('TSK-000321');
    expect(result!.status).toBe('in_progress');
    expect(result!.totalSteps).toBe(1);
    expect(result!.completedSteps).toBe(0);
    expect(result!.steps).toHaveLength(1);
  });

  it('maps step enrichment fields correctly', async () => {
    const supabase = makeSupabaseStub();
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);
    const step = result!.steps[0];

    expect(step.sourceCellAddress).toBe('03-A.01.01.01');
    expect(step.sourceContainerCode).toBe('CNT-000111');
    expect(step.imageUrl).toBe('https://cdn.example.com/widget-a.jpg');
  });

  it('maps PR1/PR3 step fields correctly', async () => {
    const pickedStepRow = {
      ...stepRow,
      status: 'picked',
      qty_picked: 5,
      inventory_unit_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      pick_container_id: ids.container,
      executed_at: '2026-03-01T10:05:00.000Z',
      executed_by: ids.tenant
    };
    const supabase = makeSupabaseStub({ stepData: [pickedStepRow] });
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);
    const step = result!.steps[0];

    expect(step.inventoryUnitId).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(step.pickContainerId).toBe(ids.container);
    expect(step.executedAt).toBe('2026-03-01T10:05:00.000Z');
    expect(step.executedBy).toBe(ids.tenant);
  });

  it('counts terminal steps as completedSteps', async () => {
    const pickedStep = { ...stepRow, id: '11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'picked' };
    const partialStep = { ...stepRow, id: '22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'partial' };
    const pendingStep = { ...stepRow, id: '33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa', status: 'pending' };
    const supabase = makeSupabaseStub({ stepData: [pickedStep, partialStep, pendingStep] });
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);

    expect(result!.totalSteps).toBe(3);
    expect(result!.completedSteps).toBe(2);
  });

  it('returns null enrichment fields when source_cell_id / source_container_id are null', async () => {
    const unallocatedStep = {
      ...stepRow,
      source_cell_id: null,
      source_container_id: null,
      order_line_id: null
    };
    const supabase = makeSupabaseStub({ stepData: [unallocatedStep], containerData: [], cellData: [], orderLineData: [] });
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);
    const step = result!.steps[0];

    expect(step.sourceCellAddress).toBeNull();
    expect(step.sourceContainerCode).toBeNull();
    expect(step.imageUrl).toBeNull();
  });

  it('returns null imageUrl when product has no image_urls', async () => {
    const supabase = makeSupabaseStub({
      productData: [{ id: ids.product, image_urls: null }]
    });
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);

    expect(result!.steps[0].imageUrl).toBeNull();
  });

  it('throws when pick_steps query errors', async () => {
    const supabase = makeSupabaseStub({ stepError: { code: 'PGRST500', message: 'DB error' } });
    const repo = createPickReadRepo(supabase as never);

    await expect(repo.findPickTaskDetail(ids.task)).rejects.toMatchObject({ code: 'PGRST500' });
  });

  it('returns empty steps array and zero counts when task has no steps', async () => {
    const supabase = makeSupabaseStub({ stepData: [] });
    const repo = createPickReadRepo(supabase as never);

    const result = await repo.findPickTaskDetail(ids.task);

    expect(result!.steps).toHaveLength(0);
    expect(result!.totalSteps).toBe(0);
    expect(result!.completedSteps).toBe(0);
  });
});
