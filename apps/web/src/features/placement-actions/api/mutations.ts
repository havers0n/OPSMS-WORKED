import type {
  MoveContainerRequest,
  PlacementCommandResponse,
  PlaceContainerRequest,
  RemoveContainerRequest
} from '@wos/domain';
import { bffRequest } from '@/shared/api/bff/client';

export async function placeContainer(input: PlaceContainerRequest) {
  return bffRequest<PlacementCommandResponse>('/api/placement/place', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function removeContainer(input: RemoveContainerRequest) {
  return bffRequest<PlacementCommandResponse>('/api/placement/remove', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}

export async function moveContainer(input: MoveContainerRequest) {
  return bffRequest<PlacementCommandResponse>('/api/placement/move', {
    method: 'POST',
    body: JSON.stringify(input)
  });
}
