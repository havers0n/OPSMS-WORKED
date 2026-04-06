import { useQuery } from '@tanstack/react-query';
import { floorNonRackLocationsQueryOptions } from './queries';

export function useFloorNonRackLocations(floorId: string | null) {
  return useQuery(floorNonRackLocationsQueryOptions(floorId));
}
