import {
  buildCatalogProductItemRef,
  cellSchema,
  cellStorageSnapshotRowSchema,
  cellOccupancyRowSchema,
  composeLayoutDraft,
  containerSchema,
  containerStorageSnapshotRowSchema,
  inventoryItemSchema,
  inventoryUnitSchema,
  locationOccupancyRowSchema,
  locationStorageSnapshotRowSchema,
  parseCellAddress,
  productPackagingLevelSchema,
  productUnitProfileSchema,
  containerTypeSchema,
  floorSchema,
  layoutLifecycleInfoSchema,
  layoutValidationResultSchema,
  rackGeometrySchema,
  rackStructureSchema,
  productSchema,
  siteSchema,
  orderSchema,
  orderSummarySchema,
  orderLineSchema,
  pickTaskSchema,
  pickTaskSummarySchema,
  pickStepSchema,
  waveSchema,
  waveSummarySchema,
  type CellStorageSnapshotRow,
  type CellOccupancyRow,
  type Cell,
  type Container,
  type ContainerStorageSnapshotRow,
  type ContainerType,
  type Floor,
  type InventoryItem,
  type InventoryUnit,
  type LayoutDraft,
  type LayoutLifecycleInfo,
  type LayoutPersistedDraftValidationResult,
  type RackGeometry,
  type RackStructure,
  type LocationOccupancyRow,
  type LocationStorageSnapshotRow,
  type Site,
  type Order,
  type OrderSummary,
  type OrderLine,
  type PickTask,
  type PickTaskSummary,
  type PickStep,
  type Wave,
  type WaveSummary,
  type Product,
  type ProductPackagingLevel,
  type ProductUnitProfile,
  type Wall,
  type WallType,
  type Zone,
  type ZoneCategory
} from '@wos/domain';

type LayoutVersionRow = {
  id: string;
  floor_id: string;
  draft_version?: number | null;
  version_no: number;
  state: string;
};

type RackRow = {
  id: string;
  layout_version_id: string;
  display_code: string;
  kind: 'single' | 'paired';
  axis: 'NS' | 'WE';
  x: number;
  y: number;
  total_length: number;
  depth: number;
  rotation_deg: 0 | 90 | 180 | 270;
};

type RackFaceRow = {
  id: string;
  rack_id: string;
  side: 'A' | 'B';
  enabled: boolean;
  slot_numbering_direction: 'ltr' | 'rtl';
  face_mode?: 'mirrored' | 'independent' | null;
  is_mirrored: boolean;
  mirror_source_face_id: string | null;
  face_length: number | null;
};

type RackSectionRow = {
  id: string;
  rack_face_id: string;
  ordinal: number;
  length: number;
};

type RackLevelRow = {
  id: string;
  rack_section_id: string;
  ordinal: number;
  slot_count: number;
  structural_default_role?: 'primary_pick' | 'reserve' | 'none' | null;
};

