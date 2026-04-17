import { useQuery } from '@tanstack/react-query';
import { locationEffectiveRoleQueryOptions } from './queries';

export function useLocationEffectiveRole(locationId: string | null, productId: string | null) {
  return useQuery(locationEffectiveRoleQueryOptions(locationId, productId));
}
