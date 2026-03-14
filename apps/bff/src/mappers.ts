import {
  cellSchema,
  cellStorageSnapshotRowSchema,
  cellOccupancyRowSchema,
  containerSchema,
  containerStorageSnapshotRowSchema,
  inventoryItemSchema,
  parseCellAddress,
  containerTypeSchema,
  floorSchema,
  layoutDraftSchema,
  layoutValidationResultSchema,
  siteSchema,
  type CellStorageSnapshotRow,
  type CellOccupancyRow,
  type Cell,
  type Container,
  type ContainerStorageSnapshotRow,
  type ContainerType,
  type Floor,
  type InventoryItem,
  type LayoutDraft,
  type LayoutValidationResult,
  type Site
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

export function mapContainerTypeRowToDomain(row: { id: string; code: string; description: string }): ContainerType {
  return containerTypeSchema.parse({
    id: row.id,
    code: row.code,
    description: row.description
  });
}

export function mapContainerRowToDomain(row: {
  id: string;
  tenant_id: string;
  external_code: string | null;
  container_type_id: string;
  status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  created_at: string;
  created_by: string | null;
}): Container {
  return containerSchema.parse({
    id: row.id,
    tenantId: row.tenant_id,
    externalCode: row.external_code,
    containerTypeId: row.container_type_id,
    status: row.status,
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
  external_code: string | null;
  container_type: string;
  container_status: 'active' | 'quarantined' | 'closed' | 'lost' | 'damaged';
  item_ref: string | null;
  quantity: number | null;
  uom: string | null;
}): ContainerStorageSnapshotRow {
  return containerStorageSnapshotRowSchema.parse({
    tenantId: row.tenant_id,
    containerId: row.container_id,
    externalCode: row.external_code,
    containerType: row.container_type,
    containerStatus: row.container_status,
    itemRef: row.item_ref,
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

export function mapLayoutDraftBundleToDomain(bundle: {
  layoutVersion: LayoutVersionRow;
  racks: RackRow[];
  rackFaces: RackFaceRow[];
  rackSections: RackSectionRow[];
  rackLevels: RackLevelRow[];
}): LayoutDraft {
  const racks = bundle.racks
    .sort((a, b) => a.display_code.localeCompare(b.display_code))
    .map((row) => buildRack(row, bundle.rackFaces, bundle.rackSections, bundle.rackLevels));

  return layoutDraftSchema.parse({
    layoutVersionId: bundle.layoutVersion.id,
    floorId: bundle.layoutVersion.floor_id,
    state: bundle.layoutVersion.state,
    rackIds: racks.map((rack) => rack.id),
    racks: Object.fromEntries(racks.map((rack) => [rack.id, rack]))
  });
}

export function mapValidationResult(input: unknown): LayoutValidationResult {
  return layoutValidationResultSchema.parse(input);
}