type LayoutZoneRow = {
  id: string;
  layout_version_id: string;
  code: string;
  name: string;
  category: ZoneCategory | null;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutWallRow = {
  id: string;
  layout_version_id: string;
  code: string;
  name: string | null;
  wall_type: WallType | null;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  blocks_rack_placement: boolean;
};

type ProductRow = {
  id: string;
  source: string;
  external_product_id: string;
  sku: string | null;
  name: string;
  permalink: string | null;
  image_urls: unknown;
  image_files: unknown;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type UnitProfileRow = {
  product_id: string;
  unit_weight_g: number | null;
  unit_width_mm: number | null;
  unit_height_mm: number | null;
  unit_depth_mm: number | null;
  weight_class: 'light' | 'medium' | 'heavy' | 'very_heavy' | null;
  size_class: 'small' | 'medium' | 'large' | 'oversized' | null;
  created_at: string;
  updated_at: string;
};

export type PackagingLevelRow = {
  id: string;
  product_id: string;
  code: string;
  name: string;
  base_unit_qty: number;
  is_base: boolean;
  can_pick: boolean;
  can_store: boolean;
  is_default_pick_uom: boolean;
  barcode: string | null;
  pack_weight_g: number | null;
  pack_width_mm: number | null;
  pack_height_mm: number | null;
  pack_depth_mm: number | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

export function mapProductRowToDomain(row: ProductRow): Product {
  return productSchema.parse({
    id: row.id,
    source: row.source,
    externalProductId: row.external_product_id,
    sku: row.sku,
    name: row.name,
    permalink: row.permalink,
    imageUrls: normalizeStringArray(row.image_urls),
    imageFiles: normalizeStringArray(row.image_files),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export function mapUnitProfileRowToDomain(row: UnitProfileRow): ProductUnitProfile {
  return productUnitProfileSchema.parse({
    productId: row.product_id,
    unitWeightG: row.unit_weight_g,
    unitWidthMm: row.unit_width_mm,
    unitHeightMm: row.unit_height_mm,
    unitDepthMm: row.unit_depth_mm,
    weightClass: row.weight_class,
    sizeClass: row.size_class,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export function mapPackagingLevelRowToDomain(row: PackagingLevelRow): ProductPackagingLevel {
  return productPackagingLevelSchema.parse({
    id: row.id,
    productId: row.product_id,
    code: row.code,
    name: row.name,
    baseUnitQty: row.base_unit_qty,
    isBase: row.is_base,
    canPick: row.can_pick,
    canStore: row.can_store,
    isDefaultPickUom: row.is_default_pick_uom,
    barcode: row.barcode,
    packWeightG: row.pack_weight_g,
    packWidthMm: row.pack_width_mm,
    packHeightMm: row.pack_height_mm,
    packDepthMm: row.pack_depth_mm,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

export function mapSiteRowToDomain(row: { id: string; code: string; name: string; timezone: string }): Site {
  return siteSchema.parse({
    id: row.id,
    code: row.code,
    name: row.name,
    timezone: row.timezone
  });
}

export function mapFloorRowToDomain(row: { id: string; site_id: string; code: string; name: string; sort_order: number }): Floor {
  return floorSchema.parse({
    id: row.id,
    siteId: row.site_id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order
  });
}

export function mapContainerTypeRowToDomain(row: {
  id: string;
  code: string;
  description: string;
  supports_storage: boolean;
  supports_picking: boolean;
}): ContainerType {
  return containerTypeSchema.parse({
    id: row.id,
    code: row.code,
    description: row.description,
    supportsStorage: row.supports_storage,
    supportsPicking: row.supports_picking
  });
}

export function mapContainerRowToDomain(row: {
  id: string;
  tenant_id: string;
  system_code: string;
  external_code: string | null;
  container_type_id: string;
  status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  operational_role: 'storage' | 'pick';
  parent_container_id?: string | null;
  packaging_profile_id?: string | null;
  is_standard_pack?: boolean | null;
  gross_weight_g?: number | null;
  length_mm?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  received_at?: string | null;
  source_document_type?: string | null;
  source_document_id?: string | null;
  last_receipt_correlation_key?: string | null;
  created_at: string;
  created_by: string | null;
}): Container {
  return containerSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    systemCode: row.system_code,
    externalCode: row.external_code,
    containerTypeId: row.container_type_id,
    status: row.status,
    operationalRole: row.operational_role,
    parentContainerId: row.parent_container_id ?? null,
    packagingProfileId: row.packaging_profile_id ?? null,
    isStandardPack: row.is_standard_pack ?? null,
    grossWeightG: row.gross_weight_g ?? null,
    lengthMm: row.length_mm ?? null,
    widthMm: row.width_mm ?? null,
    heightMm: row.height_mm ?? null,
    receivedAt: row.received_at ?? null,
    sourceDocumentType: row.source_document_type ?? null,
    sourceDocumentId: row.source_document_id ?? null,
    lastReceiptCorrelationKey: row.last_receipt_correlation_key ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by
  });
}

export function mapCellOccupancyRowToDomain(row: {
  tenant_id: string;
  cell_id: string;
  container_id: string;
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  placed_at: string;
}): CellOccupancyRow {
  return cellOccupancyRowSchema.parse({
    tenantId: row.tenant_id,
    cellId: row.cell_id,
    containerId: row.container_id,
    externalCode: row.external_code,
    containerType: row.container_type,
    containerStatus: row.container_status,
    placedAt: row.placed_at
  });
}

export function mapContainerStorageSnapshotRowToDomain(row: {
  tenant_id: string;
  container_id: string;
  system_code: string;
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  inventory_unit_id?: string | null;
  item_ref: string | null;
  product_id?: string | null;
  product?: ProductRow | null;
  quantity: number | null;
  uom: string | null;
  packaging_state?: 'sealed' | 'opened' | 'loose' | null;
  product_packaging_level_id?: string | null;
  pack_count?: number | null;
  container_packaging_profile_id?: string | null;
  container_is_standard_pack?: boolean | null;
  preferred_packaging_profile_id?: string | null;
  preset_usage_status?: 'preferred_match' | 'standard_non_preferred' | 'manual' | 'unknown' | null;
}): ContainerStorageSnapshotRow {
  return containerStorageSnapshotRowSchema.parse({
    tenantId: row.tenant_id,
    containerId: row.container_id,
    systemCode: row.system_code,
    externalCode: row.external_code,
    containerType: row.container_type,
    containerStatus: row.container_status,
    inventoryUnitId: row.inventory_unit_id ?? null,
    itemRef: row.item_ref,
    product: row.product ? mapProductRowToDomain(row.product) : null,
    quantity: row.quantity,
    uom: row.uom,
    packagingState: row.packaging_state ?? null,
    productPackagingLevelId: row.product_packaging_level_id ?? null,
    packCount: row.pack_count ?? null,
    containerPackagingProfileId: row.container_packaging_profile_id ?? null,
    containerIsStandardPack: row.container_is_standard_pack ?? null,
    preferredPackagingProfileId: row.preferred_packaging_profile_id ?? null,
    presetUsageStatus: row.preset_usage_status ?? 'unknown'
  });
}

export function mapCellStorageSnapshotRowToDomain(row: {
  tenant_id: string;
  cell_id: string;
  container_id: string;
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  placed_at: string;
  inventory_unit_id?: string | null;
  item_ref: string | null;
  product_id?: string | null;
  product?: ProductRow | null;
  quantity: number | null;
  uom: string | null;
}): CellStorageSnapshotRow {
  return cellStorageSnapshotRowSchema.parse({
    tenantId: row.tenant_id,
    cellId: row.cell_id,
    containerId: row.container_id,
    externalCode: row.external_code,
    containerType: row.container_type,
    containerStatus: row.container_status,
    placedAt: row.placed_at,
    inventoryUnitId: row.inventory_unit_id ?? null,
    itemRef: row.item_ref,
    product: row.product ? mapProductRowToDomain(row.product) : null,
    quantity: row.quantity,
    uom: row.uom
  });
}

export function mapLocationOccupancyRowToDomain(row: {
  tenant_id: string;
  floor_id: string;
  location_id: string;
  location_code: string;
  location_type: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
  cell_id: string | null;
  container_id: string;
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  placed_at: string;
}): LocationOccupancyRow {
  return locationOccupancyRowSchema.parse({
    tenantId: row.tenant_id,
    floorId: row.floor_id,
    locationId: row.location_id,
    locationCode: row.location_code,
    locationType: row.location_type,
    cellId: row.cell_id,
    containerId: row.container_id,
    externalCode: row.external_code,
    containerType: row.container_type,
    containerStatus: row.container_status,
    placedAt: row.placed_at
  });
}

export function mapLocationStorageSnapshotRowToDomain(row: {
  tenant_id: string;
  floor_id: string;
  location_id: string;
  location_code: string;
  location_type: 'rack_slot' | 'floor' | 'staging' | 'dock' | 'buffer';
  cell_id: string | null;
  container_id: string;
  system_code: string;
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  placed_at: string;
  inventory_unit_id?: string | null;
  item_ref: string | null;
  product_id?: string | null;
  product?: ProductRow | null;
  quantity: number | null;
  uom: string | null;
  packaging_state?: 'sealed' | 'opened' | 'loose' | null;
  product_packaging_level_id?: string | null;
  pack_count?: number | null;
  container_packaging_profile_id?: string | null;
  container_is_standard_pack?: boolean | null;
  preferred_packaging_profile_id?: string | null;
  preset_usage_status?: 'preferred_match' | 'standard_non_preferred' | 'manual' | 'unknown' | null;
}): LocationStorageSnapshotRow {
  return locationStorageSnapshotRowSchema.parse({
    tenantId: row.tenant_id,
    floorId: row.floor_id,
    locationId: row.location_id,
    locationCode: row.location_code,
    locationType: row.location_type,
    cellId: row.cell_id,
    containerId: row.container_id,
    systemCode: row.system_code,
    externalCode: row.external_code,
    containerType: row.container_type,
    containerStatus: row.container_status,
    placedAt: row.placed_at,
    inventoryUnitId: row.inventory_unit_id ?? null,
    itemRef: row.item_ref,
    product: row.product ? mapProductRowToDomain(row.product) : null,
    quantity: row.quantity,
    uom: row.uom,
    packagingState: row.packaging_state ?? null,
    productPackagingLevelId: row.product_packaging_level_id ?? null,
    packCount: row.pack_count ?? null,
    containerPackagingProfileId: row.container_packaging_profile_id ?? null,
    containerIsStandardPack: row.container_is_standard_pack ?? null,
    preferredPackagingProfileId: row.preferred_packaging_profile_id ?? null,
    presetUsageStatus: row.preset_usage_status ?? 'unknown'
  });
}

export function mapCellRowToDomain(row: {
  id: string;
  layout_version_id: string;
  rack_id: string;
  rack_face_id: string;
  rack_section_id: string;
  rack_level_id: string;
  slot_no: number;
  address: string;
  address_sort_key: string;
  cell_code: string;
  x: number | null;
  y: number | null;
  status: 'active' | 'inactive';
}): Cell {
  return cellSchema.parse({
    id: row.id,
    cellCode: row.cell_code,
    layoutVersionId: row.layout_version_id,
    rackId: row.rack_id,
    rackFaceId: row.rack_face_id,
    rackSectionId: row.rack_section_id,
    rackLevelId: row.rack_level_id,
    slotNo: row.slot_no,
    address: parseCellAddress(row.address, row.address_sort_key),
    x: row.x ?? undefined,
    y: row.y ?? undefined,
    status: row.status
  });
}

export function mapInventoryItemRowToDomain(row: {
  id: string;
  tenant_id: string;
  container_id: string;
  item_ref: string;
  product_id?: string | null;
  product?: ProductRow | null;
  quantity: number;
  uom: string;
  created_at: string;
  created_by: string | null;
}): InventoryItem {
  return inventoryItemSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    containerId: row.container_id,
    itemRef: row.item_ref,
    product: row.product ? mapProductRowToDomain(row.product) : null,
    quantity: row.quantity,
    uom: row.uom,
    createdAt: row.created_at,
    createdBy: row.created_by
  });
}

export function mapInventoryUnitRowToDomain(row: {
  id: string;
  tenant_id: string;
  container_id: string;
  product_id: string;
  quantity: number;
  uom: string;
  lot_code: string | null;
  serial_no: string | null;
  expiry_date: string | null;
  status: 'available' | 'reserved' | 'damaged' | 'hold';
  packaging_state: 'sealed' | 'opened' | 'loose';
  product_packaging_level_id?: string | null;
  pack_count?: number | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by?: string | null;
  source_inventory_unit_id?: string | null;
  container_line_id?: string | null;
}): InventoryUnit {
  return inventoryUnitSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    containerId: row.container_id,
    productId: row.product_id,
    quantity: row.quantity,
    uom: row.uom,
    lotCode: row.lot_code,
    serialNo: row.serial_no,
    expiryDate: row.expiry_date,
    status: row.status,
    packagingState: row.packaging_state,
    productPackagingLevelId: row.product_packaging_level_id ?? null,
    packCount: row.pack_count ?? null,
    containerLineId: row.container_line_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by ?? null,
    sourceInventoryUnitId: row.source_inventory_unit_id ?? null
  });
}

export function mapInventoryUnitRowToLegacyInventoryItemDomain(row: {
  id: string;
  tenant_id: string;
  container_id: string;
  product_id: string;
  quantity: number;
  uom: string;
  packaging_state?: 'sealed' | 'opened' | 'loose' | null;
  product_packaging_level_id?: string | null;
  pack_count?: number | null;
  created_at: string;
  created_by: string | null;
  product?: ProductRow | null;
}): InventoryItem {
  return inventoryItemSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    containerId: row.container_id,
    itemRef: buildCatalogProductItemRef(row.product_id),
    product: row.product ? mapProductRowToDomain(row.product) : null,
    quantity: row.quantity,
    uom: row.uom,
    packagingState: row.packaging_state ?? null,
    productPackagingLevelId: row.product_packaging_level_id ?? null,
    packCount: row.pack_count ?? null,
    createdAt: row.created_at,
    createdBy: row.created_by
  });
}

function buildRackLevel(row: RackLevelRow) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    slotCount: row.slot_count,
    structuralDefaultRole: row.structural_default_role ?? 'none'
  };
}

function buildRackSection(row: RackSectionRow, allLevels: RackLevelRow[]) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    length: row.length,
    levels: allLevels
      .filter((level) => level.rack_section_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map(buildRackLevel)
  };
}

function buildRackFace(row: RackFaceRow, allSections: RackSectionRow[], allLevels: RackLevelRow[]) {
  const relationshipMode = row.face_mode ?? (row.is_mirrored ? 'mirrored' : 'independent');
  return {
    id: row.id,
    side: row.side,
    enabled: row.enabled,
    slotNumberingDirection: row.slot_numbering_direction,
    relationshipMode,
    isMirrored: row.is_mirrored,
    mirrorSourceFaceId: row.mirror_source_face_id,
    faceLength: row.face_length ?? undefined,
    sections: allSections
      .filter((section) => section.rack_face_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((section) => buildRackSection(section, allLevels))
  };
}

function buildRackGeometry(row: RackRow): RackGeometry {
  return rackGeometrySchema.parse({
    x: row.x,
    y: row.y,
    totalLength: row.total_length,
    depth: row.depth,
    rotationDeg: row.rotation_deg
  });
}

function buildRackStructure(
  row: RackRow,
  allFaces: RackFaceRow[],
  allSections: RackSectionRow[],
  allLevels: RackLevelRow[]
): RackStructure {
  return rackStructureSchema.parse({
    displayCode: row.display_code,
    kind: row.kind,
    axis: row.axis,
    faces: allFaces
      .filter((face) => face.rack_id === row.id)
      .sort((a, b) => a.side.localeCompare(b.side))
      .map((face) => buildRackFace(face, allSections, allLevels))
  });
}

function buildZone(row: LayoutZoneRow): Zone {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    category: row.category,
    color: row.color,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height
  };
}

function buildWall(row: LayoutWallRow): Wall {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    wallType: row.wall_type,
    x1: row.x1,
    y1: row.y1,
    x2: row.x2,
    y2: row.y2,
    blocksRackPlacement: row.blocks_rack_placement
  };
}

