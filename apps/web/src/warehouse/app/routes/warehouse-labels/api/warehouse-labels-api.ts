import { useMutation } from '@tanstack/react-query';
import type {
  WarehouseLabelPresetId,
  WarehouseLabelPreviewRequest,
  WarehouseLabelPreviewResponse
} from '@wos/domain';
import { bffRequest, bffRequestBlob } from '@/shared/api/bff/client';
import type { BffBlobDownload } from '@/shared/api/bff/client';

export const warehouseLabelKeys = {
  preview: (floorId: string, preset: WarehouseLabelPresetId) =>
    ['warehouse-labels', 'preview', floorId, preset] as const
};

async function previewWarehouseLabels(
  request: WarehouseLabelPreviewRequest
): Promise<WarehouseLabelPreviewResponse> {
  return bffRequest<WarehouseLabelPreviewResponse>('/api/warehouse-labels/preview', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

async function downloadWarehouseLabelsPdf(
  request: WarehouseLabelPreviewRequest
): Promise<BffBlobDownload> {
  return bffRequestBlob('/api/warehouse-labels/pdf', {
    method: 'POST',
    body: JSON.stringify(request)
  });
}

export function useWarehouseLabelPreview() {
  return useMutation({
    mutationFn: previewWarehouseLabels
  });
}

export function useWarehouseLabelPdfDownload() {
  return useMutation({
    mutationFn: downloadWarehouseLabelsPdf
  });
}

export type PreviewFingerprint = {
  floorId: string;
  selectionMode: string;
  labelPreset: WarehouseLabelPresetId;
  layoutMode: string;
};

export function computePreviewFingerprint(
  floorId: string,
  preset: WarehouseLabelPresetId
): PreviewFingerprint {
  return {
    floorId,
    selectionMode: 'entire-floor',
    labelPreset: preset,
    layoutMode: 'single-label-page'
  };
}

export function fingerprintsMatch(
  a: PreviewFingerprint | null,
  b: PreviewFingerprint | null
): boolean {
  if (a === null || b === null) return false;
  return (
    a.floorId === b.floorId &&
    a.selectionMode === b.selectionMode &&
    a.labelPreset === b.labelPreset &&
    a.layoutMode === b.layoutMode
  );
}

export function triggerBlobDownload(download: BffBlobDownload): void {
  const url = URL.createObjectURL(download.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = download.filename;
  a.click();
  URL.revokeObjectURL(url);
}