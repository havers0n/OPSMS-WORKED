import type { SupabaseClient } from '@supabase/supabase-js';
import type { Order, OrderLine, OrderStatus, OrderSummary } from '@wos/domain';
import { mapOrderLineRowToDomain, mapOrderRowToDomain, mapOrderSummaryRowToDomain } from '../../mappers.js';

type WaveRelation = { name: string } | Array<{ name: string }> | null | undefined;

type OrderRow = {
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
};

type ProductRow = {
  id: string;
  external_product_id: string;
  sku: string | null;
  name: string;
  is_active: boolean;
};

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

type OrderLineInsertRow = {
  id: string;
  order_id: string;
  tenant_id: string;
  product_id: string | null;
  sku: string;
  name: string;
  qty_required: number;
  qty_picked: number;
  status: string;
};

type WaveCreateCheckRow = {
  id: string;
  tenant_id: string;
  status: string;
};

const orderSelectColumns = `
  id,
  tenant_id,
  external_number,
  status,
  priority,
  wave_id,
  created_at,
  released_at,
  closed_at,
  waves(name)
`;

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

const orderLineSelectColumns = 'id,order_id,tenant_id,product_id,sku,name,qty_required,qty_picked,status';
const productSelectColumns = 'id,external_product_id,sku,name,is_active';

function getWaveNameFromRelation(relation: WaveRelation): string | null {
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? null;
  }

  return relation?.name ?? null;
}

function mapOrderRow(row: OrderRow, lines: OrderLine[]): Order {
  return mapOrderRowToDomain(
    {
      id: row.id,
      tenant_id: row.tenant_id,
      external_number: row.external_number,
      status: row.status,
      priority: row.priority,
      wave_id: row.wave_id,
      wave_name: getWaveNameFromRelation(row.waves),
      created_at: row.created_at,
      released_at: row.released_at,
      closed_at: row.closed_at
    },
    lines
  );
}

function mapOrderSummaryMetricsRow(row: OrderSummaryMetricsRow): OrderSummary {
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

export type OrderStatusSnapshot = {
  id: string;
  status: OrderStatus;
  waveId: string | null;
};

export type OrderEditableSnapshot = {
  id: string;
  status: OrderStatus;
};

export type WaveCreateCheck = {
  id: string;
  tenantId: string;
  status: string;
};

export type ProductForOrderLine = {
  id: string;
  sku: string | null;
  externalProductId: string;
  name: string;
  isActive: boolean;
};

export type OrderPatch = {
  status: OrderStatus;
  closedAt?: string;
};

export type OrdersRepo = {
  listOrderSummaries(tenantId: string, status?: string | null): Promise<OrderSummary[]>;
  findWaveForOrderCreate(waveId: string): Promise<WaveCreateCheck | null>;
  createOrder(input: {
    tenantId: string;
    externalNumber: string;
    priority: number;
    waveId: string | null;
  }): Promise<string>;
  findOrderEditableSnapshot(orderId: string): Promise<OrderEditableSnapshot | null>;
  findOrderStatusSnapshot(orderId: string): Promise<OrderStatusSnapshot | null>;
  countOrderLines(orderId: string): Promise<number>;
  updateOrderStatus(orderId: string, patch: OrderPatch): Promise<void>;
  runReleaseOrder(orderId: string): Promise<void>;
  findProductForOrderLine(productId: string): Promise<ProductForOrderLine | null>;
  createOrderLine(input: {
    orderId: string;
    tenantId: string;
    productId: string;
    sku: string;
    name: string;
    qtyRequired: number;
  }): Promise<OrderLine>;
  removeOrderLine(orderId: string, lineId: string): Promise<void>;
  findOrderResponse(orderId: string): Promise<Order | null>;
};

export function createOrdersRepo(supabase: SupabaseClient): OrdersRepo {
  return {
    async listOrderSummaries(tenantId, status) {
      let query = supabase
        .from('orders')
        .select(orderSummarySelectColumns)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return ((data ?? []) as OrderSummaryMetricsRow[]).map(mapOrderSummaryMetricsRow);
    },

    async findWaveForOrderCreate(waveId) {
      const { data, error } = await supabase
        .from('waves')
        .select('id,tenant_id,status')
        .eq('id', waveId)
        .single();

      if (error || !data) {
        return null;
      }

      const row = data as WaveCreateCheckRow;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        status: row.status
      };
    },

    async createOrder(input) {
      const { data, error } = await supabase
        .from('orders')
        .insert({
          tenant_id: input.tenantId,
          external_number: input.externalNumber,
          priority: input.priority,
          wave_id: input.waveId,
          status: 'draft'
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id as string;
    },

    async findOrderEditableSnapshot(orderId) {
      const { data, error } = await supabase
        .from('orders')
        .select('id,status')
        .eq('id', orderId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id as string,
        status: data.status as OrderStatus
      };
    },

    async findOrderStatusSnapshot(orderId) {
      const { data, error } = await supabase
        .from('orders')
        .select('id,status,wave_id')
        .eq('id', orderId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id as string,
        status: data.status as OrderStatus,
        waveId: (data.wave_id as string | null) ?? null
      };
    },

    async countOrderLines(orderId) {
      const { count, error } = await supabase
        .from('order_lines')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId);

      if (error) {
        throw error;
      }

      return count ?? 0;
    },

    async updateOrderStatus(orderId, patch) {
      const payload: Record<string, unknown> = { status: patch.status };

      if (patch.closedAt) {
        payload.closed_at = patch.closedAt;
      }

      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)
        .select('id')
        .single();

      if (error) {
        throw error;
      }
    },

    async runReleaseOrder(orderId) {
      const { error } = await supabase.rpc('release_order', { order_uuid: orderId });

      if (error) {
        throw error;
      }
    },

    async findProductForOrderLine(productId) {
      const { data, error } = await supabase
        .from('products')
        .select(productSelectColumns)
        .eq('id', productId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      const product = (data as ProductRow | null) ?? null;

      if (!product) {
        return null;
      }

      return {
        id: product.id,
        sku: product.sku,
        externalProductId: product.external_product_id,
        name: product.name,
        isActive: product.is_active
      };
    },

    async createOrderLine(input) {
      const { data, error } = await supabase
        .from('order_lines')
        .insert({
          order_id: input.orderId,
          tenant_id: input.tenantId,
          product_id: input.productId,
          sku: input.sku,
          name: input.name,
          qty_required: input.qtyRequired,
          status: 'pending'
        })
        .select(orderLineSelectColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapOrderLineRowToDomain(data as OrderLineInsertRow);
    },

    async removeOrderLine(orderId, lineId) {
      const { error } = await supabase
        .from('order_lines')
        .delete()
        .eq('id', lineId)
        .eq('order_id', orderId);

      if (error) {
        throw error;
      }
    },

    async findOrderResponse(orderId) {
      const { data: orderRow, error: orderError } = await supabase
        .from('orders')
        .select(orderSelectColumns)
        .eq('id', orderId)
        .single();

      if (orderError || !orderRow) {
        return null;
      }

      const { data: lineRows, error: linesError } = await supabase
        .from('order_lines')
        .select(orderLineSelectColumns)
        .eq('order_id', orderId)
        .order('id', { ascending: true });

      if (linesError) {
        throw linesError;
      }

      const lines = (lineRows ?? []).map((row) => mapOrderLineRowToDomain(row as OrderLineInsertRow));
      return mapOrderRow(orderRow as OrderRow, lines);
    }
  };
}
