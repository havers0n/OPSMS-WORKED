import { useQuery } from '@tanstack/react-query';
import { floorLocationOccupancyQueryOptions } from './queries';

export function useFloorLocationOccupancy(floorId: string | null) {
  return useQuery(floorLocationOccupancyQueryOptions(floorId));
}
