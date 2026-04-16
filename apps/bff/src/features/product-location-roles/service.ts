import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createProductLocationRolesRepo,
  type LocationProductAssignment,
  type CreateProductLocationRolePayload,
  type EffectiveLocationRoleResult
} from './repo.js';

export type ProductLocationRolesService = {
  listByLocationId(
    tenantId: string,
    locationId: string
  ): Promise<LocationProductAssignment[]>;
  resolveEffectiveRole(
    tenantId: string,
    locationId: string,
    productId: string
  ): Promise<EffectiveLocationRoleResult>;
  create(payload: CreateProductLocationRolePayload): Promise<LocationProductAssignment>;
  delete(tenantId: string, roleId: string): Promise<void>;
};

export function createProductLocationRolesService(
  supabase: SupabaseClient
): ProductLocationRolesService {
  const repo = createProductLocationRolesRepo(supabase);
  return {
    listByLocationId: (tenantId, locationId) => repo.listByLocationId(tenantId, locationId),
    resolveEffectiveRole: (tenantId, locationId, productId) =>
      repo.resolveEffectiveRole(tenantId, locationId, productId),
    create: (payload) => repo.create(payload),
    delete: (tenantId, roleId) => repo.delete(tenantId, roleId)
  };
}
