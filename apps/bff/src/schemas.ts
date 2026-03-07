import { z } from 'zod';
import { floorSchema, layoutDraftSchema, layoutPublishResultSchema, layoutValidationResultSchema, publishedLayoutSummarySchema, siteSchema } from '@wos/domain';

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
  side: z.string().trim().min(1),
  enabled: z.boolean(),
  anchor: z.string().trim().min(1),
  slotNumberingDirection: z.string().trim().min(1),
  isMirrored: z.boolean(),
  mirrorSourceFaceId: z.string().uuid().nullable(),
  sections: z.array(saveRackSectionPayloadSchema)
});

const saveRackPayloadSchema = z.object({
  id: z.string().uuid(),
  displayCode: z.string().trim().min(1),
  kind: z.string().trim().min(1),
  axis: z.string().trim().min(1),
  x: z.number(),
  y: z.number(),
  totalLength: z.number().positive(),
  depth: z.number().positive(),
  rotationDeg: z.number(),
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

export const layoutVersionIdResponseSchema = z.object({
  layoutVersionId: z.string().uuid()
});

export const sitesResponseSchema = z.array(siteSchema);
export const floorsResponseSchema = z.array(floorSchema);
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
