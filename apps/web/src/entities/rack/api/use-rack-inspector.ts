import { useQuery } from '@tanstack/react-query';
import { rackInspectorQueryOptions } from './queries';

export function useRackInspector(rackId: string | null) {
  return useQuery(rackInspectorQueryOptions(rackId));
}
