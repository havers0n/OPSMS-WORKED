import { useQuery } from '@tanstack/react-query';
import { activeLayoutDraftQueryOptions } from './queries';

export function useActiveLayoutDraft(floorId: string | null) {
  return useQuery(activeLayoutDraftQueryOptions(floorId));
}
