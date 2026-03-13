import { z } from 'zod';
import { containerStatusSchema } from './container';

export const containerStorageSnapshotRowSchema = z.object({
  tenantId: z.string().uuid(),
  containerId: z.string().uuid(),
  externalCode: z.string().trim().min(1).nullable(),
  containerType: z.string().trim().min(1),
  containerStatus: containerStatusSchema,
  itemRef: z.string().trim().min(1).nullable(),
  quantity: z.number().min(0).nullable(),
  uom: z.string().trim().min(1).nullable()
});

export type ContainerStorageSnapshotRow = z.infer<typeof containerStorageSnapshotRowSchema>;
