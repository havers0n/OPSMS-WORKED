import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  BondedSnapshotDiagnostics,
  BondedSnapshotDraft,
  BondedSnapshotDraftRow
} from '@wos/domain';

// ── DB row types ─────────────────────────────────────────────────────────────

type BondedSnapshotRow = {
  id: string;
  tenant_id: string;
  shift_id: string | null;
  planning_date: string | null;
  file_name: string;
  file_hash: string | null;
  source_sheet_name: string;
  imported_at: string;
  imported_by: string | null;
  row_count: number;
  diagnostics: BondedSnapshotDiagnostics;
  status: string;
  created_at: string;
};

type BondedSnapshotDetailRow = {
  id: string;
  snapshot_id: string;
  row_number: number;
  source_label: string | null;
  block: string | null;
  sku: string | null;
  description: string | null;
  released_qty: number;
  pack_factor: number | null;
  cartons_per_pallet: number | null;
  units_per_pallet: number | null;
  pull_columns: (number | null)[];
  total_pulled_qty: number;
  released_balance_qty: number;
  available_qty: number;
  notes: string | null;
  remaining_bonded_raw: string | null;
  diagnostics: string[];
  created_at: string;
};

// ── Types ────────────────────────────────────────────────────────────────────

export type CreateSnapshotInput = {
  shiftId: string | null;
  planningDate: string;
  fileName: string | null;
  draft: BondedSnapshotDraft;
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
  status: string;
  diagnostics: {
    totalRows: number;
    missingSkuRows: number;
    negativeBalanceRows: number;
    duplicateSkuGroups: number;
    warnings: string[];
  };
};

export type SnapshotDetail = {
  id: string;
  planningDate: string;
  fileName: string | null;
  importedAt: string;
  rowCount: number;
  status: string;
  diagnostics: BondedSnapshotDiagnostics;
  sourceSheetName: string;
  rows: BondedSnapshotDraftRow[];
};

