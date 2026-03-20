import { useQuery } from '@tanstack/react-query';
import { containerStorageQueryOptions } from './queries';

export function useContainerStorage(containerId: string | null) {
  return useQuery(containerStorageQueryOptions(containerId));
}
