import type { SupabaseClient } from '@supabase/supabase-js';
import {
  type WarehouseLabelPreviewRequest,
  type WarehouseLabelPreviewResponse
} from '@wos/domain';
import {
  createWarehouseLabelsRepo,
  type WarehouseLabelsRepo
} from './repo.js';
import { generateWarehouseLabelsPdf } from './pdf.js';
import {
  buildPreviewResponse,
  emptyPdfSelectionError,
  MAX_PDF_LABELS_PER_REQUEST,
  pdfLimitExceededError,
  resolveWarehouseLabelsForRequest,
  unsupportedPdfLayoutModeError
} from './resolution.js';

type PreviewLabelsInput = {
  tenantId: string;
  request: WarehouseLabelPreviewRequest;
};

type GenerateLabelsPdfInput = {
  tenantId: string;
  request: WarehouseLabelPreviewRequest;
};

export type GeneratedWarehouseLabelsPdf = {
  bytes: Uint8Array;
  labelCount: number;
};

export type WarehouseLabelsService = {
  previewLabels(input: PreviewLabelsInput): Promise<WarehouseLabelPreviewResponse>;
  generateLabelsPdf(input: GenerateLabelsPdfInput): Promise<GeneratedWarehouseLabelsPdf>;
};

export function createWarehouseLabelsService(
  repoOrSupabase: WarehouseLabelsRepo | SupabaseClient
): WarehouseLabelsService {
  const repo: WarehouseLabelsRepo =
    'listTenantFloorRackSlotLocations' in repoOrSupabase
      ? repoOrSupabase
      : createWarehouseLabelsRepo(repoOrSupabase);

  return {
    async previewLabels(input) {
      const { tenantId, request } = input;
      const labels = await resolveWarehouseLabelsForRequest(repo, tenantId, request);
      return buildPreviewResponse(request, labels);
    },

    async generateLabelsPdf(input) {
      const { tenantId, request } = input;
      const startMs = Date.now();
      const safeFloorId = request.floorId.replace(/[^a-zA-Z0-9._-]/g, '-');

      if (request.layout.mode !== 'single-label-page') {
        throw unsupportedPdfLayoutModeError();
      }

      const labels = await resolveWarehouseLabelsForRequest(repo, tenantId, request);

      if (labels.length > MAX_PDF_LABELS_PER_REQUEST) {
        throw pdfLimitExceededError(labels.length);
      }

      if (labels.length === 0) {
        throw emptyPdfSelectionError();
      }

      const bytes = await generateWarehouseLabelsPdf({
        labels,
        labelPreset: request.labelPreset
      });

      const durationMs = Date.now() - startMs;
      const outputBytes = bytes.byteLength;

      console.log(
        JSON.stringify({
          event: 'warehouse-labels-pdf-generated',
          tenantId,
          floorId: safeFloorId,
          labelCount: labels.length,
          pageCount: labels.length,
          preset: request.labelPreset,
          durationMs,
          outputBytes,
          timestamp: new Date().toISOString()
        })
      );

      return {
        bytes,
        labelCount: labels.length
      };
    }
  };
}
