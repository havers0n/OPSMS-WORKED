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
  canonicalSwapContainersResultSchema,
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
  swapContainersBodySchema,
  containerTypeSchema,
  floorSchema,
  floorAisleTopologySchema,
  floorWorkspaceSchema,
  layoutDraftSchema,
  layoutPublishRequestSchema,
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
  rackInspectorPayloadSchema,
  locationEffectiveRoleSchema,
  productUnitProfileSchema,
  productPackagingLevelSchema,
  inventoryPackagingStateSchema,
  storagePresetSchema,
  createStoragePresetBodySchema,
  patchStoragePresetBodySchema,
  createContainerFromStoragePresetBodySchema,
  createContainerFromStoragePresetResultSchema,
  setPreferredStoragePresetBodySchema,
  manualShiftSessionSchema,
  manualShiftLineSchema,
  manualShiftOrderSchema,
  manualShiftOrderErrorSchema,
  manualShiftOrderCheckUnitSchema,
  manualShiftOrderAshlamaSchema,
  manualShiftOrderEventSchema,
  manualShiftOrderItemSchema,
  manualShiftOrderDetailSchema,
  manualShiftOrderAshlamaStatusSchema,
  manualShiftOrderCheckUnitStatusSchema,
  manualShiftLineSummarySchema,
  manualShiftTodayResponseSchema as manualShiftTodayDtoSchema,
  manualShiftPeopleSummarySchema,
  manualShiftDaySummarySchema,
  manualShiftBulkAddInputRowSchema,
  manualShiftBulkAddResultSchema,
  manualShiftOrderStatusSchema,
  manualShiftOrderSizeSchema,
  manualShiftOrderErrorTypeSchema,
  manualShiftWorkerSchema,
  manualShiftWorkerRoleSchema,
  openAshlamaBoardItemSchema,
  bindableUserSchema
  ,
  dailyManualShiftImportPreviewSchema,
  manualShiftMonthlyPreviewSchema,
  manualShiftMonthlyApplyResponseSchema as manualShiftMonthlyApplyResponseDtoSchema,
  manualShiftMonthlyReplaceSafetySchema as manualShiftMonthlyReplaceSafetyDtoSchema,
  applyDailyManualShiftImportRequestSchema,
  applyDailyManualShiftImportResponseSchema,
  warehouseLabelPreviewRequestSchema as warehouseLabelPreviewRequestDtoSchema,
  warehouseLabelPreviewResponseSchema as warehouseLabelPreviewResponseDtoSchema,
  rackSlotLocationRefsResponseSchema as rackSlotLocationRefsResponseDtoSchema,
  manualShiftWorkHierarchyResponseSchema
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
  uom: z.string().trim().min(1),
  packagingState: inventoryPackagingStateSchema.optional(),
  productPackagingLevelId: z.string().uuid().nullable().optional(),
  packCount: z.number().int().positive().nullable().optional(),
  receiptCorrelationKey: z.string().uuid()
});

export const createInventoryItemBodySchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().min(0),
  uom: z.string().trim().min(1)
});

export const moveContainerToLocationRequestBodySchema = moveContainerToLocationBodySchema;
export const swapContainersRequestBodySchema = swapContainersBodySchema;
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
  slotCount: z.number().int().min(1),
  structuralDefaultRole: z.enum(['primary_pick', 'reserve', 'none']).optional().default('none')
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
  relationshipMode: z.enum(['mirrored', 'independent']).optional(),
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
  isLocked: z.boolean().optional().default(false),
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

export const publishLayoutDraftBodySchema = layoutPublishRequestSchema;

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
export const swapContainersResponseSchema = canonicalSwapContainersResultSchema;
export const transferInventoryUnitResponseSchema = canonicalTransferInventoryResultSchema;
export const pickPartialInventoryUnitResponseSchema = canonicalTransferInventoryResultSchema;
export const layoutDraftResponseSchema = layoutDraftSchema.nullable();
export const floorAisleTopologyResponseSchema = floorAisleTopologySchema;
export const floorWorkspaceResponseSchema = floorWorkspaceSchema;
export const publishedLayoutSummaryResponseSchema = publishedLayoutSummarySchema.nullable();
export const persistedDraftValidationResponseSchema = layoutValidationResultSchema;
export const publishResponseSchema = layoutPublishResultSchema;
export const nonRackLocationsResponseSchema = nonRackLocationRefsSchema;
export const effectiveLocationRoleQuerySchema = z.object({
  productId: z.string().uuid()
});
export const effectiveLocationRoleResponseSchema = locationEffectiveRoleSchema;

