import { useQuery } from '@tanstack/react-query';
import { locationContainersQueryOptions } from './queries';

export function useLocationContainers(locationId: string | null) {
  return useQuery(locationContainersQueryOptions(locationId));
}
