import { useQuery } from '@tanstack/react-query';
import { floorCellOccupancyQueryOptions } from './queries';

export function useFloorCellOccupancy(floorId: string | null) {
  return useQuery(floorCellOccupancyQueryOptions(floorId));
}