// ── Product Unit Profile ─────────────────────────────────────────────────────

export const productUnitProfileResponseSchema = productUnitProfileSchema;

export const upsertUnitProfileBodySchema = z.object({
  unitWeightG: z.number().int().positive().nullable().optional(),
  unitWidthMm: z.number().int().positive().nullable().optional(),
  unitHeightMm: z.number().int().positive().nullable().optional(),
  unitDepthMm: z.number().int().positive().nullable().optional(),
  weightClass: z.enum(['light', 'medium', 'heavy', 'very_heavy']).nullable().optional(),
  sizeClass: z.enum(['small', 'medium', 'large', 'oversized']).nullable().optional()
});

// ── Product Packaging Levels ─────────────────────────────────────────────────

export const productPackagingLevelResponseSchema = productPackagingLevelSchema;
export const productPackagingLevelsResponseSchema = z.array(productPackagingLevelSchema);
export const storagePresetResponseSchema = storagePresetSchema;
export const storagePresetsResponseSchema = z.array(storagePresetSchema);
export const createStoragePresetRequestBodySchema = createStoragePresetBodySchema;
export const patchStoragePresetRequestBodySchema = patchStoragePresetBodySchema;
export const createContainerFromStoragePresetRequestBodySchema = createContainerFromStoragePresetBodySchema;
export const createContainerFromStoragePresetResponseSchema = createContainerFromStoragePresetResultSchema;
export const setPreferredStoragePresetRequestBodySchema = setPreferredStoragePresetBodySchema;

export const createPackagingLevelBodySchema = z.object({
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  baseUnitQty: z.number().int().min(1),
  isBase: z.boolean(),
  canPick: z.boolean().optional().default(true),
  canStore: z.boolean().optional().default(true),
  isDefaultPickUom: z.boolean().optional().default(false),
  barcode: z.string().nullable().optional(),
  packWeightG: z.number().int().positive().nullable().optional(),
  packWidthMm: z.number().int().positive().nullable().optional(),
  packHeightMm: z.number().int().positive().nullable().optional(),
  packDepthMm: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional().default(0),
  isActive: z.boolean().optional().default(true)
});

export const patchPackagingLevelBodySchema = z.object({
  code: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1).optional(),
  baseUnitQty: z.number().int().min(1).optional(),
  isBase: z.boolean().optional(),
  canPick: z.boolean().optional(),
  canStore: z.boolean().optional(),
  isDefaultPickUom: z.boolean().optional(),
  barcode: z.string().nullable().optional(),
  packWeightG: z.number().int().positive().nullable().optional(),
  packWidthMm: z.number().int().positive().nullable().optional(),
  packHeightMm: z.number().int().positive().nullable().optional(),
  packDepthMm: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional()
});

// Batch replace-all: each item in the set (id optional — present means update, absent means create)
export const packagingLevelSetItemSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1),
  name: z.string().trim().min(1),
  baseUnitQty: z.number().int().min(1),
  isBase: z.boolean(),
  canPick: z.boolean(),
  canStore: z.boolean(),
  isDefaultPickUom: z.boolean(),
  barcode: z.string().nullable().optional(),
  packWeightG: z.number().int().positive().nullable().optional(),
  packWidthMm: z.number().int().positive().nullable().optional(),
  packHeightMm: z.number().int().positive().nullable().optional(),
  packDepthMm: z.number().int().positive().nullable().optional(),
  sortOrder: z.number().int(),
  isActive: z.boolean()
});

export const setPackagingLevelsBodySchema = z.array(packagingLevelSetItemSchema);

export const patchLocationGeometryBodySchema = z.object({
  floorX: z.number().nullable(),
  floorY: z.number().nullable()
});

// Manual Shift Control

export const createManualShiftBodySchema = z.object({
  date: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1)
});

export const createManualShiftLineBodySchema = z.object({
  name: z.string().trim().min(1),
  sortOrder: z.number().int().default(0)
});

export const patchManualShiftLineBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().optional()
});

export const createManualShiftWorkerBodySchema = z.object({
  name: z.string().trim().min(1),
  role: manualShiftWorkerRoleSchema.default('picker'),
  sortOrder: z.number().int().default(0),
  authUserId: z.string().uuid().nullable().optional()
});

