import type { SupabaseClient } from '@supabase/supabase-js';
import type { WarehouseStockSnapshotPreview, WarehouseStockSnapshotRow, WarehouseStockSnapshotDiagnosticCode } from '@wos/domain';

// ── DB row types ─────────────────────────────────────────────────────────────

type WarehouseStockSnapshotRowDb = {
  id: string;
  tenant_id: string;
  shift_id: string | null;
  planning_date: string;
  file_name: string | null;
  file_hash: string | null;
  source_sheet_name: string;
  imported_at: string;
  imported_by: string | null;
  source_row_count: number;
  unique_sku_count: number;
  diagnostics: Array<{ code: string; message: string; rowNumber?: number; sku?: string }>;
  status: string;
  created_at: string;
};

type WarehouseStockSnapshotDetailRowDb = {
  id: string;
  snapshot_id: string;
  sku: string;
  description: string | null;
  category: string | null;
  warehouse_qty_raw: number;
  available_qty: number;
  source_demand_qty: number | null;
  source_row_count: number;
  diagnostics: string[];
  created_at: string;
};

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateSnapshotInput = {
  shiftId: string | null;
  planningDate: string;
  fileName: string | null;
  preview: WarehouseStockSnapshotPreview;
};

export type CreateSnapshotResult = {
  id: string;
  planningDate: string;
  status: string;
  rowCount: number;
  importedAt: string;
};

export type SnapshotListItem = {
  id: string;
  planningDate: string;
  fileName: string | null;
  importedAt: string;
  rowCount: number;
  sourceRowCount: number;
  uniqueSkuCount: number;
  status: string;
  diagnostics: Array<{ code: string; message: string; rowNumber?: number; sku?: string }>;
};

export type SnapshotDetail = {
  id: string;
  planningDate: string;
  fileName: string | null;
  importedAt: string;
  rowCount: number;
  sourceRowCount: number;
  uniqueSkuCount: number;
  status: string;
  diagnostics: Array<{ code: string; message: string; rowNumber?: number; sku?: string }>;
  sourceSheetName: string;
  rows: WarehouseStockSnapshotRow[];
};

export type WarehouseStockRepo = {
  createSnapshot(
    tenantId: string,
    userId: string | null,
    input: CreateSnapshotInput
  ): Promise<CreateSnapshotResult>;
  getSnapshot(tenantId: string, snapshotId: string): Promise<SnapshotDetail | null>;
  listSnapshots(tenantId: string): Promise<SnapshotListItem[]>;
  getLatestCompletedSnapshot(tenantId: string, planningDate: string): Promise<SnapshotDetail | null>;
};

// ── Column selects ───────────────────────────────────────────────────────────

const snapshotColumns = `
  id,
  tenant_id,
  shift_id,
  planning_date,
  file_name,
  file_hash,
  source_sheet_name,
  imported_at,
  imported_by,
  source_row_count,
  unique_sku_count,
  diagnostics,
  status,
  created_at
`.trim();

const snapshotRowColumns = `
  id,
  snapshot_id,
  sku,
  description,
  category,
  warehouse_qty_raw,
  available_qty,
  source_demand_qty,
  source_row_count,
  diagnostics,
  created_at
`.trim();

// ── Factory ──────────────────────────────────────────────────────────────────

