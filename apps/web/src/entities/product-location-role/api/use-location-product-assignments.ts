import { useQuery } from '@tanstack/react-query';
import { locationProductAssignmentsQueryOptions } from './queries';

export function useLocationProductAssignments(locationId: string | null) {
  return useQuery(locationProductAssignmentsQueryOptions(locationId));
}
