import type { PlacementCommandResponse } from '@wos/domain';
import {
  ContainerAlreadyPlacedError,
  ContainerNotFoundError,
  PublishedLayoutNotFoundError,
  TargetCellNotFoundError
} from './errors.js';
import type { PlacementRepo } from './placement-repo.js';

export type PlaceContainerCommand = {
  tenantId: string;
  containerId: string;
  targetCellId: string;
  actorId?: string | null;
};

export async function placeContainer(
  repo: PlacementRepo,
  command: PlaceContainerCommand
): Promise<PlacementCommandResponse> {
  const container = await repo.resolveContainer(command.containerId, command.tenantId);
  if (!container) {
    throw new ContainerNotFoundError();
  }

  const targetCell = await repo.resolvePlaceTarget(command.targetCellId);
  if (!targetCell) {
    throw new TargetCellNotFoundError();
  }

  try {
    await repo.placeContainer(container.id, targetCell.id, command.actorId ?? null);
  } catch (error) {
    if (
      error instanceof ContainerNotFoundError ||
      error instanceof ContainerAlreadyPlacedError ||
      error instanceof PublishedLayoutNotFoundError ||
      error instanceof TargetCellNotFoundError
    ) {
      throw error;
    }

    throw error;
  }

  return {
    ok: true,
    containerId: command.containerId,
    targetCellId: command.targetCellId
  };
}
