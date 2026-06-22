import type { WarehouseStockSnapshotPreview } from '@wos/domain';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import { warehouseStockKeys } from './queries';

export type WarehouseStockUploadResponse = {
  preview: WarehouseStockSnapshotPreview;
  fileName: string;
  pivotSheetFound: boolean;
};

export type WarehouseStockPublishInput = {
  preview: WarehouseStockSnapshotPreview;
  planningDate: string;
  fileName?: string | null;
  shiftId?: string | null;
};

export type WarehouseStockPublishResponse = {
  id: string;
  planningDate: string;
  status: string;
  rowCount: number;
  importedAt: string;
};

async function uploadWarehouseStockExcel(file: File): Promise<WarehouseStockUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return bffRequest<WarehouseStockUploadResponse>('/api/warehouse-stock/upload', {
    method: 'POST',
    body: formData
  });
}

async function publishWarehouseStockSnapshot(input: WarehouseStockPublishInput): Promise<WarehouseStockPublishResponse> {
  return bffRequest<WarehouseStockPublishResponse>('/api/warehouse-stock/snapshots', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export function useUploadWarehouseStockExcel() {
  return useMutation({
    mutationFn: uploadWarehouseStockExcel
  });
}

export function usePublishWarehouseStockSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: publishWarehouseStockSnapshot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: warehouseStockKeys.snapshots() });
    }
  });
}
