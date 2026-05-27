import { z } from 'zod';

export const pickerWorkerQuerySchema = z.object({
  workerId: z.string().uuid()
});

export const pickerConfirmStepBodySchema = z.object({
  qtyPicked: z.number().positive()
});
