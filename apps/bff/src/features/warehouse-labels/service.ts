import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getWarehouseLabelPreset,
  warehouseLabelPreviewResponseSchema,
  type WarehouseLabelPreviewRequest,
  type WarehouseLabelPreviewResponse,
  type WarehouseLabelResolvedLayout
} from '@wos/domain';
import { ApiError } from '../../errors.js';
import {
  createWarehouseLabelsRepo,
  type WarehouseLabelCellRow,
  type WarehouseLabelLocationRow,
  type WarehouseLabelsRepo
} from './repo.js';

const MAX_LABELS_PER_REQUEST = 1000;
const SAMPLE_LABEL_LIMIT = 10;
const A4_PAGE_WIDTH_MM = 210;
const A4_PAGE_HEIGHT_MM = 297;

const presetWarningThresholds = {
  'rack-slot-100x50': 18,
  'rack-slot-100x60': 22,
  'rack-slot-70x40': 14
} as const;

type PreviewLabelsInput = {
  tenantId: string;
  request: WarehouseLabelPreviewRequest;
};

type ResolvedLabel = {
  locationId: string;
  locationCode: string;
  addressSortKey: string;
};

function compareResolvedLabels(left: ResolvedLabel, right: ResolvedLabel): number {
  const addressComparison = left.addressSortKey.localeCompare(right.addressSortKey);
  if (addressComparison !== 0) {
    return addressComparison;
  }

  const codeComparison = left.locationCode.localeCompare(right.locationCode);
  if (codeComparison !== 0) {
    return codeComparison;
  }

  return left.locationId.localeCompare(right.locationId);
}

function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function impossibleLayoutError(): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', 'A4 layout is impossible for the selected preset, margin, and gap.');
}

function limitExceededError(): ApiError {
  return new ApiError(
    422,
    'WAREHOUSE_LABEL_LIMIT_EXCEEDED',
    `Warehouse label preview is limited to ${MAX_LABELS_PER_REQUEST} resolved labels per request.`
  );
}

function locationNotFoundError(locationId: string): ApiError {
  return new ApiError(404, 'LOCATION_NOT_FOUND', `Location ${locationId} was not found.`);
}

function locationFloorMismatchError(locationId: string, floorId: string): ApiError {
  return new ApiError(409, 'LOCATION_FLOOR_MISMATCH', `Location ${locationId} does not belong to floor ${floorId}.`);
}

function locationTypeInvalidError(locationId: string, locationType: string): ApiError {
  return new ApiError(
    409,
    'LOCATION_TYPE_INVALID',
    `Location ${locationId} has type ${locationType} and cannot be printed as a rack-slot label.`
  );
}

function locationNotPrintableError(locationId: string, reason: string): ApiError {
  return new ApiError(409, 'LOCATION_NOT_PRINTABLE', `Location ${locationId} is not printable: ${reason}.`);
}

function buildResolvedLayout(request: WarehouseLabelPreviewRequest): WarehouseLabelResolvedLayout {
  const preset = getWarehouseLabelPreset(request.labelPreset);

  if (request.layout.mode === 'single-label-page') {
    return {
      mode: 'single-label-page',
      pageWidthMm: preset.widthMm,
      pageHeightMm: preset.heightMm,
      labelsPerPage: 1
    };
  }

  const usableWidth = A4_PAGE_WIDTH_MM - 2 * request.layout.marginMm;
  const usableHeight = A4_PAGE_HEIGHT_MM - 2 * request.layout.marginMm;
  const columns = Math.floor((usableWidth + request.layout.gapMm) / (preset.widthMm + request.layout.gapMm));
  const rows = Math.floor((usableHeight + request.layout.gapMm) / (preset.heightMm + request.layout.gapMm));
  const labelsPerPage = columns * rows;

  if (columns < 1 || rows < 1 || labelsPerPage < 1) {
    throw impossibleLayoutError();
  }

  return {
    mode: 'a4-sheet',
    pageWidthMm: A4_PAGE_WIDTH_MM,
    pageHeightMm: A4_PAGE_HEIGHT_MM,
    marginMm: request.layout.marginMm,
    gapMm: request.layout.gapMm,
    columns,
    rows,
    labelsPerPage
  };
}

function buildWarnings(request: WarehouseLabelPreviewRequest, labels: ResolvedLabel[]): string[] {
  const threshold = presetWarningThresholds[request.labelPreset];
  const overlongCount = labels.filter((label) => label.locationCode.length > threshold).length;

  if (overlongCount === 0) {
    return [];
  }

  return [
    `${overlongCount} label address${overlongCount === 1 ? ' exceeds' : 'es exceed'} recommended length ${threshold} for preset ${request.labelPreset}.`
  ];
}