export type BondedRepo = {
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
  row_count,
  diagnostics,
  status,
  created_at
`.trim();

const snapshotRowColumns = `
  id,
  snapshot_id,
  row_number,
  source_label,
  block,
  sku,
  description,
  released_qty,
  pack_factor,
  cartons_per_pallet,
  units_per_pallet,
  pull_columns,
  total_pulled_qty,
  released_balance_qty,
  available_qty,
  notes,
  remaining_bonded_raw,
  diagnostics,
  created_at
`.trim();

// ── Factory ──────────────────────────────────────────────────────────────────

export function createBondedRepo(supabase: SupabaseClient): BondedRepo {
  return {
    async createSnapshot(tenantId, userId, input) {
      const now = new Date().toISOString();

      const { data: snapshot, error: snapError } = await supabase
        .from('bonded_snapshots')
        .insert({
          tenant_id: tenantId,
          shift_id: input.shiftId,
          planning_date: input.planningDate,
          file_name: input.fileName ?? '',
          file_hash: null,
          source_sheet_name: input.draft.sourceSheetName,
          imported_at: now,
          imported_by: userId,
          row_count: input.draft.rowCount ?? input.draft.rows.length,
          diagnostics: input.draft.diagnostics,
          status: 'completed'
        })
        .select('id, imported_at')
        .single();

      if (snapError) throw snapError;

      const rowsToInsert = input.draft.rows.map(row => ({
        snapshot_id: snapshot.id,
        row_number: row.rowNumber,
        source_label: row.sourceLabel,
        block: row.block,
        sku: row.sku,
        description: row.description,
        released_qty: row.releasedQty,
        pack_factor: row.packFactor,
        cartons_per_pallet: row.cartonsPerPallet,
        units_per_pallet: row.unitsPerPallet,
        pull_columns: row.pullColumns,
        total_pulled_qty: row.totalPulledQty,
        released_balance_qty: row.releasedBalanceQty,
        available_qty: row.availableQty,
        notes: row.notes,
        remaining_bonded_raw: row.remainingBondedRaw,
        diagnostics: row.diagnostics
      }));

      const { error: rowsError } = await supabase
        .from('bonded_snapshot_rows')
        .insert(rowsToInsert);

      if (rowsError) throw rowsError;

      return {
        id: snapshot.id,
        planningDate: input.planningDate,
        status: 'completed',
        rowCount: input.draft.rowCount ?? input.draft.rows.length,
        importedAt: snapshot.imported_at
      };
    },

    async getSnapshot(tenantId, snapshotId) {
      const { data: snapshot, error: snapError } = await supabase
        .from('bonded_snapshots')
        .select(snapshotColumns)
        .eq('id', snapshotId)
        .eq('tenant_id', tenantId)
        .single();

      if (snapError) {
        if (snapError.code === 'PGRST116') return null;
        throw snapError;
      }

      const snapRow = snapshot as unknown as BondedSnapshotRow;

      const { data: rows, error: rowsError } = await supabase
        .from('bonded_snapshot_rows')
        .select(snapshotRowColumns)
        .eq('snapshot_id', snapshotId)
        .order('row_number', { ascending: true });

      if (rowsError) throw rowsError;

      return mapSnapshotDetail(snapRow, (rows ?? []) as unknown as BondedSnapshotDetailRow[]);
    },

    async listSnapshots(tenantId) {
      const { data: snapshots, error } = await supabase
        .from('bonded_snapshots')
        .select(snapshotColumns)
        .eq('tenant_id', tenantId)
        .order('imported_at', { ascending: false });

      if (error) throw error;

      return ((snapshots ?? []) as unknown as BondedSnapshotRow[]).map(mapSnapshotListItem);
    },

    async getLatestCompletedSnapshot(tenantId, planningDate) {
      const { data: snapshot, error: snapError } = await supabase
        .from('bonded_snapshots')
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

      const snapRow = snapshot as unknown as BondedSnapshotRow;

      const { data: rows, error: rowsError } = await supabase
        .from('bonded_snapshot_rows')
        .select(snapshotRowColumns)
        .eq('snapshot_id', snapRow.id)
        .order('row_number', { ascending: true });

      if (rowsError) throw rowsError;

      return mapSnapshotDetail(snapRow, (rows ?? []) as unknown as BondedSnapshotDetailRow[]);
    }
  };
}

// ── Mappers ──────────────────────────────────────────────────────────────────

function mapSnapshotListItem(snapshot: BondedSnapshotRow): SnapshotListItem {
  return {
    id: snapshot.id,
    planningDate: snapshot.planning_date ?? '',
    fileName: snapshot.file_name || null,
    importedAt: snapshot.imported_at,
    rowCount: snapshot.row_count,
    status: snapshot.status,
    diagnostics: {
      totalRows: snapshot.diagnostics.totalRows,
      missingSkuRows: snapshot.diagnostics.missingSkuRows,
      negativeBalanceRows: snapshot.diagnostics.negativeBalanceRows,
      duplicateSkuGroups: snapshot.diagnostics.duplicateSkuGroups,
      warnings: snapshot.diagnostics.warnings
    }
  };
}

function mapSnapshotDetail(
  snapshot: BondedSnapshotRow,
  rows: BondedSnapshotDetailRow[]
): SnapshotDetail {
  return {
    id: snapshot.id,
    planningDate: snapshot.planning_date ?? '',
    fileName: snapshot.file_name || null,
    importedAt: snapshot.imported_at,
    rowCount: snapshot.row_count,
    status: snapshot.status,
    diagnostics: snapshot.diagnostics,
    sourceSheetName: snapshot.source_sheet_name,
    rows: rows.map(r => ({
      rowNumber: r.row_number,
      sourceLabel: r.source_label,
      block: r.block,
      sku: r.sku,
      description: r.description,
      releasedQty: r.released_qty,
      packFactor: r.pack_factor,
      cartonsPerPallet: r.cartons_per_pallet,
      unitsPerPallet: r.units_per_pallet,
      pullColumns: r.pull_columns,
      totalPulledQty: r.total_pulled_qty,
      releasedBalanceQty: r.released_balance_qty,
      availableQty: r.available_qty,
      notes: r.notes,
      remainingBondedRaw: r.remaining_bonded_raw,
      diagnostics: r.diagnostics
    }))
  };
}
