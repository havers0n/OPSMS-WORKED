import {
  buildCatalogProductItemRef,
  cellSchema,
  cellStorageSnapshotRowSchema,
  cellOccupancyRowSchema,
  containerSchema,
  containerStorageSnapshotRowSchema,
  inventoryItemSchema,
  inventoryUnitSchema,
  locationOccupancyRowSchema,
  locationStorageSnapshotRowSchema,
  parseCellAddress,
  containerTypeSchema,
  floorSchema,
  layoutDraftSchema,
  layoutValidationResultSchema,
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
  type LayoutValidationResult,
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
  type Wall,
  type WallType,
  type Zone,
  type ZoneCategory
} from '@wos/domain';

type LayoutVersionRow = {
  id: string;
  floor_id: string;
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
  item_ref: string | null;
  product_id?: string | null;
  product?: ProductRow | null;
  quantity: number | null;
  uom: string | null;
}): ContainerStorageSnapshotRow {
  return containerStorageSnapshotRowSchema.parse({
    tenantId: row.tenant_id,
    containerId: row.container_id,
    systemCode: row.system_code,
    externalCode: row.external_code,
    containerType: row.container_type,
    containerStatus: row.container_status,
    itemRef: row.item_ref,
    product: row.product ? mapProductRowToDomain(row.product) : null,
    quantity: row.quantity,
    uom: row.uom
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
  item_ref: string | null;
  product_id?: string | null;
  product?: ProductRow | null;
  quantity: number | null;
  uom: string | null;
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
    itemRef: row.item_ref,
    product: row.product ? mapProductRowToDomain(row.product) : null,
    quantity: row.quantity,
    uom: row.uom
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
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by?: string | null;
  source_inventory_unit_id?: string | null;
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
    createdAt: row.created_at,
    createdBy: row.created_by
  });
}

function buildRackLevel(row: RackLevelRow) {
  return {
    id: row.id,
    ordinal: row.ordinal,
    slotCount: row.slot_count
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
  return {
    id: row.id,
    side: row.side,
    enabled: row.enabled,
    slotNumberingDirection: row.slot_numbering_direction,
    isMirrored: row.is_mirrored,
    mirrorSourceFaceId: row.mirror_source_face_id,
    faceLength: row.face_length ?? undefined,
    sections: allSections
      .filter((section) => section.rack_face_id === row.id)
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((section) => buildRackSection(section, allLevels))
  };
}

function buildRack(row: RackRow, allFaces: RackFaceRow[], allSections: RackSectionRow[], allLevels: RackLevelRow[]) {
  return {
    id: row.id,
    displayCode: row.display_code,
    kind: row.kind,
    axis: row.axis,
    x: row.x,
    y: row.y,
    totalLength: row.total_length,
    depth: row.depth,
    rotationDeg: row.rotation_deg,
    faces: allFaces
      .filter((face) => face.rack_id === row.id)
      .sort((a, b) => a.side.localeCompare(b.side))
      .map((face) => buildRackFace(face, allSections, allLevels))
  };
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
    .map((row) => buildRack(row, bundle.rackFaces, bundle.rackSections, bundle.rackLevels));
  const zones = (bundle.zones ?? [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(buildZone);
  const walls = (bundle.walls ?? [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(buildWall);

  return layoutDraftSchema.parse({
    layoutVersionId: bundle.layoutVersion.id,
    floorId: bundle.layoutVersion.floor_id,
    state: bundle.layoutVersion.state,
    versionNo: bundle.layoutVersion.version_no,
    rackIds: racks.map((rack) => rack.id),
    racks: Object.fromEntries(racks.map((rack) => [rack.id, rack])),
    zoneIds: zones.map((zone) => zone.id),
    zones: Object.fromEntries(zones.map((zone) => [zone.id, zone])),
    wallIds: walls.map((wall) => wall.id),
    walls: Object.fromEntries(walls.map((wall) => [wall.id, wall]))
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
        faceLength: number | null;
        isMirrored: boolean;
        mirrorSourceFaceId: string | null;
        sections: Array<{
          id: string;
          ordinal: number;
          length: number;
          levels: Array<{ id: string; ordinal: number; slotCount: number }>;
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

  const racks = bundle.racks.map((r) => ({
    id: r.id,
    displayCode: r.displayCode,
    kind: r.kind,
    axis: r.axis,
    x: r.x,
    y: r.y,
    totalLength: r.totalLength,
    depth: r.depth,
    rotationDeg: r.rotationDeg,
    faces: r.faces.map((f) => ({
      id: f.id,
      side: f.side,
      enabled: f.enabled,
      slotNumberingDirection: f.slotNumberingDirection,
      isMirrored: f.isMirrored,
      mirrorSourceFaceId: f.mirrorSourceFaceId,
      faceLength: f.faceLength ?? undefined,
      sections: f.sections.map((s) => ({
        id: s.id,
        ordinal: s.ordinal,
        length: s.length,
        levels: s.levels.map((l) => ({
          id: l.id,
          ordinal: l.ordinal,
          slotCount: l.slotCount
        }))
      }))
    }))
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

  return layoutDraftSchema.parse({
    layoutVersionId: bundle.layoutVersionId,
    floorId: bundle.floorId,
    state: bundle.state,
    versionNo: bundle.versionNo,
    rackIds: racks.map((r) => r.id),
    racks: Object.fromEntries(racks.map((r) => [r.id, r])),
    zoneIds: zones.map((zone) => zone.id),
    zones: Object.fromEntries(zones.map((zone) => [zone.id, zone])),
    wallIds: walls.map((wall) => wall.id),
    walls: Object.fromEntries(walls.map((wall) => [wall.id, wall]))
  });
}

export function mapValidationResult(input: unknown): LayoutValidationResult {
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
