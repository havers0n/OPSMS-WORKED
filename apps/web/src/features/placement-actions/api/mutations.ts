import type { CanonicalMoveContainerResult, CanonicalSwapContainersResult, RemoveContainerResult } from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export async function placeContainer(input: { containerId: string; locationId: string }) {
  return bffRequest<{ ok: boolean; containerId: string; locationId: string }>(
    '/api/placement/place-at-location',
    { method: 'POST', body: JSON.stringify(input) }
  );
}

export async function removeContainer(input: { containerId: string }) {
  return bffRequest<RemoveContainerResult>(`/api/containers/${input.containerId}/remove`, {
    method: 'POST'
  });
}

export async function moveContainer(input: { containerId: string; targetLocationId: string }) {
  return bffRequest<CanonicalMoveContainerResult>(
    `/api/containers/${input.containerId}/move-to-location`,
    { method: 'POST', body: JSON.stringify({ targetLocationId: input.targetLocationId }) }
  );
}

export async function swapContainers(input: { sourceContainerId: string; targetContainerId: string }) {
  return bffRequest<CanonicalSwapContainersResult>(
    `/api/containers/${input.sourceContainerId}/swap`,
    { method: 'POST', body: JSON.stringify({ targetContainerId: input.targetContainerId }) }
  );
}
