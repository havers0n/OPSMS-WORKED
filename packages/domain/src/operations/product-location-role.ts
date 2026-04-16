import { z } from 'zod';

export const productLocationRoleValueSchema = z.enum(['primary_pick', 'reserve']);
export type ProductLocationRoleValue = z.infer<typeof productLocationRoleValueSchema>;
export const structuralDefaultRoleValueSchema = z.enum(['primary_pick', 'reserve', 'none']);
export type StructuralDefaultRoleValue = z.infer<typeof structuralDefaultRoleValueSchema>;

export const productLocationRoleStateSchema = z.enum(['draft', 'published', 'inactive']);
export type ProductLocationRoleState = z.infer<typeof productLocationRoleStateSchema>;

/**
 * Operational policy: which product should be picked from which location,
 * and at what role.
 *
 * This is NOT a physical property of the location. A location that is
 * `primary_pick` for SKU-A may be `reserve` for SKU-B. The role lives
 * on this relation, not on the location itself.
 *
 * The allocation RPC queries published primary_pick rows to find the
 * correct source location for a pick step.
 */
export const productLocationRoleSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  productId: z.string().uuid(),
  locationId: z.string().uuid(),
  role: productLocationRoleValueSchema,
  state: productLocationRoleStateSchema,
  layoutVersionId: z.string().uuid().nullable(),
  effectiveFrom: z.string().nullable(),
  effectiveTo: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type ProductLocationRole = z.infer<typeof productLocationRoleSchema>;

export const effectiveLocationRoleSourceSchema = z.enum([
  'explicit_override',
  'structural_default',
  'none',
  'conflict'
]);
export type EffectiveLocationRoleSource = z.infer<typeof effectiveLocationRoleSourceSchema>;

export const locationEffectiveRoleSchema = z.object({
  locationId: z.string().uuid(),
  productId: z.string().uuid(),
  structuralDefaultRole: structuralDefaultRoleValueSchema,
  effectiveRole: z.enum(['primary_pick', 'reserve', 'none']).nullable(),
  effectiveRoleSource: effectiveLocationRoleSourceSchema,
  conflictingPublishedRoles: z.array(productLocationRoleValueSchema).default([])
});

export type LocationEffectiveRole = z.infer<typeof locationEffectiveRoleSchema>;
