import type { SupabaseClient } from '@supabase/supabase-js';
import {
  routeGraphDtoSchema,
  routeGraphEdgeDtoSchema,
  routeGraphNodeDtoSchema,
  shortestFloorPathRpcRowsSchema,
  type CreateRouteGraphEdgeRequest,
  type CreateRouteGraphNodeRequest,
  type PatchRouteGraphEdgeRequest,
  type PatchRouteGraphNodeRequest,
  type RouteGraphDto,
  type RouteGraphEdgeDto,
  type RouteGraphNodeDto,
  type ShortestFloorPathRpcRow
} from './schema.js';

type RouteGraphNodeRow = {
  id: string;
  floor_id: string;
  x: number;
  y: number;
  kind: string;
  label: string | null;
  created_at: string;
  updated_at: string;
};

type RouteGraphEdgeRow = {
  id: string;
  floor_id: string;
  source_node_id: string;
  target_node_id: string;
  cost: number;
  reverse_cost: number;
  points: unknown;
  created_at: string;
  updated_at: string;
};

const nodeColumns = 'id,floor_id,x,y,kind,label,created_at,updated_at';
const edgeColumns = 'id,floor_id,source_node_id,target_node_id,cost,reverse_cost,points,created_at,updated_at';

function mapNodeRow(row: RouteGraphNodeRow): RouteGraphNodeDto {
  return routeGraphNodeDtoSchema.parse({
    id: row.id,
    floorId: row.floor_id,
    x: row.x,
    y: row.y,
    kind: row.kind,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function mapEdgeRow(row: RouteGraphEdgeRow): RouteGraphEdgeDto {
  return routeGraphEdgeDtoSchema.parse({
    id: row.id,
    floorId: row.floor_id,
    sourceNodeId: row.source_node_id,
    targetNodeId: row.target_node_id,
    cost: row.cost,
    reverseCost: row.reverse_cost,
    points: row.points,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function mapGraphRows(nodes: RouteGraphNodeRow[], edges: RouteGraphEdgeRow[]): RouteGraphDto {
  return routeGraphDtoSchema.parse({
    nodes: nodes.map(mapNodeRow),
    edges: edges.map(mapEdgeRow)
  });
}

export type FloorRoutingRepo = {
  listGraph(tenantId: string, floorId: string): Promise<RouteGraphDto>;
  createNode(tenantId: string, floorId: string, input: CreateRouteGraphNodeRequest): Promise<RouteGraphNodeDto>;
  patchNode(
    tenantId: string,
    floorId: string,
    nodeId: string,
    input: PatchRouteGraphNodeRequest
  ): Promise<RouteGraphNodeDto | null>;
  deleteNode(tenantId: string, floorId: string, nodeId: string): Promise<boolean>;
  createEdge(tenantId: string, floorId: string, input: CreateRouteGraphEdgeRequest): Promise<RouteGraphEdgeDto>;
  findEdge(tenantId: string, floorId: string, edgeId: string): Promise<RouteGraphEdgeDto | null>;
  patchEdge(
    tenantId: string,
    floorId: string,
    edgeId: string,
    input: PatchRouteGraphEdgeRequest
  ): Promise<RouteGraphEdgeDto | null>;
  deleteEdge(tenantId: string, floorId: string, edgeId: string): Promise<boolean>;
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
    async listGraph(tenantId, floorId) {
      const [nodesResult, edgesResult] = await Promise.all([
        supabase
          .from('floor_route_nodes')
          .select(nodeColumns)
          .eq('tenant_id', tenantId)
          .eq('floor_id', floorId)
          .order('created_at', { ascending: true }),
        supabase
          .from('floor_route_edges')
          .select(edgeColumns)
          .eq('tenant_id', tenantId)
          .eq('floor_id', floorId)
          .order('created_at', { ascending: true })
      ]);

      if (nodesResult.error) {
        throw nodesResult.error;
      }
      if (edgesResult.error) {
        throw edgesResult.error;
      }

      return mapGraphRows(
        (nodesResult.data ?? []) as RouteGraphNodeRow[],
        (edgesResult.data ?? []) as RouteGraphEdgeRow[]
      );
    },

    async createNode(tenantId, floorId, input) {
      const { data, error } = await supabase
        .from('floor_route_nodes')
        .insert({
          tenant_id: tenantId,
          floor_id: floorId,
          x: input.x,
          y: input.y,
          kind: input.kind ?? 'walkway',
          label: input.label ?? null
        })
        .select(nodeColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapNodeRow(data as RouteGraphNodeRow);
    },

    async patchNode(tenantId, floorId, nodeId, input) {
      const updates: Record<string, unknown> = {};
      if (input.x !== undefined) updates.x = input.x;
      if (input.y !== undefined) updates.y = input.y;
      if (input.kind !== undefined) updates.kind = input.kind;
      if ('label' in input) updates.label = input.label ?? null;

      const { data, error } = await supabase
        .from('floor_route_nodes')
        .update(updates)
        .eq('id', nodeId)
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .select(nodeColumns)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapNodeRow(data as RouteGraphNodeRow) : null;
    },

    async deleteNode(tenantId, floorId, nodeId) {
      const { data, error } = await supabase
        .from('floor_route_nodes')
        .delete()
        .eq('id', nodeId)
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .select('id')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    },

    async createEdge(tenantId, floorId, input) {
      const { data, error } = await supabase
        .from('floor_route_edges')
        .insert({
          tenant_id: tenantId,
          floor_id: floorId,
          source_node_id: input.sourceNodeId,
          target_node_id: input.targetNodeId,
          cost: input.cost,
          reverse_cost: input.reverseCost ?? -1,
          points: input.points ?? []
        })
        .select(edgeColumns)
        .single();

      if (error) {
        throw error;
      }

      return mapEdgeRow(data as RouteGraphEdgeRow);
    },

    async findEdge(tenantId, floorId, edgeId) {
      const { data, error } = await supabase
        .from('floor_route_edges')
        .select(edgeColumns)
        .eq('id', edgeId)
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapEdgeRow(data as RouteGraphEdgeRow) : null;
    },

    async patchEdge(tenantId, floorId, edgeId, input) {
      const updates: Record<string, unknown> = {};
      if (input.sourceNodeId !== undefined) updates.source_node_id = input.sourceNodeId;
      if (input.targetNodeId !== undefined) updates.target_node_id = input.targetNodeId;
      if (input.cost !== undefined) updates.cost = input.cost;
      if (input.reverseCost !== undefined) updates.reverse_cost = input.reverseCost;
      if (input.points !== undefined) updates.points = input.points;

      const { data, error } = await supabase
        .from('floor_route_edges')
        .update(updates)
        .eq('id', edgeId)
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .select(edgeColumns)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data ? mapEdgeRow(data as RouteGraphEdgeRow) : null;
    },

    async deleteEdge(tenantId, floorId, edgeId) {
      const { data, error } = await supabase
        .from('floor_route_edges')
        .delete()
        .eq('id', edgeId)
        .eq('tenant_id', tenantId)
        .eq('floor_id', floorId)
        .select('id')
        .maybeSingle();

      if (error) {
        throw error;
      }

      return Boolean(data);
    },

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
