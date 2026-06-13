import {
  getWarehouseLabelPreset,
  warehouseLabelPreviewResponseSchema,
  type WarehouseLabelPreviewRequest,
  type WarehouseLabelPreviewResponse,
  type WarehouseLabelResolvedLayout
} from '@wos/domain';
import { ApiError } from '../../errors.js';
import type {
  WarehouseLabelCellRow,
  WarehouseLabelLocationRow,
  WarehouseLabelsRepo
} from './repo.js';
import type { ResolvedWarehouseLabel } from './pdf.js';

export const MAX_LABELS_PER_REQUEST = 1000;
const SAMPLE_LABEL_LIMIT = 10;
const A4_PAGE_WIDTH_MM = 210;
const A4_PAGE_HEIGHT_MM = 297;

const presetWarningThresholds = {
  'rack-slot-100x50': 18,
  'rack-slot-100x60': 22,
  'rack-slot-70x40': 14
} as const;

function compareResolvedLabels(left: ResolvedWarehouseLabel, right: ResolvedWarehouseLabel): number {
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

export function dedupeIds(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

function impossibleLayoutError(): ApiError {
  return new ApiError(400, 'VALIDATION_ERROR', 'A4 layout is impossible for the selected preset, margin, and gap.');
}

export function limitExceededError(): ApiError {
  return new ApiError(
    422,
    'WAREHOUSE_LABEL_LIMIT_EXCEEDED',
    `Warehouse label preview is limited to ${MAX_LABELS_PER_REQUEST} resolved labels per request.`
  );
}

export function requestedLocationsNotFoundError(): ApiError {
  return new ApiError(404, 'LOCATION_NOT_FOUND', 'One or more requested locations were not found.');
}

export function unsupportedPdfLayoutModeError(): ApiError {
  return new ApiError(
    422,
    'WAREHOUSE_LABEL_PDF_LAYOUT_UNSUPPORTED',
    'PDF rendering for the selected layout mode is not supported yet.'
  );
}

export function emptyPdfSelectionError(): ApiError {
  return new ApiError(422, 'LABEL_SELECTION_EMPTY', 'No printable warehouse labels were resolved for the requested PDF.');
}

export function buildResolvedLayout(request: WarehouseLabelPreviewRequest): WarehouseLabelResolvedLayout {
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

function buildWarnings(request: WarehouseLabelPreviewRequest, labels: ResolvedWarehouseLabel[]): string[] {
  const threshold = presetWarningThresholds[request.labelPreset];
  const overlongCount = labels.filter((label) => label.locationCode.length > threshold).length;

  if (overlongCount === 0) {
    return [];
  }

  return [
    `${overlongCount} label address${overlongCount === 1 ? ' exceeds' : 'es exceed'} recommended length ${threshold} for preset ${request.labelPreset}.`
  ];
}

export function buildPreviewResponse(
  request: WarehouseLabelPreviewRequest,
  labels: ResolvedWarehouseLabel[]
): WarehouseLabelPreviewResponse {
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

function resolvePrintableLabelOrNull(
  location: WarehouseLabelLocationRow,
  cellsById: Map<string, WarehouseLabelCellRow>,
  publishedLayoutVersionIds: Set<string>,
  floorId: string
): ResolvedWarehouseLabel | null {
  if (location.floor_id !== floorId) {
    return null;
  }

  if (location.location_type !== 'rack_slot') {
    return null;
  }

  if (location.status !== 'active') {
    return null;
  }

  if (!location.geometry_slot_id) {
    return null;
  }

  const cell = cellsById.get(location.geometry_slot_id);
  if (!cell) {
    return null;
  }

  if (cell.status !== 'active') {
    return null;
  }

  if (!publishedLayoutVersionIds.has(cell.layout_version_id)) {
    return null;
  }

  return {
    locationId: location.id,
    locationCode: location.code,
    addressSortKey: cell.address_sort_key
  };
}

async function resolveLabels(
  repo: WarehouseLabelsRepo,
  tenantId: string,
  request: WarehouseLabelPreviewRequest,
  locations: WarehouseLabelLocationRow[]
): Promise<ResolvedWarehouseLabel[]> {
  const publishedLayoutVersions = await repo.listPublishedLayoutVersionsForFloor(tenantId, request.floorId);
  const publishedLayoutVersionIds = new Set(
    publishedLayoutVersions
      .filter((layoutVersion) => layoutVersion.floor_id === request.floorId && layoutVersion.state === 'published')
      .map((layoutVersion) => layoutVersion.id)
  );

  if (publishedLayoutVersionIds.size === 0) {
    return [];
  }

  const cellIds = dedupeIds(
    locations
      .map((location) => location.geometry_slot_id)
      .filter((cellId): cellId is string => typeof cellId === 'string')
  );
  const cells = await repo.listCellsByIds(cellIds);
  const cellsById = new Map(cells.map((cell) => [cell.id, cell]));

  return locations
    .map((location) => resolvePrintableLabelOrNull(location, cellsById, publishedLayoutVersionIds, request.floorId))
    .filter((label): label is ResolvedWarehouseLabel => label !== null)
    .sort(compareResolvedLabels);
}

export async function resolveWarehouseLabelsForRequest(
  repo: WarehouseLabelsRepo,
  tenantId: string,
  request: WarehouseLabelPreviewRequest
): Promise<ResolvedWarehouseLabel[]> {
  if (request.selection.mode === 'location-ids') {
    const locationIds = dedupeIds(request.selection.locationIds);
    if (locationIds.length > MAX_LABELS_PER_REQUEST) {
      throw limitExceededError();
    }

    const locations = await repo.listTenantLocationsByIds(tenantId, locationIds);
    if (locations.length !== locationIds.length) {
      throw requestedLocationsNotFoundError();
    }

    const labels = await resolveLabels(repo, tenantId, request, locations);
    if (labels.length !== locationIds.length) {
      throw requestedLocationsNotFoundError();
    }

    return labels;
  }

  const locations = await repo.listTenantFloorRackSlotLocations(tenantId, request.floorId);
  const labels = await resolveLabels(repo, tenantId, request, locations);

  if (labels.length > MAX_LABELS_PER_REQUEST) {
    throw limitExceededError();
  }

  return labels;
}
