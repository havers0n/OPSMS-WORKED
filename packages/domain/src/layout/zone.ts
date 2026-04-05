import { z } from 'zod';

export const zoneCategorySchema = z.enum([
  'generic',
  'storage',
  'staging',
  'packing',
  'receiving',
  'custom'
]);
export type ZoneCategory = z.infer<typeof zoneCategorySchema>;

export const zoneSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  name: z.string().min(1),
  category: zoneCategorySchema.optional().nullable(),
  color: z.string().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive()
});
export type Zone = z.infer<typeof zoneSchema>;

/**
 * Describes how a zone relates to container placement.
 *
 * This is intentionally computed from category — not persisted — so the
 * contract can evolve without a schema migration.
 *
 * 'none'          — zone is an operational context area only; containers are
 *                   not placed here directly or via children.
 * 'children_only' — containers live in addressed locations (rack cells) inside
 *                   this zone; the zone boundary itself is not a placement target.
 * 'direct'        — zone may contain floor/staging locations that accept direct
 *                   container placement (semantics established; UI not yet built).
 */
export type ZonePlacementBehavior = 'none' | 'children_only' | 'direct';

export function getZonePlacementBehavior(
  category: ZoneCategory | null | undefined
): ZonePlacementBehavior {
  switch (category) {
    case 'storage':
      return 'children_only';
    case 'staging':
    case 'receiving':
      return 'direct';
    case 'packing':
    case 'generic':
    case 'custom':
    case null:
    case undefined:
      return 'none';
  }
}