export function mapLayoutDraftBundleToDomain(bundle: {
  layoutVersion: LayoutVersionRow;
  racks: RackRow[];
  rackFaces: RackFaceRow[];
  rackSections: RackSectionRow[];
  rackLevels: RackLevelRow[];
  zones?: LayoutZoneRow[];
  walls?: LayoutWallRow[];
}): LayoutDraft {
  const racks = bundle.racks
    .sort((a, b) => a.display_code.localeCompare(b.display_code))
    .map((row) => ({
      id: row.id,
      geometry: buildRackGeometry(row),
      structure: buildRackStructure(row, bundle.rackFaces, bundle.rackSections, bundle.rackLevels)
    }));
  const zones = (bundle.zones ?? [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(buildZone);
  const walls = (bundle.walls ?? [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(buildWall);

  const lifecycle: LayoutLifecycleInfo = layoutLifecycleInfoSchema.parse({
    layoutVersionId: bundle.layoutVersion.id,
    draftVersion: bundle.layoutVersion.draft_version ?? null,
    floorId: bundle.layoutVersion.floor_id,
    state: bundle.layoutVersion.state,
    versionNo: bundle.layoutVersion.version_no
  });

  return composeLayoutDraft({
    lifecycle,
    racks,
    zones,
    walls
  });
}

// Maps the JSON returned by the get_layout_bundle(uuid) SECURITY DEFINER RPC
// to the domain LayoutDraft type.  The RPC returns a single JSON object with
// the full rack hierarchy already assembled, so no post-processing joins are
// needed here.
export function mapLayoutBundleJsonToDomain(json: unknown): LayoutDraft | null {
  if (json === null || json === undefined) return null;

  const bundle = json as {
    layoutVersionId: string;
    draftVersion?: number | null;
    floorId: string;
    state: string;
    versionNo: number;
    racks: Array<{
      id: string;
      displayCode: string;
      kind: string;
      axis: string;
      x: number;
      y: number;
      totalLength: number;
      depth: number;
      rotationDeg: number;
      faces: Array<{
        id: string;
        side: string;
        enabled: boolean;
        slotNumberingDirection: string;
        relationshipMode?: 'mirrored' | 'independent';
        faceLength: number | null;
        isMirrored: boolean;
        mirrorSourceFaceId: string | null;
        sections: Array<{
          id: string;
          ordinal: number;
          length: number;
          levels: Array<{
            id: string;
            ordinal: number;
            slotCount: number;
            structuralDefaultRole?: 'primary_pick' | 'reserve' | 'none';
          }>;
        }>;
      }>;
    }>;
    zones?: Array<{
      id: string;
      code: string;
      name: string;
      category: ZoneCategory | null;
      color: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
    walls?: Array<{
      id: string;
      code: string;
      name: string | null;
      wallType: WallType | null;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      blocksRackPlacement: boolean;
    }>;
  };

  const lifecycle: LayoutLifecycleInfo = layoutLifecycleInfoSchema.parse({
    layoutVersionId: bundle.layoutVersionId,
    draftVersion: bundle.draftVersion ?? null,
    floorId: bundle.floorId,
    state: bundle.state,
    versionNo: bundle.versionNo
  });

  const racks = bundle.racks.map((rack) => ({
    id: rack.id,
    geometry: rackGeometrySchema.parse({
      x: rack.x,
      y: rack.y,
      totalLength: rack.totalLength,
      depth: rack.depth,
      rotationDeg: rack.rotationDeg
    }),
    structure: rackStructureSchema.parse({
      displayCode: rack.displayCode,
      kind: rack.kind,
      axis: rack.axis,
      faces: rack.faces.map((face) => ({
        id: face.id,
        side: face.side,
        enabled: face.enabled,
        slotNumberingDirection: face.slotNumberingDirection,
        relationshipMode: face.relationshipMode ?? (face.isMirrored ? 'mirrored' : 'independent'),
        isMirrored: face.isMirrored,
        mirrorSourceFaceId: face.mirrorSourceFaceId,
        faceLength: face.faceLength ?? undefined,
        sections: face.sections.map((section) => ({
          id: section.id,
          ordinal: section.ordinal,
          length: section.length,
          levels: section.levels.map((level) => ({
            id: level.id,
            ordinal: level.ordinal,
            slotCount: level.slotCount,
            structuralDefaultRole: level.structuralDefaultRole ?? 'none'
          }))
        }))
      }))
    })
  }));

  const zones = (bundle.zones ?? []).map((zone) => ({
    id: zone.id,
    code: zone.code,
    name: zone.name,
    category: zone.category,
    color: zone.color,
    x: zone.x,
    y: zone.y,
    width: zone.width,
    height: zone.height
  }));

  const walls = (bundle.walls ?? []).map((wall) => ({
    id: wall.id,
    code: wall.code,
    name: wall.name,
    wallType: wall.wallType,
    x1: wall.x1,
    y1: wall.y1,
    x2: wall.x2,
    y2: wall.y2,
    blocksRackPlacement: wall.blocksRackPlacement
  }));

  return composeLayoutDraft({
    lifecycle,
    racks,
    zones,
    walls
  });
}

export function mapPersistedDraftValidationResult(input: unknown): LayoutPersistedDraftValidationResult {
  return layoutValidationResultSchema.parse(input);
}

// ── Orders ────────────────────────────────────────────────────────────────────

export function mapOrderLineRowToDomain(row: {
  id: string;
  order_id: string;
  tenant_id: string;
  product_id: string | null;
  sku: string;
  name: string;
  qty_required: number;
  qty_picked: number;
  reserved_qty?: number;
  status: string;
}): OrderLine {
  return orderLineSchema.parse({
    id: row.id,
    orderId: row.order_id,
    tenantId: row.tenant_id,
    productId: row.product_id,
    sku: row.sku,
    name: row.name,
    qtyRequired: row.qty_required,
    qtyPicked: row.qty_picked,
    reservedQty: row.reserved_qty ?? 0,
    status: row.status
  });
}

export function mapOrderRowToDomain(
  row: {
    id: string;
    tenant_id: string;
    external_number: string;
    status: string;
    priority: number;
    wave_id: string | null;
    wave_name: string | null;
    created_at: string;
    released_at: string | null;
    closed_at: string | null;
  },
  lines: OrderLine[]
): Order {
  return orderSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    externalNumber: row.external_number,
    status: row.status,
    priority: row.priority,
    waveId: row.wave_id,
    waveName: row.wave_name,
    createdAt: row.created_at,
    releasedAt: row.released_at,
    closedAt: row.closed_at,
    lines
  });
}

export function mapOrderSummaryRowToDomain(row: {
  id: string;
  tenant_id: string;
  external_number: string;
  status: string;
  priority: number;
  wave_id: string | null;
  wave_name: string | null;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
  line_count: number;
  unit_count: number;
  picked_unit_count: number;
}): OrderSummary {
  return orderSummarySchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    externalNumber: row.external_number,
    status: row.status,
    priority: row.priority,
    waveId: row.wave_id,
    waveName: row.wave_name,
    createdAt: row.created_at,
    releasedAt: row.released_at,
    closedAt: row.closed_at,
    lineCount: row.line_count,
    unitCount: row.unit_count,
    pickedUnitCount: row.picked_unit_count
  });
}

export function mapWaveSummaryRowToDomain(row: {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  created_at: string;
  released_at: string | null;
  closed_at: string | null;
  total_orders: number;
  ready_orders: number;
  blocking_order_count: number;
}): WaveSummary {
  return waveSummarySchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    releasedAt: row.released_at,
    closedAt: row.closed_at,
    totalOrders: row.total_orders,
    readyOrders: row.ready_orders,
    blockingOrderCount: row.blocking_order_count
  });
}

