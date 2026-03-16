import { useQuery } from '@tanstack/react-query';
import { containerCurrentLocationQueryOptions } from './queries';

export function useContainerLocation(containerId: string | null) {
  return useQuery(containerCurrentLocationQueryOptions(containerId));
}
