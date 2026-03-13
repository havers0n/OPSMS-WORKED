import { z } from 'zod';
import {
  cellOccupancyRowSchema,
  containerSchema,
  moveContainerResultSchema,
  placeContainerResultSchema,
  removeContainerResultSchema,
  containerTypeSchema,
  floorSchema,
  layoutDraftSchema,
  layoutPublishResultSchema,
  layoutValidationResultSchema,
  publishedLayoutSummarySchema,
  rackAxisSchema,
  rackFaceSideSchema,
  rackKindSchema,
  siteSchema,
  slotNumberingDirectionSchema
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
  externalCode: z.string().trim().min(1).nullable().optional()
});

export const placeContainerBodySchema = z.object({
  cellId: z.string().uuid()
});

export const moveContainerBodySchema = z.object({
  targetCellId: z.string().uuid()
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
export const cellOccupancyResponseSchema = z.array(cellOccupancyRowSchema);
export const placeContainerResponseSchema = placeContainerResultSchema;
export const removeContainerResponseSchema = removeContainerResultSchema;
export const moveContainerResponseSchema = moveContainerResultSchema;
export const layoutDraftResponseSchema = layoutDraftSchema.nullable();
export const publishedLayoutSummaryResponseSchema = publishedLayoutSummarySchema.nullable();
export const validationResponseSchema = layoutValidationResultSchema;
export const publishResponseSchema = layoutPublishResultSchema;

export const errorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string(),
  errorId: z.string()
});
