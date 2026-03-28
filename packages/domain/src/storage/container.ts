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
  externalCode: z.string().trim().min(1).nullable(),
  containerTypeId: z.string().uuid(),
  status: containerStatusSchema,
  operationalRole: containerOperationalRoleSchema,
  createdAt: z.string(),
  createdBy: z.string().uuid().nullable()
});

export type ContainerStatus = z.infer<typeof containerStatusSchema>;
export type ContainerOperationalRole = z.infer<typeof containerOperationalRoleSchema>;
export type ContainerType = z.infer<typeof containerTypeSchema>;
export type Container = z.infer<typeof containerSchema>;
