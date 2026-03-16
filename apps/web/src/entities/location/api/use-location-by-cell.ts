import { useQuery } from '@tanstack/react-query';
import { locationByCellQueryOptions } from './queries';

export function useLocationByCell(cellId: string | null) {
  return useQuery(locationByCellQueryOptions(cellId));
}
