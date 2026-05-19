import type { SupabaseClient } from '@supabase/supabase-js';
import { shortestFloorPathRpcRowsSchema, type ShortestFloorPathRpcRow } from './schema.js';

export type FloorRoutingRepo = {
  listExistingNodeIds(tenantId: string, floorId: string, nodeIds: string[]): Promise<string[]>;
  getShortestFloorPath(
    tenantId: string,
    floorId: string,
    startNodeId: string,
    endNodeId: string
  ): Promise<ShortestFloorPathRpcRow[]>;
};

export function createFloorRoutingRepo(supabase: SupabaseClient): FloorRoutingRepo {
  return {
    async listExistingNodeIds(tenantId, floorId, nodeIds) {
      if (nodeIds.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('floor_route_nodes')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .in('id', nodeIds);

      if (error) {
        throw error;
      }

      return ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
    },

    async getShortestFloorPath(tenantId, floorId, startNodeId, endNodeId) {
      const { data, error } = await supabase.rpc('get_shortest_floor_path', {
        p_tenant_id: tenantId,
        p_floor_id: floorId,
        p_start_node_id: startNodeId,
        p_end_node_id: endNodeId
      });

      if (error) {
        throw error;
      }

      return shortestFloorPathRpcRowsSchema.parse(data ?? []);
    }
  };
}
