import { useQuery } from '@tanstack/react-query';
import { floorCellsByProductQueryOptions } from './queries';

export function useFloorCellsByProduct(floorId: string | null, productId: string | null) {
  return useQuery(floorCellsByProductQueryOptions(floorId, productId));
}
