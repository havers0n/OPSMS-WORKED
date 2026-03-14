import { useQuery } from '@tanstack/react-query';
import { floorWorkspaceQueryOptions } from './queries';

export function useFloorWorkspace(floorId: string | null) {
  return useQuery(floorWorkspaceQueryOptions(floorId));
}
