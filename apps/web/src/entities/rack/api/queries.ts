import type { RackInspectorPayload } from '@wos/domain';
import { queryOptions } from '@tanstack/react-query';
import { bffRequest } from '@/shared/api/bff/client';

export const rackKeys = {
  all: ['rack'] as const,
  inspector: (rackId: string | null) =>
    [...rackKeys.all, 'inspector', rackId ?? 'none'] as const,
};

async function fetchRackInspector(rackId: string): Promise<RackInspectorPayload> {
  return bffRequest<RackInspectorPayload>(`/api/racks/${rackId}/inspector`);
}

export function rackInspectorQueryOptions(rackId: string | null) {
  return queryOptions({
    queryKey: rackKeys.inspector(rackId),
    queryFn: () => fetchRackInspector(rackId as string),
    enabled: Boolean(rackId),
    staleTime: 30_000,
  });
}
