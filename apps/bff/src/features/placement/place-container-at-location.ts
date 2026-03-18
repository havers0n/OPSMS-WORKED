import { ContainerNotFoundError } from './errors.js';
import type { PlacementRepo } from './placement-repo.js';

export type PlaceContainerAtLocationCommand = {
  tenantId: string;
  containerId: string;
  locationId: string;
  actorId?: string | null;
};

export type PlaceContainerAtLocationResult = {
  ok: boolean;
  containerId: string;
  locationId: string;
};

export async function placeContainerAtLocation(
  repo: PlacementRepo,
  command: PlaceContainerAtLocationCommand
): Promise<PlaceContainerAtLocationResult> {
  const container = await repo.resolveContainer(command.containerId, command.tenantId);
  if (!container) {
    throw new ContainerNotFoundError();
  }

  await repo.placeContainerAtLocation(container.id, command.locationId, command.actorId ?? null);

  return {
    ok: true,
    containerId: command.containerId,
    locationId: command.locationId
  };
}
