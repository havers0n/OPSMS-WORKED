import { useMutation, useQuery } from '@tanstack/react-query';
import type {
  RackSlotLocationRef,
  WarehouseLabelPresetId,
  WarehouseLabelSelection,
  WarehouseLabelPreviewRequest,
  WarehouseLabelPreviewResponse
} from '@wos/domain';
import { bffRequest, bffRequestBlob } from '@/shared/api/bff/client';
import type { BffBlobDownload } from '@/shared/api/bff/client';

export const warehouseLabelKeys = {
  preview: (floorId: string, preset: WarehouseLabelPresetId) =>
    ['warehouse-labels', 'preview', floorId, preset] as const,
  rackSlotLocationRefs: (floorId: string | null) =>
    ['warehouse-labels', 'rack-slot-location-refs', floorId ?? 'none'] as const
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

async function fetchRackSlotLocationRefs(floorId: string): Promise<RackSlotLocationRef[]> {
  return bffRequest<RackSlotLocationRef[]>(`/api/floors/${floorId}/rack-slot-location-refs`);
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

export function useRackSlotLocationRefs(floorId: string | null) {
  return useQuery({
    queryKey: warehouseLabelKeys.rackSlotLocationRefs(floorId),
    queryFn: () => fetchRackSlotLocationRefs(floorId as string),
    enabled: Boolean(floorId)
  });
}

export type PreviewFingerprint = {
  floorId: string;
  selection: WarehouseLabelSelection;
  labelPreset: WarehouseLabelPresetId;
  layoutMode: string;
};

export function computePreviewFingerprint(
  floorId: string,
  preset: WarehouseLabelPresetId,
  selection: WarehouseLabelSelection
): PreviewFingerprint {
  return {
    floorId,
    selection:
      selection.mode === 'location-ids'
        ? {
            mode: 'location-ids',
            locationIds: Array.from(new Set(selection.locationIds)).sort((left, right) => left.localeCompare(right))
          }
        : selection,
    labelPreset: preset,
    layoutMode: 'single-label-page'
  };
}

export function fingerprintsMatch(
  a: PreviewFingerprint | null,
  b: PreviewFingerprint | null
): boolean {
  if (a === null || b === null) return false;
  if (
    a.floorId !== b.floorId ||
    a.labelPreset !== b.labelPreset ||
    a.layoutMode !== b.layoutMode ||
    a.selection.mode !== b.selection.mode
  ) {
    return false;
  }

  if (a.selection.mode === 'entire-floor') {
    return true;
  }

  const aLocationIds = a.selection.locationIds;
  const bLocationIds = b.selection.mode === 'location-ids' ? b.selection.locationIds : [];

  if (aLocationIds.length !== bLocationIds.length) {
    return false;
  }

  return aLocationIds.every((locationId, index) => locationId === bLocationIds[index]);
}

export function triggerBlobDownload(download: BffBlobDownload): void {
  const url = URL.createObjectURL(download.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = download.filename;
  a.click();
  URL.revokeObjectURL(url);
}
