import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickTaskDetail, PickStepDetail } from '@wos/domain';
import { pickTaskDetailSchema } from '@wos/domain';

// ── Column lists ──────────────────────────────────────────────────────────────

const pickTaskColumns =
  'id,tenant_id,source_type,source_id,status,assigned_to,started_at,completed_at,created_at';

const pickStepColumns = [
  'id', 'task_id', 'tenant_id', 'order_id', 'order_line_id',
  'sequence_no', 'sku', 'item_name', 'qty_required', 'qty_picked',
  'status', 'source_cell_id', 'source_container_id',
  'inventory_unit_id', 'pick_container_id', 'executed_at', 'executed_by'
].join(',');

// ── Row types ─────────────────────────────────────────────────────────────────

type PickTaskRow = {
  id: string;
  tenant_id: string;
  source_type: 'order' | 'wave';
  source_id: string;
  status: string;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type PickStepRow = {
  id: string;
  task_id: string;
  tenant_id: string;
  order_id: string | null;
  order_line_id: string | null;
  sequence_no: number;
  sku: string;
  item_name: string;
  qty_required: number;
  qty_picked: number;
  status: string;
  source_cell_id: string | null;
  source_container_id: string | null;
  inventory_unit_id: string | null;
  pick_container_id: string | null;
  executed_at: string | null;
  executed_by: string | null;
};

// ── Terminal step statuses for rollup counters ────────────────────────────────

const terminalStatuses = new Set(['picked', 'partial', 'skipped', 'exception', 'needs_replenishment']);

// ── Factory ───────────────────────────────────────────────────────────────────

export type PickReadRepo = {
  findPickTaskDetail(taskId: string): Promise<PickTaskDetail | null>;
};

export function createPickReadRepo(supabase: SupabaseClient): PickReadRepo {
  return {
    async findPickTaskDetail(taskId) {
      // 1. Load task row
      const { data: taskRow, error: taskError } = await supabase
        .from('pick_tasks')
        .select(pickTaskColumns)
        .eq('id', taskId)
        .single();

      if (taskError || !taskRow) {
        return null;
      }

      // 2. Load step rows
      const { data: stepRows, error: stepsError } = await supabase
        .from('pick_steps')
        .select(pickStepColumns)
        .eq('task_id', taskId)
        .order('sequence_no', { ascending: true });

      if (stepsError) {
        throw stepsError;
      }

      const steps = (stepRows ?? []) as PickStepRow[];

      // 3. Collect unique IDs for enrichment
      const containerIds = [...new Set(
        steps.map((s) => s.source_container_id).filter((id): id is string => id !== null)
      )];
      const cellIds = [...new Set(
        steps.map((s) => s.source_cell_id).filter((id): id is string => id !== null)
      )];
      const orderLineIds = [...new Set(
        steps.map((s) => s.order_line_id).filter((id): id is string => id !== null)
      )];

      // 4. Batch-fetch enrichment data in parallel
      const [containerResult, cellResult, orderLineResult] = await Promise.all([
        containerIds.length > 0
          ? supabase.from('containers').select('id,external_code').in('id', containerIds)
          : Promise.resolve({ data: [], error: null }),
        cellIds.length > 0
          ? supabase.from('cells').select('id,address').in('id', cellIds)
          : Promise.resolve({ data: [], error: null }),
        orderLineIds.length > 0
          ? supabase.from('order_lines').select('id,product_id').in('id', orderLineIds)
          : Promise.resolve({ data: [], error: null })
      ]);

      if (containerResult.error) throw containerResult.error;
      if (cellResult.error) throw cellResult.error;
      if (orderLineResult.error) throw orderLineResult.error;

      // 5. Fetch products for image URLs
      const productIds = [...new Set(
        ((orderLineResult.data ?? []) as { id: string; product_id: string }[])
          .map((ol) => ol.product_id)
          .filter(Boolean)
      )];

      const productResult = productIds.length > 0
        ? await supabase.from('products').select('id,image_urls').in('id', productIds)
        : { data: [], error: null };

      if (productResult.error) throw productResult.error;

      // 6. Build lookup maps
      const containerCodeById = new Map(
        ((containerResult.data ?? []) as { id: string; external_code: string }[])
          .map((c) => [c.id, c.external_code])
      );

      const cellAddressById = new Map(
        ((cellResult.data ?? []) as { id: string; address: string }[])
          .map((c) => [c.id, c.address])
      );

      const productIdByOrderLineId = new Map(
        ((orderLineResult.data ?? []) as { id: string; product_id: string }[])
          .map((ol) => [ol.id, ol.product_id])
      );

      const imageUrlByProductId = new Map(
        ((productResult.data ?? []) as { id: string; image_urls: string[] | null }[])
          .map((p) => {
            const first = (p.image_urls ?? [])[0] ?? null;
            return [p.id, first] as [string, string | null];
          })
      );

      // 7. Map steps to domain with enrichment
      const enrichedSteps: PickStepDetail[] = steps.map((row) => {
        const productId = row.order_line_id
          ? productIdByOrderLineId.get(row.order_line_id) ?? null
          : null;

        return {
          id: row.id,
          taskId: row.task_id,
          tenantId: row.tenant_id,
          orderId: row.order_id,
          orderLineId: row.order_line_id,
          sequenceNo: row.sequence_no,
          sku: row.sku,
          itemName: row.item_name,
          qtyRequired: row.qty_required,
          qtyPicked: row.qty_picked,
          status: row.status as PickStepDetail['status'],
          sourceCellId: row.source_cell_id,
          sourceContainerId: row.source_container_id,
          inventoryUnitId: row.inventory_unit_id,
          pickContainerId: row.pick_container_id,
          executedAt: row.executed_at,
          executedBy: row.executed_by,
          sourceCellAddress: row.source_cell_id
            ? (cellAddressById.get(row.source_cell_id) ?? null)
            : null,
          sourceContainerCode: row.source_container_id
            ? (containerCodeById.get(row.source_container_id) ?? null)
            : null,
          imageUrl: productId ? (imageUrlByProductId.get(productId) ?? null) : null
        };
      });

      // 8. Compute rollup counters
      const totalSteps = enrichedSteps.length;
      const completedSteps = enrichedSteps.filter((s) => terminalStatuses.has(s.status)).length;

      const task = taskRow as PickTaskRow;

      return pickTaskDetailSchema.parse({
        id: task.id,
        tenantId: task.tenant_id,
        sourceType: task.source_type,
        sourceId: task.source_id,
        status: task.status,
        assignedTo: task.assigned_to,
        startedAt: task.started_at,
        completedAt: task.completed_at,
        createdAt: task.created_at,
        totalSteps,
        completedSteps,
        steps: enrichedSteps
      });
    }
  };
}