function buildResponse(request: WarehouseLabelPreviewRequest, labels: ResolvedLabel[]): WarehouseLabelPreviewResponse {
  const resolvedPreset = getWarehouseLabelPreset(request.labelPreset);
  const resolvedLayout = buildResolvedLayout(request);
  const pageCount = labels.length === 0 ? 0 : Math.ceil(labels.length / resolvedLayout.labelsPerPage);

  return warehouseLabelPreviewResponseSchema.parse({
    labelCount: labels.length,
    pageCount,
    resolvedPreset,
    resolvedLayout,
    sampleLabels: labels.slice(0, SAMPLE_LABEL_LIMIT).map((label) => ({
      locationId: label.locationId,
      address: label.locationCode,
      barcodeValue: label.locationCode
    })),
    warnings: buildWarnings(request, labels)
  });
}

function validateLocationRow(location: WarehouseLabelLocationRow, floorId: string): void {
  if (location.floor_id !== floorId) {
    throw locationFloorMismatchError(location.id, floorId);
  }

  if (location.location_type !== 'rack_slot') {
    throw locationTypeInvalidError(location.id, location.location_type);
  }

  if (location.status !== 'active') {
    throw locationNotPrintableError(location.id, `status ${location.status}`);
  }

  if (!location.geometry_slot_id) {
    throw locationNotPrintableError(location.id, 'missing geometry slot');
  }
}

function resolvePrintableLabel(
  location: WarehouseLabelLocationRow,
  cellsById: Map<string, WarehouseLabelCellRow>,
  layoutStateById: Map<string, 'draft' | 'published' | 'archived'>
): ResolvedLabel {
  const cell = cellsById.get(location.geometry_slot_id as string);
  if (!cell) {
    throw locationNotPrintableError(location.id, 'geometry slot is missing');
  }

  if (cell.status !== 'active') {
    throw locationNotPrintableError(location.id, `geometry slot status ${cell.status}`);
  }

  const layoutState = layoutStateById.get(cell.layout_version_id);
  if (layoutState !== 'published') {
    throw locationNotPrintableError(location.id, 'geometry slot is not in a published layout');
  }

  return {
    locationId: location.id,
    locationCode: location.code,
    addressSortKey: cell.address_sort_key
  };
}

async function resolveLabels(
  repo: WarehouseLabelsRepo,
  request: WarehouseLabelPreviewRequest,
  locations: WarehouseLabelLocationRow[]
): Promise<ResolvedLabel[]> {
  for (const location of locations) {
    validateLocationRow(location, request.floorId);
  }

  const cellIds = dedupeIds(
    locations
      .map((location) => location.geometry_slot_id)
      .filter((cellId): cellId is string => typeof cellId === 'string')
  );
  const cells = await repo.listCellsByIds(cellIds);
  const cellsById = new Map(cells.map((cell) => [cell.id, cell]));
  const layoutVersionIds = dedupeIds(cells.map((cell) => cell.layout_version_id));
  const layoutVersions = await repo.listLayoutVersionsByIds(layoutVersionIds);
  const layoutStateById = new Map(layoutVersions.map((layoutVersion) => [layoutVersion.id, layoutVersion.state]));

  return locations
    .map((location) => resolvePrintableLabel(location, cellsById, layoutStateById))
    .sort(compareResolvedLabels);
}

export type WarehouseLabelsService = {
  previewLabels(input: PreviewLabelsInput): Promise<WarehouseLabelPreviewResponse>;
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

      if (request.selection.mode === 'location-ids') {
        const locationIds = dedupeIds(request.selection.locationIds);
        if (locationIds.length > MAX_LABELS_PER_REQUEST) {
          throw limitExceededError();
        }

        const locations = await repo.listTenantLocationsByIds(tenantId, locationIds);
        const locationsById = new Map(locations.map((location) => [location.id, location]));
        const orderedLocations = locationIds.map((locationId) => {
          const location = locationsById.get(locationId);
          if (!location) {
            throw locationNotFoundError(locationId);
          }

          return location;
        });

        return buildResponse(request, await resolveLabels(repo, request, orderedLocations));
      }

      const locations = await repo.listTenantFloorRackSlotLocations(tenantId, request.floorId);
      const labels = await resolveLabels(repo, request, locations);

      if (labels.length > MAX_LABELS_PER_REQUEST) {
        throw limitExceededError();
      }

      return buildResponse(request, labels);
    }
  };
}