export function createWarehouseStockRepo(supabase: SupabaseClient): WarehouseStockRepo {
  return {
    async createSnapshot(tenantId, userId, input) {
      const now = new Date().toISOString();

      const { data: snapshot, error: snapError } = await supabase
        .from('warehouse_stock_snapshots')
        .insert({
          tenant_id: tenantId,
          shift_id: input.shiftId,
          planning_date: input.planningDate,
          file_name: input.fileName,
          file_hash: null,
          source_sheet_name: input.preview.sourceSheetName,
          imported_at: now,
          imported_by: userId,
          source_row_count: input.preview.rowCount,
          unique_sku_count: input.preview.uniqueSkuCount,
          diagnostics: input.preview.diagnostics,
          status: 'completed'
        })
        .select('id, imported_at')
        .single();

      if (snapError) throw snapError;

      const rowsToInsert = input.preview.rows.map(row => ({
        snapshot_id: snapshot.id,
        sku: row.sku,
        description: row.description,
        category: row.category,
        warehouse_qty_raw: row.warehouseQtyRaw,
        available_qty: row.availableQty,
        source_demand_qty: row.sourceDemandQty,
        source_row_count: row.sourceRowCount,
        diagnostics: row.diagnostics
      }));

      const { error: rowsError } = await supabase
        .from('warehouse_stock_snapshot_rows')
        .insert(rowsToInsert);

      if (rowsError) throw rowsError;

      return {
        id: snapshot.id,
        planningDate: input.planningDate,
        status: 'completed',
        rowCount: input.preview.rows.length,
        importedAt: snapshot.imported_at
      };
    },

    async getSnapshot(tenantId, snapshotId) {
      const { data: snapshot, error: snapError } = await supabase
        .from('warehouse_stock_snapshots')
        .select(snapshotColumns)
        .eq('id', snapshotId)
        .eq('tenant_id', tenantId)
        .single();

      if (snapError) {
        if (snapError.code === 'PGRST116') return null;
        throw snapError;
      }

      const snapRow = snapshot as unknown as WarehouseStockSnapshotRowDb;

      const { data: rows, error: rowsError } = await supabase
        .from('warehouse_stock_snapshot_rows')
        .select(snapshotRowColumns)
        .eq('snapshot_id', snapshotId)
        .order('sku', { ascending: true });

      if (rowsError) throw rowsError;

      return mapSnapshotDetail(snapRow, (rows ?? []) as unknown as WarehouseStockSnapshotDetailRowDb[]);
    },

    async listSnapshots(tenantId) {
      const { data: snapshots, error } = await supabase
        .from('warehouse_stock_snapshots')
        .select(snapshotColumns)
        .eq('tenant_id', tenantId)
        .order('imported_at', { ascending: false });

      if (error) throw error;

      return ((snapshots ?? []) as unknown as WarehouseStockSnapshotRowDb[]).map(mapSnapshotListItem);
    },

    async getLatestCompletedSnapshot(tenantId, planningDate) {
      const { data: snapshot, error: snapError } = await supabase
        .from('warehouse_stock_snapshots')
        .select(snapshotColumns)
        .eq('tenant_id', tenantId)
        .eq('planning_date', planningDate)
        .eq('status', 'completed')
        .order('imported_at', { ascending: false })
        .limit(1)
        .single();

      if (snapError) {
        if (snapError.code === 'PGRST116') return null;
        throw snapError;
      }

      const snapRow = snapshot as unknown as WarehouseStockSnapshotRowDb;

      const { data: rows, error: rowsError } = await supabase
        .from('warehouse_stock_snapshot_rows')
        .select(snapshotRowColumns)
        .eq('snapshot_id', snapRow.id)
        .order('sku', { ascending: true });

      if (rowsError) throw rowsError;

      return mapSnapshotDetail(snapRow, (rows ?? []) as unknown as WarehouseStockSnapshotDetailRowDb[]);
    }
  };
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapSnapshotListItem(snapshot: WarehouseStockSnapshotRowDb): SnapshotListItem {
  return {
    id: snapshot.id,
    planningDate: snapshot.planning_date,
    fileName: snapshot.file_name || null,
    importedAt: snapshot.imported_at,
    rowCount: 0, // not stored at top-level
    sourceRowCount: snapshot.source_row_count,
    uniqueSkuCount: snapshot.unique_sku_count,
    status: snapshot.status,
    diagnostics: snapshot.diagnostics
  };
}

function mapSnapshotDetail(
  snapshot: WarehouseStockSnapshotRowDb,
  rows: WarehouseStockSnapshotDetailRowDb[]
): SnapshotDetail {
  return {
    id: snapshot.id,
    planningDate: snapshot.planning_date,
    fileName: snapshot.file_name || null,
    importedAt: snapshot.imported_at,
    rowCount: rows.length,
    sourceRowCount: snapshot.source_row_count,
    uniqueSkuCount: snapshot.unique_sku_count,
    status: snapshot.status,
    diagnostics: snapshot.diagnostics,
    sourceSheetName: snapshot.source_sheet_name,
    rows: rows.map(r => ({
      sku: r.sku,
      description: r.description,
      category: r.category,
      warehouseQtyRaw: r.warehouse_qty_raw,
      availableQty: r.available_qty,
      sourceDemandQty: r.source_demand_qty,
      sourceRowCount: r.source_row_count,
      diagnostics: r.diagnostics as WarehouseStockSnapshotDiagnosticCode[]
    }))
  };
}
