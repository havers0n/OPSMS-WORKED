import { useQuery } from '@tanstack/react-query';
import { publishedLayoutSummaryQueryOptions } from './queries';

export function usePublishedLayoutSummary(floorId: string | null) {
  return useQuery(publishedLayoutSummaryQueryOptions(floorId));
}
