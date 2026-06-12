import { z } from 'zod';

export const pickerConfirmStepBodySchema = z.object({
  qtyPicked: z.number().positive()
});
