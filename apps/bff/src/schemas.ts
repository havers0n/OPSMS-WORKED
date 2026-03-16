import { z } from 'zod';
import {
  cellStorageSnapshotRowSchema,
  cellOccupancyRowSchema,
  floorCellOccupancyResponseSchema,
  cellSchema,
  containerCurrentLocationSchema,
  containerSchema,
  containerStatusSchema,
  containerStorageSnapshotRowSchema,
  canonicalMoveContainerResultSchema,
  canonicalTransferInventoryResultSchema,
  inventoryItemSchema,
  locationOccupancyResponseSchema,
  locationReferenceSchema,
  locationStorageSnapshotResponseSchema,
  moveContainerResultSchema,
  moveContainerToLocationBodySchema,
  pickPartialInventoryUnitBodySchema,
  placementCommandResponseSchema,
  placeContainerRequestSchema,
  moveContainerRequestSchema,
  placeContainerResultSchema,
  productSchema,
  removeContainerRequestSchema,
  removeContainerResultSchema,
  transferInventoryUnitBodySchema,
  containerTypeSchema,
  floorSchema,
  floorWorkspaceSchema,
  layoutDraftSchema,
  layoutPublishResultSchema,
  layoutValidationResultSchema,
  publishedLayoutSummarySchema,
  rackAxisSchema,
  rackFaceSideSchema,
  rackKindSchema,
  siteSchema,
  slotNumberingDirectionSchema,
  orderSchema,
  orderSummarySchema,
  orderStatusSchema,
  orderLineSchema,
  pickTaskSchema,
  pickTaskSummarySchema,
  pickStepSchema,
  waveSchema,
  waveSummarySchema,
  waveStatusSchema
} from '@wos/domain';

export const createSiteBodySchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  timezone: z.string().trim().min(1)
});

export const createFloorBodySchema = z.object({
  siteId: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  sortOrder: z.number().int().min(0)
});

export const createContainerBodySchema = z.object({
  containerTypeId: z.string().uuid(),
  externalCode: z.string().trim().min(1)
});

export const addInventoryToContainerBodySchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  uom: z.string().trim().min(1)
});

export const createInventoryItemBodySchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().min(0),
  uom: z.string().trim().min(1)
});

export const placeContainerBodySchema = z.object({
  cellId: z.string().uuid()
});

export const moveContainerBodySchema = z.object({
  targetCellId: z.string().uuid()
});

export const moveContainerToLocationRequestBodySchema = moveContainerToLocationBodySchema;
export const transferInventoryUnitRequestBodySchema = transferInventoryUnitBodySchema;
export const pickPartialInventoryUnitRequestBodySchema = pickPartialInventoryUnitBodySchema;

export const placementPlaceBodySchema = placeContainerRequestSchema;
export const placementRemoveBodySchema = removeContainerRequestSchema;
export const placementMoveBodySchema = moveContainerRequestSchema;

export const createLayoutDraftBodySchema = z.object({
  floorId: z.string().uuid()
});

const saveRackLevelPayloadSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().min(1),
  slotCount: z.number().int().min(1)
});

const saveRackSectionPayloadSchema = z.object({
  id: z.string().uuid(),
  ordinal: z.number().int().min(1),
  length: z.number().positive(),
  levels: z.array(saveRackLevelPayloadSchema)
});

const saveRackFacePayloadSchema = z.object({
  id: z.string().uuid(),
  side: rackFaceSideSchema,
  enabled: z.boolean(),
  slotNumberingDirection: slotNumberingDirectionSchema,
  isMirrored: z.boolean(),
  mirrorSourceFaceId: z.string().uuid().nullable(),
  faceLength: z.number().positive().optional(),
  sections: z.array(saveRackSectionPayloadSchema)
});

const saveRackPayloadSchema = z.object({
  id: z.string().uuid(),
  displayCode: z.string().trim().min(1),
  kind: rackKindSchema,
  axis: rackAxisSchema,
  x: z.number(),
  y: z.number(),
  totalLength: z.number().positive(),
  depth: z.number().positive(),
  rotationDeg: z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]),
  faces: z.array(saveRackFacePayloadSchema)
});

export const saveLayoutDraftBodySchema = z.object({
  layoutDraft: z.object({
    layoutVersionId: z.string().uuid(),
    racks: z.array(saveRackPayloadSchema)
  })
});

export const idResponseSchema = z.object({
  id: z.string().uuid()
});

export const tenantMembershipSchema = z.object({
  tenantId: z.string().uuid(),
  tenantCode: z.string().trim().min(1),
  tenantName: z.string().trim().min(1),
  role: z.enum(['platform_admin', 'tenant_admin', 'operator'])
});

export const currentWorkspaceResponseSchema = z.object({
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    displayName: z.string().trim().min(1)
  }),
  currentTenantId: z.string().uuid().nullable(),
  memberships: z.array(tenantMembershipSchema)
});

export const layoutVersionIdResponseSchema = z.object({
  layoutVersionId: z.string().uuid()
});

