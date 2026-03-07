import { useQuery } from '@tanstack/react-query';
import { sitesQueryOptions } from './queries';

export function useSites() {
  return useQuery(sitesQueryOptions());
}
