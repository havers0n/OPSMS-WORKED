import { z } from 'zod';
import { containerStatusSchema } from './container';
import { inventoryUnitStatusSchema } from './inventory-unit';

export const operationsCellStatusSchema = z.enum([
  'empty',
  'stocked',
  'pick_active',
  'reserved',
  'quarantined'
]);

export const operationsCellRuntimeItemSchema = z.object({
  itemRef: z.string().trim().min(1).nullable(),
  productId: z.string().uuid().nullable(),
  sku: z.string().trim().min(1).nullable(),
  name: z.string().trim().min(1).nullable(),
  quantity: z.number().min(0),
  uom: z.string().trim().min(1),
  inventoryStatus: inventoryUnitStatusSchema.nullable()
});

export const operationsCellRuntimeContainerSchema = z.object({
  containerId: z.string().uuid(),
  externalCode: z.string().trim().min(1).nullable(),
  containerType: z.string().trim().min(1),
  containerStatus: containerStatusSchema,
  totalQuantity: z.number().min(0),
  itemCount: z.number().int().min(0),
  items: z.array(operationsCellRuntimeItemSchema)
});

export const operationsCellRuntimeSchema = z.object({
  cellId: z.string().uuid(),
  cellAddress: z.string().trim().min(1),
  status: operationsCellStatusSchema,
  pickActive: z.boolean(),
  reserved: z.boolean(),
  quarantined: z.boolean(),
  stocked: z.boolean(),
  containerCount: z.number().int().min(0),
  totalQuantity: z.number().min(0),
  containers: z.array(operationsCellRuntimeContainerSchema)
});

export const operationsCellRuntimeResponseSchema = z.array(operationsCellRuntimeSchema);

export type OperationsCellStatus = z.infer<typeof operationsCellStatusSchema>;
export type OperationsCellRuntimeItem = z.infer<typeof operationsCellRuntimeItemSchema>;
export type OperationsCellRuntimeContainer = z.infer<typeof operationsCellRuntimeContainerSchema>;
export type OperationsCellRuntime = z.infer<typeof operationsCellRuntimeSchema>;