export function mapWaveRowToDomain(
  row: {
    id: string;
    tenant_id: string;
    name: string;
    status: string;
    created_at: string;
    released_at: string | null;
    closed_at: string | null;
    total_orders: number;
    ready_orders: number;
    blocking_order_count: number;
  },
  orders: OrderSummary[]
): Wave {
  return waveSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    status: row.status,
    createdAt: row.created_at,
    releasedAt: row.released_at,
    closedAt: row.closed_at,
    totalOrders: row.total_orders,
    readyOrders: row.ready_orders,
    blockingOrderCount: row.blocking_order_count,
    orders
  });
}

// ── Pick tasks ────────────────────────────────────────────────────────────────

export function mapPickStepRowToDomain(row: {
  id: string;
  task_id: string;
  tenant_id: string;
  order_id: string | null;
  order_line_id: string | null;
  sequence_no: number;
  sku: string;
  item_name: string;
  qty_required: number;
  qty_picked: number;
  status: string;
  source_cell_id: string | null;
  source_container_id: string | null;
  inventory_unit_id?: string | null;
  pick_container_id?: string | null;
  executed_at?: string | null;
  executed_by?: string | null;
}): PickStep {
  return pickStepSchema.parse({
    id: row.id,
    taskId: row.task_id,
    tenantId: row.tenant_id,
    orderId: row.order_id,
    orderLineId: row.order_line_id,
    sequenceNo: row.sequence_no,
    sku: row.sku,
    itemName: row.item_name,
    qtyRequired: row.qty_required,
    qtyPicked: row.qty_picked,
    status: row.status,
    sourceCellId: row.source_cell_id,
    sourceContainerId: row.source_container_id,
    inventoryUnitId: row.inventory_unit_id ?? null,
    pickContainerId: row.pick_container_id ?? null,
    executedAt: row.executed_at ?? null,
    executedBy: row.executed_by ?? null
  });
}

export function mapPickTaskRowToDomain(
  row: {
    id: string;
    task_number: string;
    tenant_id: string;
    source_type: 'order' | 'wave';
    source_id: string;
    status: string;
    assigned_to: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string;
  },
  steps: PickStep[]
): PickTask {
  return pickTaskSchema.parse({
    id: row.id,
    taskNumber: row.task_number,
    tenantId: row.tenant_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    status: row.status,
    assignedTo: row.assigned_to,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    steps
  });
}

export function mapPickTaskSummaryRowToDomain(row: {
  id: string;
  task_number: string;
  tenant_id: string;
  source_type: 'order' | 'wave';
  source_id: string;
  status: string;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  total_steps: number;
  completed_steps: number;
  exception_steps: number;
}): PickTaskSummary {
  return pickTaskSummarySchema.parse({
    id: row.id,
    taskNumber: row.task_number,
    tenantId: row.tenant_id,
    sourceType: row.source_type,
    sourceId: row.source_id,
    status: row.status,
    assignedTo: row.assigned_to,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    totalSteps: row.total_steps,
    completedSteps: row.completed_steps,
    exceptionSteps: row.exception_steps
  });
}
