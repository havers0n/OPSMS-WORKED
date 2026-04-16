import type { SupabaseClient } from '@supabase/supabase-js';

export type LocationProductAssignment = {
  id: string;
  productId: string;
  locationId: string;
  role: 'primary_pick' | 'reserve';
  state: 'draft' | 'published' | 'inactive';
  layoutVersionId: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    imageUrl: string | null;
  };
};

export type CreateProductLocationRolePayload = {
  tenantId: string;
  productId: string;
  locationId: string;
  role: 'primary_pick' | 'reserve';
};

export type EffectiveLocationRoleResult = {
  locationId: string;
  productId: string;
  structuralDefaultRole: 'primary_pick' | 'reserve' | 'none';
  effectiveRole: 'primary_pick' | 'reserve' | 'none' | null;
  effectiveRoleSource: 'explicit_override' | 'structural_default' | 'none' | 'conflict';
  conflictingPublishedRoles: Array<'primary_pick' | 'reserve'>;
};

export type ProductLocationRolesRepo = {
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

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  image_urls: unknown;
};

type ProductLocationRoleRow = {
  id: string;
  product_id: string;
  location_id: string;
  role: string;
  state: string;
  layout_version_id: string | null;
  created_at: string;
  products: ProductRow | null;
};

function firstImageUrl(imageUrls: unknown): string | null {
  if (!Array.isArray(imageUrls)) return null;
  const first = imageUrls[0];
  return typeof first === 'string' ? first : null;
}

const selectColumns =
  'id, product_id, location_id, role, state, layout_version_id, created_at, products(id, name, sku, image_urls)';

function mapRow(row: ProductLocationRoleRow): LocationProductAssignment {
  return {
    id: row.id,
    productId: row.product_id,
    locationId: row.location_id,
    role: row.role as 'primary_pick' | 'reserve',
    state: row.state as 'draft' | 'published' | 'inactive',
    layoutVersionId: row.layout_version_id,
    createdAt: row.created_at,
    product: row.products
      ? {
          id: row.products.id,
          name: row.products.name,
          sku: row.products.sku,
          imageUrl: firstImageUrl(row.products.image_urls)
        }
      : {
          id: row.product_id,
          name: 'Unknown product',
          sku: null,
          imageUrl: null
        }
  };
}

export function createProductLocationRolesRepo(supabase: SupabaseClient): ProductLocationRolesRepo {
  return {
    async listByLocationId(tenantId, locationId) {
      const { data, error } = await supabase
        .from('product_location_roles')
        .select(selectColumns)
        .eq('tenant_id', tenantId)
        .eq('location_id', locationId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return ((data ?? []) as unknown as ProductLocationRoleRow[]).map(mapRow);
    },

    async resolveEffectiveRole(tenantId, locationId, productId) {
      const { data: locationRow, error: locationError } = await supabase
        .from('locations')
        .select('id,geometry_slot_id')
        .eq('tenant_id', tenantId)
        .eq('id', locationId)
        .maybeSingle();

      if (locationError) throw locationError;
      if (!locationRow) {
        throw new Error('LOCATION_NOT_FOUND');
      }

      let structuralDefaultRole: 'primary_pick' | 'reserve' | 'none' = 'none';
      const geometrySlotId = (locationRow as { geometry_slot_id: string | null }).geometry_slot_id;
      if (geometrySlotId) {
        const { data: cellRow, error: cellError } = await supabase
          .from('cells')
          .select('rack_level_id')
          .eq('id', geometrySlotId)
          .maybeSingle();

        if (cellError) throw cellError;

        const rackLevelId = (cellRow as { rack_level_id: string | null } | null)?.rack_level_id ?? null;
        if (rackLevelId) {
          const { data: levelRow, error: levelError } = await supabase
            .from('rack_levels')
            .select('structural_default_role')
            .eq('id', rackLevelId)
            .maybeSingle();

          if (levelError) throw levelError;
          const role = (levelRow as { structural_default_role: 'primary_pick' | 'reserve' | 'none' | null } | null)
            ?.structural_default_role;
          structuralDefaultRole = role ?? 'none';
        }
      }

      const { data: roleRows, error: roleError } = await supabase
        .from('product_location_roles')
        .select('role')
        .eq('tenant_id', tenantId)
        .eq('location_id', locationId)
        .eq('product_id', productId)
        .eq('state', 'published');

      if (roleError) throw roleError;

      const publishedRoles = new Set(
        ((roleRows ?? []) as Array<{ role: string }>)
          .map((row) => row.role)
          .filter((role): role is 'primary_pick' | 'reserve' => role === 'primary_pick' || role === 'reserve')
      );

      const hasPrimary = publishedRoles.has('primary_pick');
      const hasReserve = publishedRoles.has('reserve');

      if (hasPrimary && hasReserve) {
        return {
          locationId,
          productId,
          structuralDefaultRole,
          effectiveRole: null,
          effectiveRoleSource: 'conflict',
          conflictingPublishedRoles: ['primary_pick', 'reserve']
        };
      }

      if (hasPrimary || hasReserve) {
        const explicitRole: 'primary_pick' | 'reserve' = hasPrimary ? 'primary_pick' : 'reserve';
        return {
          locationId,
          productId,
          structuralDefaultRole,
          effectiveRole: explicitRole,
          effectiveRoleSource: 'explicit_override',
          conflictingPublishedRoles: []
        };
      }

      if (structuralDefaultRole !== 'none') {
        return {
          locationId,
          productId,
          structuralDefaultRole,
          effectiveRole: structuralDefaultRole,
          effectiveRoleSource: 'structural_default',
          conflictingPublishedRoles: []
        };
      }

      return {
        locationId,
        productId,
        structuralDefaultRole: 'none',
        effectiveRole: 'none',
        effectiveRoleSource: 'none',
        conflictingPublishedRoles: []
      };
    },

    async create(payload) {
      const { data: inserted, error: insertError } = await supabase
        .from('product_location_roles')
        .insert({
          tenant_id: payload.tenantId,
          product_id: payload.productId,
          location_id: payload.locationId,
          role: payload.role,
          state: 'published',
          layout_version_id: null
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      const { data, error } = await supabase
        .from('product_location_roles')
        .select(selectColumns)
        .eq('id', (inserted as { id: string }).id)
        .single();

      if (error) throw error;
      return mapRow(data as unknown as ProductLocationRoleRow);
    },

    async delete(tenantId, roleId) {
      const { error } = await supabase
        .from('product_location_roles')
        .delete()
        .eq('id', roleId)
        .eq('tenant_id', tenantId);

      if (error) throw error;
    }
  };
}
