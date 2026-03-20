import { useQuery } from '@tanstack/react-query';
import { floorsQueryOptions } from './queries';

export function useFloors(siteId: string | null) {
  return useQuery(floorsQueryOptions(siteId));
}
