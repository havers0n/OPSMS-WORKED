import type { SupabaseClient } from '@supabase/supabase-js';
import type { Wave, WaveStatus, WaveSummary } from '@wos/domain';
import { mapOrderSummaryRowToDomain, mapWaveRowToDomain, mapWaveSummaryRowToDomain } from '../../mappers.js';

type WaveRelation = { name: string } | Array<{ name: string }> | null | undefined;

type OrderSummaryMetricsRow = {
  id: string;
  tenant_id: string;
  external_number: string;
  status: string;
  priority: number;
  wave_id: string | null;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
  waves?: WaveRelation;
  order_lines?: Array<{ qty_required: number; qty_picked: number }>;
};

type WaveRow = {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
};

const orderSummarySelectColumns = `
  id,
  tenant_id,
  external_number,
  status,
  priority,
  wave_id,
  created_at,
  released_at,
  closed_at,
  waves(name),
  order_lines(qty_required, qty_picked)
`;

const waveSelectColumns = 'id,tenant_id,name,status,created_at,released_at,closed_at';

function getWaveNameFromRelation(relation: WaveRelation): string | null {
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null;
  }

  return relation?.name ?? null;
}

function mapOrderSummaryMetricsRow(row: OrderSummaryMetricsRow) {
  const lines = row.order_lines ?? [];

  return mapOrderSummaryRowToDomain({
    id: row.id,
    tenant_id: row.tenant_id,
    external_number: row.external_number,
    status: row.status,
    priority: row.priority,
    wave_id: row.wave_id,
    wave_name: getWaveNameFromRelation(row.waves),
    created_at: row.created_at,
    released_at: row.released_at,
    closed_at: row.closed_at,
    line_count: lines.length,
    unit_count: lines.reduce((sum, line) => sum + line.qty_required, 0),
    picked_unit_count: lines.reduce((sum, line) => sum + line.qty_picked, 0)
  });
}

function buildWaveCounts(orders: Array<{ status: string }>) {
  const totalOrders = orders.length;
  const readyOrders = orders.filter((order) => order.status === 'ready').length;
  const blockingOrderCount = orders.filter((order) => order.status !== 'ready').length;

  return {
    totalOrders,
    readyOrders,
    blockingOrderCount
  };
}

function mapWaveWithOrders(waveRow: WaveRow, orders: ReturnType<typeof mapOrderSummaryMetricsRow>[]): Wave {
  const counts = buildWaveCounts(orders);

  return mapWaveRowToDomain(
    {
      id: waveRow.id,
      tenant_id: waveRow.tenant_id,
      name: waveRow.name,
      status: waveRow.status,
      created_at: waveRow.created_at,
      released_at: waveRow.released_at,
      closed_at: waveRow.closed_at,
      total_orders: counts.totalOrders,
      ready_orders: counts.readyOrders,
      blocking_order_count: counts.blockingOrderCount
    },
    orders
  );
}

function mapWaveSummaryWithCounts(row: WaveRow & { orders?: Array<{ status: string }> }): WaveSummary {
  const counts = buildWaveCounts(row.orders ?? []);

  return mapWaveSummaryRowToDomain({
    id: row.id,
    tenant_id: row.tenant_id,
    name: row.name,
    status: row.status,
    created_at: row.created_at,
    released_at: row.released_at,
    closed_at: row.closed_at,
    total_orders: counts.totalOrders,
    ready_orders: counts.readyOrders,
    blocking_order_count: counts.blockingOrderCount
  });
}

export type WavePatch = {
  status: WaveStatus;
  closedAt?: string;
};

export type WavesRepo = {
  listWaveSummaries(tenantId: string): Promise<WaveSummary[]>;
  createWave(input: { tenantId: string; name: string }): Promise<string>;
  updateWaveStatus(waveId: string, patch: WavePatch): Promise<void>;
  runReleaseWave(waveId: string): Promise<void>;
  attachOrderToWave(waveId: string, orderId: string): Promise<void>;
  detachOrderFromWave(waveId: string, orderId: string): Promise<void>;
  findWaveResponse(waveId: string): Promise<Wave | null>;
};

export function createWavesRepo(supabase: SupabaseClient): WavesRepo {
  return {
    async listWaveSummaries(tenantId) {
      const { data, error } = await supabase
        .from('waves')
        .select(`${waveSelectColumns},orders(status)`)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return ((data ?? []) as Array<WaveRow & { orders?: Array<{ status: string }> }>).map(mapWaveSummaryWithCounts);
    },

    async createWave(input) {
      const { data, error } = await supabase
        .from('waves')
        .insert({
          tenant_id: input.tenantId,
          name: input.name,
          status: 'draft'
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id as string;
    },

    async updateWaveStatus(waveId, patch) {
      const payload: Record<string, unknown> = { status: patch.status };

      if (patch.closedAt) {
        payload.closed_at = patch.closedAt;
      }

      const { error } = await supabase
        .from('waves')
        .update(payload)
        .eq('id', waveId)
        .select('id')
        .single();

      if (error) {
        throw error;
      }
    },

    async runReleaseWave(waveId) {
      const { error } = await supabase.rpc('release_wave', { wave_uuid: waveId });

      if (error) {
        throw error;
      }
    },

    async attachOrderToWave(waveId, orderId) {
      const { error } = await supabase.rpc('attach_order_to_wave', {
        wave_uuid: waveId,
        order_uuid: orderId
      });

      if (error) {
        throw error;
      }
    },

    async detachOrderFromWave(waveId, orderId) {
      const { error } = await supabase.rpc('detach_order_from_wave', {
        wave_uuid: waveId,
        order_uuid: orderId
      });

      if (error) {
        throw error;
      }
    },

    async findWaveResponse(waveId) {
      const { data: waveRow, error: waveError } = await supabase
        .from('waves')
        .select(waveSelectColumns)
        .eq('id', waveId)
        .single();

      if (waveError || !waveRow) {
        return null;
      }

      const { data: orderRows, error: ordersError } = await supabase
        .from('orders')
        .select(orderSummarySelectColumns)
        .eq('wave_id', waveId)
        .order('created_at', { ascending: true });

      if (ordersError) {
        throw ordersError;
      }

      const orders = ((orderRows ?? []) as OrderSummaryMetricsRow[]).map(mapOrderSummaryMetricsRow);
      return mapWaveWithOrders(waveRow as WaveRow, orders);
    }
  };
}
