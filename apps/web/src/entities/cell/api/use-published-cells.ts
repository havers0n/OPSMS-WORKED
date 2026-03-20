import { useQuery } from '@tanstack/react-query';
import { publishedCellsQueryOptions } from './queries';

export function usePublishedCells(floorId: string | null) {
  return useQuery(publishedCellsQueryOptions(floorId));
}
