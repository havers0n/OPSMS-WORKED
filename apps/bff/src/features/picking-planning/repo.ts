import type { SupabaseClient } from '@supabase/supabase-js';
import type { PickingPlanningOrderInputReadRepo } from './input-builder.js';

export type PickingPlanningWaveReadRepo = {
  listOrderIdsForWave(waveId: string): Promise<string[]>;
};

export function createPickingPlanningWaveReadRepo(supabase: SupabaseClient, tenantId: string): PickingPlanningWaveReadRepo {
  return {
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
      const { data, error } = await supabase.from('products').select('id,sku').in('id', productIds);
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
      const { data, error } = await supabase
        .from('product_packaging_levels')
        .select('product_id,base_unit_qty,is_default_pick_uom,is_base,can_pick,is_active,pack_weight_g,pack_width_mm,pack_height_mm,pack_depth_mm')
        .in('product_id', productIds)
        .order('is_default_pick_uom', { ascending: false })
        .order('is_base', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async listPrimaryPickLocations(productIds) {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from('product_location_roles')
        .select('product_id,location_id')
        .in('product_id', productIds)
        .eq('tenant_id', tenantId)
        .eq('role', 'primary_pick')
        .eq('state', 'published');
      if (error) throw error;
      return data ?? [];
    },

    async listInventoryUnits(productIds) {
      if (productIds.length === 0) return [];
      const { data, error } = await supabase
        .from('inventory_unit')
        .select('product_id,container_id,quantity,uom,created_at')
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
        .select('id,tenant_id,floor_id,warehouse_id,code,sort_order,route_sequence,pick_sequence,geometry_slot_id,floor_x,floor_y,zone_id,pick_zone_id,task_zone_id,allocation_zone_id,access_aisle_id,side_of_aisle,position_along_aisle,travel_node_id')
        .in('id', locationIds)
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (error) throw error;
      return data ?? [];
    }
  };
}
