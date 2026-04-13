import { z } from 'zod';
import {
  cellStorageSnapshotRowSchema,
  cellOccupancyRowSchema,
  cellSchema,
  layoutChangeClassSchema,
  containerCurrentLocationSchema,
  containerOperationalRoleSchema,
  containerSchema,
  containerStatusSchema,
  containerStorageSnapshotRowSchema,
  canonicalMoveContainerResultSchema,
  canonicalTransferInventoryResultSchema,
  inventoryItemSchema,
  locationOccupancyResponseSchema,
  operationsCellRuntimeResponseSchema,
  locationReferenceSchema,
  locationStorageSnapshotResponseSchema,
  moveContainerToLocationBodySchema,
  nonRackLocationRefsSchema,
  pickPartialInventoryUnitBodySchema,
  productSchema,
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
  wallTypeSchema,
  zoneCategorySchema,
  orderSchema,
  orderSummarySchema,
  orderStatusSchema,
  orderLineSchema,
  pickTaskSchema,
  pickTaskSummarySchema,
  pickStepSchema,
  pickTaskDetailSchema,
  waveSchema,
  waveSummarySchema,
  waveStatusSchema,
  rackInspectorPayloadSchema
} from '@wos/domain';

// ── Rack Inspector ──────────────────────────────────────────────────────────

export { rackInspectorPayloadSchema };

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
  externalCode: z.string().trim().min(1).optional(),
  operationalRole: containerOperationalRoleSchema.default('storage')
});

export const listContainersQuerySchema = z.object({
  operationalRole: containerOperationalRoleSchema.optional()
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

export const moveContainerToLocationRequestBodySchema = moveContainerToLocationBodySchema;
export const transferInventoryUnitRequestBodySchema = transferInventoryUnitBodySchema;
export const pickPartialInventoryUnitRequestBodySchema = pickPartialInventoryUnitBodySchema;

export const placementPlaceAtLocationBodySchema = z.object({
  containerId: z.string().uuid(),
  locationId: z.string().uuid()
});

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

const saveZonePayloadSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  category: zoneCategorySchema.optional().nullable(),
  color: z.string().trim().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive()
});

const saveWallPayloadSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1).optional().nullable(),
  wallType: wallTypeSchema.optional().nullable(),
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
  blocksRackPlacement: z.boolean()
}).refine(
  (wall) => wall.x1 === wall.x2 || wall.y1 === wall.y2,
  'Walls must be axis-aligned.'
).refine(
  (wall) => wall.x1 !== wall.x2 || wall.y1 !== wall.y2,
  'Walls must have non-zero length.'
);

export const saveLayoutDraftBodySchema = z.object({
  layoutDraft: z.object({
    layoutVersionId: z.string().uuid(),
    draftVersion: z.number().int().min(0).nullable().optional(),
    racks: z.array(saveRackPayloadSchema),
    zones: z.array(saveZonePayloadSchema).default([]),
    walls: z.array(saveWallPayloadSchema).default([])
  })
});

export type SaveLayoutDraftPayload = z.infer<typeof saveLayoutDraftBodySchema>['layoutDraft'];

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

export const saveLayoutDraftResponseSchema = z.object({
  layoutVersionId: z.string().uuid(),
  draftVersion: z.number().int().min(0).nullable(),
  changeClass: layoutChangeClassSchema
});

export const publishLayoutDraftBodySchema = z.object({
  expectedDraftVersion: z.number().int().min(0)
});

export const sitesResponseSchema = z.array(siteSchema);
export const floorsResponseSchema = z.array(floorSchema);
export const containerTypesResponseSchema = z.array(containerTypeSchema);
export const containersResponseSchema = z.array(containerSchema);
export const containerResponseSchema = containerSchema;
export const createContainerResponseSchema = z.object({
  containerId: z.string().uuid(),
  systemCode: z.string().trim().min(1),
  externalCode: z.string().trim().min(1).nullable(),
  containerTypeId: z.string().uuid(),
  status: containerStatusSchema,
  operationalRole: containerOperationalRoleSchema
});
export const cellsResponseSchema = z.array(cellSchema);
export const cellOccupancyResponseSchema = z.array(cellOccupancyRowSchema);
export const containerStorageSnapshotResponseSchema = z.array(containerStorageSnapshotRowSchema);
export const cellStorageSnapshotResponseSchema = z.array(cellStorageSnapshotRowSchema);
export const locationOccupancyRowsResponseSchema = locationOccupancyResponseSchema;
export const locationStorageSnapshotRowsResponseSchema = locationStorageSnapshotResponseSchema;
export const locationReferenceResponseSchema = locationReferenceSchema;
export const operationsCellsRuntimeResponseSchema = operationsCellRuntimeResponseSchema;
export const containerCurrentLocationResponseSchema = containerCurrentLocationSchema;

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
export const removeContainerResponseSchema = removeContainerResultSchema;
export const moveContainerToLocationResponseSchema = canonicalMoveContainerResultSchema;
export const transferInventoryUnitResponseSchema = canonicalTransferInventoryResultSchema;
export const pickPartialInventoryUnitResponseSchema = canonicalTransferInventoryResultSchema;
export const layoutDraftResponseSchema = layoutDraftSchema.nullable();
export const floorWorkspaceResponseSchema = floorWorkspaceSchema;
export const publishedLayoutSummaryResponseSchema = publishedLayoutSummarySchema.nullable();
export const persistedDraftValidationResponseSchema = layoutValidationResultSchema;
export const publishResponseSchema = layoutPublishResultSchema;
export const nonRackLocationsResponseSchema = nonRackLocationRefsSchema;

export const patchLocationGeometryBodySchema = z.object({
  floorX: z.number().nullable(),
  floorY: z.number().nullable()
});

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
export const pickTaskDetailResponseSchema = pickTaskDetailSchema;

export { pickTaskSchema, pickTaskSummarySchema, pickStepSchema, pickTaskDetailSchema };

// ── Picking / allocation ───────────────────────────────────────────────────────

export const allocatePickStepsResponseSchema = z.object({
  taskId: z.string().uuid(),
  allocated: z.number().int().min(0),
  needsReplenishment: z.number().int().min(0)
});

// ── Picking / execution ────────────────────────────────────────────────────────

export const executePickStepBodySchema = z.object({
  qtyActual: z.number().int().positive(),
  pickContainerId: z.string().uuid()
});

export const executePickStepResponseSchema = z.object({
  stepId: z.string().uuid(),
  status: z.enum(['picked', 'partial']),
  qtyPicked: z.number().int().min(0),
  taskId: z.string().uuid(),
  taskStatus: z.enum(['in_progress', 'completed', 'completed_with_exceptions']),
  orderStatus: z.string().nullable(),
  waveStatus: z.string().nullable(),
  movementId: z.string().uuid().nullable()
});

// ── Error ─────────────────────────────────────────────────────────────────────

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
  errorId: z.string()
});
