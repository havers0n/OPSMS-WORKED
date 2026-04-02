import { useQuery } from '@tanstack/react-query';
import { floorOperationsCellsQueryOptions } from './queries';

export function useFloorOperationsCells(floorId: string | null) {
  return useQuery(floorOperationsCellsQueryOptions(floorId));
}
