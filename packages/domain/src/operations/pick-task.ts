import { z } from 'zod';

export const pickTaskStatusSchema = z.enum([
  'ready',
  'assigned',
  'in_progress',
  'completed',
  'completed_with_exceptions'
]);
export type PickTaskStatus = z.infer<typeof pickTaskStatusSchema>;

export const pickStepStatusSchema = z.enum([
  'pending',
  'picked',
  'partial',
  'skipped',
  'exception',
  'needs_replenishment'
]);
export type PickStepStatus = z.infer<typeof pickStepStatusSchema>;

export const pickStepSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  tenantId: z.string().uuid(),
  orderId: z.string().uuid().nullable(),
  orderLineId: z.string().uuid().nullable(),
  sequenceNo: z.number().int().positive(),
  sku: z.string().trim().min(1),
  itemName: z.string().trim().min(1),
  qtyRequired: z.number().int().positive(),
  qtyPicked: z.number().int().min(0),
  status: pickStepStatusSchema,
  sourceCellId: z.string().uuid().nullable(),
  sourceContainerId: z.string().uuid().nullable(),
  inventoryUnitId: z.string().uuid().nullable(),
  pickContainerId: z.string().uuid().nullable(),
  executedAt: z.string().nullable(),
  executedBy: z.string().uuid().nullable()
});
export type PickStep = z.infer<typeof pickStepSchema>;

export const pickTaskSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sourceType: z.enum(['order', 'wave']),
  sourceId: z.string().uuid(),
  status: pickTaskStatusSchema,
  assignedTo: z.string().uuid().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  steps: z.array(pickStepSchema)
});
export type PickTask = z.infer<typeof pickTaskSchema>;

/** Step enriched with human-readable source location / container / product image */
export const pickStepDetailSchema = pickStepSchema.extend({
  sourceCellAddress: z.string().nullable(),
  sourceContainerCode: z.string().nullable(),
  imageUrl: z.string().nullable()
});
export type PickStepDetail = z.infer<typeof pickStepDetailSchema>;

/** Full task detail including enriched steps — used by picker-facing UI */
export const pickTaskDetailSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sourceType: z.enum(['order', 'wave']),
  sourceId: z.string().uuid(),
  status: pickTaskStatusSchema,
  assignedTo: z.string().uuid().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  totalSteps: z.number().int().min(0),
  completedSteps: z.number().int().min(0),
  steps: z.array(pickStepDetailSchema)
});
export type PickTaskDetail = z.infer<typeof pickTaskDetailSchema>;

/** Summary returned in order execution section (no full steps array) */
export const pickTaskSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  sourceType: z.enum(['order', 'wave']),
  sourceId: z.string().uuid(),
  status: pickTaskStatusSchema,
  assignedTo: z.string().uuid().nullable(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  totalSteps: z.number().int().min(0),
  completedSteps: z.number().int().min(0),
  exceptionSteps: z.number().int().min(0)
});
export type PickTaskSummary = z.infer<typeof pickTaskSummarySchema>;