export const patchManualShiftWorkerBodySchema = z.object({
  name: z.string().trim().min(1).optional(),
  role: manualShiftWorkerRoleSchema.optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  authUserId: z.string().uuid().nullable().optional()
});

export const createManualShiftOrderBodySchema = z.object({
  pointName: z.string().trim().min(1),
  orderNumber: z.string().trim().min(1).nullable().optional(),
  customerName: z.string().trim().min(1).nullable().optional(),
  pickerName: z.string().trim().min(1).nullable().optional(),
  pickerWorkerId: z.string().uuid().nullable().optional(),
  checkerName: z.string().trim().min(1).nullable().optional(),
  lineCount: z.number().int().positive().nullable().optional(),
  palletCount: z.number().min(0).nullable().optional(),
  size: manualShiftOrderSizeSchema.optional(),
  status: manualShiftOrderStatusSchema.optional(),
  comment: z.string().trim().min(1).nullable().optional()
});

export const patchManualShiftOrderBodySchema = z.object({
  pointName: z.string().trim().min(1).nullable().optional(),
  orderNumber: z.string().trim().min(1).nullable().optional(),
  customerName: z.string().trim().min(1).nullable().optional(),
  pickerName: z.string().trim().min(1).nullable().optional(),
  pickerWorkerId: z.string().uuid().nullable().optional(),
  checkerName: z.string().trim().min(1).nullable().optional(),
  lineCount: z.number().int().positive().nullable().optional(),
  palletCount: z.number().min(0).nullable().optional(),
  size: manualShiftOrderSizeSchema.optional(),
  comment: z.string().trim().min(1).nullable().optional(),
  startedAt: z.string().nullable().optional(),
  finishedAt: z.string().nullable().optional(),
  checkedAt: z.string().nullable().optional()
});

export const transitionManualShiftOrderStatusBodySchema = z.object({
  status: manualShiftOrderStatusSchema
});

export const createManualShiftOrderErrorBodySchema = z.object({
  type: manualShiftOrderErrorTypeSchema,
  comment: z.string().trim().min(1).nullable().optional()
});

export const createManualShiftOrderCheckUnitBodySchema = z.object({
  note: z.string().trim().min(1).nullable().optional(),
  reason: z.string().trim().min(1).nullable().optional()
});

export const patchManualShiftOrderCheckUnitBodySchema = z.object({
  note: z.string().trim().min(1).nullable().optional(),
  reason: z.string().trim().min(1).nullable().optional()
});

export const transitionManualShiftOrderCheckUnitStatusBodySchema = z.object({
  status: manualShiftOrderCheckUnitStatusSchema,
  reason: z.string().trim().min(1).nullable().optional(),
  note: z.string().trim().min(1).nullable().optional()
}).superRefine((value, ctx) => {
  if (value.status === 'returned') {
    const normalizedReason = value.reason?.trim();
    if (!normalizedReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reason'],
        message: 'reason is required when status is returned'
      });
    }
  }
});

export const createManualShiftOrderAshlamaBodySchema = z.object({
  checkUnitId: z.string().uuid().nullable().optional(),
  text: z.string().trim().min(1)
});

export const patchManualShiftOrderAshlamaBodySchema = z.object({
  status: manualShiftOrderAshlamaStatusSchema
});

export const manualShiftDeleteRestoreBodySchema = z.object({
  reason: z.string().trim().min(1).optional(),
  actorName: z.string().trim().min(1).optional()
});

export const bulkCreateManualShiftOrdersBodySchema = z.union([
  z.object({
    rawText: z.string().trim().min(1),
    rows: z.undefined().optional()
  }),
  z.object({
    rawText: z.undefined().optional(),
    rows: z.array(
      manualShiftBulkAddInputRowSchema.pick({
        raw: true,
        pointName: true,
        orderNumber: true,
        pickerName: true,
        lineCount: true,
        palletCount: true,
        size: true
      })
    ).min(1)
  })
]);

