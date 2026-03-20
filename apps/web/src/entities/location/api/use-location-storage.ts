import { useQuery } from '@tanstack/react-query';
import { locationStorageQueryOptions } from './queries';

export function useLocationStorage(locationId: string | null) {
  return useQuery(locationStorageQueryOptions(locationId));
}
