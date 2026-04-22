import { z } from 'zod';

export const containerStatusSchema = z.enum(['active', 'quarantined', 'closed', 'lost', 'damaged']);

export const containerOperationalRoleSchema = z.enum(['storage', 'pick']);

export const containerTypeSchema = z.object({
  id: z.string().uuid(),
  code: z.string().trim().min(1),
  description: z.string().trim().min(1),
  supportsStorage: z.boolean(),
  supportsPicking: z.boolean()
});

export const containerSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  systemCode: z.string().trim().min(1),
  externalCode: z.string().trim().min(1).nullable(),
  barcode: z.string().trim().min(1).nullable().optional(),
  externalRef: z.string().trim().min(1).nullable().optional(),
  containerTypeId: z.string().uuid(),
  status: containerStatusSchema,
  operationalRole: containerOperationalRoleSchema,
  parentContainerId: z.string().uuid().nullable().optional(),
  packagingProfileId: z.string().uuid().nullable().optional(),
  isStandardPack: z.boolean().nullable().optional(),
  grossWeightG: z.number().int().positive().nullable().optional(),
  lengthMm: z.number().int().positive().nullable().optional(),
  widthMm: z.number().int().positive().nullable().optional(),
  heightMm: z.number().int().positive().nullable().optional(),
  receivedAt: z.string().nullable().optional(),
  sourceDocumentType: z.string().trim().min(1).nullable().optional(),
  sourceDocumentId: z.string().trim().min(1).nullable().optional(),
  lastReceiptCorrelationKey: z.string().trim().min(1).nullable().optional(),
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable()
});

export type ContainerStatus = z.infer<typeof containerStatusSchema>;
export type ContainerOperationalRole = z.infer<typeof containerOperationalRoleSchema>;
export type ContainerType = z.infer<typeof containerTypeSchema>;
export type Container = z.infer<typeof containerSchema>;
