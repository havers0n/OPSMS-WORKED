import { useMutation, useQueryClient } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';
import type {
  RouteGraphEdge,
  RouteGraphNode,
  RouteGraphNodeKind,
  RouteGraphPoint
} from '../model/types';
import { routeGraphKeys } from './queries';

export type CreateRouteNodeBody = {
  x: number;
  y: number;
  kind: RouteGraphNodeKind;
  label: string | null;
};

export type PatchRouteNodeBody = Partial<CreateRouteNodeBody>;

export type CreateRouteEdgeBody = {
  sourceNodeId: string;
  targetNodeId: string;
  cost: number;
  reverseCost: number;
  points: RouteGraphPoint[];
};

export type PatchRouteEdgeBody = Partial<CreateRouteEdgeBody>;

export function createRouteNode(floorId: string, body: CreateRouteNodeBody) {
  return bffRequest<RouteGraphNode>(`/api/floors/${floorId}/routing/nodes`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function patchRouteNode(
  floorId: string,
  nodeId: string,
  body: PatchRouteNodeBody
) {
  return bffRequest<RouteGraphNode>(
    `/api/floors/${floorId}/routing/nodes/${nodeId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body)
    }
  );
}

export async function deleteRouteNode(floorId: string, nodeId: string) {
  await bffRequest<void>(`/api/floors/${floorId}/routing/nodes/${nodeId}`, {
    method: 'DELETE'
  });
}

export function createRouteEdge(floorId: string, body: CreateRouteEdgeBody) {
  return bffRequest<RouteGraphEdge>(`/api/floors/${floorId}/routing/edges`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export function patchRouteEdge(
  floorId: string,
  edgeId: string,
  body: PatchRouteEdgeBody
) {
  return bffRequest<RouteGraphEdge>(
    `/api/floors/${floorId}/routing/edges/${edgeId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(body)
    }
  );
}

export async function deleteRouteEdge(floorId: string, edgeId: string) {
  await bffRequest<void>(`/api/floors/${floorId}/routing/edges/${edgeId}`, {
    method: 'DELETE'
  });
}

export function useCreateRouteNode(floorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateRouteNodeBody) => createRouteNode(floorId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: routeGraphKeys.byFloor(floorId)
      });
    }
  });
}

export function usePatchRouteNode(floorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      nodeId,
      body
    }: {
      nodeId: string;
      body: PatchRouteNodeBody;
    }) => patchRouteNode(floorId, nodeId, body),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: routeGraphKeys.byFloor(floorId)
      });
    }
  });
}

export function useDeleteRouteNode(floorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nodeId: string) => deleteRouteNode(floorId, nodeId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: routeGraphKeys.byFloor(floorId)
      });
    }
  });
}

export function useCreateRouteEdge(floorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateRouteEdgeBody) => createRouteEdge(floorId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: routeGraphKeys.byFloor(floorId)
      });
    }
  });
}

export function usePatchRouteEdge(floorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      edgeId,
      body
    }: {
      edgeId: string;
      body: PatchRouteEdgeBody;
    }) => patchRouteEdge(floorId, edgeId, body),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: routeGraphKeys.byFloor(floorId)
      });
    }
  });
}

export function useDeleteRouteEdge(floorId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (edgeId: string) => deleteRouteEdge(floorId, edgeId),
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: routeGraphKeys.byFloor(floorId)
      });
    }
  });
}
