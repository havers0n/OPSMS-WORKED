import { z } from 'zod';
import { orderSummarySchema } from './order';

export const waveStatusSchema = z.enum([
  'draft',
  'ready',
  'released',
  'in_progress',
  'completed',
  'partial',
  'closed'
]);
export type WaveStatus = z.infer<typeof waveStatusSchema>;

const waveBaseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string().trim().min(1),
  status: waveStatusSchema,
  createdAt: z.string(),
  releasedAt: z.string().nullable(),
  closedAt: z.string().nullable(),
  totalOrders: z.number().int().min(0),
  readyOrders: z.number().int().min(0),
  blockingOrderCount: z.number().int().min(0)
});

export const waveSummarySchema = waveBaseSchema;
export type WaveSummary = z.infer<typeof waveSummarySchema>;

export const waveSchema = waveBaseSchema.extend({
  orders: z.array(orderSummarySchema)
});
export type Wave = z.infer<typeof waveSchema>;
