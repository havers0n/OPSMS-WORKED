import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const warehouseStockKeys = {
  all: ['warehouse-stock'] as const,
  snapshots: () => [...warehouseStockKeys.all, 'snapshots'] as const,
  snapshotDetail: (snapshotId: string) => [...warehouseStockKeys.all, 'snapshots', snapshotId] as const
};

export type WarehouseStockSnapshotListItem = {
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

export type WarehouseStockSnapshotDetail = {
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
  rows: Array<{
    sku: string;
    description: string | null;
    category: string | null;
    warehouseQtyRaw: number;
    availableQty: number;
    sourceDemandQty: number | null;
    sourceRowCount: number;
    diagnostics: string[];
  }>;
};

async function fetchWarehouseStockSnapshots(): Promise<WarehouseStockSnapshotListItem[]> {
  return bffRequest<WarehouseStockSnapshotListItem[]>('/api/warehouse-stock/snapshots');
}

async function fetchWarehouseStockSnapshotDetail(snapshotId: string): Promise<WarehouseStockSnapshotDetail> {
  return bffRequest<WarehouseStockSnapshotDetail>(`/api/warehouse-stock/snapshots/${snapshotId}`);
}

export function warehouseStockSnapshotsQueryOptions() {
  return queryOptions({
    queryKey: warehouseStockKeys.snapshots(),
    queryFn: fetchWarehouseStockSnapshots,
    staleTime: 30_000
  });
}

export function warehouseStockSnapshotDetailQueryOptions(snapshotId: string) {
  return queryOptions({
    queryKey: warehouseStockKeys.snapshotDetail(snapshotId),
    queryFn: () => fetchWarehouseStockSnapshotDetail(snapshotId),
    enabled: !!snapshotId
  });
}
