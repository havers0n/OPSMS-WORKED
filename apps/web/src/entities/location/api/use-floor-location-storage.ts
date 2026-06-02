import { useQuery } from '@tanstack/react-query';
import { floorLocationStorageQueryOptions } from './queries';

export function useFloorLocationStorage(floorId: string | null) {
  return useQuery(floorLocationStorageQueryOptions(floorId));
}