export const manualShiftSessionResponseSchema = manualShiftSessionSchema;
export const manualShiftLineResponseSchema = manualShiftLineSchema;
export const manualShiftOrderResponseSchema = manualShiftOrderSchema;
export const manualShiftOrderDetailResponseSchema = manualShiftOrderDetailSchema;
export const manualShiftOrderErrorResponseSchema = manualShiftOrderErrorSchema;
export const manualShiftOrderCheckUnitResponseSchema = manualShiftOrderCheckUnitSchema;
export const manualShiftOrderCheckUnitsResponseSchema = z.array(manualShiftOrderCheckUnitSchema);
export const manualShiftOrderAshlamaResponseSchema = manualShiftOrderAshlamaSchema;
export const manualShiftOrderAshlamotResponseSchema = z.array(manualShiftOrderAshlamaSchema);
export const manualShiftOrderEventsResponseSchema = z.array(manualShiftOrderEventSchema);
export const manualShiftOrderItemResponseSchema = manualShiftOrderItemSchema;
export const manualShiftOrderItemsResponseSchema = z.array(manualShiftOrderItemSchema);
export const manualShiftLineSummaryResponseSchema = z.array(manualShiftLineSummarySchema);
export const manualShiftTodayResponseSchema = manualShiftTodayDtoSchema;
export const manualShiftPeopleSummaryResponseSchema = manualShiftPeopleSummarySchema;
export const manualShiftDaySummaryResponseSchema = manualShiftDaySummarySchema;
export const manualShiftOrdersResponseSchema = z.array(
  manualShiftOrderSchema.extend({
    totalQuantity: z.number().min(0)
  })
);
export const manualShiftBulkAddResponseSchema = manualShiftBulkAddResultSchema;
export const manualShiftWorkerResponseSchema = manualShiftWorkerSchema;
export const openAshlamaBoardResponseSchema = z.array(openAshlamaBoardItemSchema);
export const manualShiftWorkersResponseSchema = z.array(manualShiftWorkerSchema);
export const bindableUsersResponseSchema = z.array(bindableUserSchema);
export const manualShiftImportPreviewResponseSchema = z.object({
  preview: dailyManualShiftImportPreviewSchema
});
export const manualShiftMonthlyImportPreviewResponseSchema = z.object({
  preview: manualShiftMonthlyPreviewSchema
});
export const manualShiftMonthlyApplyResponseSchema = manualShiftMonthlyApplyResponseDtoSchema;
export const manualShiftMonthlyReplaceSafetySchema = manualShiftMonthlyReplaceSafetyDtoSchema;
export const applyManualShiftImportRequestSchema = applyDailyManualShiftImportRequestSchema;
export const applyManualShiftImportResponseSchema = applyDailyManualShiftImportResponseSchema;
export const warehouseLabelPreviewRequestBodySchema = warehouseLabelPreviewRequestDtoSchema;
export const warehouseLabelPreviewResponseSchema = warehouseLabelPreviewResponseDtoSchema;
export const rackSlotLocationRefsResponseSchema = rackSlotLocationRefsResponseDtoSchema;
export { manualShiftWorkHierarchyResponseSchema };

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

export const skipPickStepResponseSchema = z.object({
  stepId: z.string().uuid(),
  status: z.literal('skipped'),
  qtyPicked: z.number().int().min(0),
  taskId: z.string().uuid(),
  taskStatus: z.enum(['in_progress', 'completed', 'completed_with_exceptions']),
  orderStatus: z.string().nullable(),
  waveStatus: z.string().nullable(),
  movementId: z.null()
});

// ── Error ─────────────────────────────────────────────────────────────────────

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  requestId: z.string(),
  errorId: z.string()
});

export const clientErrorReportRequestBodySchema = z.object({
  clientErrorId: z.string().uuid(),
  source: z.enum(['window-error', 'unhandled-rejection', 'react-error-boundary', 'manual-debug']),
  message: z.string().trim().min(1),
  stack: z.string().trim().min(1).nullable().optional(),
  componentStack: z.string().trim().min(1).nullable().optional(),
  route: z.string().trim().min(1).nullable().optional(),
  url: z.string().trim().min(1).nullable().optional(),
  userAgent: z.string().trim().min(1).nullable().optional(),
  occurredAt: z.string().trim().min(1),
  viewport: z
    .object({
      width: z.number().int().min(0),
      height: z.number().int().min(0),
      pixelRatio: z.number().positive().nullable().optional()
    })
    .nullable()
    .optional(),
  context: z.record(z.string(), z.unknown()).optional()
});

export const clientErrorReportResponseSchema = z.object({
  accepted: z.literal(true),
  requestId: z.string()
});
