import { useQuery } from '@tanstack/react-query';
import { activeLayoutDraftQueryOptions } from '@/entities/layout-version/api/queries';

export function useActiveLayoutDraft(floorId: string | null) {
  return useQuery(activeLayoutDraftQueryOptions(floorId));
}
