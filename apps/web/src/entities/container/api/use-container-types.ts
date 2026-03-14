import { useQuery } from '@tanstack/react-query';
import { containerTypesQueryOptions } from './queries';

export function useContainerTypes() {
  return useQuery(containerTypesQueryOptions());
}
