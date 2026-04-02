import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createProductLocationRolesRepo,
  type LocationProductAssignment,
  type CreateProductLocationRolePayload
} from './repo.js';

export type ProductLocationRolesService = {
  listByLocationId(
    tenantId: string,
    locationId: string
  ): Promise<LocationProductAssignment[]>;
  create(payload: CreateProductLocationRolePayload): Promise<LocationProductAssignment>;
  delete(tenantId: string, roleId: string): Promise<void>;
};

export function createProductLocationRolesService(
  supabase: SupabaseClient
): ProductLocationRolesService {
  const repo = createProductLocationRolesRepo(supabase);
  return {
    listByLocationId: (tenantId, locationId) => repo.listByLocationId(tenantId, locationId),
    create: (payload) => repo.create(payload),
    delete: (tenantId, roleId) => repo.delete(tenantId, roleId)
  };
}
