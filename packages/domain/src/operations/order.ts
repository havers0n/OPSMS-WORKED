import { z } from 'zod';

export const orderStatusSchema = z.enum([
  'draft',
  'ready',
  'released',
  'picking',
  'picked',
  'partial',
  'closed',
  'cancelled'
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderLineStatusSchema = z.enum([
  'pending',
  'released',
  'picking',
  'picked',
  'partial',
  'skipped',
  'exception'
]);
export type OrderLineStatus = z.infer<typeof orderLineStatusSchema>;

export const orderLineSchema = z.object({
  id: z.string().uuid(),
  orderId: z.string().uuid(),
  tenantId: z.string().uuid(),
  sku: z.string().trim().min(1),
  name: z.string().trim().min(1),
  qtyRequired: z.number().int().positive(),
  qtyPicked: z.number().int().min(0),
  status: orderLineStatusSchema
});
export type OrderLine = z.infer<typeof orderLineSchema>;

export const orderSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  externalNumber: z.string().trim().min(1),
  status: orderStatusSchema,
  priority: z.number().int(),
  waveId: z.string().uuid().nullable(),
  createdAt: z.string(),
  releasedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  lines: z.array(orderLineSchema)
});
export type Order = z.infer<typeof orderSchema>;

/** Summary row returned in list responses (no lines array) */
export const orderSummarySchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  externalNumber: z.string().trim().min(1),
  status: orderStatusSchema,
  priority: z.number().int(),
  waveId: z.string().uuid().nullable(),
  createdAt: z.string(),
  releasedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  lineCount: z.number().int().min(0),
  unitCount: z.number().int().min(0),
  pickedUnitCount: z.number().int().min(0)
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;
