import { z } from 'zod';
import { layoutVersionStateSchema } from '../enums/layout';

export const layoutVersionSchema = z.object({
  id: z.string(),
  floorId: z.string(),
  state: layoutVersionStateSchema,
  versionNo: z.number().int().min(1)
});
export type LayoutVersion = z.infer<typeof layoutVersionSchema>;