export const sitesResponseSchema = z.array(siteSchema);
export const floorsResponseSchema = z.array(floorSchema);
export const containerTypesResponseSchema = z.array(containerTypeSchema);
export const containersResponseSchema = z.array(containerSchema);
export const containerResponseSchema = containerSchema;
export const createContainerResponseSchema = z.object({
  containerId: z.string().uuid(),
  externalCode: z.string().trim().min(1),
  containerTypeId: z.string().uuid(),
  status: containerStatusSchema
});
export const cellsResponseSchema = z.array(cellSchema);
export const cellOccupancyResponseSchema = z.array(cellOccupancyRowSchema);
export const floorCellOccupancyRowsResponseSchema = floorCellOccupancyResponseSchema;
export const containerStorageSnapshotResponseSchema = z.array(containerStorageSnapshotRowSchema);
export const cellStorageSnapshotResponseSchema = z.array(cellStorageSnapshotRowSchema);
export const locationOccupancyRowsResponseSchema = locationOccupancyResponseSchema;
export const locationStorageSnapshotRowsResponseSchema = locationStorageSnapshotResponseSchema;
export const locationReferenceResponseSchema = locationReferenceSchema;
export const containerCurrentLocationResponseSchema = containerCurrentLocationSchema;

/**
 * Response shape for GET /api/rack-sections/:sectionId/slots/:slotNo/storage.
 * `published` is true when at least one persisted cell UUID was found for this
 * section+slot (i.e. the layout version has been published at least once).
 * `rows` contains the storage snapshot rows; an empty array for a published
 * layout means the slot is genuinely empty.
 */
export const cellSlotStorageResponseSchema = z.object({
  published: z.boolean(),
  rows: z.array(cellStorageSnapshotRowSchema)
});
export type CellSlotStorageResponse = z.infer<typeof cellSlotStorageResponseSchema>;
export const inventoryItemsResponseSchema = z.array(inventoryItemSchema);
export const inventoryItemResponseSchema = inventoryItemSchema;
export const addInventoryToContainerResponseSchema = inventoryItemSchema;
export const productsResponseSchema = z.array(productSchema);
export const productResponseSchema = productSchema;
export const productCatalogResponseSchema = z.object({
  items: z.array(productSchema),
  total: z.number().int().min(0),
  activeTotal: z.number().int().min(0),
  limit: z.number().int().positive(),
  offset: z.number().int().min(0)
});
export const placeContainerResponseSchema = placeContainerResultSchema;
export const removeContainerResponseSchema = removeContainerResultSchema;
export const moveContainerResponseSchema = moveContainerResultSchema;
export const moveContainerToLocationResponseSchema = canonicalMoveContainerResultSchema;
export const transferInventoryUnitResponseSchema = canonicalTransferInventoryResultSchema;
export const pickPartialInventoryUnitResponseSchema = canonicalTransferInventoryResultSchema;
export const placementCommandResponse = placementCommandResponseSchema;
export const layoutDraftResponseSchema = layoutDraftSchema.nullable();
export const floorWorkspaceResponseSchema = floorWorkspaceSchema;
export const publishedLayoutSummaryResponseSchema = publishedLayoutSummarySchema.nullable();
export const validationResponseSchema = layoutValidationResultSchema;
export const publishResponseSchema = layoutPublishResultSchema;

// ── Orders ────────────────────────────────────────────────────────────────────

export const createOrderBodySchema = z.object({
  externalNumber: z.string().trim().min(1),
  priority: z.number().int().min(0).optional().default(0),
  waveId: z.string().uuid().optional()
});

export const addOrderLineBodySchema = z.object({
  productId: z.string().uuid(),
  qtyRequired: z.number().int().positive()
});

export const transitionOrderStatusBodySchema = z.object({
  status: orderStatusSchema
});

export const ordersResponseSchema = z.array(orderSummarySchema);
export const orderResponseSchema = orderSchema;
export const orderLineResponseSchema = orderLineSchema;

export { orderStatusSchema, orderSummarySchema, orderSchema, orderLineSchema };

// Waves

export const createWaveBodySchema = z.object({
  name: z.string().trim().min(1)
});

export const transitionWaveStatusBodySchema = z.object({
  status: waveStatusSchema
});

export const attachWaveOrderBodySchema = z.object({
  orderId: z.string().uuid()
});

export const wavesResponseSchema = z.array(waveSummarySchema);
export const waveResponseSchema = waveSchema;

export { waveStatusSchema, waveSummarySchema, waveSchema };

// ── Pick tasks ────────────────────────────────────────────────────────────────

export const pickTaskResponseSchema = pickTaskSchema;
export const pickTaskSummaryResponseSchema = pickTaskSummarySchema;
export const pickTasksResponseSchema = z.array(pickTaskSummarySchema);

export { pickTaskSchema, pickTaskSummarySchema, pickStepSchema };

// ── Error ─────────────────────────────────────────────────────────────────────

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  errorId: z.string()
});
