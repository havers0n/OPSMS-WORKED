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
      if (request.layout.mode !== 'single-label-page') {
        throw unsupportedPdfLayoutModeError();
      }

      const labels = await resolveWarehouseLabelsForRequest(repo, tenantId, request);
      if (labels.length === 0) {
        throw emptyPdfSelectionError();
      }

      const bytes = await generateWarehouseLabelsPdf({
        labels,
        labelPreset: request.labelPreset
      });

      return {
        bytes,
        labelCount: labels.length
      };
    }
  };
}
