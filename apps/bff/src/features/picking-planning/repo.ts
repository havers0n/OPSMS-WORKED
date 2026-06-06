import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickingPlanningOrderInputReadRepo } from './input-builder.js';

export type PickingPlanningWaveReadRepo = {
  getWaveById(waveId: string): Promise<{ id: string } | null>;
  listOrderIdsForWave(waveId: string): Promise<string[]>;
};

export function createPickingPlanningWaveReadRepo(supabase: SupabaseClient, tenantId: string): PickingPlanningWaveReadRepo {
  return {
    async getWaveById(waveId) {
      const { data, error } = await supabase
        .from('waves')
        .select('id')
        .eq('id', waveId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async listOrderIdsForWave(waveId) {
      const { data: waveData, error: waveError } = await supabase
        .from('waves')
        .select('id')
        .eq('id', waveId)
        .eq('tenant_id', tenantId)
        .maybeSingle();

      if (waveError) throw waveError;
      if (!waveData) return [];

      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('wave_id', waveId)
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

      if (error) throw error;
      return (data ?? []).map((row) => row.id as string);
    }
  };
}

export function createPickingPlanningOrderInputReadRepo(supabase: SupabaseClient, tenantId: string): PickingPlanningOrderInputReadRepo {
  return {
    async listOrdersByIds(orderIds) {
      if (orderIds.length === 0) return [];
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .in('id', orderIds)
        .eq('tenant_id', tenantId);
      if (error) throw error;
      return data ?? [];
    },
    async listOrderLines(orderIds) {
      const { data, error } = await supabase
        .from('order_lines')
        .select('order_id,id,product_id,sku,qty_required,qty_picked')
        .in('order_id', orderIds)
        .eq('tenant_id', tenantId);

      if (error) throw error;
      return data ?? [];
    },

    async listProducts(productIds) {
      if (productIds.length === 0) return [];
      // products is shared catalog/master data (not tenant-scoped table in this schema).
      // Scope is constrained by explicit product IDs derived from tenant-scoped order lines.
      const { data, error } = await supabase.from('products').select('id,sku,name,image_urls').in('id', productIds);
      if (error) throw error;
      return data ?? [];
    },

    async listUnitProfiles(productIds) {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from('product_unit_profiles')
        .select('product_id,unit_weight_g,unit_width_mm,unit_height_mm,unit_depth_mm,weight_class,size_class')
        .in('product_id', productIds);
      if (error) throw error;
      return data ?? [];
    },

    async listPackagingLevels(productIds) {
      if (productIds.length === 0) return [];
      // product_packaging_levels is product master data keyed by product_id (not tenant-scoped table in this schema).
      // Scope is constrained by explicit product IDs derived from tenant-scoped order lines.
      const { data, error } = await supabase
        .from('product_packaging_levels')
        .select('id,product_id,code,name,barcode,base_unit_qty,sort_order,is_default_pick_uom,is_base,can_pick,is_active,pack_weight_g,pack_width_mm,pack_height_mm,pack_depth_mm')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true })
        .order('is_default_pick_uom', { ascending: false })
        .order('is_base', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async listExplicitLocationRoles(productIds, locationIds) {
      if (productIds.length === 0 || locationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('product_location_roles')
        .select('product_id,location_id,role')
        .in('product_id', productIds)
        .in('location_id', locationIds)
        .eq('tenant_id', tenantId)
        .eq('state', 'published');
      if (error) throw error;
      return (data ?? []) as Array<{ product_id: string; location_id: string; role: 'primary_pick' | 'reserve' }>;
    },

    async listStructuralRolesForLocations(locationIds) {
      if (locationIds.length === 0) return [];

      // Step 1: get geometry_slot_id for each candidate location (tenant-scoped).
      const { data: locationRows, error: locError } = await supabase
        .from('locations')
        .select('id,geometry_slot_id')
        .in('id', locationIds)
        .eq('tenant_id', tenantId);
      if (locError) throw locError;

      const locationToSlot = new Map(
        (locationRows ?? [])
          .filter((row): row is { id: string; geometry_slot_id: string } => row.geometry_slot_id != null)
          .map((row) => [row.id, row.geometry_slot_id])
      );
      const slotIds = Array.from(locationToSlot.values());
      if (slotIds.length === 0) return [];

      // Step 2: get rack_level_id for each geometry slot (cells).
      const { data: cellRows, error: cellError } = await supabase
        .from('cells')
        .select('id,rack_level_id')
        .in('id', slotIds);
      if (cellError) throw cellError;

      const slotToLevel = new Map(
        (cellRows ?? [])
          .filter((row): row is { id: string; rack_level_id: string } => row.rack_level_id != null)
          .map((row) => [row.id, row.rack_level_id])
      );
      const levelIds = Array.from(new Set(slotToLevel.values()));
      if (levelIds.length === 0) return [];

      // Step 3: get structural_default_role for each rack level.
      const { data: levelRows, error: levelError } = await supabase
        .from('rack_levels')
        .select('id,structural_default_role')
        .in('id', levelIds);
      if (levelError) throw levelError;

      const levelToRole = new Map(
        (levelRows ?? []).map((row) => [row.id as string, row.structural_default_role as string | null])
      );

      // Assemble: location → slot → rack_level → structural_default_role.
      const result: Array<{ location_id: string; structural_default_role: 'primary_pick' | 'reserve' }> = [];
      for (const locationId of locationIds) {
        const slotId = locationToSlot.get(locationId);
        if (!slotId) continue;
        const levelId = slotToLevel.get(slotId);
        if (!levelId) continue;
        const role = levelToRole.get(levelId);
        if (role !== 'primary_pick' && role !== 'reserve') continue;
        result.push({ location_id: locationId, structural_default_role: role });
      }
      return result;
    },

    async listInventoryUnits(productIds) {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from('inventory_unit')
        .select('id,product_id,container_id,quantity,uom,created_at')
        .in('product_id', productIds)
        .eq('tenant_id', tenantId)
        .eq('status', 'available')
        .gt('quantity', 0);
      if (error) throw error;
      return data ?? [];
    },

    async listContainerLocations(containerIds) {
      if (containerIds.length === 0) return [];
      const { data, error } = await supabase
        .from('containers')
        .select('id,current_location_id')
        .in('id', containerIds)
        .eq('tenant_id', tenantId)
        .not('current_location_id', 'is', null);
      if (error) throw error;
      return data ?? [];
    },

    async listLocations(locationIds) {
      if (locationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('locations')
        .select('id,tenant_id,floor_id,code,sort_order,route_sequence,pick_sequence,geometry_slot_id,floor_x,floor_y,zone_id,pick_zone_id,task_zone_id,allocation_zone_id,access_aisle_id,side_of_aisle,position_along_aisle,travel_node_id')
        .in('id', locationIds)
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (error) throw error;
      return data ?? [];
    }
  };
}
