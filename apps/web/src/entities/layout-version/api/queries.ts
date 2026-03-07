import type { LayoutDraft } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const layoutVersionKeys = {
  all: ['layout-version'] as const,
  activeDraft: (floorId: string | null) => [...layoutVersionKeys.all, 'active-draft', floorId ?? 'none'] as const
};

async function fetchActiveLayoutDraft(floorId: string): Promise<LayoutDraft | null> {
  return bffRequest<LayoutDraft | null>(`/floors/${floorId}/layout-draft`);
}

export function activeLayoutDraftQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: layoutVersionKeys.activeDraft(floorId),
    queryFn: () => fetchActiveLayoutDraft(floorId as string),
    enabled: Boolean(floorId)
  });
}
