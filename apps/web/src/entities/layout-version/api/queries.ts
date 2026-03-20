import type { FloorWorkspace, LayoutDraft, PublishedLayoutSummary } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const layoutVersionKeys = {
  all: ['layout-version'] as const,
  activeDraft: (floorId: string | null) => [...layoutVersionKeys.all, 'active-draft', floorId ?? 'none'] as const,
  publishedSummary: (floorId: string | null) => [...layoutVersionKeys.all, 'published-summary', floorId ?? 'none'] as const,
  workspace: (floorId: string | null) => [...layoutVersionKeys.all, 'workspace', floorId ?? 'none'] as const
};

async function fetchActiveLayoutDraft(floorId: string): Promise<LayoutDraft | null> {
  return bffRequest<LayoutDraft | null>(`/floors/${floorId}/layout-draft`);
}

async function fetchFloorWorkspace(floorId: string): Promise<FloorWorkspace> {
  return bffRequest<FloorWorkspace>(`/floors/${floorId}/workspace`);
}

async function fetchPublishedLayoutSummary(floorId: string): Promise<PublishedLayoutSummary | null> {
  return bffRequest<PublishedLayoutSummary | null>(`/floors/${floorId}/published-layout`);
}

export function activeLayoutDraftQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: layoutVersionKeys.activeDraft(floorId),
    queryFn: () => fetchActiveLayoutDraft(floorId as string),
    enabled: Boolean(floorId)
  });
}

export function publishedLayoutSummaryQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: layoutVersionKeys.publishedSummary(floorId),
    queryFn: () => fetchPublishedLayoutSummary(floorId as string),
    enabled: Boolean(floorId)
  });
}

export function floorWorkspaceQueryOptions(floorId: string | null) {
  return queryOptions({
    queryKey: layoutVersionKeys.workspace(floorId),
    queryFn: () => fetchFloorWorkspace(floorId as string),
    enabled: Boolean(floorId)
  });
}
