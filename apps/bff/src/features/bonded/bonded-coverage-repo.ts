import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BondedCoverageRequest,
  BondedCoverageRequestDetail,
  BondedCoverageRequestItem
} from '@wos/domain';

// ── DB row types ─────────────────────────────────────────────────────────────

type BondedCoverageRequestRow = {
  id: string;
  tenant_id: string;
  shift_id: string;
  planning_date: string;
  status: string;
  title: string | null;
  notes: string | null;
  bonded_snapshot_id: string | null;
  warehouse_stock_snapshot_id: string | null;
  created_by_profile_id: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  closed_by_profile_id: string | null;
  closed_by_name: string | null;
  closed_at: string | null;
  cancelled_by_profile_id: string | null;
  cancelled_by_name: string | null;
  cancelled_at: string | null;
};

type BondedCoverageRequestItemRow = {
  id: string;
  request_id: string;
  sku: string;
  description: string | null;
  category: string | null;
  requested_qty: number;
  fulfilled_qty: number;
  demand_qty_at_create: number | null;
  warehouse_qty_at_create: number | null;
  shortage_qty_at_create: number | null;
  bonded_available_qty_at_create: number | null;
  bonded_cover_qty_at_create: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateRequestInput = {
  shiftId: string;
  planningDate: string;
  title: string | null | undefined;
  notes: string | null | undefined;
  bondedSnapshotId: string | null | undefined;
  warehouseStockSnapshotId: string | null | undefined;
  items?: Array<{
    sku: string;
    description?: string | null;
    category?: string | null;
    requestedQty: number;
    demandQtyAtCreate?: number | null;
    warehouseQtyAtCreate?: number | null;
    shortageQtyAtCreate?: number | null;
    bondedAvailableQtyAtCreate?: number | null;
    bondedCoverQtyAtCreate?: number | null;
    notes?: string | null;
  }>;
};

export type AddItemInput = {
  sku: string;
  description?: string | null;
  category?: string | null;
  requestedQty: number;
  demandQtyAtCreate?: number | null;
  warehouseQtyAtCreate?: number | null;
  shortageQtyAtCreate?: number | null;
  bondedAvailableQtyAtCreate?: number | null;
  bondedCoverQtyAtCreate?: number | null;
  notes?: string | null;
};

export type UpdateItemInput = {
  requestedQty?: number;
  notes?: string | null;
};

export type BondedCoverageRepo = {
  createRequest(
    tenantId: string,
    userId: string | null,
    userName: string | null,
    input: CreateRequestInput
  ): Promise<BondedCoverageRequestDetail>;

  getRequest(tenantId: string, requestId: string): Promise<BondedCoverageRequestDetail | null>;

  listRequests(
    tenantId: string,
    shiftId: string,
    status?: string
  ): Promise<BondedCoverageRequest[]>;

  addItem(requestId: string, input: AddItemInput): Promise<BondedCoverageRequestItem>;

  updateItem(itemId: string, input: UpdateItemInput): Promise<BondedCoverageRequestItem>;

  updateRequestStatus(
    requestId: string,
    status: string,
    userId: string | null,
    userName: string | null,
    closedAt?: string | null,
    cancelledAt?: string | null
  ): Promise<BondedCoverageRequest>;

  updateItemFulfilledQty(itemId: string, fulfilledQty: number): Promise<void>;
};

// ── Column selects ───────────────────────────────────────────────────────────

const requestColumns = `
  id,
  tenant_id,
  shift_id,
  planning_date,
  status,
  title,
  notes,
  bonded_snapshot_id,
  warehouse_stock_snapshot_id,
  created_by_profile_id,
  created_by_name,
  created_at,
  updated_at,
  closed_by_profile_id,
  closed_by_name,
  closed_at,
  cancelled_by_profile_id,
  cancelled_by_name,
  cancelled_at
`.trim();

const itemColumns = `
  id,
  request_id,
  sku,
  description,
  category,
  requested_qty,
  fulfilled_qty,
  demand_qty_at_create,
  warehouse_qty_at_create,
  shortage_qty_at_create,
  bonded_available_qty_at_create,
  bonded_cover_qty_at_create,
  notes,
  created_at,
  updated_at
`.trim();

// ── Factory ──────────────────────────────────────────────────────────────────

export function createBondedCoverageRepo(supabase: SupabaseClient): BondedCoverageRepo {
  return {
    async createRequest(tenantId, userId, userName, input) {
      const now = new Date().toISOString();

      const { data: request, error: reqError } = await supabase
        .from('bonded_coverage_requests')
        .insert({
          tenant_id: tenantId,
          shift_id: input.shiftId,
          planning_date: input.planningDate,
          status: 'open',
          title: input.title ?? null,
          notes: input.notes ?? null,
          bonded_snapshot_id: input.bondedSnapshotId ?? null,
          warehouse_stock_snapshot_id: input.warehouseStockSnapshotId ?? null,
          created_by_profile_id: userId,
          created_by_name: userName,
          created_at: now,
          updated_at: now
        })
        .select(requestColumns)
        .single();

      if (reqError) throw reqError;

      const requestRow = request as unknown as BondedCoverageRequestRow;

      let items: BondedCoverageRequestItem[] = [];
      if (input.items && input.items.length > 0) {
        const itemsToInsert = input.items.map(item => ({
          request_id: requestRow.id,
          sku: item.sku,
          description: item.description ?? null,
          category: item.category ?? null,
          requested_qty: item.requestedQty,
          fulfilled_qty: 0,
          demand_qty_at_create: item.demandQtyAtCreate ?? null,
          warehouse_qty_at_create: item.warehouseQtyAtCreate ?? null,
          shortage_qty_at_create: item.shortageQtyAtCreate ?? null,
          bonded_available_qty_at_create: item.bondedAvailableQtyAtCreate ?? null,
          bonded_cover_qty_at_create: item.bondedCoverQtyAtCreate ?? null,
          notes: item.notes ?? null
        }));

        const { data: insertedItems, error: itemsError } = await supabase
          .from('bonded_coverage_request_items')
          .insert(itemsToInsert)
          .select(itemColumns);

        if (itemsError) throw itemsError;

        items = ((insertedItems ?? []) as unknown as BondedCoverageRequestItemRow[]).map(mapItemRow);
      }

      return {
        ...mapRequestRow(requestRow),
        items
      };
    },

    async getRequest(tenantId, requestId) {
      const { data: request, error: reqError } = await supabase
        .from('bonded_coverage_requests')
        .select(requestColumns)
        .eq('id', requestId)
        .eq('tenant_id', tenantId)
        .single();

      if (reqError) {
        if (reqError.code === 'PGRST116') return null;
        throw reqError;
      }

      const requestRow = request as unknown as BondedCoverageRequestRow;

      const { data: items, error: itemsError } = await supabase
        .from('bonded_coverage_request_items')
        .select(itemColumns)
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      return {
        ...mapRequestRow(requestRow),
        items: ((items ?? []) as unknown as BondedCoverageRequestItemRow[]).map(mapItemRow)
      };
    },

    async listRequests(tenantId, shiftId, status) {
      let query = supabase
        .from('bonded_coverage_requests')
        .select(requestColumns)
        .eq('tenant_id', tenantId)
        .eq('shift_id', shiftId);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: requests, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;

      return ((requests ?? []) as unknown as BondedCoverageRequestRow[]).map(mapRequestRow);
    },

    async addItem(requestId, input) {
      const { data: item, error } = await supabase
        .from('bonded_coverage_request_items')
        .insert({
          request_id: requestId,
          sku: input.sku,
          description: input.description ?? null,
          category: input.category ?? null,
          requested_qty: input.requestedQty,
          fulfilled_qty: 0,
          demand_qty_at_create: input.demandQtyAtCreate ?? null,
          warehouse_qty_at_create: input.warehouseQtyAtCreate ?? null,
          shortage_qty_at_create: input.shortageQtyAtCreate ?? null,
          bonded_available_qty_at_create: input.bondedAvailableQtyAtCreate ?? null,
          bonded_cover_qty_at_create: input.bondedCoverQtyAtCreate ?? null,
          notes: input.notes ?? null
        })
        .select(itemColumns)
        .single();

      if (error) throw error;

      return mapItemRow(item as unknown as BondedCoverageRequestItemRow);
    },

    async updateItem(itemId, input) {
      const patch: Record<string, unknown> = {};
      if (input.requestedQty !== undefined) {
        patch.requested_qty = input.requestedQty;
      }
      if (input.notes !== undefined) {
        patch.notes = input.notes;
      }

      const { data: item, error } = await supabase
        .from('bonded_coverage_request_items')
        .update(patch)
        .eq('id', itemId)
        .select(itemColumns)
        .single();

      if (error) throw error;

      return mapItemRow(item as unknown as BondedCoverageRequestItemRow);
    },

    async updateRequestStatus(requestId, status, userId, userName, closedAt, cancelledAt) {
      const patch: Record<string, unknown> = {
        status
      };

      if (status === 'closed') {
        patch.closed_by_profile_id = userId;
        patch.closed_by_name = userName;
        patch.closed_at = closedAt ?? new Date().toISOString();
        patch.cancelled_by_profile_id = null;
        patch.cancelled_by_name = null;
        patch.cancelled_at = null;
      } else if (status === 'cancelled') {
        patch.cancelled_by_profile_id = userId;
        patch.cancelled_by_name = userName;
        patch.cancelled_at = cancelledAt ?? new Date().toISOString();
        patch.closed_by_profile_id = null;
        patch.closed_by_name = null;
        patch.closed_at = null;
      }

      const { data: request, error } = await supabase
        .from('bonded_coverage_requests')
        .update(patch)
        .eq('id', requestId)
        .select(requestColumns)
        .single();

      if (error) throw error;

      return mapRequestRow(request as unknown as BondedCoverageRequestRow);
    },

    async updateItemFulfilledQty(itemId, fulfilledQty) {
      const { error } = await supabase
        .from('bonded_coverage_request_items')
        .update({ fulfilled_qty: fulfilledQty })
        .eq('id', itemId);

      if (error) throw error;
    }
  };
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapRequestRow(row: BondedCoverageRequestRow): BondedCoverageRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    shiftId: row.shift_id,
    planningDate: row.planning_date,
    status: row.status as BondedCoverageRequest['status'],
    title: row.title,
    notes: row.notes,
    bondedSnapshotId: row.bonded_snapshot_id,
    warehouseStockSnapshotId: row.warehouse_stock_snapshot_id,
    createdByProfileId: row.created_by_profile_id,
    createdByName: row.created_by_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    closedByProfileId: row.closed_by_profile_id,
    closedByName: row.closed_by_name,
    closedAt: row.closed_at,
    cancelledByProfileId: row.cancelled_by_profile_id,
    cancelledByName: row.cancelled_by_name,
    cancelledAt: row.cancelled_at
  };
}

function mapItemRow(row: BondedCoverageRequestItemRow): BondedCoverageRequestItem {
  return {
    id: row.id,
    requestId: row.request_id,
    sku: row.sku,
    description: row.description,
    category: row.category,
    requestedQty: row.requested_qty,
    fulfilledQty: row.fulfilled_qty,
    demandQtyAtCreate: row.demand_qty_at_create,
    warehouseQtyAtCreate: row.warehouse_qty_at_create,
    shortageQtyAtCreate: row.shortage_qty_at_create,
    bondedAvailableQtyAtCreate: row.bonded_available_qty_at_create,
    bondedCoverQtyAtCreate: row.bonded_cover_qty_at_create,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
