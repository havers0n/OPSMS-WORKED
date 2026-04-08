import { z } from 'zod';

export const layoutChangeClassSchema = z.enum([
  'no_changes',
  'geometry_only',
  'structure_changed',
  'zones_or_walls_changed',
  'mixed'
]);

export type LayoutChangeClass = z.infer<typeof layoutChangeClassSchema>;
